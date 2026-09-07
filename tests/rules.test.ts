/**
 * Firestore security rules tests.
 *
 * These are the highest-value tests in the project: firestore.rules is the real
 * authorization boundary. Everything in the client is advisory — a determined user
 * talks to Firestore directly, so what these rules permit is what is actually
 * permitted.
 *
 * The suite also pins the two defects that made the old rules unusable:
 *   - the file was duplicated end-to-end and could not compile, so nothing deployed;
 *   - a user could rewrite their own `permissions` array (only role/organizationId
 *     were protected) while the app treated that array as the source of truth.
 *
 * Requires the emulators. `npm test` starts them, runs this, and shuts them down.
 */
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';

const ORG = 'org-a';
const OTHER_ORG = 'org-b';

const ADMIN = { uid: 'admin-1', claims: { role: 'admin', organizationId: ORG } };
const COACH = { uid: 'coach-1', claims: { role: 'coach', organizationId: ORG } };
const OTHER_COACH = { uid: 'coach-2', claims: { role: 'coach', organizationId: ORG } };
const PARENT = { uid: 'parent-1', claims: { role: 'parent', organizationId: ORG } };
const OTHER_PARENT = { uid: 'parent-2', claims: { role: 'parent', organizationId: ORG } };
const FOREIGN_ADMIN = { uid: 'admin-9', claims: { role: 'admin', organizationId: OTHER_ORG } };

let testEnv: RulesTestEnvironment;

const ctx = (u: { uid: string; claims: Record<string, string> }) =>
  testEnv.authenticatedContext(u.uid, u.claims).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    // Set by tests/setup.ts -- deliberately NOT the project `npm run seed` fills.
    projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-laila-tov-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      // The dedicated test emulator (firebase.test.json), not the dev one on 8080.
      port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(':')[1] ?? 8090),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed through an admin context that bypasses rules, so setup cannot be blocked
  // by the very rules under test.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'users', PARENT.uid), {
      uid: PARENT.uid, email: 'p1@test.com', role: 'parent',
      organizationId: ORG, permissions: ['babies.read.assigned'],
      status: 'active', managedBabyProfiles: ['baby-1'],
    });
    await setDoc(doc(db, 'users', COACH.uid), {
      uid: COACH.uid, email: 'c1@test.com', role: 'coach',
      organizationId: ORG, permissions: ['babies.create'],
      status: 'active', managedBabyProfiles: ['baby-1'],
    });

    // baby-1: coach-1's, parent-1's.
    await setDoc(doc(db, 'baby_profiles', 'baby-1'), {
      id: 'baby-1', name: 'Baby One', organizationId: ORG,
      assignedCoachId: COACH.uid, parentIds: [PARENT.uid],
      status: 'active', createdBy: COACH.uid, familyName: 'Alpha',
    });

    // baby-2: a different family entirely.
    await setDoc(doc(db, 'baby_profiles', 'baby-2'), {
      id: 'baby-2', name: 'Baby Two', organizationId: ORG,
      assignedCoachId: OTHER_COACH.uid, parentIds: [OTHER_PARENT.uid],
      status: 'active', createdBy: OTHER_COACH.uid, familyName: 'Beta',
    });

    await setDoc(doc(db, 'baby_profiles', 'baby-1', 'sleep_records', 'rec-1'), {
      id: 'rec-1', date: '2026-01-01', sleepCycles: [],
    });
    await setDoc(doc(db, 'baby_profiles', 'baby-2', 'sleep_records', 'rec-2'), {
      id: 'rec-2', date: '2026-01-01', sleepCycles: [],
    });

    await setDoc(doc(db, 'invitations', 'inv-1'), {
      id: 'inv-1', invitationCode: 'CODE1234', email: 'new@test.com',
      role: 'parent', organizationId: ORG, status: 'pending', createdBy: COACH.uid,
    });

    await setDoc(doc(db, 'audit_logs', 'log-1'), {
      action: 'test', userId: COACH.uid, organizationId: ORG,
    });
  });
});

describe('baby profiles: family isolation', () => {
  it('a parent can read their own baby', async () => {
    await assertSucceeds(getDoc(doc(ctx(PARENT), 'baby_profiles', 'baby-1')));
  });

  it("a parent CANNOT read another family's baby", async () => {
    await assertFails(getDoc(doc(ctx(PARENT), 'baby_profiles', 'baby-2')));
  });

  it('a coach can read a baby assigned to them', async () => {
    await assertSucceeds(getDoc(doc(ctx(COACH), 'baby_profiles', 'baby-1')));
  });

  it('a coach CANNOT read a baby assigned to another coach', async () => {
    await assertFails(getDoc(doc(ctx(COACH), 'baby_profiles', 'baby-2')));
  });

  it('an admin can read any baby in their own organization', async () => {
    await assertSucceeds(getDoc(doc(ctx(ADMIN), 'baby_profiles', 'baby-1')));
  });

  it("an admin from another organization CANNOT read this org's baby", async () => {
    await assertFails(getDoc(doc(ctx(FOREIGN_ADMIN), 'baby_profiles', 'baby-1')));
  });

  it('a coach listing their own babies succeeds', async () => {
    const q = query(
      collection(ctx(COACH), 'baby_profiles'),
      where('assignedCoachId', '==', COACH.uid)
    );
    await assertSucceeds(getDocs(q));
  });

  it('an unconstrained list of all babies is refused', async () => {
    // Per-document evaluation means a query that could return another family's
    // baby fails as a whole, rather than silently filtering.
    await assertFails(getDocs(collection(ctx(COACH), 'baby_profiles')));
  });
});

describe('baby profiles: writes', () => {
  it('a coach can create a baby assigned to themselves', async () => {
    await assertSucceeds(
      setDoc(doc(ctx(COACH), 'baby_profiles', 'new-baby'), {
        id: 'new-baby', name: 'New', organizationId: ORG,
        assignedCoachId: COACH.uid, parentIds: [], status: 'active', createdBy: COACH.uid,
      })
    );
  });

  it('a coach CANNOT create a baby assigned to a different coach', async () => {
    await assertFails(
      setDoc(doc(ctx(COACH), 'baby_profiles', 'new-baby'), {
        id: 'new-baby', name: 'New', organizationId: ORG,
        assignedCoachId: OTHER_COACH.uid, parentIds: [], status: 'active', createdBy: COACH.uid,
      })
    );
  });

  it('a parent CANNOT create a baby profile', async () => {
    await assertFails(
      setDoc(doc(ctx(PARENT), 'baby_profiles', 'new-baby'), {
        id: 'new-baby', name: 'New', organizationId: ORG,
        assignedCoachId: COACH.uid, parentIds: [PARENT.uid], status: 'active', createdBy: PARENT.uid,
      })
    );
  });

  it('a coach can update coach notes on their own baby', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(COACH), 'baby_profiles', 'baby-1'), { coachNotes: 'updated' })
    );
  });

  it('a parent can touch activity timestamps (saving a sleep record does this)', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(PARENT), 'baby_profiles', 'baby-1'), { lastUpdatedAt: new Date() })
    );
  });

  it('a parent CANNOT edit coach notes', async () => {
    await assertFails(
      updateDoc(doc(ctx(PARENT), 'baby_profiles', 'baby-1'), { coachNotes: 'hacked' })
    );
  });

  it('a parent CANNOT add themselves to another family', async () => {
    await assertFails(
      updateDoc(doc(ctx(PARENT), 'baby_profiles', 'baby-2'), { parentIds: [PARENT.uid] })
    );
  });
});

describe('sleep records', () => {
  it('a parent can read and write records for their own baby', async () => {
    await assertSucceeds(getDoc(doc(ctx(PARENT), 'baby_profiles/baby-1/sleep_records', 'rec-1')));
    await assertSucceeds(
      setDoc(doc(ctx(PARENT), 'baby_profiles/baby-1/sleep_records', 'rec-new'), {
        id: 'rec-new', date: '2026-02-01', sleepCycles: [],
      })
    );
  });

  it("a parent CANNOT read another family's sleep records", async () => {
    await assertFails(getDoc(doc(ctx(PARENT), 'baby_profiles/baby-2/sleep_records', 'rec-2')));
  });

  it("a parent CANNOT write to another family's sleep records", async () => {
    await assertFails(
      setDoc(doc(ctx(PARENT), 'baby_profiles/baby-2/sleep_records', 'rec-evil'), {
        id: 'rec-evil', date: '2026-02-01', sleepCycles: [],
      })
    );
  });

  it('the assigned coach can read their baby records', async () => {
    await assertSucceeds(getDoc(doc(ctx(COACH), 'baby_profiles/baby-1/sleep_records', 'rec-1')));
  });

  it('an unassigned coach CANNOT read those records', async () => {
    await assertFails(getDoc(doc(ctx(OTHER_COACH), 'baby_profiles/baby-1/sleep_records', 'rec-1')));
  });
});

describe('users: privilege escalation', () => {
  it('a user can update their own display name', async () => {
    await assertSucceeds(
      updateDoc(doc(ctx(PARENT), 'users', PARENT.uid), { displayName: 'New Name' })
    );
  });

  it('a user CANNOT escalate their own permissions array', async () => {
    // The previous rules protected only role and organizationId, leaving `permissions`
    // writable — and the app read that array to decide what the user could do.
    await assertFails(
      updateDoc(doc(ctx(PARENT), 'users', PARENT.uid), {
        permissions: ['system.manage_roles', 'users.create'],
      })
    );
  });

  it('a user CANNOT change their own role', async () => {
    await assertFails(updateDoc(doc(ctx(PARENT), 'users', PARENT.uid), { role: 'admin' }));
  });

  it('a user CANNOT change their own organization', async () => {
    await assertFails(
      updateDoc(doc(ctx(PARENT), 'users', PARENT.uid), { organizationId: OTHER_ORG })
    );
  });

  it('a user CANNOT grant themselves access to another baby', async () => {
    await assertFails(
      updateDoc(doc(ctx(PARENT), 'users', PARENT.uid), { managedBabyProfiles: ['baby-2'] })
    );
  });

  it('nobody may create a user document from the client (server only)', async () => {
    await assertFails(
      setDoc(doc(ctx(ADMIN), 'users', 'brand-new'), {
        uid: 'brand-new', email: 'x@test.com', role: 'admin', organizationId: ORG,
      })
    );
  });
});

describe('invitations', () => {
  it('an admin can read invitations in their organization', async () => {
    await assertSucceeds(getDoc(doc(ctx(ADMIN), 'invitations', 'inv-1')));
  });

  it('the creating coach can read their own invitation', async () => {
    await assertSucceeds(getDoc(doc(ctx(COACH), 'invitations', 'inv-1')));
  });

  it('a coach CANNOT read an invitation created by someone else', async () => {
    await assertFails(getDoc(doc(ctx(OTHER_COACH), 'invitations', 'inv-1')));
  });

  it('a parent CANNOT read invitations', async () => {
    await assertFails(getDoc(doc(ctx(PARENT), 'invitations', 'inv-1')));
  });

  it('clients CANNOT write invitations directly (server only)', async () => {
    await assertFails(
      updateDoc(doc(ctx(ADMIN), 'invitations', 'inv-1'), { status: 'cancelled' })
    );
  });
});

describe('audit logs', () => {
  it('an admin can read audit logs', async () => {
    await assertSucceeds(getDoc(doc(ctx(ADMIN), 'audit_logs', 'log-1')));
  });

  it('a coach CANNOT read audit logs', async () => {
    await assertFails(getDoc(doc(ctx(COACH), 'audit_logs', 'log-1')));
  });

  it('nobody may write audit logs from the client', async () => {
    // An audit log the subject can edit is not an audit log. The server writes these
    // via the Admin SDK, which bypasses rules.
    await assertFails(
      setDoc(doc(ctx(ADMIN), 'audit_logs', 'forged'), { action: 'forged', userId: ADMIN.uid })
    );
  });
});

describe('unauthenticated and retired collections', () => {
  it('an unauthenticated visitor can read nothing', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'baby_profiles', 'baby-1')));
    await assertFails(getDoc(doc(anon, 'invitations', 'inv-1')));
    await assertFails(getDoc(doc(anon, 'users', PARENT.uid)));
  });

  it('a signed-in user with no role claim is refused', async () => {
    // Accounts created outside the registration flow have no claims.
    const noClaims = testEnv.authenticatedContext('stranger', {}).firestore();
    await assertFails(getDoc(doc(noClaims, 'baby_profiles', 'baby-1')));
  });

  it('retired collections are denied by the catch-all', async () => {
    for (const name of ['placeholder_users', 'logs', 'auditLogs', 'babies', 'invites']) {
      await assertFails(getDoc(doc(ctx(ADMIN), name, 'anything')));
    }
  });
});

describe('permission map', () => {
  it('stays in sync with what the rules allow', async () => {
    const { roleHasPermission } = await import('../src/lib/permissions');

    expect(roleHasPermission('coach', 'babies.create')).toBe(true);
    expect(roleHasPermission('parent', 'babies.create')).toBe(false);
    expect(roleHasPermission('parent', 'sleep_data.write.assigned')).toBe(true);
    expect(roleHasPermission('admin', 'system.manage_invitations')).toBe(true);
    expect(roleHasPermission('coach', 'system.manage_invitations')).toBe(true);
    expect(roleHasPermission('parent', 'system.manage_invitations')).toBe(false);

    // The old implementation returned false for everything, which is what blocked
    // baby creation and every sleep-data write.
    expect(roleHasPermission(undefined, 'babies.create')).toBe(false);
    expect(roleHasPermission('nonsense', 'babies.create')).toBe(false);
  });
});

/**
 * End-to-end tests for the server API routes, against the emulators.
 *
 * These exercise the flows that were structurally broken: registration used to delete
 * the account it had just created, a coach could not create a baby, no invitation code
 * was ever issued for one, and an admin could not cancel an invitation.
 *
 * The route handlers are invoked directly with real Request objects, so the auth
 * checks, validation and Firestore writes all run for real.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { adminAuth, adminDb } from '../src/lib/firebaseAdmin';
import { POST as registerRoute } from '../src/app/api/auth/register/route';
import { GET as validateRoute } from '../src/app/api/invitations/validate/route';
import { GET as listInvitationsRoute, POST as createInvitationRoute } from '../src/app/api/invitations/route';
import { POST as cancelInvitationRoute } from '../src/app/api/invitations/[id]/cancel/route';
import { POST as createBabyRoute } from '../src/app/api/babies/route';
import { POST as bootstrapRoute } from '../src/app/api/admin/bootstrap/route';

const ORG = 'test-org';
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-laila-tov-test';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099';

/**
 * Mint a usable ID token for a uid: create a custom token with the Admin SDK, then
 * exchange it at the Auth emulator. The resulting token carries the user's custom
 * claims, which is exactly what requireAuth reads.
 */
async function idTokenFor(uid: string): Promise<string> {
  const customToken = await adminAuth.createCustomToken(uid);
  const response = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const body = await response.json();
  if (!body.idToken) throw new Error(`Token exchange failed: ${JSON.stringify(body)}`);
  return body.idToken as string;
}

async function makeUser(
  uid: string,
  role: 'admin' | 'coach' | 'parent',
  email: string
): Promise<string> {
  await adminAuth.createUser({ uid, email, password: 'Password123!' }).catch(async () => {
    await adminAuth.updateUser(uid, { email });
  });
  await adminAuth.setCustomUserClaims(uid, { role, organizationId: ORG });
  await adminDb.collection('users').doc(uid).set({
    uid,
    email,
    role,
    organizationId: ORG,
    status: 'active',
    managedBabyProfiles: [],
  });
  return idTokenFor(uid);
}

function post(url: string, body: unknown, token?: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function get(url: string, token?: string): Request {
  return new Request(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/** Remove everything the emulator holds, so each test starts clean. */
async function clearEmulator(): Promise<void> {
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  await fetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

let coachToken: string;
let adminToken: string;
const COACH_UID = 'coach-uid';
const ADMIN_UID = 'admin-uid';

beforeAll(async () => {
  await clearEmulator();
});

beforeEach(async () => {
  await clearEmulator();
  adminToken = await makeUser(ADMIN_UID, 'admin', 'admin@test.com');
  coachToken = await makeUser(COACH_UID, 'coach', 'coach@test.com');
  await adminDb.collection('organizations').doc(ORG).set({ id: ORG, name: 'Test Org', isActive: true });
});

describe('auth: registration', () => {
  it('redeems an invitation, creates the account, and sets custom claims', async () => {
    const created = await createInvitationRoute(
      post('http://localhost/api/invitations', { email: 'newcoach@test.com', role: 'coach' }, adminToken)
    );
    const { invitationCode } = await created.json();
    expect(invitationCode).toMatch(/^[A-Z0-9]{8}$/);

    const response = await registerRoute(
      post('http://localhost/api/auth/register', {
        email: 'newcoach@test.com',
        password: 'Password123!',
        displayName: 'New Coach',
        invitationCode,
      })
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.role).toBe('coach');
    expect(result.redirectPath).toBe('/coach/dashboard');

    // The claims are the whole point: rules and API routes read them, and the old
    // client-side flow could not set them at all.
    const user = await adminAuth.getUser(result.uid);
    expect(user.customClaims).toMatchObject({ role: 'coach', organizationId: ORG });

    // The account must still exist. The previous implementation deleted it on the
    // way out of a failed Firestore write, so every registration rolled itself back.
    const userDoc = await adminDb.collection('users').doc(result.uid).get();
    expect(userDoc.exists).toBe(true);
    expect(userDoc.data()?.role).toBe('coach');

    const invitations = await adminDb
      .collection('invitations')
      .where('invitationCode', '==', invitationCode)
      .get();
    expect(invitations.docs[0].data().status).toBe('accepted');
  });

  it('links a parent to the baby their invitation names', async () => {
    const babyResponse = await createBabyRoute(
      post('http://localhost/api/babies', {
        name: 'Test Baby', familyName: 'Family', age: 6, parentEmail1: 'parent@test.com',
      }, coachToken)
    );
    const { id: babyId, invitationCode } = await babyResponse.json();
    expect(invitationCode).toBeTruthy();

    const response = await registerRoute(
      post('http://localhost/api/auth/register', {
        email: 'parent@test.com',
        password: 'Password123!',
        displayName: 'A Parent',
        invitationCode,
      })
    );
    const result = await response.json();
    expect(result.redirectPath).toBe(`/parent/${babyId}`);

    const baby = await adminDb.collection('baby_profiles').doc(babyId).get();
    expect(baby.data()?.parentIds).toContain(result.uid);
  });

  it('rejects an unknown code without creating an account', async () => {
    const response = await registerRoute(
      post('http://localhost/api/auth/register', {
        email: 'nobody@test.com',
        password: 'Password123!',
        displayName: 'Nobody',
        invitationCode: 'BADCODE1',
      })
    );
    expect(response.status).toBe(400);
    await expect(adminAuth.getUserByEmail('nobody@test.com')).rejects.toThrow();
  });

  it('rejects a code issued to a different email address', async () => {
    const created = await createInvitationRoute(
      post('http://localhost/api/invitations', { email: 'intended@test.com', role: 'coach' }, adminToken)
    );
    const { invitationCode } = await created.json();

    const response = await registerRoute(
      post('http://localhost/api/auth/register', {
        email: 'someone.else@test.com',
        password: 'Password123!',
        displayName: 'Interloper',
        invitationCode,
      })
    );
    expect(response.status).toBe(400);
  });

  it('refuses to reuse an already-redeemed code', async () => {
    const created = await createInvitationRoute(
      post('http://localhost/api/invitations', { email: 'once@test.com', role: 'coach' }, adminToken)
    );
    const { invitationCode } = await created.json();

    const body = {
      email: 'once@test.com', password: 'Password123!',
      displayName: 'First', invitationCode,
    };
    expect((await registerRoute(post('http://localhost/api/auth/register', body))).status).toBe(200);
    expect((await registerRoute(post('http://localhost/api/auth/register', body))).status).toBe(400);
  });
});

describe('invitations: validation endpoint', () => {
  it('validates a good code for an unauthenticated visitor', async () => {
    const created = await createInvitationRoute(
      post('http://localhost/api/invitations', { email: 'visitor@test.com', role: 'coach' }, adminToken)
    );
    const { invitationCode } = await created.json();

    // No token: this is the signup page, before any account exists. The old
    // client-side check read Firestore directly and was always denied.
    const response = await validateRoute(
      get(`http://localhost/api/invitations/validate?code=${invitationCode}&email=visitor@test.com`)
    );
    const result = await response.json();
    expect(result.valid).toBe(true);
    expect(result.role).toBe('coach');
  });

  it('reports an unknown code as invalid rather than erroring', async () => {
    const response = await validateRoute(
      get('http://localhost/api/invitations/validate?code=NOSUCH12')
    );
    expect((await response.json()).valid).toBe(false);
  });

  it('rejects an expired code', async () => {
    const past = new Date(Date.now() - 1000);
    await adminDb.collection('invitations').doc('expired').set({
      id: 'expired', invitationCode: 'EXPIRED1', email: 'x@test.com', role: 'parent',
      organizationId: ORG, status: 'pending', createdBy: ADMIN_UID,
      createdAt: new Date(), expiresAt: past, metadata: {}, history: [],
    });

    const response = await validateRoute(
      get('http://localhost/api/invitations/validate?code=EXPIRED1')
    );
    expect((await response.json()).valid).toBe(false);
  });
});

describe('invitations: authorization', () => {
  it('refuses an unauthenticated create', async () => {
    const response = await createInvitationRoute(
      post('http://localhost/api/invitations', { email: 'x@test.com', role: 'coach' })
    );
    expect(response.status).toBe(401);
  });

  it('refuses a parent creating an invitation', async () => {
    const parentToken = await makeUser('parent-uid', 'parent', 'p@test.com');
    const response = await createInvitationRoute(
      post('http://localhost/api/invitations', { email: 'x@test.com', role: 'parent' }, parentToken)
    );
    expect(response.status).toBe(403);
  });

  it('refuses a coach inviting another coach', async () => {
    // A coach may onboard parents, not peers -- that is an admin decision.
    const response = await createInvitationRoute(
      post('http://localhost/api/invitations', { email: 'x@test.com', role: 'coach' }, coachToken)
    );
    expect(response.status).toBe(403);
  });

  it('refuses a coach issuing a parent invitation for another coach\'s baby', async () => {
    const otherCoachToken = await makeUser('coach-2', 'coach', 'c2@test.com');
    const babyResponse = await createBabyRoute(
      post('http://localhost/api/babies', { name: 'Theirs', familyName: 'Other', age: 3 }, otherCoachToken)
    );
    const { id: babyId } = await babyResponse.json();

    const response = await createInvitationRoute(
      post('http://localhost/api/invitations',
        { email: 'x@test.com', role: 'parent', babyProfileId: babyId }, coachToken)
    );
    expect(response.status).toBe(403);
  });

  it('rejects a duplicate pending invitation for the same address', async () => {
    const body = { email: 'dupe@test.com', role: 'coach' };
    expect((await createInvitationRoute(post('http://localhost/api/invitations', body, adminToken))).status).toBe(200);
    expect((await createInvitationRoute(post('http://localhost/api/invitations', body, adminToken))).status).toBe(409);
  });
});

describe('invitations: cancellation', () => {
  it('lets an admin cancel a pending invitation', async () => {
    const created = await createInvitationRoute(
      post('http://localhost/api/invitations', { email: 'cancelme@test.com', role: 'coach' }, adminToken)
    );
    const { id } = await created.json();

    const response = await cancelInvitationRoute(
      post(`http://localhost/api/invitations/${id}/cancel`, {}, adminToken),
      { params: Promise.resolve({ id }) }
    );
    expect(response.status).toBe(200);

    const doc = await adminDb.collection('invitations').doc(id).get();
    expect(doc.data()?.status).toBe('cancelled');
    // Soft cancel: the history survives for the audit trail.
    expect(doc.data()?.history).toHaveLength(2);
  });

  it("refuses a coach cancelling someone else's invitation", async () => {
    const created = await createInvitationRoute(
      post('http://localhost/api/invitations', { email: 'admins@test.com', role: 'coach' }, adminToken)
    );
    const { id } = await created.json();

    const response = await cancelInvitationRoute(
      post(`http://localhost/api/invitations/${id}/cancel`, {}, coachToken),
      { params: Promise.resolve({ id }) }
    );
    expect(response.status).toBe(403);
  });

  it('cannot cancel an invitation that was already redeemed', async () => {
    const created = await createInvitationRoute(
      post('http://localhost/api/invitations', { email: 'used@test.com', role: 'coach' }, adminToken)
    );
    const { id, invitationCode } = await created.json();

    await registerRoute(post('http://localhost/api/auth/register', {
      email: 'used@test.com', password: 'Password123!',
      displayName: 'Used', invitationCode,
    }));

    const response = await cancelInvitationRoute(
      post(`http://localhost/api/invitations/${id}/cancel`, {}, adminToken),
      { params: Promise.resolve({ id }) }
    );
    expect(response.status).toBe(409);
  });
});

describe('babies', () => {
  it('creates a profile and issues a parent invitation code', async () => {
    // The form promises "צור פרופיל וקוד הזמנה". The old code hardcoded inviteCode
    // to '' and discarded the parent emails, so no code was ever created.
    const response = await createBabyRoute(
      post('http://localhost/api/babies', {
        name: 'Noam', familyName: 'Cohen', age: 8,
        motherName: 'Michal', parentEmail1: 'mum@test.com',
      }, coachToken)
    );
    expect(response.status).toBe(200);
    const { id, invitationCode } = await response.json();
    expect(invitationCode).toMatch(/^[A-Z0-9]{8}$/);

    const baby = await adminDb.collection('baby_profiles').doc(id).get();
    expect(baby.data()?.assignedCoachId).toBe(COACH_UID);
    expect(baby.data()?.inviteCode).toBe(invitationCode);

    // The coach's own record is updated so the dashboard can find it.
    const coach = await adminDb.collection('users').doc(COACH_UID).get();
    expect(coach.data()?.managedBabyProfiles).toContain(id);
  });

  it('issues separate codes for two parents', async () => {
    const response = await createBabyRoute(
      post('http://localhost/api/babies', {
        name: 'Twin', familyName: 'Levi', age: 4,
        parentEmail1: 'mum2@test.com', parentEmail2: 'dad2@test.com',
      }, coachToken)
    );
    const { invitationCode, secondInvitationCode } = await response.json();
    expect(invitationCode).toBeTruthy();
    expect(secondInvitationCode).toBeTruthy();
    expect(invitationCode).not.toBe(secondInvitationCode);
  });

  it('creates a profile without a code when no parent email is given', async () => {
    const response = await createBabyRoute(
      post('http://localhost/api/babies', { name: 'Solo', familyName: 'Nobody', age: 2 }, coachToken)
    );
    expect((await response.json()).invitationCode).toBeNull();
  });

  it('refuses a parent creating a baby profile', async () => {
    const parentToken = await makeUser('parent-2', 'parent', 'p2@test.com');
    const response = await createBabyRoute(
      post('http://localhost/api/babies', { name: 'X', familyName: 'Y', age: 1 }, parentToken)
    );
    expect(response.status).toBe(403);
  });

  it('rejects an out-of-range age', async () => {
    const response = await createBabyRoute(
      post('http://localhost/api/babies', { name: 'X', familyName: 'Y', age: 999 }, coachToken)
    );
    expect(response.status).toBe(400);
  });
});

describe('invitation listing', () => {
  it('shows an admin the whole organization but a coach only their own', async () => {
    await createInvitationRoute(
      post('http://localhost/api/invitations', { email: 'a@test.com', role: 'coach' }, adminToken)
    );
    const baby = await createBabyRoute(
      post('http://localhost/api/babies', { name: 'B', familyName: 'C', age: 5 }, coachToken)
    );
    const { id: babyId } = await baby.json();
    await createInvitationRoute(
      post('http://localhost/api/invitations',
        { email: 'b@test.com', role: 'parent', babyProfileId: babyId }, coachToken)
    );

    const adminList = await (await listInvitationsRoute(get('http://localhost/api/invitations', adminToken))).json();
    expect(adminList.invitations).toHaveLength(2);

    const coachList = await (await listInvitationsRoute(get('http://localhost/api/invitations', coachToken))).json();
    expect(coachList.invitations).toHaveLength(1);
    expect(coachList.invitations[0].email).toBe('b@test.com');
  });
});

describe('bootstrap', () => {
  it('refuses the wrong secret', async () => {
    await clearEmulator();
    const response = await bootstrapRoute(
      post('http://localhost/api/admin/bootstrap', {
        secret: 'wrong-secret-of-same-length!!', email: 'a@test.com',
        password: 'Password123!', displayName: 'A', organizationName: 'Org',
      })
    );
    expect(response.status).toBe(403);
  });

  it('creates the first admin, then refuses to run again', async () => {
    await clearEmulator();
    const body = {
      secret: process.env.ADMIN_BOOTSTRAP_SECRET,
      email: 'first@test.com', password: 'Password123!',
      displayName: 'First Admin', organizationName: 'First Org',
    };

    const first = await bootstrapRoute(post('http://localhost/api/admin/bootstrap', body));
    expect(first.status).toBe(200);
    const { uid } = await first.json();
    expect((await adminAuth.getUser(uid)).customClaims).toMatchObject({ role: 'admin' });

    // Not a back door for minting extra admins.
    const second = await bootstrapRoute(
      post('http://localhost/api/admin/bootstrap', { ...body, email: 'second@test.com' })
    );
    expect(second.status).toBe(409);
  });
});

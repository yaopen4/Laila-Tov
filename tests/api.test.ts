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
import { DELETE as deleteBabyRoute, PATCH as updateBabyRoute } from '../src/app/api/babies/[id]/route';
import { POST as archiveBabyRoute } from '../src/app/api/babies/[id]/archive/route';
import { POST as createSleepRecordRoute } from '../src/app/api/babies/[id]/sleep-records/route';
import {
  DELETE as deleteSleepRecordRoute,
  PATCH as updateSleepRecordRoute,
} from '../src/app/api/babies/[id]/sleep-records/[recordId]/route';
import { POST as bootstrapRoute } from '../src/app/api/admin/bootstrap/route';
import { __resetRateLimits, LIMITS } from '../src/lib/server/rateLimit';
import { DELETE as deleteSessionRoute, POST as createSessionRoute } from '../src/app/api/auth/session/route';
import { GET as healthRoute } from '../src/app/api/health/route';
import { SESSION_COOKIE, verifySessionCookie } from '../src/lib/session';

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
  __resetRateLimits();
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

describe('rate limiting', () => {
  it('refuses further validation attempts once the budget is spent', async () => {
    const url = 'http://localhost/api/invitations/validate?code=NOSUCH12';

    // Spend the whole budget. These are legitimate-shaped requests; only the rate
    // should stop them.
    for (let i = 0; i < LIMITS.validateInvitation.limit; i++) {
      const ok = await validateRoute(get(url));
      expect(ok.status).toBe(200);
    }

    const blocked = await validateRoute(get(url));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error).toContain('יותר מדי בקשות');
  });

  it('counts each client IP separately', async () => {
    const url = 'http://localhost/api/invitations/validate?code=NOSUCH12';
    const from = (ip: string) => new Request(url, { headers: { 'x-forwarded-for': ip } });

    for (let i = 0; i < LIMITS.validateInvitation.limit; i++) {
      await validateRoute(from('203.0.113.1'));
    }
    expect((await validateRoute(from('203.0.113.1'))).status).toBe(429);

    // A different caller is unaffected by the first one's spending.
    expect((await validateRoute(from('203.0.113.2'))).status).toBe(200);
  });

  it('limits registration attempts', async () => {
    const body = {
      email: 'ratelimit@test.com', password: 'Password123!',
      displayName: 'RL', invitationCode: 'BADCODE1',
    };

    for (let i = 0; i < LIMITS.register.limit; i++) {
      const res = await registerRoute(post('http://localhost/api/auth/register', body));
      expect(res.status).toBe(400);   // bad code, but not rate limited yet
    }

    expect((await registerRoute(post('http://localhost/api/auth/register', body))).status).toBe(429);
  });
});

describe('auth: session cookie', () => {
  function cookieFrom(response: Response): string {
    const header = response.headers.get('set-cookie') ?? '';
    const match = new RegExp(`${SESSION_COOKIE}=([^;]*)`).exec(header);
    return match?.[1] ?? '';
  }

  it('exchanges a fresh ID token for an httpOnly cookie carrying the role', async () => {
    const response = await createSessionRoute(
      post('http://localhost/api/auth/session', { idToken: coachToken })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/i);

    // The emulator signs nothing, so verify the way middleware does in emulator mode.
    const session = await verifySessionCookie(cookieFrom(response), {
      projectId: PROJECT,
      allowUnsigned: true,
    });
    expect(session).toEqual({ uid: COACH_UID, role: 'coach', organizationId: ORG });
  });

  it('refuses a cross-site text/plain form post (login CSRF)', async () => {
    const response = await createSessionRoute(
      new Request('http://localhost/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ idToken: coachToken }),
      })
    );
    expect(response.status).toBe(415);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects a garbage token', async () => {
    const response = await createSessionRoute(
      post('http://localhost/api/auth/session', { idToken: 'not-a-token' })
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('refuses an account without role claims', async () => {
    await adminAuth.createUser({ uid: 'noclaims', email: 'noclaims@test.com', password: 'Password123!' });
    const token = await idTokenFor('noclaims');
    const response = await createSessionRoute(post('http://localhost/api/auth/session', { idToken: token }));
    expect(response.status).toBe(403);
  });

  it('clears the cookie on sign-out', async () => {
    const response = await deleteSessionRoute();
    expect(response.headers.get('set-cookie')).toMatch(new RegExp(`${SESSION_COOKIE}=;.*Max-Age=0`, 'i'));
  });
});

describe('babies and sleep records: audited server-side writes (#4)', () => {
  const BABY = 'baby-api';
  const RECORD = { date: '2026-03-01', sleepCycles: [{ bedtime: '19:30', timeToSleep: '10 דקות', whoPutToSleep: 'אמא', howFellAsleep: 'הנקה', wakeTime: '06:15' }] };
  let parentToken: string;
  let strangerParentToken: string;
  let otherCoachToken: string;

  const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
  function req(method: string, url: string, token: string | undefined, body?: unknown): Request {
    return new Request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function auditActions(): Promise<string[]> {
    const snap = await adminDb.collection('audit_logs').get();
    return snap.docs.map((d) => d.data().action as string);
  }

  beforeEach(async () => {
    parentToken = await makeUser('parent-uid', 'parent', 'parent@test.com');
    strangerParentToken = await makeUser('stranger-uid', 'parent', 'stranger@test.com');
    otherCoachToken = await makeUser('coach-2', 'coach', 'coach2@test.com');
    await adminDb.collection('baby_profiles').doc(BABY).set({
      id: BABY, name: 'Noam', familyName: 'Cohen', organizationId: ORG,
      assignedCoachId: COACH_UID, parentIds: ['parent-uid'], status: 'active',
      createdBy: COACH_UID, coachNotes: 'old',
    });
  });

  it('a parent logs, edits and deletes a record for their own baby, each audited', async () => {
    const created = await createSleepRecordRoute(
      req('POST', 'http://localhost/x', parentToken, RECORD), params({ id: BABY })
    );
    expect(created.status).toBe(201);
    const { id } = await created.json();

    const stored = (await adminDb.doc(`baby_profiles/${BABY}/sleep_records/${id}`).get()).data();
    expect(stored).toMatchObject({ date: '2026-03-01', createdBy: 'parent-uid' });
    expect(stored?.sleepCycles[0]).toMatchObject({ bedtime: '19:30', wakeTime: '06:15' });

    const updated = await updateSleepRecordRoute(
      req('PATCH', 'http://localhost/x', parentToken, { ...RECORD, date: '2026-03-02' }),
      params({ id: BABY, recordId: id })
    );
    expect(updated.status).toBe(200);
    expect((await adminDb.doc(`baby_profiles/${BABY}/sleep_records/${id}`).get()).data()?.date).toBe('2026-03-02');

    const deleted = await deleteSleepRecordRoute(
      req('DELETE', 'http://localhost/x', parentToken), params({ id: BABY, recordId: id })
    );
    expect(deleted.status).toBe(200);
    expect((await adminDb.doc(`baby_profiles/${BABY}/sleep_records/${id}`).get()).exists).toBe(false);

    expect(await auditActions()).toEqual(
      expect.arrayContaining(['sleep_record_created', 'sleep_record_updated', 'sleep_record_deleted'])
    );
  });

  it("another family's parent and an unassigned coach are refused", async () => {
    for (const token of [strangerParentToken, otherCoachToken]) {
      const res = await createSleepRecordRoute(
        req('POST', 'http://localhost/x', token, RECORD), params({ id: BABY })
      );
      expect(res.status).toBe(403);
    }
    const unauthenticated = await createSleepRecordRoute(
      req('POST', 'http://localhost/x', undefined, RECORD), params({ id: BABY })
    );
    expect(unauthenticated.status).toBe(401);
    expect((await adminDb.collection(`baby_profiles/${BABY}/sleep_records`).get()).size).toBe(0);
  });

  it('rejects malformed records', async () => {
    const bad = [
      { ...RECORD, date: '01/03/2026' },
      { ...RECORD, date: { seconds: 1 } },
      { ...RECORD, sleepCycles: [] },
      { ...RECORD, sleepCycles: [{ bedtime: '25:00' }] },
      { ...RECORD, sleepCycles: [{ bedtime: '19:00', howFellAsleep: 'x'.repeat(501) }] },
    ];
    for (const body of bad) {
      const res = await createSleepRecordRoute(
        req('POST', 'http://localhost/x', parentToken, body), params({ id: BABY })
      );
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
  });

  it('a record id from another baby is not reachable through this one', async () => {
    await adminDb.collection('baby_profiles').doc('other-baby').set({
      id: 'other-baby', organizationId: ORG, assignedCoachId: 'coach-2', parentIds: ['stranger-uid'],
    });
    await adminDb.doc('baby_profiles/other-baby/sleep_records/r1').set({ id: 'r1', date: '2026-01-01' });
    const res = await deleteSleepRecordRoute(
      req('DELETE', 'http://localhost/x', parentToken), params({ id: BABY, recordId: 'r1' })
    );
    expect(res.status).toBe(404);
    expect((await adminDb.doc('baby_profiles/other-baby/sleep_records/r1').get()).exists).toBe(true);
  });

  it('the assigned coach edits only descriptive fields; access fields are ignored', async () => {
    const res = await updateBabyRoute(
      req('PATCH', 'http://localhost/x', coachToken, {
        coachNotes: 'new notes', age: 7,
        parentIds: ['stranger-uid'], assignedCoachId: 'coach-2', organizationId: 'evil',
      }),
      params({ id: BABY })
    );
    expect(res.status).toBe(200);
    const baby = (await adminDb.doc(`baby_profiles/${BABY}`).get()).data();
    expect(baby).toMatchObject({
      coachNotes: 'new notes', age: 7,
      parentIds: ['parent-uid'], assignedCoachId: COACH_UID, organizationId: ORG,
    });
    expect(await auditActions()).toContain('baby_profile_updated');
  });

  it('parents and other coaches cannot edit or archive a profile', async () => {
    for (const token of [parentToken, otherCoachToken]) {
      const edit = await updateBabyRoute(
        req('PATCH', 'http://localhost/x', token, { coachNotes: 'x' }), params({ id: BABY })
      );
      expect(edit.status).toBe(403);
      const archive = await archiveBabyRoute(
        req('POST', 'http://localhost/x', token, { archived: true }), params({ id: BABY })
      );
      expect(archive.status).toBe(403);
    }
    expect((await adminDb.doc(`baby_profiles/${BABY}`).get()).data()?.coachNotes).toBe('old');
  });

  it('the coach archives and restores, both audited', async () => {
    const archive = await archiveBabyRoute(
      req('POST', 'http://localhost/x', coachToken, { archived: true }), params({ id: BABY })
    );
    expect(archive.status).toBe(200);
    expect((await adminDb.doc(`baby_profiles/${BABY}`).get()).data()).toMatchObject({
      status: 'archived', isArchived: true,
    });

    await archiveBabyRoute(
      req('POST', 'http://localhost/x', coachToken, { archived: false }), params({ id: BABY })
    );
    expect((await adminDb.doc(`baby_profiles/${BABY}`).get()).data()).toMatchObject({
      status: 'active', isArchived: false, dateArchived: null,
    });
    expect(await auditActions()).toEqual(
      expect.arrayContaining(['baby_profile_archived', 'baby_profile_restored'])
    );
  });

  it('only an admin deletes, and the sleep records go with the profile', async () => {
    await adminDb.doc(`baby_profiles/${BABY}/sleep_records/r1`).set({ id: 'r1' });

    const byCoach = await deleteBabyRoute(req('DELETE', 'http://localhost/x', coachToken), params({ id: BABY }));
    expect(byCoach.status).toBe(403);

    const byAdmin = await deleteBabyRoute(req('DELETE', 'http://localhost/x', adminToken), params({ id: BABY }));
    expect(byAdmin.status).toBe(200);
    expect((await adminDb.doc(`baby_profiles/${BABY}`).get()).exists).toBe(false);
    expect((await adminDb.doc(`baby_profiles/${BABY}/sleep_records/r1`).get()).exists).toBe(false);
    expect(await auditActions()).toContain('baby_profile_deleted');

  });

  it('deleting a baby does not create user documents for missing users', async () => {
    await adminDb.doc(`baby_profiles/${BABY}`).update({ parentIds: ['parent-uid', 'ghost-uid'] });
    const res = await deleteBabyRoute(req('DELETE', 'http://localhost/x', adminToken), params({ id: BABY }));
    expect(res.status).toBe(200);
    expect((await adminDb.doc('users/ghost-uid').get()).exists).toBe(false);
    expect((await adminDb.doc(`users/${COACH_UID}`).get()).data()?.managedBabyProfiles).toEqual([]);
  });

  it('an admin from another organization cannot touch this baby', async () => {
    await adminAuth.createUser({ uid: 'foreign-admin', email: 'fa@test.com', password: 'Password123!' });
    await adminAuth.setCustomUserClaims('foreign-admin', { role: 'admin', organizationId: 'other-org' });
    const token = await idTokenFor('foreign-admin');
    const res = await deleteBabyRoute(req('DELETE', 'http://localhost/x', token), params({ id: BABY }));
    expect(res.status).toBe(403);
  });
});

describe('health', () => {
  it('reports ok when Firestore and Auth are reachable, without leaking details', async () => {
    const response = await healthRoute(new Request('http://localhost/api/health'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: 'ok', checks: { firestore: 'ok', auth: 'ok' } });
    expect(Object.keys(body).sort()).toEqual(['checks', 'emulators', 'status', 'version']);
  });
});

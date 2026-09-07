/**
 * Seed the local emulator with a usable demo dataset.
 *
 * Without this there is nothing to log into: accounts can only be created by redeeming
 * an invitation, and invitations can only be issued by an admin who does not yet exist.
 *
 * Run:  npm run emulators   (in one terminal)
 *       npm run seed        (in another)
 *
 * Refuses to run against anything but the emulator - it creates accounts with known
 * passwords, which must never touch a real project.
 */
import { config } from 'dotenv';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

config({ path: '.env.local' });

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-laila-tov';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error(
    'Refusing to seed: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must be set.\n' +
      'This script creates accounts with well-known passwords and is emulator-only.\n' +
      'Copy .env.example to .env.local and start the emulators first.'
  );
  process.exit(1);
}

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });

const auth = getAuth();
const db = getFirestore();

const PASSWORD = 'Password123!';
const ORG_ID = 'demo-org';

const ADMIN_PERMISSIONS = [
  'users.create', 'users.read.all', 'users.update.all', 'users.deactivate',
  'babies.create', 'babies.read.all', 'babies.read.assigned', 'babies.update.assigned',
  'babies.archive', 'sleep_data.read.all', 'sleep_data.read.assigned',
  'sleep_data.write.assigned', 'reports.generate.all', 'reports.generate.assigned',
  'reports.export', 'system.manage_roles', 'system.manage_organization',
  'system.view_audit_logs', 'system.manage_invitations',
];
const COACH_PERMISSIONS = [
  'users.read.assigned', 'babies.create', 'babies.read.assigned',
  'babies.update.assigned', 'babies.archive', 'sleep_data.read.assigned',
  'sleep_data.write.assigned', 'reports.generate.assigned', 'reports.export',
  'system.manage_invitations',
];
const PARENT_PERMISSIONS = [
  'babies.read.assigned', 'sleep_data.read.assigned',
  'sleep_data.write.assigned', 'reports.generate.assigned',
];

type Role = 'admin' | 'coach' | 'parent';

async function upsertUser(opts: {
  email: string;
  displayName: string;
  role: Role;
  permissions: string[];
  managedBabyProfiles?: string[];
  assignedCoachId?: string;
}): Promise<string> {
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(opts.email);
    uid = existing.uid;
    await auth.updateUser(uid, { password: PASSWORD, displayName: opts.displayName });
  } catch {
    const created = await auth.createUser({
      email: opts.email,
      password: PASSWORD,
      displayName: opts.displayName,
    });
    uid = created.uid;
  }

  // The claims are what firestore.rules and the API routes actually authorize against.
  await auth.setCustomUserClaims(uid, { role: opts.role, organizationId: ORG_ID });

  const now = Timestamp.now();
  await db.collection('users').doc(uid).set({
    uid,
    email: opts.email,
    emailVerified: true,
    displayName: opts.displayName,
    role: opts.role,
    organizationId: ORG_ID,
    permissions: opts.permissions,
    status: 'active',
    managedBabyProfiles: opts.managedBabyProfiles ?? [],
    ...(opts.assignedCoachId ? { assignedCoachId: opts.assignedCoachId } : {}),
    createdAt: now,
    lastLoginAt: now,
    invitationAcceptedAt: now,
    originalInvitationId: 'seed',
    preferences: {
      language: 'he',
      timezone: 'Asia/Jerusalem',
      notifications: { email: true, push: false, reminders: true },
    },
  });

  return uid;
}

async function main() {
  console.log(`Seeding project "${PROJECT_ID}" via emulators...\n`);

  await db.collection('organizations').doc(ORG_ID).set({
    id: ORG_ID,
    name: 'מרפאת שינה לדוגמה',
    type: 'independent',
    settings: {
      defaultInvitationExpiry: 30,
      maxCoaches: 50,
      maxBabyProfilesPerCoach: 100,
      allowParentInvitations: true,
    },
    createdAt: Timestamp.now(),
    ownerId: 'pending',
    isActive: true,
  });

  const adminUid = await upsertUser({
    email: 'admin@lailatov.test',
    displayName: 'מנהלת המערכת',
    role: 'admin',
    permissions: ADMIN_PERMISSIONS,
  });
  await db.collection('organizations').doc(ORG_ID).update({ ownerId: adminUid });

  const coachUid = await upsertUser({
    email: 'coach@lailatov.test',
    displayName: 'יועצת שינה',
    role: 'coach',
    permissions: COACH_PERMISSIONS,
  });

  // A baby, owned by the coach above.
  const babyRef = db.collection('baby_profiles').doc('demo-baby');
  const dob = new Date();
  dob.setMonth(dob.getMonth() - 8);

  await babyRef.set({
    id: babyRef.id,
    name: 'נועם',
    dateOfBirth: Timestamp.fromDate(dob),
    organizationId: ORG_ID,
    assignedCoachId: coachUid,
    parentIds: [],
    status: 'active',
    createdAt: Timestamp.now(),
    createdBy: coachUid,
    lastUpdatedAt: Timestamp.now(),
    settings: {
      sleepGoals: { nightSleepHours: 10, dayNaps: 2, totalSleepHours: 12 },
      trackingPreferences: { reminderTime: '20:00', autoArchiveAfterDays: 30 },
    },
    familyName: 'כהן',
    age: 8,
    motherName: 'מיכל',
    fatherName: 'דני',
    siblingsCount: 1,
    siblingsNames: 'יעל, בת 3',
    description: 'מתקשה להירדם לבד',
    coachNotes: 'ננסה שגרת ערב קבועה השבוע.',
    isArchived: false,
    dateArchived: null,
    lastModified: new Date().toISOString(),
    inviteCode: '',
  });

  const parentUid = await upsertUser({
    email: 'parent@lailatov.test',
    displayName: 'מיכל כהן',
    role: 'parent',
    permissions: PARENT_PERMISSIONS,
    managedBabyProfiles: [babyRef.id],
    assignedCoachId: coachUid,
  });
  await babyRef.update({ parentIds: FieldValue.arrayUnion(parentUid) });

  // Two nights of sleep data. `date` is a YYYY-MM-DD string: the UI parses it with
  // new Date(...), which yields Invalid Date if a Timestamp is stored instead.
  for (let daysAgo = 1; daysAgo <= 2; daysAgo++) {
    const day = new Date();
    day.setDate(day.getDate() - daysAgo);
    const dateStr = day.toISOString().slice(0, 10);

    await babyRef.collection('sleep_records').doc(`seed-${dateStr}`).set({
      id: `seed-${dateStr}`,
      date: dateStr,
      sleepCycles: [
        {
          id: `${dateStr}-1`,
          bedtime: '19:45',
          timeToSleep: '20 דקות',
          whoPutToSleep: 'אמא',
          howFellAsleep: 'הנקה',
          wakeTime: '23:30',
        },
        {
          id: `${dateStr}-2`,
          bedtime: '23:50',
          timeToSleep: 'מייד',
          whoPutToSleep: 'אבא',
          howFellAsleep: 'נדנוד',
          wakeTime: '06:15',
        },
      ],
      timestamp: Timestamp.now(),
    });
  }

  // A pending invitation, so signup can be exercised immediately.
  const inviteRef = db.collection('invitations').doc('demo-invite');
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  await inviteRef.set({
    id: inviteRef.id,
    invitationCode: 'DEMO2468',
    email: 'newparent@lailatov.test',
    role: 'parent',
    organizationId: ORG_ID,
    status: 'pending',
    createdAt: Timestamp.now(),
    expiresAt: Timestamp.fromDate(expires),
    createdBy: coachUid,
    metadata: { babyProfileId: babyRef.id, assignedCoachId: coachUid },
    history: [
      { timestamp: Timestamp.now(), action: 'created', performedBy: coachUid, details: 'Seed data' },
    ],
  });

  console.log('Seed complete.\n');
  console.log('  Sign in with any of these:\n');
  console.log(`    Admin   admin@lailatov.test    / ${PASSWORD}`);
  console.log(`    Coach   coach@lailatov.test    / ${PASSWORD}`);
  console.log(`    Parent  parent@lailatov.test   / ${PASSWORD}`);
  console.log('\n  To try the signup flow, open /signup and enter BOTH of these:\n');
  console.log('    invite code:  DEMO2468');
  console.log('    email:        newparent@lailatov.test   <-- must be exactly this');
  console.log('\n  An invitation is bound to the address it was issued for, so signing up');
  console.log('  with any other email is refused. That is deliberate: it stops a leaked');
  console.log('  code being used to join another family.');
  console.log('\n  App: http://localhost:9002   Emulator UI: http://localhost:4000\n');
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

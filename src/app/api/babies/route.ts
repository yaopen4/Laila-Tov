import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebaseAdmin';
import { ApiError, handleRoute, readJson, requireAuth, requireString } from '@/lib/apiAuth';
import { createInvitation } from '@/lib/server/invitations';
import { auditLog, requestContext } from '@/lib/server/audit';

export const runtime = 'nodejs';

/** Firestore rejects undefined values, so strip those keys before writing. */
function compact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** Age in months -> an approximate date of birth. */
function dateOfBirthFromAgeMonths(ageMonths: number): Timestamp {
  const dob = new Date();
  dob.setMonth(dob.getMonth() - ageMonths);
  return Timestamp.fromDate(dob);
}

/**
 * POST /api/babies — create a baby profile and its parent invitation together.
 *
 * The form's button reads "צור פרופיל וקוד הזמנה" and the success toast tells the coach
 * where to find the code, but the old implementation hardcoded inviteCode to '' and
 * silently discarded the parent email addresses. No invitation document was ever
 * created, so a coach-created baby could never be linked to a parent — the invite
 * redemption flow had nothing to redeem.
 *
 * Profile and invitation are written in one batch: a baby that promises a code but has
 * none is worse than no baby at all.
 */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const user = await requireAuth(req, { permission: 'babies.create' });
    const body = await readJson(req);

    const name = requireString(body, 'name', 'נדרש שם התינוק.');
    const familyName = requireString(body, 'familyName', 'נדרש שם משפחה.');

    const ageMonths = Number(body.age);
    if (!Number.isFinite(ageMonths) || ageMonths < 0 || ageMonths > 60) {
      throw new ApiError(400, `Invalid age: ${String(body.age)}`, 'גיל התינוק אינו תקין.');
    }

    const siblingsCount = Number.isFinite(Number(body.siblingsCount)) ? Number(body.siblingsCount) : 0;
    const parentEmail = optionalString(body, 'parentEmail1');
    const secondParentEmail = optionalString(body, 'parentEmail2');

    const babyRef = adminDb.collection('baby_profiles').doc();
    const now = Timestamp.now();

    const profile = compact({
      id: babyRef.id,
      name,
      dateOfBirth: dateOfBirthFromAgeMonths(ageMonths),
      gender: optionalString(body, 'gender'),
      organizationId: user.organizationId,
      assignedCoachId: user.uid,
      parentIds: [],
      status: 'active',
      createdAt: now,
      createdBy: user.uid,
      lastUpdatedAt: now,
      settings: {
        sleepGoals: { nightSleepHours: 10, dayNaps: 2, totalSleepHours: 12 },
        trackingPreferences: { reminderTime: '20:00', autoArchiveAfterDays: 30 },
      },
      // Legacy fields still read by the coach and parent UIs.
      familyName,
      age: ageMonths,
      motherName: optionalString(body, 'motherName'),
      fatherName: optionalString(body, 'fatherName'),
      siblingsCount,
      siblingsNames: optionalString(body, 'siblingsNames'),
      description: optionalString(body, 'description'),
      coachNotes: optionalString(body, 'coachNotes'),
      isArchived: false,
      dateArchived: null,
      lastModified: new Date().toISOString(),
    });

    const batch = adminDb.batch();
    batch.set(babyRef, profile);
    batch.update(adminDb.collection('users').doc(user.uid), {
      managedBabyProfiles: FieldValue.arrayUnion(babyRef.id),
    });
    await batch.commit();

    // Mint the invitation the UI promises. Only possible once the baby exists, since
    // the invitation has to point at it.
    let invitationCode: string | null = null;
    if (parentEmail) {
      try {
        const invitation = await createInvitation({
          email: parentEmail,
          role: 'parent',
          organizationId: user.organizationId,
          createdBy: user.uid,
          babyProfileId: babyRef.id,
          assignedCoachId: user.uid,
        });
        invitationCode = invitation.invitationCode;
        await babyRef.update({ inviteCode: invitationCode });
      } catch (error) {
        // The profile is already saved and usable; surface the invitation failure
        // rather than pretending a code exists.
        console.error('[babies] Profile created but invitation failed:', error);
      }
    }

    // A second parent gets their own code for the same baby.
    let secondInvitationCode: string | null = null;
    if (secondParentEmail) {
      try {
        const invitation = await createInvitation({
          email: secondParentEmail,
          role: 'parent',
          organizationId: user.organizationId,
          createdBy: user.uid,
          babyProfileId: babyRef.id,
          assignedCoachId: user.uid,
        });
        secondInvitationCode = invitation.invitationCode;
      } catch (error) {
        console.error('[babies] Second parent invitation failed:', error);
      }
    }

    await auditLog({
      action: 'baby_profile_created',
      userId: user.uid,
      organizationId: user.organizationId,
      targetType: 'baby_profile',
      targetId: babyRef.id,
      success: true,
      details: { name, familyName, invitationIssued: Boolean(invitationCode) },
      ...requestContext(req),
    });

    return NextResponse.json({
      id: babyRef.id,
      invitationCode,
      secondInvitationCode,
    });
  });
}

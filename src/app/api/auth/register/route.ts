import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { ApiError, handleRoute, readJson, requireString } from '@/lib/apiAuth';
import { getPermissionsForRole, getRedirectPathForRole } from '@/lib/permissions';
import { markInvitationAccepted, validateInvitationCode } from '@/lib/server/invitations';
import { auditLog, requestContext } from '@/lib/server/audit';

export const runtime = 'nodejs';

/**
 * POST /api/auth/register — redeem an invitation code and create the account.
 *
 * This replaces a client-side flow that could not work. Creating /users/{uid} required
 * a rule check that read /users/{uid}, so the first write was always denied; the client
 * then caught the failure and deleted the freshly created Auth user, meaning every
 * registration rolled itself back.
 *
 * Doing it here fixes that structurally: the Admin SDK bypasses rules, and it can set
 * the `role` / `organizationId` custom claims that everything downstream depends on.
 * The client signs in normally afterwards and its ID token carries the claims.
 */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const body = await readJson(req);

    const email = requireString(body, 'email', 'נדרשת כתובת אימייל.').toLowerCase();
    const password = requireString(body, 'password', 'נדרשת סיסמה.');
    const displayName = requireString(body, 'displayName', 'נדרש שם מלא.');
    const invitationCode = requireString(body, 'invitationCode', 'נדרש קוד הזמנה.').toUpperCase();

    if (password.length < 6) {
      throw new ApiError(400, 'Password too short', 'הסיסמה חייבת להכיל לפחות 6 תווים.');
    }

    const validation = await validateInvitationCode(invitationCode, email);
    if (!validation.valid || !validation.invitation) {
      throw new ApiError(400, `Invalid invitation: ${validation.reason}`, validation.reason);
    }

    const invitation = validation.invitation;
    const { role, organizationId } = invitation;

    // Step 1 — the Auth user.
    let uid: string;
    try {
      const created = await adminAuth.createUser({ email, password, displayName });
      uid = created.uid;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === 'auth/email-already-exists') {
        throw new ApiError(409, 'Email already registered', 'כתובת האימייל כבר רשומה במערכת.');
      }
      if (code === 'auth/invalid-password') {
        throw new ApiError(400, 'Weak password', 'הסיסמה חלשה מדי.');
      }
      throw error;
    }

    // Steps 2-4 — claims, user document, invitation state, parent linkage.
    // If any of it fails we remove the Auth user so the code stays redeemable,
    // rather than stranding a half-registered account.
    try {
      await adminAuth.setCustomUserClaims(uid, { role, organizationId });

      const babyProfileId = invitation.metadata?.babyProfileId;
      const now = Timestamp.now();

      const batch = adminDb.batch();

      batch.set(adminDb.collection('users').doc(uid), {
        uid,
        email,
        emailVerified: false,
        displayName,
        role,
        organizationId,
        permissions: getPermissionsForRole(role),
        status: 'active',
        managedBabyProfiles: role === 'parent' && babyProfileId ? [babyProfileId] : [],
        ...(invitation.metadata?.assignedCoachId
          ? { assignedCoachId: invitation.metadata.assignedCoachId }
          : {}),
        createdAt: now,
        lastLoginAt: now,
        invitationAcceptedAt: now,
        originalInvitationId: invitation.id,
        preferences: {
          language: 'he',
          timezone: 'Asia/Jerusalem',
          notifications: { email: true, push: false, reminders: true },
        },
      });

      // Link a parent to the baby the invitation was issued for.
      if (role === 'parent' && babyProfileId) {
        batch.update(adminDb.collection('baby_profiles').doc(babyProfileId), {
          parentIds: FieldValue.arrayUnion(uid),
          lastUpdatedAt: now,
        });
      }

      await batch.commit();
      await markInvitationAccepted(invitation.id, uid);
    } catch (error) {
      await adminAuth.deleteUser(uid).catch((cleanupError) => {
        console.error('[register] Rollback failed; orphaned auth user', uid, cleanupError);
      });
      throw error;
    }

    await auditLog({
      action: 'user_registered',
      userId: uid,
      organizationId,
      targetType: 'user',
      targetId: uid,
      success: true,
      details: { email, role, invitationId: invitation.id },
      ...requestContext(req),
    });

    return NextResponse.json({
      uid,
      role,
      organizationId,
      redirectPath: getRedirectPathForRole(
        role,
        invitation.metadata?.babyProfileId ? [invitation.metadata.babyProfileId] : []
      ),
    });
  });
}

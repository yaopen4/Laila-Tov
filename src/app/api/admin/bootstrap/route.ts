import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { ApiError, handleRoute, readJson, requireString } from '@/lib/apiAuth';
import { getPermissionsForRole } from '@/lib/permissions';
import { auditLog, requestContext } from '@/lib/server/audit';

export const runtime = 'nodejs';

/**
 * POST /api/admin/bootstrap — create the very first organization and admin.
 *
 * Resolves a genuine chicken-and-egg: invitations can only be issued by an admin, and
 * admins can only be created by redeeming an invitation. Something has to seed the
 * first one. Previously nothing did, so a fresh deployment had no way in at all.
 *
 * Guarded two ways: a shared secret in ADMIN_BOOTSTRAP_SECRET, and a hard refusal to
 * run once any admin exists. Rotate or unset the secret after first use.
 */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const secret = process.env.ADMIN_BOOTSTRAP_SECRET;

    if (!secret || secret === 'change-me-to-a-long-random-string') {
      throw new ApiError(
        503,
        'ADMIN_BOOTSTRAP_SECRET is not configured',
        'אתחול המערכת אינו זמין.'
      );
    }

    const body = await readJson(req);
    const provided = requireString(body, 'secret', 'נדרש קוד אתחול.');

    // Length check first: timingSafeEqual throws on a length mismatch.
    if (provided.length !== secret.length || !timingSafeEqual(provided, secret)) {
      throw new ApiError(403, 'Bootstrap secret mismatch', 'קוד אתחול שגוי.');
    }

    // Refuse if the system is already initialised — this endpoint must not be a way
    // to mint extra admins.
    const existingAdmin = await adminDb
      .collection('users')
      .where('role', '==', 'admin')
      .limit(1)
      .get();

    if (!existingAdmin.empty) {
      throw new ApiError(
        409,
        'An admin already exists; bootstrap is closed',
        'המערכת כבר אותחלה.'
      );
    }

    const email = requireString(body, 'email', 'נדרשת כתובת אימייל.').toLowerCase();
    const password = requireString(body, 'password', 'נדרשת סיסמה.');
    const displayName = requireString(body, 'displayName', 'נדרש שם מלא.');
    const organizationName = requireString(body, 'organizationName', 'נדרש שם ארגון.');

    if (password.length < 8) {
      throw new ApiError(400, 'Bootstrap password too short', 'סיסמת מנהל חייבת להכיל לפחות 8 תווים.');
    }

    const orgRef = adminDb.collection('organizations').doc();
    const now = Timestamp.now();

    const created = await adminAuth.createUser({ email, password, displayName });

    try {
      await adminAuth.setCustomUserClaims(created.uid, {
        role: 'admin',
        organizationId: orgRef.id,
      });

      const batch = adminDb.batch();

      batch.set(orgRef, {
        id: orgRef.id,
        name: organizationName,
        type: 'independent',
        settings: {
          defaultInvitationExpiry: 30,
          maxCoaches: 50,
          maxBabyProfilesPerCoach: 100,
          allowParentInvitations: true,
        },
        createdAt: now,
        ownerId: created.uid,
        isActive: true,
      });

      batch.set(adminDb.collection('users').doc(created.uid), {
        uid: created.uid,
        email,
        emailVerified: false,
        displayName,
        role: 'admin',
        organizationId: orgRef.id,
        permissions: getPermissionsForRole('admin'),
        status: 'active',
        managedBabyProfiles: [],
        createdAt: now,
        lastLoginAt: now,
        invitationAcceptedAt: now,
        originalInvitationId: 'bootstrap',
        preferences: {
          language: 'he',
          timezone: 'Asia/Jerusalem',
          notifications: { email: true, push: false, reminders: true },
        },
      });

      await batch.commit();
    } catch (error) {
      await adminAuth.deleteUser(created.uid).catch(() => undefined);
      throw error;
    }

    await auditLog({
      action: 'system_bootstrapped',
      userId: created.uid,
      organizationId: orgRef.id,
      targetType: 'organization',
      targetId: orgRef.id,
      success: true,
      details: { email, organizationName },
      ...requestContext(req),
    });

    return NextResponse.json({
      uid: created.uid,
      organizationId: orgRef.id,
      message: 'Admin created. Rotate or unset ADMIN_BOOTSTRAP_SECRET now.',
    });
  });
}

/** Constant-time string comparison, so the secret cannot be guessed byte by byte. */
function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

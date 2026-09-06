import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebaseAdmin';
import { ApiError, handleRoute, readJson, requireAuth, requireString } from '@/lib/apiAuth';
import { isUserRole } from '@/lib/permissions';
import { createInvitation, type InvitationRecord } from '@/lib/server/invitations';
import { auditLog, requestContext } from '@/lib/server/audit';

export const runtime = 'nodejs';

/** GET /api/invitations — list invitations the caller may see. */
export async function GET(req: Request) {
  return handleRoute(async () => {
    const user = await requireAuth(req, { permission: 'system.manage_invitations' });

    let query = adminDb
      .collection('invitations')
      .where('organizationId', '==', user.organizationId);

    // A coach sees only the invitations they issued; an admin sees the whole org.
    if (user.role === 'coach') {
      query = query.where('createdBy', '==', user.uid);
    }

    const snapshot = await query.get();

    const invitations = snapshot.docs
      .map((doc) => doc.data() as InvitationRecord)
      .map((inv) => ({
        id: inv.id,
        invitationCode: inv.invitationCode,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        createdAt: inv.createdAt?.toDate?.()?.toISOString() ?? null,
        expiresAt: inv.expiresAt?.toDate?.()?.toISOString() ?? null,
        createdBy: inv.createdBy,
        babyProfileId: inv.metadata?.babyProfileId ?? null,
      }))
      // Sorted here rather than in the query: adding orderBy would demand another
      // composite index for what is a small, per-organization result set.
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    return NextResponse.json({ invitations });
  });
}

/** POST /api/invitations — mint a code for manual delivery. */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const user = await requireAuth(req, { permission: 'system.manage_invitations' });
    const body = await readJson(req);

    const email = requireString(body, 'email', 'נדרשת כתובת אימייל.');
    const role = body.role;

    if (!isUserRole(role)) {
      throw new ApiError(400, `Invalid role: ${String(role)}`, 'תפקיד לא תקין.');
    }
    // Only an admin may mint another admin or a coach.
    if (user.role === 'coach' && role !== 'parent') {
      throw new ApiError(403, 'Coaches may only invite parents', 'יועצת יכולה להזמין הורים בלבד.');
    }

    const babyProfileId = typeof body.babyProfileId === 'string' ? body.babyProfileId : undefined;

    // A parent invitation must name the baby it grants access to, and the caller must
    // own that baby — otherwise an invitation could hand access to another family.
    if (role === 'parent') {
      if (!babyProfileId) {
        throw new ApiError(400, 'Parent invitations require babyProfileId', 'יש לבחור תינוק להזמנה.');
      }
      const baby = await adminDb.collection('baby_profiles').doc(babyProfileId).get();
      if (!baby.exists) {
        throw new ApiError(404, 'Baby profile not found', 'פרופיל התינוק לא נמצא.');
      }
      const data = baby.data()!;
      if (data.organizationId !== user.organizationId) {
        throw new ApiError(403, 'Baby belongs to another organization', 'אין לך הרשאה לפרופיל זה.');
      }
      if (user.role === 'coach' && data.assignedCoachId !== user.uid) {
        throw new ApiError(403, 'Baby assigned to another coach', 'אין לך הרשאה לפרופיל זה.');
      }
    }

    const invitation = await createInvitation({
      email,
      role,
      organizationId: user.organizationId,
      createdBy: user.uid,
      babyProfileId,
      assignedCoachId: role === 'parent' ? user.uid : undefined,
      welcomeMessage: typeof body.welcomeMessage === 'string' ? body.welcomeMessage : undefined,
    });

    await auditLog({
      action: 'invitation_created',
      userId: user.uid,
      organizationId: user.organizationId,
      targetType: 'invitation',
      targetId: invitation.id,
      success: true,
      details: { email, role, babyProfileId },
      ...requestContext(req),
    });

    return NextResponse.json({
      id: invitation.id,
      invitationCode: invitation.invitationCode,
      expiresAt: invitation.expiresAt.toISOString(),
    });
  });
}

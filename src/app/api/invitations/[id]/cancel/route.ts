import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebaseAdmin';
import { ApiError, handleRoute, requireAuth } from '@/lib/apiAuth';
import { cancelInvitation, type InvitationRecord } from '@/lib/server/invitations';
import { auditLog, requestContext } from '@/lib/server/audit';

export const runtime = 'nodejs';

/**
 * POST /api/invitations/{id}/cancel
 *
 * A soft cancel: the document is kept with status 'cancelled' plus a history entry,
 * so the audit trail survives. The old client-side version was wired up correctly but
 * could never succeed, because it depended on an admin user document that the broken
 * signup flow had never managed to create.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireAuth(req, { permission: 'system.manage_invitations' });
    const { id } = await ctx.params;

    const snap = await adminDb.collection('invitations').doc(id).get();
    if (!snap.exists) {
      throw new ApiError(404, `Invitation ${id} not found`, 'ההזמנה לא נמצאה.');
    }

    const invitation = snap.data() as InvitationRecord;

    if (invitation.organizationId !== user.organizationId) {
      throw new ApiError(403, 'Cross-organization cancel', 'אין לך הרשאה לפעולה זו.');
    }
    // An admin may cancel anything in the organization; a coach only their own.
    if (user.role === 'coach' && invitation.createdBy !== user.uid) {
      throw new ApiError(403, 'Coach may only cancel own invitations', 'אין לך הרשאה לבטל הזמנה זו.');
    }

    await cancelInvitation(id, user.uid);

    await auditLog({
      action: 'invitation_cancelled',
      userId: user.uid,
      organizationId: user.organizationId,
      targetType: 'invitation',
      targetId: id,
      success: true,
      ...requestContext(req),
    });

    return NextResponse.json({ success: true });
  });
}

import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebaseAdmin';
import { ApiError, handleRoute, readJson, requireAuth } from '@/lib/apiAuth';
import { auditInBatch, requestContext } from '@/lib/server/audit';
import { loadBabyForWrite, touched } from '@/lib/server/babies';

export const runtime = 'nodejs';

/**
 * POST /api/babies/{id}/archive  { archived: boolean }
 *
 * Archive or restore a profile (coach, admin). One route for both directions so the
 * audit trail reads as a single kind of event with a clear before/after.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireAuth(req, { role: ['coach', 'admin'] });
    const { id } = await ctx.params;
    const body = await readJson(req);

    if (typeof body.archived !== 'boolean') {
      throw new ApiError(400, 'archived must be a boolean', 'בקשה לא תקינה.');
    }
    const archived = body.archived;

    const { ref } = await loadBabyForWrite(user, id, { allowParent: false });

    const batch = adminDb.batch();
    batch.update(ref, {
      status: archived ? 'archived' : 'active',
      isArchived: archived,
      dateArchived: archived ? new Date().toISOString() : null,
      ...touched(),
    });
    auditInBatch(batch, {
      action: archived ? 'baby_profile_archived' : 'baby_profile_restored',
      userId: user.uid,
      organizationId: user.organizationId,
      targetType: 'baby_profile',
      targetId: id,
      success: true,
      ...requestContext(req),
    });
    await batch.commit();

    return NextResponse.json({ ok: true });
  });
}

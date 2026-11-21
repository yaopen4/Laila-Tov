import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebaseAdmin';
import { handleRoute, readJson, requireAuth } from '@/lib/apiAuth';
import { auditLog, requestContext } from '@/lib/server/audit';
import { cleanProfileUpdate, loadBabyForWrite, touched } from '@/lib/server/babies';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/babies/{id} — edit a profile's descriptive fields (coach, admin). */
export async function PATCH(req: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const user = await requireAuth(req, { role: ['coach', 'admin'] });
    const { id } = await ctx.params;
    const { ref } = await loadBabyForWrite(user, id, { allowParent: false });

    const update = cleanProfileUpdate(await readJson(req));
    await ref.update({ ...update, ...touched() });

    await auditLog({
      action: 'baby_profile_updated',
      userId: user.uid,
      organizationId: user.organizationId,
      targetType: 'baby_profile',
      targetId: id,
      success: true,
      // Field names only: values can be sensitive family notes.
      details: { fields: Object.keys(update).filter((f) => f !== 'dateOfBirth') },
      ...requestContext(req),
    });

    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/babies/{id} — permanently delete a profile and its sleep records.
 *
 * Admin only, as before: a coach archives, an admin deletes. Records live in a
 * subcollection, which deleting the parent document would leave orphaned.
 */
export async function DELETE(req: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const user = await requireAuth(req, { role: 'admin' });
    const { id } = await ctx.params;
    const { ref, baby } = await loadBabyForWrite(user, id, { allowParent: false });

    await adminDb.recursiveDelete(ref);

    // Keep the coach's and parents' back-references consistent.
    const batch = adminDb.batch();
    for (const uid of [baby.assignedCoachId, ...(baby.parentIds ?? [])].filter(Boolean)) {
      batch.set(
        adminDb.collection('users').doc(uid),
        { managedBabyProfiles: FieldValue.arrayRemove(id) },
        { merge: true }
      );
    }
    await batch.commit().catch((error) => {
      console.error('[babies] Deleted profile but failed to update back-references:', error);
    });

    await auditLog({
      action: 'baby_profile_deleted',
      userId: user.uid,
      organizationId: user.organizationId,
      targetType: 'baby_profile',
      targetId: id,
      success: true,
      details: { name: `${baby.name ?? ''} ${baby.familyName ?? ''}`.trim() },
      ...requestContext(req),
    });

    return NextResponse.json({ ok: true });
  });
}

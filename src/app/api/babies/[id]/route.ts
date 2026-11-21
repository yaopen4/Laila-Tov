import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebaseAdmin';
import { handleRoute, readJson, requireAuth } from '@/lib/apiAuth';
import { auditInBatch, auditLog, requestContext } from '@/lib/server/audit';
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
    const batch = adminDb.batch();
    batch.update(ref, { ...update, ...touched() });
    auditInBatch(batch, {
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
    await batch.commit();

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

    // recursiveDelete cannot join a batch, so record the intent first: an entry for a
    // delete that then fails is recoverable; a delete with no entry is not.
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

    await adminDb.recursiveDelete(ref);

    // Keep the coach's and parents' back-references consistent. update(), not
    // set(merge): a uid whose user document is gone must not get a stub created.
    const NOT_FOUND = 5;
    await Promise.all(
      [baby.assignedCoachId, ...(baby.parentIds ?? [])].filter(Boolean).map((uid) =>
        adminDb
          .collection('users')
          .doc(uid)
          .update({ managedBabyProfiles: FieldValue.arrayRemove(id) })
          .catch((error: { code?: number }) => {
            if (error.code !== NOT_FOUND) {
              console.error(`[babies] Deleted ${id} but could not update user ${uid}:`, error);
            }
          })
      )
    );

    return NextResponse.json({ ok: true });
  });
}

import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebaseAdmin';
import { ApiError, handleRoute, readJson, requireAuth } from '@/lib/apiAuth';
import { auditInBatch, requestContext } from '@/lib/server/audit';
import { cleanSleepRecord, loadBabyForWrite, touched } from '@/lib/server/babies';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string; recordId: string }> };

async function loadRecord(req: Request, ctx: Ctx) {
  const user = await requireAuth(req);
  const { id, recordId } = await ctx.params;
  const { ref } = await loadBabyForWrite(user, id, { allowParent: true });
  const recordRef = ref.collection('sleep_records').doc(recordId);
  const snap = await recordRef.get();
  if (!snap.exists) {
    throw new ApiError(404, `Sleep record ${id}/${recordId} not found`, 'רשומת השינה לא נמצאה.');
  }
  return { user, id, recordId, babyRef: ref, recordRef };
}

/** PATCH /api/babies/{id}/sleep-records/{recordId} — replace a day's record. */
export async function PATCH(req: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const { user, id, recordId, babyRef, recordRef } = await loadRecord(req, ctx);
    const record = cleanSleepRecord(await readJson(req));

    const batch = adminDb.batch();
    batch.update(recordRef, {
      ...record,
      updatedAt: Timestamp.now(),
      updatedBy: user.uid,
    });
    batch.update(babyRef, touched());
    auditInBatch(batch, {
      action: 'sleep_record_updated',
      userId: user.uid,
      organizationId: user.organizationId,
      targetType: 'sleep_record',
      targetId: `${id}/${recordId}`,
      success: true,
      details: { date: record.date, cycles: record.sleepCycles.length },
      ...requestContext(req),
    });
    await batch.commit();

    return NextResponse.json({ ok: true });
  });
}

/** DELETE /api/babies/{id}/sleep-records/{recordId} */
export async function DELETE(req: Request, ctx: Ctx) {
  return handleRoute(async () => {
    const { user, id, recordId, babyRef, recordRef } = await loadRecord(req, ctx);

    const batch = adminDb.batch();
    batch.delete(recordRef);
    batch.update(babyRef, touched());
    auditInBatch(batch, {
      action: 'sleep_record_deleted',
      userId: user.uid,
      organizationId: user.organizationId,
      targetType: 'sleep_record',
      targetId: `${id}/${recordId}`,
      success: true,
      ...requestContext(req),
    });
    await batch.commit();

    return NextResponse.json({ ok: true });
  });
}

import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebaseAdmin';
import { handleRoute, readJson, requireAuth } from '@/lib/apiAuth';
import { auditInBatch, requestContext } from '@/lib/server/audit';
import { cleanSleepRecord, loadBabyForWrite, touched } from '@/lib/server/babies';

export const runtime = 'nodejs';

/** POST /api/babies/{id}/sleep-records — log a day's sleep (parent, coach, admin). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireAuth(req);
    const { id } = await ctx.params;
    const { ref } = await loadBabyForWrite(user, id, { allowParent: true });
    const record = cleanSleepRecord(await readJson(req));

    const recordRef = ref.collection('sleep_records').doc();
    const batch = adminDb.batch();
    batch.set(recordRef, {
      ...record,
      id: recordRef.id,
      timestamp: Timestamp.now(),
      createdBy: user.uid,
    });
    batch.update(ref, touched());
    auditInBatch(batch, {
      action: 'sleep_record_created',
      userId: user.uid,
      organizationId: user.organizationId,
      targetType: 'sleep_record',
      targetId: `${id}/${recordRef.id}`,
      success: true,
      details: { date: record.date, cycles: record.sleepCycles.length },
      ...requestContext(req),
    });
    await batch.commit();

    return NextResponse.json({ id: recordRef.id }, { status: 201 });
  });
}

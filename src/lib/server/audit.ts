import 'server-only';

import { FieldValue, type WriteBatch } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';

/**
 * Server-side audit trail.
 *
 * Audit writes belong on the server: `audit_logs` is client-write-denied in
 * firestore.rules, and a log the subject can edit is not an audit log. The previous
 * client-side implementation had every write rejected and swallowed, so the trail was
 * empty while the admin viewer rendered a blank page.
 *
 * Failures here are logged but never rethrown — a broken audit write must not fail the
 * operation being audited.
 */

export interface AuditEvent {
  action: string;
  userId: string;
  organizationId: string;
  targetType?: string;
  targetId?: string;
  success: boolean;
  details?: Record<string, unknown>;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * The admin audit viewer filters by category, so every entry needs one. Derived from
 * the action here rather than passed by each route, so it cannot be forgotten.
 */
export function categoryFor(action: string): string {
  if (action === 'user_registered' || action.startsWith('session_')) return 'authentication';
  if (action.startsWith('invitation_') || action.startsWith('user_')) return 'user_management';
  if (action.startsWith('baby_profile_') || action.startsWith('sleep_record_')) {
    return 'data_modification';
  }
  return 'system_admin';
}

/** Firestore rejects undefined values outright, so drop those keys. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function entry(event: AuditEvent): Record<string, unknown> {
  return {
    ...compact({ ...event, details: event.details ? compact(event.details) : undefined }),
    category: categoryFor(event.action),
    timestamp: FieldValue.serverTimestamp(),
  };
}

export async function auditLog(event: AuditEvent): Promise<void> {
  try {
    await adminDb.collection('audit_logs').add(entry(event));
  } catch (error) {
    console.error('[audit] Failed to write audit entry:', event.action, error);
  }
}

/**
 * Add the audit entry to the same batch as the change it records, so the two commit
 * together: a change can never land without its entry. Prefer this over auditLog()
 * wherever the change itself is a batched write.
 */
export function auditInBatch(batch: WriteBatch, event: AuditEvent): void {
  batch.set(adminDb.collection('audit_logs').doc(), entry(event));
}

/** Pull client IP / user-agent off the request for the audit record. */
export function requestContext(req: Request): { ipAddress?: string; userAgent?: string } {
  const forwarded = req.headers.get('x-forwarded-for');
  return compact({
    ipAddress: forwarded?.split(',')[0]?.trim() || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
  });
}

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
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

/** Firestore rejects undefined values outright, so drop those keys. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export async function auditLog(event: AuditEvent): Promise<void> {
  try {
    await adminDb.collection('audit_logs').add({
      ...compact({ ...event, details: event.details ? compact(event.details) : undefined }),
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('[audit] Failed to write audit entry:', event.action, error);
  }
}

/** Pull client IP / user-agent off the request for the audit record. */
export function requestContext(req: Request): { ipAddress?: string; userAgent?: string } {
  const forwarded = req.headers.get('x-forwarded-for');
  return compact({
    ipAddress: forwarded?.split(',')[0]?.trim() || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
  });
}

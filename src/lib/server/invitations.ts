import 'server-only';

import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin';
import { ApiError } from '../apiAuth';
import type { UserRole } from '../permissions';

/**
 * Invitation logic, server-side.
 *
 * Invitations are delivered as codes that a coach or admin shares directly (WhatsApp,
 * SMS, in person). There is no email provider: the old one could never have sent mail
 * (its API key had no NEXT_PUBLIC_ prefix, so it was undefined in the browser, and the
 * package was not installed) yet returned success:true, so the UI reported invitations
 * as sent when nothing was.
 */

export const INVITATION_TTL_DAYS = 30;

/**
 * Unambiguous alphabet: no O/0, I/1/L, U/V. These codes get read aloud and
 * retyped by tired parents.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
const CODE_LENGTH = 8;

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/**
 * Generate a code not already in use.
 *
 * Looks up by equality on invitationCode alone. The previous version paired that with
 * where('status','!=','expired'), which needs a composite index and — because `!=`
 * silently skips documents missing the field — could report a taken code as free.
 */
export async function generateUniqueCode(db: Firestore = adminDb): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await db
      .collection('invitations')
      .where('invitationCode', '==', code)
      .limit(1)
      .get();
    if (existing.empty) return code;
  }
  // 29^8 is ~5e11; ten collisions means something is wrong, not bad luck.
  throw new ApiError(500, 'Could not generate a unique invitation code', 'שגיאה ביצירת קוד הזמנה.');
}

export interface InvitationRecord {
  id: string;
  invitationCode: string;
  email: string;
  role: UserRole;
  organizationId: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  createdAt: Timestamp;
  expiresAt: Timestamp;
  createdBy: string;
  acceptedAt?: Timestamp;
  acceptedBy?: string;
  metadata: {
    babyProfileId?: string;
    assignedCoachId?: string;
    welcomeMessage?: string;
  };
  history: Array<{ timestamp: Timestamp; action: string; performedBy: string; details?: string }>;
}

export interface CreateInvitationInput {
  email: string;
  role: UserRole;
  organizationId: string;
  createdBy: string;
  babyProfileId?: string;
  assignedCoachId?: string;
  welcomeMessage?: string;
}

/** Drop undefined values — Firestore rejects them. */
function compact<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export async function createInvitation(
  input: CreateInvitationInput,
  db: Firestore = adminDb
): Promise<{ id: string; invitationCode: string; expiresAt: Date }> {
  const email = input.email.trim().toLowerCase();

  // Refuse a duplicate pending invite for the same address. The old email-based path
  // skipped this check, so the admin UI could mint unlimited duplicates.
  const duplicate = await db
    .collection('invitations')
    .where('email', '==', email)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (!duplicate.empty) {
    const existing = duplicate.docs[0].data() as InvitationRecord;
    if (existing.expiresAt.toDate() > new Date()) {
      throw new ApiError(
        409,
        `Pending invitation already exists for ${email}`,
        'כבר קיימת הזמנה פעילה לכתובת זו.'
      );
    }
  }

  const invitationCode = await generateUniqueCode(db);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const ref = db.collection('invitations').doc();

  await ref.set(
    compact({
      id: ref.id,
      invitationCode,
      email,
      role: input.role,
      organizationId: input.organizationId,
      status: 'pending',
      createdAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(expiresAt),
      createdBy: input.createdBy,
      metadata: compact({
        babyProfileId: input.babyProfileId,
        assignedCoachId: input.assignedCoachId,
        welcomeMessage: input.welcomeMessage,
      }),
      history: [
        {
          timestamp: Timestamp.fromDate(now),
          action: 'created',
          performedBy: input.createdBy,
          details: 'Invitation code created for manual delivery',
        },
      ],
    })
  );

  return { id: ref.id, invitationCode, expiresAt };
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  invitation?: InvitationRecord;
}

/**
 * Look up and validate a code.
 *
 * Runs on the server because the caller is an unauthenticated visitor on the signup
 * page. firestore.rules correctly denies them any read of `invitations`, which is why
 * the old client-side prevalidation always failed.
 */
export async function validateInvitationCode(
  code: string,
  email?: string,
  db: Firestore = adminDb
): Promise<ValidationResult> {
  const snapshot = await db
    .collection('invitations')
    .where('invitationCode', '==', code.trim().toUpperCase())
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { valid: false, reason: 'קוד ההזמנה אינו קיים.' };
  }

  const invitation = snapshot.docs[0].data() as InvitationRecord;

  if (invitation.status === 'cancelled') return { valid: false, reason: 'הזמנה זו בוטלה.' };
  if (invitation.status === 'accepted') return { valid: false, reason: 'כבר נעשה שימוש בקוד הזמנה זה.' };
  if (invitation.expiresAt.toDate() < new Date()) {
    return { valid: false, reason: 'תוקף ההזמנה פג.' };
  }
  if (email && invitation.email.toLowerCase() !== email.trim().toLowerCase()) {
    return { valid: false, reason: 'קוד ההזמנה אינו תואם לכתובת האימייל.' };
  }

  return { valid: true, invitation };
}

export async function markInvitationAccepted(
  invitationId: string,
  userId: string,
  db: Firestore = adminDb
): Promise<void> {
  await db.collection('invitations').doc(invitationId).update({
    status: 'accepted',
    acceptedAt: FieldValue.serverTimestamp(),
    acceptedBy: userId,
    history: FieldValue.arrayUnion({
      timestamp: Timestamp.now(),
      action: 'accepted',
      performedBy: userId,
    }),
  });
}

export async function cancelInvitation(
  invitationId: string,
  performedBy: string,
  db: Firestore = adminDb
): Promise<void> {
  const ref = db.collection('invitations').doc(invitationId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new ApiError(404, `Invitation ${invitationId} not found`, 'ההזמנה לא נמצאה.');
  }

  const invitation = snap.data() as InvitationRecord;
  if (invitation.status === 'accepted') {
    throw new ApiError(409, 'Cannot cancel an accepted invitation', 'לא ניתן לבטל הזמנה שכבר מומשה.');
  }

  await ref.update({
    status: 'cancelled',
    history: FieldValue.arrayUnion({
      timestamp: Timestamp.now(),
      action: 'cancelled',
      performedBy,
    }),
  });
}

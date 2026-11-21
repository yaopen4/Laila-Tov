import 'server-only';

import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';

import { adminDb } from '../firebaseAdmin';
import { ApiError, type AuthedUser } from '../apiAuth';

/**
 * Server-side access checks and input sanitising for baby-profile and sleep-record
 * writes (#4).
 *
 * These writes used to go straight from the browser to Firestore, which meant no
 * audit entry could be written for them (audit_logs is server-write-only, and must
 * be). They now run here, and firestore.rules denies them to clients, so every change
 * to a family's data leaves a trail.
 *
 * The access rules mirror firestore.rules exactly — the rules remain the boundary for
 * reads, and these functions are the boundary for writes:
 *   admin  — any baby in their organization
 *   coach  — babies assigned to them
 *   parent — their own baby's sleep records only
 */

export interface BabyDoc {
  id: string;
  name?: string;
  familyName?: string;
  organizationId: string;
  assignedCoachId: string;
  parentIds?: string[];
  status?: string;
}

const NOT_FOUND = 'פרופיל התינוק לא נמצא.';
const FORBIDDEN = 'אין לך הרשאה לפעולה זו.';

export async function loadBabyForWrite(
  user: AuthedUser,
  babyId: string,
  { allowParent }: { allowParent: boolean }
): Promise<{ ref: DocumentReference; baby: BabyDoc }> {
  const ref = adminDb.collection('baby_profiles').doc(babyId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new ApiError(404, `Baby ${babyId} not found`, NOT_FOUND);
  }
  const baby = { ...(snap.data() as BabyDoc), id: snap.id };

  const allowed =
    (user.role === 'admin' && baby.organizationId === user.organizationId) ||
    (user.role === 'coach' && baby.assignedCoachId === user.uid) ||
    (allowParent && user.role === 'parent' && (baby.parentIds ?? []).includes(user.uid));

  if (!allowed) {
    // 404 rather than 403 would hide existence, but every caller here already reached
    // the baby through a link it was given; a clear 403 helps support more.
    throw new ApiError(403, `${user.role} ${user.uid} may not write baby ${babyId}`, FORBIDDEN);
  }

  return { ref, baby };
}

// ---------- sleep records ----------

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CYCLES = 30;
const MAX_TEXT = 500;

function text(value: unknown, field: string, { required }: { required: boolean }): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ApiError(400, `Missing ${field}`, 'יש למלא את כל שדות החובה.');
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new ApiError(400, `${field} must be a string`, 'נתונים לא תקינים.');
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_TEXT) {
    throw new ApiError(400, `${field} too long`, 'אחד השדות ארוך מדי.');
  }
  if (required && trimmed === '') {
    throw new ApiError(400, `Missing ${field}`, 'יש למלא את כל שדות החובה.');
  }
  return trimmed;
}

function time(value: unknown, field: string, { required }: { required: boolean }): string | undefined {
  const parsed = text(value, field, { required });
  if (parsed !== undefined && !TIME.test(parsed)) {
    throw new ApiError(400, `${field} is not HH:MM`, 'שעה לא תקינה.');
  }
  return parsed;
}

export interface CleanSleepRecord {
  date: string;
  sleepCycles: Array<{
    id: string;
    bedtime: string;
    timeToSleep: string;
    whoPutToSleep: string;
    howFellAsleep: string;
    wakeTime?: string;
  }>;
}

/**
 * Accept only the fields a sleep record has, in the shapes the UI produces. The
 * client converts the form's Date to a local 'YYYY-MM-DD' key before sending: the
 * server's timezone is not the family's, so it must not do that conversion itself.
 */
export function cleanSleepRecord(body: Record<string, unknown>): CleanSleepRecord {
  const date = body.date;
  if (typeof date !== 'string' || !DATE_KEY.test(date) || Number.isNaN(Date.parse(date))) {
    throw new ApiError(400, `Invalid date: ${String(date)}`, 'תאריך לא תקין.');
  }

  const cycles = body.sleepCycles;
  if (!Array.isArray(cycles) || cycles.length === 0 || cycles.length > MAX_CYCLES) {
    throw new ApiError(400, 'sleepCycles must be a non-empty array', 'יש להזין לפחות מחזור שינה אחד.');
  }

  return {
    date,
    sleepCycles: cycles.map((raw, index) => {
      if (typeof raw !== 'object' || raw === null) {
        throw new ApiError(400, `sleepCycles[${index}] is not an object`, 'נתונים לא תקינים.');
      }
      const cycle = raw as Record<string, unknown>;
      const wakeTime = time(cycle.wakeTime, 'wakeTime', { required: false });
      return {
        id: text(cycle.id, 'id', { required: false }) ?? `cycle-${index + 1}`,
        bedtime: time(cycle.bedtime, 'bedtime', { required: true })!,
        timeToSleep: text(cycle.timeToSleep, 'timeToSleep', { required: false }) ?? '',
        whoPutToSleep: text(cycle.whoPutToSleep, 'whoPutToSleep', { required: false }) ?? '',
        howFellAsleep: text(cycle.howFellAsleep, 'howFellAsleep', { required: false }) ?? '',
        ...(wakeTime ? { wakeTime } : {}),
      };
    }),
  };
}

// ---------- profile edits ----------

/**
 * The fields a coach may edit from the edit-baby form. Everything that carries access
 * control (organizationId, assignedCoachId, parentIds, createdBy, inviteCode, status)
 * is deliberately absent: those change only through their own dedicated flows.
 */
export function cleanProfileUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  for (const field of ['name', 'familyName'] as const) {
    if (body[field] !== undefined) {
      update[field] = text(body[field], field, { required: true });
    }
  }
  for (const field of [
    'motherName',
    'fatherName',
    'siblingsNames',
    'description',
    'coachNotes',
  ] as const) {
    if (body[field] !== undefined) {
      // Long free text is legitimate here (notes), so allow more than a cycle field.
      const value = body[field];
      if (value !== null && typeof value !== 'string') {
        throw new ApiError(400, `${field} must be a string`, 'נתונים לא תקינים.');
      }
      const trimmed = (value ?? '').trim();
      if (trimmed.length > 5000) {
        throw new ApiError(400, `${field} too long`, 'אחד השדות ארוך מדי.');
      }
      update[field] = trimmed;
    }
  }

  if (body.age !== undefined) {
    const age = Number(body.age);
    if (!Number.isFinite(age) || age < 0 || age > 60) {
      throw new ApiError(400, `Invalid age: ${String(body.age)}`, 'גיל התינוק אינו תקין.');
    }
    update.age = age;
    const dob = new Date();
    dob.setMonth(dob.getMonth() - age);
    update.dateOfBirth = Timestamp.fromDate(dob);
  }

  if (body.siblingsCount !== undefined) {
    const count = Number(body.siblingsCount);
    if (!Number.isInteger(count) || count < 0 || count > 30) {
      throw new ApiError(400, 'Invalid siblingsCount', 'מספר אחים לא תקין.');
    }
    update.siblingsCount = count;
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, 'No editable fields', 'לא נשלחו שינויים.');
  }

  return update;
}

/** Fields every write to a baby (or its records) bumps. */
export function touched(): { lastUpdatedAt: Timestamp; lastModified: string } {
  return { lastUpdatedAt: Timestamp.now(), lastModified: new Date().toISOString() };
}

import 'server-only';

import { NextResponse } from 'next/server';
import { adminAuth } from './firebaseAdmin';
import { isUserRole, roleHasPermission, type UserRole } from './permissions';

/**
 * Server-side request authorization.
 *
 * The client sends its Firebase ID token as `Authorization: Bearer <token>`. We verify
 * it with the Admin SDK and read `role` / `organizationId` from the custom claims that
 * registration set. This is a real check against a signed token — unlike the previous
 * client-side gates, which read a localStorage cache the user could edit.
 */

export interface AuthedUser {
  uid: string;
  email: string | undefined;
  role: UserRole;
  organizationId: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Safe to show a Hebrew-speaking end user. */
    readonly userMessage?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function bearerToken(req: Request): string {
  const header = req.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new ApiError(401, 'Missing bearer token', 'נדרשת התחברות מחדש.');
  }
  return token;
}

/**
 * Verify the caller and, optionally, assert a role or permission.
 * Throws ApiError; use `handleRoute` to turn that into a response.
 */
export async function requireAuth(
  req: Request,
  opts: { role?: UserRole | UserRole[]; permission?: string } = {}
): Promise<AuthedUser> {
  const token = bearerToken(req);

  let decoded;
  try {
    // checkRevoked: a disabled or signed-out user's token stops working immediately
    // rather than lingering until it expires.
    decoded = await adminAuth.verifyIdToken(token, true);
  } catch {
    throw new ApiError(401, 'Invalid or expired token', 'ההתחברות פגה. יש להתחבר מחדש.');
  }

  const role = decoded.role;
  const organizationId = decoded.organizationId;

  if (!isUserRole(role) || typeof organizationId !== 'string') {
    // Claims are set during registration. Their absence means the account predates
    // this flow or was created outside it.
    throw new ApiError(
      403,
      `User ${decoded.uid} has no role/organization claims`,
      'לחשבון חסרות הרשאות. יש לפנות למנהל המערכת.'
    );
  }

  const user: AuthedUser = { uid: decoded.uid, email: decoded.email, role, organizationId };

  if (opts.role) {
    const allowed = Array.isArray(opts.role) ? opts.role : [opts.role];
    if (!allowed.includes(role)) {
      throw new ApiError(403, `Role ${role} not in [${allowed.join(', ')}]`, 'אין לך הרשאה לפעולה זו.');
    }
  }

  if (opts.permission && !roleHasPermission(role, opts.permission)) {
    throw new ApiError(403, `Role ${role} lacks ${opts.permission}`, 'אין לך הרשאה לפעולה זו.');
  }

  return user;
}

/**
 * Wraps a route handler so thrown ApiErrors become clean JSON responses and anything
 * unexpected becomes a 500 without leaking internals to the client.
 */
export function handleRoute(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  return fn().catch((error: unknown) => {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.userMessage ?? error.message, code: error.status },
        { status: error.status }
      );
    }
    console.error('[api] Unhandled error:', error);
    return NextResponse.json({ error: 'שגיאת שרת. נסה שוב מאוחר יותר.', code: 500 }, { status: 500 });
  });
}

/** Parse and validate a JSON body, rejecting anything that is not an object. */
export async function readJson<T extends Record<string, unknown>>(req: Request): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, 'Body is not valid JSON', 'בקשה לא תקינה.');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiError(400, 'Body must be a JSON object', 'בקשה לא תקינה.');
  }
  return body as T;
}

/** Require a non-empty string field. */
export function requireString(body: Record<string, unknown>, field: string, userMessage: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiError(400, `Missing or empty field: ${field}`, userMessage);
  }
  return value.trim();
}

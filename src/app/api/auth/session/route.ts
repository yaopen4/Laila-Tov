import { NextResponse } from 'next/server';

import { adminAuth } from '@/lib/firebaseAdmin';
import { ApiError, handleRoute, readJson, requireString } from '@/lib/apiAuth';
import { isUserRole } from '@/lib/permissions';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/session';

export const runtime = 'nodejs';

/** Recently signed in: Firebase recommends minting session cookies only from fresh tokens. */
const MAX_TOKEN_AGE_SECONDS = 5 * 60;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

/**
 * POST /api/auth/session — exchange a fresh ID token for an httpOnly session cookie.
 *
 * The cookie is what middleware.ts checks before rendering /admin, /coach and
 * /parent. It is httpOnly, so page scripts (and anything injected into them) cannot
 * read it.
 */
export async function POST(req: Request) {
  return handleRoute(async () => {
    const body = await readJson(req);
    const idToken = requireString(body, 'idToken', 'בקשה לא תקינה.');

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken, true);
    } catch {
      throw new ApiError(401, 'Invalid ID token', 'ההתחברות פגה. יש להתחבר מחדש.');
    }

    if (Date.now() / 1000 - decoded.auth_time > MAX_TOKEN_AGE_SECONDS) {
      throw new ApiError(401, 'Sign-in is not recent', 'יש להתחבר מחדש.');
    }

    if (!isUserRole(decoded.role) || typeof decoded.organizationId !== 'string') {
      throw new ApiError(403, `User ${decoded.uid} has no role claims`, 'לחשבון חסרות הרשאות.');
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, cookieOptions(SESSION_MAX_AGE_SECONDS));
    return response;
  });
}

/** DELETE /api/auth/session — sign-out. Clears the cookie; needs no authentication. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  return response;
}

import { NextResponse, type NextRequest } from 'next/server';

import {
  SESSION_COOKIE,
  emulatorSessionsAllowed,
  rolesForPath,
  verifySessionCookie,
} from '@/lib/session';

/**
 * Server-side route protection (#3).
 *
 * Before this, /admin and /coach were guarded only by a useEffect in their layouts,
 * so the page shell was served to anyone and redirected afterwards. Now the request
 * is rejected before rendering unless it carries a valid session cookie whose `role`
 * claim may open the path.
 *
 * The layouts keep their client-side checks; they are harmless and cover the moment
 * between a sign-out and the next navigation.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const allowed = rolesForPath(pathname);
  if (!allowed) return NextResponse.next();

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
  const session = await verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value, {
    projectId,
    allowUnsigned: emulatorSessionsAllowed({
      useEmulators: process.env.NEXT_PUBLIC_USE_EMULATORS,
      projectId,
    }),
  });

  if (session && allowed.includes(session.role)) {
    return NextResponse.next();
  }

  const login = new URL('/', request.url);
  login.searchParams.set('next', `${pathname}${search}`);
  const response = NextResponse.redirect(login);
  if (!session) {
    // An expired or forged cookie is useless; drop it so it is not re-sent.
    response.cookies.delete(SESSION_COOKIE);
  }
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/coach/:path*', '/parent/:path*'],
};

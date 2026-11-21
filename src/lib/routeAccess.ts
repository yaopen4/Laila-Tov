/**
 * Which roles may open which pages. Shared by middleware (edge) and the login form
 * (browser), so it must stay free of dependencies.
 */
export type SessionRole = 'admin' | 'coach' | 'parent';

/** Which roles may open a given path. Null means the path is not protected here. */
export function rolesForPath(pathname: string): SessionRole[] | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return ['admin'];
  if (pathname === '/coach' || pathname.startsWith('/coach/')) return ['coach'];
  // The parent page checks per-baby access itself; coaches and admins open it too.
  if (pathname.startsWith('/parent/')) return ['parent', 'coach', 'admin'];
  return null;
}

/**
 * Where to send someone after they sign in, given the `?next=` middleware added.
 *
 * Resolves the candidate with the URL parser FIRST and checks the resulting origin,
 * then returns the parsed path, never the raw string. String checks alone are not
 * enough: the URL parser strips tabs and newlines, so "/\t/evil.com" passes a
 * startsWith('/') && !startsWith('//') test yet resolves to https://evil.com.
 */
export function safeNextPath(
  next: string | null,
  origin: string,
  role: SessionRole,
  fallback: string
): string {
  if (!next) return fallback;
  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return fallback;
  }
  if (url.origin !== origin) return fallback;
  if (!rolesForPath(url.pathname)?.includes(role)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

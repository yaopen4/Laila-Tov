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

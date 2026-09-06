/**
 * Role -> permission mapping. Single source of truth, shared by client and server.
 *
 * Previously permissions were resolved by querying `user_role_assignments` joined to
 * `roles`. Nothing user-reachable ever wrote those collections, so the lookup returned
 * an empty set and every permission check failed closed — which is what blocked baby
 * creation and all sleep-data writes.
 *
 * A static map removes that whole class of failure: it needs no Firestore read, no
 * composite index, and no bootstrap step, and it cannot silently resolve to "no
 * permissions" because a collection is empty.
 *
 * This is the *application* authorization layer. It is advisory only — it produces
 * good error messages and hides UI the user cannot use. The real boundary is
 * firestore.rules plus the server-side API routes, both of which key off the
 * `role` custom claim.
 */

export type UserRole = 'admin' | 'coach' | 'parent';

export const PERMISSIONS = {
  admin: [
    'users.create',
    'users.read.all',
    'users.update.all',
    'users.deactivate',
    'babies.create',
    'babies.read.all',
    'babies.read.assigned',
    'babies.update.assigned',
    'babies.archive',
    'sleep_data.read.all',
    'sleep_data.read.assigned',
    'sleep_data.write.assigned',
    'reports.generate.all',
    'reports.generate.assigned',
    'reports.export',
    'system.manage_roles',
    'system.manage_organization',
    'system.view_audit_logs',
    'system.manage_invitations',
  ],
  coach: [
    'users.read.assigned',
    'babies.create',
    'babies.read.assigned',
    'babies.update.assigned',
    'babies.archive',
    'sleep_data.read.assigned',
    'sleep_data.write.assigned',
    'reports.generate.assigned',
    'reports.export',
    'system.manage_invitations',
  ],
  parent: [
    'babies.read.assigned',
    'sleep_data.read.assigned',
    'sleep_data.write.assigned',
    'reports.generate.assigned',
  ],
} as const satisfies Record<UserRole, readonly string[]>;

export type Permission = (typeof PERMISSIONS)[UserRole][number];

const PERMISSION_SETS: Record<UserRole, ReadonlySet<string>> = {
  admin: new Set(PERMISSIONS.admin),
  coach: new Set(PERMISSIONS.coach),
  parent: new Set(PERMISSIONS.parent),
};

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'coach' || value === 'parent';
}

/** Pure permission check. No I/O, so it cannot fail open or closed by accident. */
export function roleHasPermission(role: string | undefined | null, permission: string): boolean {
  if (!isUserRole(role)) return false;
  return PERMISSION_SETS[role].has(permission);
}

/** The permission list stored on a user document, for display and back-compat. */
export function getPermissionsForRole(role: string | undefined | null): string[] {
  return isUserRole(role) ? [...PERMISSIONS[role]] : [];
}

/** Where each role lands after login. */
export function getRedirectPathForRole(
  role: string | undefined | null,
  managedBabyProfiles: string[] = []
): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'coach':
      return '/coach/dashboard';
    case 'parent':
      // A parent with no linked baby has nowhere to go; /parent/dashboard does not
      // exist as a route, so sending them there produced a 404.
      return managedBabyProfiles.length > 0 ? `/parent/${managedBabyProfiles[0]}` : '/';
    default:
      return '/';
  }
}

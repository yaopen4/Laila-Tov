// src/lib/auth-service.ts
"use client";

const USER_ROLE_KEY = 'lailaTovUserRole';
const USERNAME_KEY = 'lailaTovUsername';

type UserRole = 'coach' | 'parent' | null;

/**
 * Stores user role and username in localStorage upon login.
 * @param username - The username of the logged-in user.
 * @param role - The role of the logged-in user ('coach' or 'parent').
 */
export function login(username: string, role: 'coach' | 'parent'): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USERNAME_KEY, username);
    localStorage.setItem(USER_ROLE_KEY, role);
  }
}

/**
 * Clears user role and username from localStorage upon logout.
 */
export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(USER_ROLE_KEY);
  }
}

/**
 * Retrieves the current user's username and role from localStorage.
 * @returns An object with username and role, or null if not logged in.
 */
export function getCurrentUser(): { username: string | null; role: UserRole } {
  if (typeof window !== 'undefined') {
    const username = localStorage.getItem(USERNAME_KEY);
    const role = localStorage.getItem(USER_ROLE_KEY) as UserRole;
    return { username, role };
  }
  return { username: null, role: null };
}

/**
 * Checks if the current user is authenticated as a coach.
 * @returns True if the user is a coach, false otherwise.
 */
export function isCoach(): boolean {
  if (typeof window !== 'undefined') {
    const { role } = getCurrentUser();
    return role === 'coach';
  }
  return false;
}

/**
 * Checks if the current user is authenticated as the specified parent.
 * @param expectedParentUsername - The parent username to check against (usually from URL params).
 * @returns True if the user is the correct parent, false otherwise.
 */
export function isParent(expectedParentUsername: string): boolean {
  if (typeof window !== 'undefined') {
    const { username, role } = getCurrentUser();
    return role === 'parent' && username === expectedParentUsername;
  }
  return false;
}

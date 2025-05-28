
// src/lib/auth-service.ts
"use client";

const USER_ROLE_KEY = 'lailaTovUserRole';
const USERNAME_KEY = 'lailaTovUsername';

/**
 * Represents the possible roles a user can have in the application.
 */
type UserRole = 'coach' | 'parent' | null;

/**
 * Stores user role and username in localStorage upon login.
 * This simulates a client-side session.
 * @param {string} username - The username of the logged-in user.
 * @param {'coach' | 'parent'} role - The role of the logged-in user.
 */
export function login(username: string, role: 'coach' | 'parent'): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(USERNAME_KEY, username);
      localStorage.setItem(USER_ROLE_KEY, role);
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      // Optionally, inform the user that login details couldn't be saved.
    }
  }
}

/**
 * Clears user role and username from localStorage upon logout.
 * This effectively ends the client-side session.
 */
export function logout(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(USERNAME_KEY);
      localStorage.removeItem(USER_ROLE_KEY);
    } catch (error) {
      console.error("Error removing from localStorage:", error);
    }
  }
}

/**
 * Retrieves the current user's username and role from localStorage.
 * @returns {{ username: string | null; role: UserRole }} An object with username and role.
 * If not logged in or if localStorage is unavailable, username and role will be null.
 */
export function getCurrentUser(): { username: string | null; role: UserRole } {
  if (typeof window !== 'undefined') {
    try {
      const username = localStorage.getItem(USERNAME_KEY);
      const role = localStorage.getItem(USER_ROLE_KEY) as UserRole;
      return { username, role };
    } catch (error) {
      console.error("Error reading from localStorage:", error);
      return { username: null, role: null };
    }
  }
  return { username: null, role: null }; // Fallback for non-browser environments (e.g., SSR initial pass)
}

/**
 * Checks if the current user is authenticated as a coach.
 * @returns {boolean} True if the user is a coach, false otherwise.
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
 * @param {string} expectedParentUsername - The parent username to check against (usually from URL params).
 * @returns {boolean} True if the user is the correct parent, false otherwise.
 */
export function isParent(expectedParentUsername: string): boolean {
  if (typeof window !== 'undefined') {
    const { username, role } = getCurrentUser();
    return role === 'parent' && username === expectedParentUsername;
  }
  return false;
}

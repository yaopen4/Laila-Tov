
// src/services/authService.ts
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth as firebaseAuthInstance } from '@/lib/firebase'; // Use the initialized auth instance

const COACH_EMAIL_IDENTIFIER = 'coach@lailatov.app'; // Example coach email

export interface AuthUser extends User {
  role?: 'coach' | 'parent';
  parentUsername?: string; // For parents, to link to their baby's data
}

/**
 * Creates a new user account with email and password.
 * @param {string} email - The user's email address.
 * @param {string} password - The user's password.
 * @returns {Promise<UserCredential>} Firebase UserCredential object.
 */
export const signUp = async (email: string, password: string) => {
  return createUserWithEmailAndPassword(firebaseAuthInstance, email, password);
};

/**
 * Logs in an existing user with email and password.
 * @param {string} email - The user's email address.
 * @param {string} password - The user's password.
 * @returns {Promise<UserCredential>} Firebase UserCredential object.
 */
export const login = async (email: string, password: string) => {
  return signInWithEmailAndPassword(firebaseAuthInstance, email, password);
};

/**
 * Logs out the current user.
 * @returns {Promise<void>}
 */
export const logout = async (): Promise<void> => {
  return signOut(firebaseAuthInstance);
};

/**
 * Subscribes to authentication state changes.
 * @param {(user: AuthUser | null) => void} callback - Function to call when auth state changes.
 * @returns {import('firebase/auth').Unsubscribe} Unsubscribe function.
 */
export const onAuthChange = (callback: (user: AuthUser | null) => void) => {
  return onAuthStateChanged(firebaseAuthInstance, (firebaseUser) => {
    if (firebaseUser) {
      // Determine role and parentUsername
      let role: 'coach' | 'parent' = 'parent';
      let parentUsername: string | undefined = undefined;

      if (firebaseUser.email === COACH_EMAIL_IDENTIFIER) {
        role = 'coach';
      } else if (firebaseUser.email?.endsWith('@lailatov.app')) {
        // Assuming parent emails are like parentUsername@lailatov.app
        parentUsername = firebaseUser.email.split('@')[0];
      }
      
      const authUser: AuthUser = {
        ...firebaseUser,
        // These custom props won't actually be on the Firebase User object
        // but we type it this way for convenience in our app.
        // For true roles, use custom claims or Firestore.
        role, 
        parentUsername,
      };
      callback(authUser);
    } else {
      callback(null);
    }
  });
};

/**
 * Gets the current authenticated user from Firebase.
 * @returns {Promise<AuthUser | null>} A promise that resolves with the AuthUser or null.
 */
export const getCurrentUser = (): Promise<AuthUser | null> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(firebaseAuthInstance, (firebaseUser) => {
      unsubscribe(); // Unsubscribe after first callback
      if (firebaseUser) {
        let role: 'coach' | 'parent' = 'parent';
        let parentUsername: string | undefined = undefined;
  
        if (firebaseUser.email === COACH_EMAIL_IDENTIFIER) {
          role = 'coach';
        } else if (firebaseUser.email?.endsWith('@lailatov.app')) {
          parentUsername = firebaseUser.email.split('@')[0];
        }
        
        const authUser: AuthUser = {
          ...firebaseUser,
          role,
          parentUsername,
        };
        resolve(authUser);
      } else {
        resolve(null);
      }
    }, reject);
  });
};


/**
 * Checks if the current user is authenticated as a coach.
 * This is a simplified check based on email. For production, use custom claims.
 * @param {User | null} user - The Firebase user object.
 * @returns {boolean} True if the user is a coach, false otherwise.
 */
export const isCoachUser = (user: User | null): boolean => {
  return user?.email === COACH_EMAIL_IDENTIFIER;
};

/**
 * Checks if the current user is authenticated as the specified parent.
 * This is a simplified check based on email.
 * @param {User | null} user - The Firebase user object.
 * @param {string} expectedParentUsername - The parent username to check against.
 * @returns {boolean} True if the user is the correct parent, false otherwise.
 */
export const isParentUser = (user: User | null, expectedParentUsername: string): boolean => {
  if (!user || !user.email) return false;
  const usernameFromEmail = user.email.split('@')[0];
  return user.email.endsWith('@lailatov.app') && usernameFromEmail === expectedParentUsername;
};

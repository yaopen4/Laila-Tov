
// src/services/authService.ts
import {
  signInWithEmailAndPassword,
  onAuthStateChanged as firebaseOnAuthStateChanged, // Renamed to avoid conflict
  type User as FirebaseUser, // Renamed to avoid conflict
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut, // Renamed to avoid conflict
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, type FieldValue } from 'firebase/firestore';
import { auth as firebaseAuthInstance, db } from '@/lib/firebase';
import type { Invite, User as AppUser, CoachProfile, BabyFormData } from '@/types';


const COACH_EMAIL_IDENTIFIER = 'coach@lailatov.app'; // Used in older direct login
const ADMIN_EMAIL_IDENTIFIER = 'admin@lailatov.app'; // Example admin email for direct login differentiation

// This is the user object shape used throughout the app, combining Firebase Auth and Firestore data
export interface AuthUser extends FirebaseUser {
  name?: string;
  role?: AppUser['role'];
  status?: AppUser['status'];
  parentUsername?: string; // This is the baby's ID for parent routing
  coachId?: string; // If the user is a parent, this is their coach's UID. If a coach, their own UID.
  linkedBabyId?: string;
}

/**
 * Upserts a user document in Firestore. Creates if not exists, updates if exists.
 * This is called on registration and login to ensure Firestore is in sync.
 * @param firebaseUser The user object from Firebase Authentication.
 * @param additionalData Additional data to merge, like role during registration.
 * @returns {Promise<UserDoc>} The user document data from Firestore.
 */
export const upsertUserDocument = async (
  firebaseUser: FirebaseUser,
  additionalData: Partial<AppUser> = {}
): Promise<AppUser> => {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // New user document
    const newUserDocData: AppUser = {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: additionalData.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'N/A',
      role: additionalData.role || 'parent', // Default to parent if not specified
      status: additionalData.status || 'active',
      lastLogin: serverTimestamp() as Timestamp,
      ...additionalData, // Spread any other provided data
    };
    await setDoc(userRef, newUserDocData);
    return newUserDocData;
  } else {
    // Existing user, update (e.g., last login, or if role needs to be synced from a trusted source)
    const existingData = userSnap.data() as AppUser;
    const dataToSet: Partial<AppUser> = {
      lastLogin: serverTimestamp() as Timestamp,
      ...additionalData, // Merge additional data, could override existing if keys match
    };
    // Only update if there's something new, or ensure role is not accidentally changed on login
    if (Object.keys(additionalData).length > 0 && additionalData.role && additionalData.role !== existingData.role) {
        // If a role is explicitly passed (e.g. during a specific role-changing flow), update it.
        // Otherwise, preserve the existing role on simple login.
        dataToSet.role = additionalData.role;
    } else {
        // If no role is in additionalData, ensure we don't accidentally wipe it.
        // And ensure existing role is part of the returned data.
        dataToSet.role = existingData.role;
    }


    if (Object.keys(dataToSet).length > 0) {
        await setDoc(userRef, dataToSet, { merge: true });
    }
    // Return the merged view of the document
    return { ...existingData, ...dataToSet } as AppUser;
  }
};


/**
 * Registers a new user with email, password, and name.
 * Intended for coach or parent registration (parent via invite).
 * @param {string} email
 * @param {string} password
 * @param {string} name
 * @param {'coach' | 'parent'} role
 * @param {string} [status] - Initial status
 * @param {Invite} [invite] - For parent registration
 * @returns {Promise<AuthUser>}
 */
export const registerWithEmail = async (
  email: string,
  password: string,
  name: string,
  role: 'coach' | 'parent',
  status: AppUser['status'] = 'active',
  invite?: Invite | null, // invite is null for coach registration
): Promise<AuthUser> => {
  const userCredential = await createUserWithEmailAndPassword(firebaseAuthInstance, email, password);
  const firebaseUser = userCredential.user;

  const userDocData: Partial<AppUser> = {
    id: firebaseUser.uid,
    email: firebaseUser.email!,
    name: name,
    role: role,
    status: status,
  };

  if (role === 'parent' && invite && invite.babyData) {
    // Note: The 'coachId' and 'inviteCode' fields do not exist on the 'User' type.
    // This logic might need to be re-evaluated if this data needs to be stored on the user document.
    // For now, we assume this info is primarily on the baby document.
  }

  const finalUserDoc = await upsertUserDocument(firebaseUser, userDocData);
  
  // If it's a coach, also create their specific profile in the 'coaches' collection
  if (role === 'coach') {
    const coachProfileRef = doc(db, 'coaches', finalUserDoc.id);
    const newCoachProfile: CoachProfile = {
      id: finalUserDoc.id,
      clientCount: 0, // Initialize with 0 clients
    };
    await setDoc(coachProfileRef, newCoachProfile);
  }

  return {
    ...firebaseUser,
    name: finalUserDoc.name,
    role: finalUserDoc.role,
    status: finalUserDoc.status,
    parentUsername: role === 'parent' && invite && invite.babyData ? invite.babyData.parentUsername : undefined,
    coachId: role === 'parent' && invite ? invite.coachId : (role === 'coach' ? firebaseUser.uid : undefined),
    linkedBabyId: role === 'parent' && invite && invite.babyData ? invite.babyData.parentUsername : undefined,
  };
};

/**
 * Logs in an existing user with email and password.
 * Also ensures their Firestore user document is up-to-date or created.
 * @param {string} email - The user's email address.
 * @param {string} password - The user's password.
 * @returns {Promise<AuthUser>} Enhanced Firebase User object with role and other app-specific data.
 */
export const loginWithEmail = async (email: string, password: string): Promise<AuthUser> => {
  const userCredential = await signInWithEmailAndPassword(firebaseAuthInstance, email, password);
  const firebaseUser = userCredential.user;
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const userDocSnap = await getDoc(userDocRef);

  if (!userDocSnap.exists()) {
      // This is a critical failure. The user exists in Auth but not Firestore.
      // This could happen if the Firestore user doc creation failed during signup.
      // We should not proceed as we cannot determine their role.
      // Log them out and show an error.
      await signOut(); // Ensure they are logged out to prevent being in a broken state.
      throw new Error("User document or role not found. Please contact support.");
  }
  
  const userDoc = userDocSnap.data() as AppUser;
  
  // To get the linked baby for a parent, we would now need to query the 'babies' collection
  // where the 'parentIds' array contains the user's UID.
  // This is a more complex query and might be better handled in the component that needs this data.
  // For now, we will leave this part simplified. The dashboard already queries for its own data.
  
  return {
    ...firebaseUser, // Spread Firebase Auth user properties (uid, email, etc.)
    role: userDoc.role,
    status: userDoc.status,
    name: userDoc.name || firebaseUser.displayName || undefined,
    // 'parentUsername' and 'linkedBabyId' are derived properties and should be fetched
    // by the specific page/component that needs them, by querying the 'babies' collection.
    coachId: userDoc.role === 'coach' ? firebaseUser.uid : undefined,
  };
};


/**
 * Logs out the current user.
 * @returns {Promise<void>}
 */
export const signOut = async (): Promise<void> => {
  return firebaseSignOut(firebaseAuthInstance);
};

/**
 * Subscribes to authentication state changes.
 * @param {(user: AuthUser | null) => void} callback - Function to call when auth state changes.
 * @returns {import('firebase/auth').Unsubscribe} Unsubscribe function.
 */
export const onAuthChange = (callback: (user: AuthUser | null) => void) => {
  return firebaseOnAuthStateChanged(firebaseAuthInstance, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        // On auth change, always try to get the full user profile from Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userDocData = userDocSnap.data() as AppUser;

          const authUser: AuthUser = {
            ...firebaseUser,
            name: userDocData.name,
            role: userDocData.role,
            status: userDocData.status,
            // Derived properties should be fetched by components that need them.
            coachId: userDocData.role === 'coach' ? firebaseUser.uid : undefined,
          };
          callback(authUser);
        } else {
          // User is authenticated with Firebase Auth, but no corresponding Firestore document.
          // This could happen if Firestore creation failed or was deleted.
          // Or if Firestore rules prevent reading this user's own document.
          console.warn(`No Firestore document found for authenticated user ${firebaseUser.uid}. Role will be undefined.`);
          callback({ ...firebaseUser, role: undefined, status: undefined }); // Pass as AuthUser with undefined role
        }
      } catch (error) {
        console.error("Error fetching user document in onAuthChange:", error);
        // If Firestore read fails (e.g. permissions), role will be unknown
        callback({ ...firebaseUser, role: undefined, status: undefined });
      }
    } else {
      callback(null);
    }
  });
};

/**
 * Gets the current authenticated user from Firebase, enhanced with Firestore data.
 * @returns {Promise<AuthUser | null>} A promise that resolves with the AuthUser or null.
 */
export const getCurrentUser = (): Promise<AuthUser | null> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = firebaseOnAuthStateChanged(firebaseAuthInstance, async (firebaseUser) => {
      unsubscribe();
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userDocData = userDocSnap.data() as AppUser;
            
            resolve({
              ...firebaseUser,
              name: userDocData.name,
              role: userDocData.role,
              status: userDocData.status,
              // Derived properties, should be fetched by components as needed
              coachId: userDocData.role === 'coach' ? firebaseUser.uid : undefined,
            });
          } else {
            console.warn(`No Firestore document for user ${firebaseUser.uid} in getCurrentUser.`);
            resolve({ ...firebaseUser, role: undefined, status: undefined });
          }
        } catch (error) {
            console.error("Error fetching user document in getCurrentUser:", error);
            // If Firestore read fails, resolve with Firebase user but undefined role
            resolve({ ...firebaseUser, role: undefined, status: undefined });
        }
      } else {
        resolve(null);
      }
    }, (error) => { // Handle errors from onAuthStateChanged itself
        unsubscribe();
        reject(error);
    });
  });
};

/**
 * Checks if the current user is authenticated as an admin based on their role in Firestore.
 * @param {AuthUser | null} user - The application's AuthUser object (includes role).
 * @returns {boolean} True if the user is an admin, false otherwise.
 */
export const isAdminUser = (user: AuthUser | null): boolean => {
  return user?.role === 'admin';
};

/**
 * Checks if the current user is authenticated as a coach based on their role in Firestore.
 * @param {AuthUser | null} user - The application's AuthUser object.
 * @returns {boolean} True if the user is a coach, false otherwise.
 */
export const isCoachUser = (user: AuthUser | null): boolean => {
  return user?.role === 'coach';
};

/**
 * Checks if the current user is authenticated as the specified parent.
 * This now primarily relies on the role and potentially the parentUsername if needed for finer checks.
 * @param {AuthUser | null} user - The application's AuthUser object.
 * @param {string} [expectedBabyIdForParentPage] - The babyId (which is parentUsername on baby doc) being accessed.
 * @returns {boolean} True if the user is the correct parent, false otherwise.
 */
export const isParentUser = (user: AuthUser | null, expectedBabyIdForParentPage?: string): boolean => {
  if (user?.role !== 'parent') return false;
  if (expectedBabyIdForParentPage) {
    // User's parentUsername (which is their linked baby's ID) must match the page they are trying to access.
    return user.parentUsername === expectedBabyIdForParentPage;
  }
  return true; // It's a parent, generic check
};


/**
 * Fetches all user documents that have the role 'coach'.
 * This is intended for admin use.
 * @returns {Promise<UserDoc[]>} An array of coach user documents.
 */
import { collection, query, where, getDocs } from 'firebase/firestore';

export const getAllCoachUsers = async (): Promise<AppUser[]> => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('role', '==', 'coach'));
  const querySnapshot = await getDocs(q);
  const coaches: AppUser[] = [];
  querySnapshot.forEach((doc) => {
    coaches.push({ id: doc.id, ...doc.data() } as AppUser);
  });
  return coaches;
};

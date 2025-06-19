
// src/services/authService.ts
import {
  signInWithEmailAndPassword,
  onAuthStateChanged as firebaseOnAuthStateChanged, // Renamed to avoid conflict
  type User as FirebaseUser, // Renamed to avoid conflict
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut, // Renamed to avoid conflict
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth as firebaseAuthInstance, db } from '@/lib/firebase';
import type { Invite } from '@/types';

const COACH_EMAIL_IDENTIFIER = 'coach@lailatov.app'; // Used in older direct login
const ADMIN_EMAIL_IDENTIFIER = 'admin@lailatov.app'; // Example admin email for direct login differentiation

export interface UserDoc {
  uid: string;
  email: string;
  name?: string;
  role: 'admin' | 'coach' | 'parent';
  status: 'active' | 'pending_approval' | 'pending_payment' | 'invited';
  createdAt: Timestamp | FieldValue;
  coachId?: string; // For parents, linking to their coach
  inviteCode?: string; // For parents, the invite code they used
  linkedBabyId?: string; // For parents, to quickly find their baby if needed
}

// This is the user object shape used throughout the app, combining Firebase Auth and Firestore data
export interface AuthUser extends FirebaseUser {
  name?: string;
  role?: 'admin' | 'coach' | 'parent';
  status?: UserDoc['status'];
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
  additionalData: Partial<UserDoc> = {}
): Promise<UserDoc> => {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // New user document
    const newUserDocData: UserDoc = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: additionalData.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'N/A',
      role: additionalData.role || 'parent', // Default to parent if not specified
      status: additionalData.status || 'active',
      createdAt: serverTimestamp() as Timestamp, // Use serverTimestamp for creation
      ...additionalData, // Spread any other provided data
    };
    await setDoc(userRef, newUserDocData);
    return newUserDocData;
  } else {
    // Existing user, update (e.g., last login, or if role needs to be synced from a trusted source)
    // For login, we generally don't want to override existing role unless explicitly intended
    const existingData = userSnap.data() as UserDoc;
    const dataToSet: Partial<UserDoc> = {
      // lastLogin: serverTimestamp(), // Example: track last login
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
    return { ...existingData, ...dataToSet } as UserDoc;
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
  status: UserDoc['status'] = 'active',
  invite?: Invite | null, // invite is null for coach registration
): Promise<AuthUser> => {
  const userCredential = await createUserWithEmailAndPassword(firebaseAuthInstance, email, password);
  const firebaseUser = userCredential.user;

  const userDocData: Partial<UserDoc> = {
    uid: firebaseUser.uid,
    email: firebaseUser.email!,
    name: name,
    role: role,
    status: status,
  };

  if (role === 'parent' && invite) {
    userDocData.coachId = invite.coachId;
    userDocData.inviteCode = invite.id;
    userDocData.linkedBabyId = invite.babyData.parentUsername; // This is the crucial link for parent's baby
  }

  const finalUserDoc = await upsertUserDocument(firebaseUser, userDocData);

  return {
    ...firebaseUser,
    name: finalUserDoc.name,
    role: finalUserDoc.role,
    status: finalUserDoc.status,
    parentUsername: role === 'parent' ? finalUserDoc.linkedBabyId : undefined,
    coachId: role === 'parent' ? finalUserDoc.coachId : (role === 'coach' ? firebaseUser.uid : undefined),
    linkedBabyId: finalUserDoc.linkedBabyId,
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

  // upsertUserDocument will fetch the existing Firestore user document.
  // We pass an empty object for additionalData as we're not changing role/name on login here.
  // The role should be pre-existing from manual setup (admin) or registration (coach/parent).
  const userDoc = await upsertUserDocument(firebaseUser, {});

  if (!userDoc || !userDoc.role) {
    // This case should be rare if setup/registration is correct.
    // It means the Firestore document for the user is missing or doesn't have a role.
    // The Firestore rules might have prevented reading/creating this doc.
    console.error(`User document or role not found for UID: ${firebaseUser.uid}. Check Firestore data and rules.`);
    // Fallback or throw error - throwing might be better to highlight the issue.
    // For now, let's try to proceed but log verbosely.
    // If this happens, admin redirection will fail.
    // This is where the "Missing or insufficient permissions" for reading /users/{uid} would manifest.
    return {
        ...firebaseUser,
        role: undefined, // Indicate role is unknown
        status: undefined,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
      };
  }
  
  let parentUsernameForRouting: string | undefined = undefined;
  if (userDoc.role === 'parent') {
    // For parents, the parentUsername used for routing is the baby's identifier they are linked to.
    // This was set as `linkedBabyId` during invite redemption.
    parentUsernameForRouting = userDoc.linkedBabyId;
    if(!parentUsernameForRouting) {
        // Fallback for older parent accounts if linkedBabyId wasn't set.
        // This assumes parent emails like parentUsername@lailatov.app maps to baby's parentUsername
        parentUsernameForRouting = firebaseUser.email?.split('@')[0];
    }
  }


  return {
    ...firebaseUser, // Spread Firebase Auth user properties (uid, email, etc.)
    role: userDoc.role,
    status: userDoc.status,
    name: userDoc.name || firebaseUser.displayName,
    parentUsername: parentUsernameForRouting,
    coachId: userDoc.role === 'coach' ? firebaseUser.uid : (userDoc.role === 'parent' ? userDoc.coachId : undefined),
    linkedBabyId: userDoc.linkedBabyId,
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
          const userDocData = userDocSnap.data() as UserDoc;
          
          let parentUsernameForRouting: string | undefined = undefined;
          if (userDocData.role === 'parent') {
             parentUsernameForRouting = userDocData.linkedBabyId || firebaseUser.email?.split('@')[0];
          }

          const authUser: AuthUser = {
            ...firebaseUser,
            name: userDocData.name,
            role: userDocData.role,
            status: userDocData.status,
            parentUsername: parentUsernameForRouting,
            coachId: userDocData.role === 'coach' ? firebaseUser.uid : (userDocData.role === 'parent' ? userDocData.coachId : undefined),
            linkedBabyId: userDocData.linkedBabyId,
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
            const userDocData = userDocSnap.data() as UserDoc;
            
            let parentUsernameForRouting: string | undefined = undefined;
            if (userDocData.role === 'parent') {
              parentUsernameForRouting = userDocData.linkedBabyId || firebaseUser.email?.split('@')[0];
            }

            resolve({
              ...firebaseUser,
              name: userDocData.name,
              role: userDocData.role,
              status: userDocData.status,
              parentUsername: parentUsernameForRouting,
              coachId: userDocData.role === 'coach' ? firebaseUser.uid : (userDocData.role === 'parent' ? userDocData.coachId : undefined),
              linkedBabyId: userDocData.linkedBabyId,
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
import { collection, query, where, getDocs, type FieldValue } from 'firebase/firestore';

export const getAllCoachUsers = async (): Promise<UserDoc[]> => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('role', '==', 'coach'));
  const querySnapshot = await getDocs(q);
  const coaches: UserDoc[] = [];
  querySnapshot.forEach((doc) => {
    coaches.push({ uid: doc.id, ...doc.data() } as UserDoc);
  });
  return coaches;
};

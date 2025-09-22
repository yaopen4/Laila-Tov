
// src/services/authService.ts
import {
  signInWithEmailAndPassword,
  onAuthStateChanged as firebaseOnAuthStateChanged, // Renamed to avoid conflict
  type User as FirebaseUser, // Renamed to avoid conflict
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut, // Renamed to avoid conflict
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, type FieldValue } from 'firebase/firestore';
import { auth as firebaseAuthInstance, db } from '@/lib/firebase';
import type { Invite, User as AppUser, CoachProfile, BabyFormData } from '@/types';
import { EventCategory, AuditEventType } from '@/types';
import { redeemInvitePartially, activatePlaceholderUser, getInviteByCodeFromFirestore } from '@/services/inviteService';
import { logger, logAudit, withPerformanceLogging } from '@/services/loggingService';


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
  return withPerformanceLogging('upsertUserDocument', async () => {
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

      // Log user creation audit trail
      await logAudit(AuditEventType.USER_CREATED, `User document created for ${firebaseUser.email}`, {
        resourceId: firebaseUser.uid,
        resourceType: 'user',
        newValue: {
          email: newUserDocData.email,
          role: newUserDocData.role,
          status: newUserDocData.status
        },
        success: true,
        metadata: {
          registrationMethod: 'upsert',
          hasAdditionalData: Object.keys(additionalData).length > 0
        }
      });

      await logger.info('User document created successfully', EventCategory.USER_MANAGEMENT, {
        userId: firebaseUser.uid,
        email: firebaseUser.email,
        role: newUserDocData.role
      });

      return newUserDocData;
    } else {
      // Existing user, update (e.g., last login, or if role needs to be synced from a trusted source)
      const existingData = userSnap.data() as AppUser;
      const oldValue = { ...existingData };
      const dataToSet: Partial<AppUser> = {
        lastLogin: serverTimestamp() as Timestamp,
        ...additionalData, // Merge additional data, could override existing if keys match
      };

      // Only update if there's something new, or ensure role is not accidentally changed on login
      if (Object.keys(additionalData).length > 0 && additionalData.role && additionalData.role !== existingData.role) {
          // If a role is explicitly passed (e.g. during a specific role-changing flow), update it.
          // Otherwise, preserve the existing role on simple login.
          dataToSet.role = additionalData.role;

          // Log role change audit trail
          await logAudit(AuditEventType.ROLE_CHANGED, `User role changed from ${existingData.role} to ${additionalData.role}`, {
            resourceId: firebaseUser.uid,
            resourceType: 'user',
            oldValue: { role: existingData.role },
            newValue: { role: additionalData.role },
            success: true,
            metadata: { triggeredBy: 'upsertUserDocument' }
          });
      } else {
          // If no role is in additionalData, ensure we don't accidentally wipe it.
          // And ensure existing role is part of the returned data.
          dataToSet.role = existingData.role;
      }

      if (Object.keys(dataToSet).length > 0) {
          await setDoc(userRef, dataToSet, { merge: true });

          // Log user update audit trail
          await logAudit(AuditEventType.USER_UPDATED, `User document updated for ${firebaseUser.email}`, {
            resourceId: firebaseUser.uid,
            resourceType: 'user',
            oldValue,
            newValue: { ...existingData, ...dataToSet },
            success: true,
            metadata: {
              updatedFields: Object.keys(dataToSet),
              hasRoleChange: dataToSet.role !== existingData.role
            }
          });
      }

      // Return the merged view of the document
      return { ...existingData, ...dataToSet } as AppUser;
    }
  }, {
    userId: firebaseUser.uid,
    email: firebaseUser.email,
    operation: 'user_document_upsert'
  });
};


/**
 * Registers a new user with email, password, and name using invitation validation.
 * Activates placeholder user records and validates invitation requirements.
 * @param {string} email
 * @param {string} password
 * @param {string} name
 * @param {string} inviteCode - Required invitation code
 * @returns {Promise<AuthUser>}
 */
export const registerWithEmailAndInvite = async (
  email: string,
  password: string,
  name: string,
  inviteCode: string
): Promise<AuthUser> => {
  return withPerformanceLogging('registerWithEmailAndInvite', async () => {
    const startTime = Date.now();

    try {
      // First, validate the invitation with the provided email
      await logger.info('Starting user registration with invite', EventCategory.AUTHENTICATION, {
        email,
        inviteCode,
        name
      });

      const invite = await getInviteByCodeFromFirestore(inviteCode, email);
      
      if (!invite) {
        const error = new Error('Invalid invitation code or email does not match invitation.');
        await logAudit(AuditEventType.SIGNUP_FAILED, 'Registration failed: Invalid invitation', {
          success: false,
          metadata: { email, inviteCode, reason: 'invalid_invitation' },
          error
        });
        throw error;
      }
      
      if (invite.status === 'expired') {
        const error = new Error('This invitation has expired.');
        await logAudit(AuditEventType.SIGNUP_FAILED, 'Registration failed: Expired invitation', {
          success: false,
          metadata: { email, inviteCode, inviteStatus: invite.status },
          error
        });
        throw error;
      }
      
      if (invite.status === 'revoked') {
        const error = new Error('This invitation has been revoked.');
        await logAudit(AuditEventType.SIGNUP_FAILED, 'Registration failed: Revoked invitation', {
          success: false,
          metadata: { email, inviteCode, inviteStatus: invite.status },
          error
        });
        throw error;
      }
      
      if (invite.status === 'completed') {
        const error = new Error('This invitation has already been fully redeemed.');
        await logAudit(AuditEventType.SIGNUP_FAILED, 'Registration failed: Already redeemed invitation', {
          success: false,
          metadata: { email, inviteCode, inviteStatus: invite.status },
          error
        });
        throw error;
      }

      // Determine role from invite (babyData indicates parent invite, otherwise coach)
      const role = invite.babyData ? 'parent' : 'coach';
      
      await logger.info('Invitation validated successfully', EventCategory.AUTHENTICATION, {
        email,
        inviteCode,
        role,
        inviteStatus: invite.status
      });

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(firebaseAuthInstance, email, password);
      const firebaseUser = userCredential.user;

      await logger.info('Firebase Auth user created', EventCategory.AUTHENTICATION, {
        userId: firebaseUser.uid,
        email: firebaseUser.email
      });

      try {
        let finalUserDoc: AppUser;
        
        if (role === 'coach') {
          // For coaches, create the user document directly (no placeholder system)
          const userDocData: AppUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: name,
            role: 'coach',
            status: 'active',
            lastLogin: serverTimestamp() as Timestamp,
          };
          
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          await setDoc(userDocRef, userDocData);
          finalUserDoc = userDocData;
          
          await logger.info('Coach user document created directly', EventCategory.USER_MANAGEMENT, {
            userId: firebaseUser.uid,
            email: firebaseUser.email,
            role: 'coach'
          });
        } else {
          // For parents, use the placeholder activation system
          await activatePlaceholderUser(email, firebaseUser.uid, name);
          
          // Get the activated user document
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (!userDocSnap.exists()) {
            throw new Error('Failed to activate user account.');
          }
          
          finalUserDoc = userDocSnap.data() as AppUser;
        }
        
        // If it's a coach, also create their specific profile in the 'coaches' collection
        if (role === 'coach') {
          const coachProfileRef = doc(db, 'coaches', finalUserDoc.id);
          const newCoachProfile: CoachProfile = {
            id: finalUserDoc.id,
            clientCount: 0, // Initialize with 0 clients
          };
          await setDoc(coachProfileRef, newCoachProfile);

          await logger.info('Coach profile created', EventCategory.USER_MANAGEMENT, {
            userId: finalUserDoc.id,
            email: finalUserDoc.email
          });
        }
        
        // Redeem the invite
        await redeemInvitePartially(invite.id, firebaseUser.uid, email);

        // Log successful registration audit trail
        await logAudit(AuditEventType.SIGNUP_SUCCESS, `User registration completed successfully for ${email}`, {
          resourceId: firebaseUser.uid,
          resourceType: 'user',
          newValue: {
            email: finalUserDoc.email,
            role: finalUserDoc.role,
            status: finalUserDoc.status
          },
          success: true,
          duration: Date.now() - startTime,
          metadata: {
            inviteCode,
            role,
            registrationMethod: 'invite',
            inviteRedeemed: true
          }
        });

        await logger.info('User registration completed successfully', EventCategory.AUTHENTICATION, {
          userId: firebaseUser.uid,
          email: firebaseUser.email,
          role: finalUserDoc.role,
          duration: Date.now() - startTime
        });

        return {
          ...firebaseUser,
          name: finalUserDoc.name,
          role: finalUserDoc.role,
          status: finalUserDoc.status,
          parentUsername: role === 'parent' && invite && invite.babyData ? invite.babyData.parentUsername : undefined,
          coachId: role === 'parent' && invite ? invite.coachId : (role === 'coach' ? firebaseUser.uid : undefined),
          linkedBabyId: role === 'parent' && invite && invite.babyData ? invite.babyData.parentUsername : undefined,
        };
      } catch (error) {
        // If anything fails after creating the Firebase user, clean up
        const cleanupStartTime = Date.now();
        try {
          await firebaseUser.delete();
          await logger.warn('Firebase user cleaned up after registration failure', EventCategory.AUTHENTICATION, {
            userId: firebaseUser.uid,
            email: firebaseUser.email,
            cleanupDuration: Date.now() - cleanupStartTime
          });
        } catch (deleteError) {
          await logger.error('Failed to clean up Firebase user after registration failure', deleteError as Error, EventCategory.AUTHENTICATION, {
            userId: firebaseUser.uid,
            email: firebaseUser.email,
            originalError: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        // Log registration failure audit trail
        await logAudit(AuditEventType.SIGNUP_FAILED, `User registration failed for ${email}`, {
          resourceId: firebaseUser.uid,
          resourceType: 'user',
          success: false,
          duration: Date.now() - startTime,
          metadata: {
            email,
            inviteCode,
            role,
            stage: 'post_firebase_creation',
            cleanupAttempted: true
          },
          error: error instanceof Error ? error : new Error('Unknown registration error')
        });

        throw error;
      }
    } catch (error) {
      if (!error.message?.includes('Registration failed:')) {
        // Log generic registration failure if not already logged
        await logAudit(AuditEventType.SIGNUP_FAILED, `User registration failed for ${email}`, {
          success: false,
          duration: Date.now() - startTime,
          metadata: {
            email,
            inviteCode,
            stage: 'validation_or_creation'
          },
          error: error instanceof Error ? error : new Error('Unknown registration error')
        });
      }

      await logger.error('User registration failed', error instanceof Error ? error : new Error('Unknown registration error'), EventCategory.AUTHENTICATION, {
        email,
        inviteCode,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }, {
    email,
    inviteCode,
    operation: 'user_registration_with_invite'
  });
};

/**
 * Registers a new user with email, password, and name.
 * Intended for coach or parent registration (parent via invite).
 * @deprecated Use registerWithEmailAndInvite instead for proper invitation validation
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
  
  // If it's a parent registration with an invite, redeem the invite
  if (role === 'parent' && invite) {
    await redeemInvitePartially(invite.id, firebaseUser.uid, email);
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
  return withPerformanceLogging('loginWithEmail', async () => {
    const startTime = Date.now();

    try {
      await logger.info('Starting user login attempt', EventCategory.AUTHENTICATION, {
        email
      });

      const userCredential = await signInWithEmailAndPassword(firebaseAuthInstance, email, password);
      const firebaseUser = userCredential.user;

      await logger.info('Firebase authentication successful', EventCategory.AUTHENTICATION, {
        userId: firebaseUser.uid,
        email: firebaseUser.email
      });

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        // Try to create the user document if it doesn't exist
        // This handles cases where the user exists in Auth but not in Firestore
        await logger.warn('Creating missing user document for authenticated user', EventCategory.AUTHENTICATION, {
          userId: firebaseUser.uid,
          email: firebaseUser.email
        });
        
        // Determine role based on email (fallback method)
        let role: AppUser['role'] = 'parent'; // default
        if (firebaseUser.email === ADMIN_EMAIL_IDENTIFIER || firebaseUser.email?.includes('admin')) {
          role = 'admin';
        } else if (firebaseUser.email === COACH_EMAIL_IDENTIFIER || firebaseUser.email?.includes('coach')) {
          role = 'coach';
        }
        
        const userDoc = await upsertUserDocument(firebaseUser, { role });

        // Log successful login with document creation
        await logAudit(AuditEventType.LOGIN_SUCCESS, `User login successful with document creation for ${email}`, {
          resourceId: firebaseUser.uid,
          resourceType: 'user',
          success: true,
          duration: Date.now() - startTime,
          metadata: {
            email,
            role: userDoc.role,
            documentCreated: true,
            loginMethod: 'email_password'
          }
        });

        await logger.info('User login completed successfully (with document creation)', EventCategory.AUTHENTICATION, {
          userId: firebaseUser.uid,
          email: firebaseUser.email,
          role: userDoc.role,
          duration: Date.now() - startTime
        });
        
        return {
          ...firebaseUser,
          role: userDoc.role,
          status: userDoc.status,
          name: userDoc.name,
          coachId: userDoc.role === 'coach' ? firebaseUser.uid : undefined,
        };
      }
      
      const userDoc = userDocSnap.data() as AppUser;

      // Update last login timestamp
      await upsertUserDocument(firebaseUser);

      // Log successful login audit trail
      await logAudit(AuditEventType.LOGIN_SUCCESS, `User login successful for ${email}`, {
        resourceId: firebaseUser.uid,
        resourceType: 'user',
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          email,
          role: userDoc.role,
          status: userDoc.status,
          loginMethod: 'email_password'
        }
      });

      await logger.info('User login completed successfully', EventCategory.AUTHENTICATION, {
        userId: firebaseUser.uid,
        email: firebaseUser.email,
        role: userDoc.role,
        duration: Date.now() - startTime
      });
      
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
    } catch (error) {
      // Log failed login attempt
      await logAudit(AuditEventType.LOGIN_FAILED, `Login failed for ${email}`, {
        success: false,
        duration: Date.now() - startTime,
        metadata: {
          email,
          errorCode: (error as any)?.code,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        },
        error: error instanceof Error ? error : new Error('Unknown login error')
      });

      await logger.error('User login failed', error instanceof Error ? error : new Error('Unknown login error'), EventCategory.AUTHENTICATION, {
        email,
        duration: Date.now() - startTime,
        errorCode: (error as any)?.code
      });

      throw error;
    }
  }, {
    email,
    operation: 'user_login'
  });
};


/**
 * Logs out the current user.
 * @returns {Promise<void>}
 */
export const signOut = async (): Promise<void> => {
  try {
    const currentUser = firebaseAuthInstance.currentUser;
    const userEmail = currentUser?.email;
    const userId = currentUser?.uid;

    await firebaseSignOut(firebaseAuthInstance);

    // Log successful logout
    await logAudit(AuditEventType.LOGOUT, `User logout successful`, {
      resourceId: userId,
      resourceType: 'user',
      success: true,
      metadata: {
        email: userEmail,
        logoutMethod: 'manual'
      }
    });

    await logger.info('User logout successful', EventCategory.AUTHENTICATION, {
      userId,
      email: userEmail
    });
  } catch (error) {
    await logger.error('User logout failed', error instanceof Error ? error : new Error('Unknown logout error'), EventCategory.AUTHENTICATION);
    throw error;
  }
};

/**
 * Sends a password reset email to the specified address.
 * @param {string} email - The user's email.
 * @returns {Promise<void>}
 */
export const sendPasswordReset = async (email: string): Promise<void> => {
  const startTime = Date.now();
  const normalizedEmail = email.toLowerCase();

  try {
    await logger.info('Password reset requested', EventCategory.AUTHENTICATION, {
      email: normalizedEmail
    });

    await sendPasswordResetEmail(firebaseAuthInstance, normalizedEmail);

    // Log successful password reset request
    await logAudit(AuditEventType.PASSWORD_RESET_REQUEST, `Password reset email sent to ${normalizedEmail}`, {
      success: true,
      duration: Date.now() - startTime,
      metadata: {
        email: normalizedEmail,
        resetMethod: 'email'
      }
    });

    await logger.info('Password reset email sent successfully', EventCategory.AUTHENTICATION, {
      email: normalizedEmail,
      duration: Date.now() - startTime
    });
  } catch (error) {
    // Log failed password reset request
    await logAudit(AuditEventType.PASSWORD_RESET_REQUEST, `Password reset failed for ${normalizedEmail}`, {
      success: false,
      duration: Date.now() - startTime,
      metadata: {
        email: normalizedEmail,
        errorCode: (error as any)?.code,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      },
      error: error instanceof Error ? error : new Error('Unknown password reset error')
    });

    await logger.error('Password reset failed', error instanceof Error ? error : new Error('Unknown password reset error'), EventCategory.AUTHENTICATION, {
      email: normalizedEmail,
      duration: Date.now() - startTime,
      errorCode: (error as any)?.code
    });

    throw error;
  }
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
 * Ensures the current user has admin privileges and a valid Firestore document.
 * @returns {Promise<void>} Throws an error if the user is not an admin.
 */
export const ensureAdminAccess = async (): Promise<void> => {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      const error = new Error('User not authenticated');
      await logAudit(AuditEventType.UNAUTHORIZED_ACCESS, 'Admin access denied: User not authenticated', {
        success: false,
        metadata: { accessType: 'admin', reason: 'not_authenticated' },
        error
      });
      throw error;
    }
    
    if (!currentUser.role) {
      const error = new Error('User role not found. Please contact support.');
      await logAudit(AuditEventType.UNAUTHORIZED_ACCESS, 'Admin access denied: User role not found', {
        resourceId: currentUser.uid,
        resourceType: 'user',
        success: false,
        metadata: { 
          accessType: 'admin', 
          reason: 'no_role',
          email: currentUser.email 
        },
        error
      });
      throw error;
    }
    
    if (currentUser.role !== 'admin') {
      const error = new Error('Admin access required');
      await logAudit(AuditEventType.PERMISSION_DENIED, `Admin access denied for user with role: ${currentUser.role}`, {
        resourceId: currentUser.uid,
        resourceType: 'user',
        success: false,
        metadata: { 
          accessType: 'admin', 
          userRole: currentUser.role,
          email: currentUser.email,
          reason: 'insufficient_permissions'
        },
        error
      });
      throw error;
    }

    // Log successful admin access verification
    await logger.debug('Admin access verified successfully', {
      userId: currentUser.uid,
      email: currentUser.email,
      role: currentUser.role
    });
  } catch (error) {
    await logger.error('Admin access verification failed', error instanceof Error ? error : new Error('Unknown admin access error'), EventCategory.SECURITY);
    throw error;
  }
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

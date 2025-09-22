// src/services/inviteService.ts
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Invite, BabyFormData, Baby, UserRole, User } from '@/types';

const INVITES_COLLECTION = 'invites';
const BABIES_COLLECTION = 'babies';
const USERS_COLLECTION = 'users';

/**
 * Helper function to get the appropriate email array for an invite based on its type.
 * Handles backward compatibility for older invites.
 * @param {Invite} invite - The invite object
 * @returns {string[]} Array of authorized emails for this invite
 */
const getAuthorizedEmails = (invite: Invite): string[] => {
  const isCoachInvite = !invite.babyData;
  
  if (isCoachInvite) {
    // For coach invites, prefer invitedEmails, but fall back to parentEmails for backward compatibility
    return invite.invitedEmails || invite.parentEmails || [];
  } else {
    // For parent invites, always use parentEmails
    return invite.parentEmails || [];
  }
};

/**
 * Creates a placeholder user record in Firestore for the invitation.
 * This placeholder will be activated when the user actually signs up.
 * @param {string} email - The email address for the placeholder user.
 * @param {UserRole} role - The role to assign to the placeholder user.
 * @param {string} inviteId - The invite ID this placeholder is associated with.
 * @returns {Promise<string>} The placeholder user ID.
 */
export const createPlaceholderUser = async (
  email: string,
  role: UserRole,
  inviteId: string
): Promise<string> => {
  // Generate a placeholder ID based on email and timestamp to ensure uniqueness
  const placeholderId = `placeholder_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
  
  const placeholderUserData: User = {
    id: placeholderId,
    email: email.toLowerCase(),
    name: '', // Will be filled during actual signup
    role: role,
    status: 'disabled', // Placeholder users are disabled until they sign up
    lastLogin: serverTimestamp() as Timestamp,
  };

  const userRef = doc(db, USERS_COLLECTION, placeholderId);
  await setDoc(userRef, placeholderUserData);
  
  return placeholderId;
};

/**
 * Creates a new invite in Firestore with placeholder user records.
 * @param {string} coachId - UID of the coach creating the invite (or admin).
 * @param {BabyFormData} babyData - Data for the baby to be associated with the invite (for parent invites).
 * @param {string[]} inviteEmails - Array of email addresses for the intended users.
 * @param {UserRole} role - The role to assign ('parent' or 'coach').
 * @returns {Promise<string>} The ID (invite code) of the newly created invite document.
 */
export const createInviteInFirestore = async (
  coachId: string,
  babyData: BabyFormData | undefined,
  inviteEmails: string[],
  role: UserRole = 'parent'
): Promise<string> => {
  const invitesRef = collection(db, INVITES_COLLECTION);
  const newInviteRef = doc(invitesRef); 
  const inviteId = newInviteRef.id;

  const createdAt = serverTimestamp() as Timestamp;
  // Make invites expire after 30 days
  const expiresAtDate = new Date();
  expiresAtDate.setDate(expiresAtDate.getDate() + 30);
  const expiresAt = Timestamp.fromDate(expiresAtDate);

  // Normalize emails
  const normalizedEmails = inviteEmails.map(email => email.toLowerCase()).filter(Boolean);

  // Create placeholder users for parent invites only (coaches don't use placeholder system)
  const placeholderUserIds: string[] = [];
  if (role === 'parent') {
    for (const email of normalizedEmails) {
      try {
        const placeholderId = await createPlaceholderUser(email, role, inviteId);
        placeholderUserIds.push(placeholderId);
      } catch (error) {
        console.error(`Failed to create placeholder user for ${email}:`, error);
        // Continue with other emails even if one fails
      }
    }
  }

  const newInviteData: Omit<Invite, 'id'> & { placeholderUserIds?: string[] } = {
    coachId,
    parentEmails: role === 'parent' ? normalizedEmails : [], // Only use parentEmails for parent invites
    invitedEmails: role === 'coach' ? normalizedEmails : undefined, // Use invitedEmails for coach invites
    status: 'pending',
    usedBy: [],
    createdAt,
    expiresAt,
    placeholderUserIds, // Store references to placeholder users
  };

  // Only include babyData for parent invites to avoid undefined values in Firestore
  if (role === 'parent' && babyData) {
    newInviteData.babyData = babyData;
  }

  await setDoc(newInviteRef, newInviteData);
  return inviteId;
};

/**
 * Activates a placeholder user by converting it to a real user account.
 * @param {string} email - The email of the user to activate.
 * @param {string} firebaseUid - The new Firebase Auth UID.
 * @param {string} name - The user's display name.
 * @returns {Promise<void>}
 */
export const activatePlaceholderUser = async (
  email: string,
  firebaseUid: string,
  name: string
): Promise<void> => {
  // Find the placeholder user by email
  const usersRef = collection(db, USERS_COLLECTION);
  const q = query(usersRef, where('email', '==', email.toLowerCase()), where('status', '==', 'disabled'));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    console.warn(`No placeholder user found for email: ${email}`);
    return;
  }

  // There should only be one placeholder per email, but just in case, handle the first one
  const placeholderDoc = querySnapshot.docs[0];
  const placeholderData = placeholderDoc.data() as User;
  
  // Create the new user document with the real Firebase UID
  const newUserData: User = {
    ...placeholderData,
    id: firebaseUid,
    name: name,
    status: 'active',
    lastLogin: serverTimestamp() as Timestamp,
  };
  
  const newUserRef = doc(db, USERS_COLLECTION, firebaseUid);
  await setDoc(newUserRef, newUserData);
  
  // Delete the placeholder user document
  await deleteDoc(doc(db, USERS_COLLECTION, placeholderDoc.id));
};

/**
 * Updates an existing invite in Firestore. Used to add/change emails.
 * @param {string} inviteId - The ID of the invite to update.
 * @param {Partial<Invite>} dataToUpdate - The fields to update (e.g., parentEmails).
 * @returns {Promise<void>}
 */
export const updateInviteInFirestore = async (inviteId: string, dataToUpdate: Partial<Invite>): Promise<void> => {
    const inviteRef = doc(db, INVITES_COLLECTION, inviteId);
    await updateDoc(inviteRef, dataToUpdate);
};


/**
 * Retrieves an invite by its code (document ID) from Firestore with enhanced validation.
 * @param {string} inviteCode - The invite code (document ID).
 * @param {string} [email] - Optional email to validate against the invite.
 * @returns {Promise<Invite | null>} The invite object or null if not found.
 */
export const getInviteByCodeFromFirestore = async (
  inviteCode: string, 
  email?: string
): Promise<Invite | null> => {
  if (!inviteCode) return null;
  const inviteRef = doc(db, INVITES_COLLECTION, inviteCode);
  const docSnap = await getDoc(inviteRef);

  if (docSnap.exists()) {
    const inviteData = docSnap.data() as Omit<Invite, 'id'>;
    
    // Check if expired
    if (inviteData.expiresAt && new Date() > (inviteData.expiresAt as Timestamp).toDate()) {
      if (inviteData.status !== 'expired') {
        await updateDoc(inviteRef, { status: 'expired' });
      }
      return { id: docSnap.id, ...inviteData, status: 'expired' } as Invite;
    }
    
    // Check if revoked
    if (inviteData.status === 'revoked') {
      return { id: docSnap.id, ...inviteData } as Invite;
    }
    
    // If email provided, validate it matches the invite
    if (email) {
      const normalizedEmail = email.toLowerCase();
      const fullInvite = { id: docSnap.id, ...inviteData } as Invite;
      const authorizedEmails = getAuthorizedEmails(fullInvite);
      
      if (!authorizedEmails.includes(normalizedEmail)) {
        return null; // Email doesn't match invite
      }
      
      // Check if this email already redeemed the invite
      if (inviteData.usedBy?.some(user => user.email === normalizedEmail)) {
        return null; // Email already used
      }
    }
    
    return { id: docSnap.id, ...inviteData } as Invite;
  }
  return null;
};

/**
 * Marks an invite as partially or fully redeemed and updates the baby document.
 * @param {string} inviteId - The ID of the invite to redeem.
 * @param {string} redeemingUserId - The Firebase Auth UID of the user redeeming the invite.
 * @param {string} redeemingUserEmail - The email of the user redeeming the invite.
 * @returns {Promise<void>}
 * @throws Will throw an error if the invite is invalid, expired, or already used by this email.
 */
export const redeemInvitePartially = async (
  inviteId: string,
  redeemingUserId: string,
  redeemingUserEmail: string
): Promise<void> => {
  const inviteRef = doc(db, INVITES_COLLECTION, inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) throw new Error('Invite code not found.');

  const invite = { id: inviteSnap.id, ...inviteSnap.data() } as Invite;
  const normalizedRedeemingEmail = redeemingUserEmail.toLowerCase();

  if (invite.status === 'completed') throw new Error('This invite has already been fully redeemed.');
  if (invite.status === 'expired' || (invite.expiresAt && new Date() > (invite.expiresAt as Timestamp).toDate())) {
    if (invite.status !== 'expired') await updateDoc(inviteRef, { status: 'expired' });
    throw new Error('This invite has expired.');
  }
  // Check email against the appropriate field based on invite type
  const authorizedEmails = getAuthorizedEmails(invite);
  
  if (!authorizedEmails.includes(normalizedRedeemingEmail)) {
    throw new Error('Email does not match this invite.');
  }
  if (invite.usedBy.some(user => user.email === normalizedRedeemingEmail)) {
    throw new Error('This email has already redeemed this invite.');
  }

  // Update invite document
  const updatedUsedBy = arrayUnion({
    userId: redeemingUserId,
    email: normalizedRedeemingEmail,
    redeemedAt: serverTimestamp() as Timestamp,
  });

  let newStatus: Invite['status'] = 'partially_redeemed';
  const totalInvitedEmails = authorizedEmails.length;
  
  if (invite.usedBy.length + 1 >= totalInvitedEmails) {
    newStatus = 'completed';
  }

  await updateDoc(inviteRef, { usedBy: updatedUsedBy, status: newStatus });

  // If it's a parent invite, update the corresponding baby document
  if (invite.babyData && invite.babyData.parentUsername) {
      const babyDocId = invite.babyData.parentUsername;
      const babyDocRef = doc(db, BABIES_COLLECTION, babyDocId);
      
      // The baby document should already exist, so we just update it.
      await updateDoc(babyDocRef, {
        parentIds: arrayUnion(redeemingUserId),
        lastModified: new Date().toISOString(),
      });
  }
};

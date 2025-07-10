
// src/services/inviteService.ts
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  FieldValue,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Invite, BabyFormData, Baby } from '@/types';

const INVITES_COLLECTION = 'invites';
const BABIES_COLLECTION = 'babies';

/**
 * Creates a new invite in Firestore for a coach to give to parents.
 * @param {string} coachId - UID of the coach creating the invite.
 * @param {BabyFormData} babyData - Data for the baby to be associated with the invite.
 * @param {string[]} parentEmails - Array of email addresses for the intended parents.
 * @returns {Promise<string>} The ID (invite code) of the newly created invite document.
 */
export const createInviteInFirestore = async (
  coachId: string,
  babyData: BabyFormData,
  parentEmails: string[]
): Promise<string> => {
  const invitesRef = collection(db, INVITES_COLLECTION);
  const newInviteRef = doc(invitesRef); 

  const createdAt = serverTimestamp() as Timestamp;
  const expiresAtDate = new Date();
  expiresAtDate.setDate(expiresAtDate.getDate() + 30);
  const expiresAt = Timestamp.fromDate(expiresAtDate);

  const newInviteData: Omit<Invite, 'id'> = {
    coachId,
    babyData, // This being present indicates it's a parent invite
    parentEmails: parentEmails.map(email => email.toLowerCase()),
    status: 'pending',
    usedBy: [],
    createdAt,
    expiresAt,
  };

  await setDoc(newInviteRef, newInviteData);
  return newInviteRef.id;
};


/**
 * Retrieves an invite by its code (document ID) from Firestore.
 * @param {string} inviteCode - The invite code (document ID).
 * @returns {Promise<Invite | null>} The invite object or null if not found.
 */
export const getInviteByCodeFromFirestore = async (inviteCode: string): Promise<Invite | null> => {
  if (!inviteCode) return null;
  const inviteRef = doc(db, INVITES_COLLECTION, inviteCode);
  const docSnap = await getDoc(inviteRef);

  if (docSnap.exists()) {
    const inviteData = docSnap.data() as Omit<Invite, 'id'>;
    // Check for expiration server-side, though client might check too
    if (inviteData.expiresAt && new Date() > (inviteData.expiresAt as Timestamp).toDate()) {
      if (inviteData.status !== 'expired') {
        await updateDoc(inviteRef, { status: 'expired' });
      }
      return { id: docSnap.id, ...inviteData, status: 'expired' } as Invite;
    }
    return { id: docSnap.id, ...inviteData } as Invite;
  }
  return null;
};

/**
 * Marks an invite as partially or fully redeemed and handles baby document creation/update if applicable.
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

  if (!inviteSnap.exists()) {
    throw new Error('Invite code not found.');
  }

  const invite = { id: inviteSnap.id, ...inviteSnap.data() } as Invite;
  const normalizedRedeemingEmail = redeemingUserEmail.toLowerCase();

  if (invite.status === 'completed') {
    throw new Error('This invite has already been fully redeemed.');
  }
  if (invite.status === 'expired' || (invite.expiresAt && new Date() > (invite.expiresAt as Timestamp).toDate())) {
    if (invite.status !== 'expired') {
        await updateDoc(inviteRef, { status: 'expired' });
    }
    throw new Error('This invite has expired.');
  }
  if (!invite.parentEmails.includes(normalizedRedeemingEmail)) {
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

  let newStatus: Invite['status'] = invite.status;
  const currentRedeemCount = invite.usedBy.length;
  if (currentRedeemCount + 1 >= invite.parentEmails.length) {
    newStatus = 'completed';
  } else if (invite.babyData) { // Only parent invites can be partially redeemed
    newStatus = 'partially_redeemed';
  }

  await updateDoc(inviteRef, {
    usedBy: updatedUsedBy,
    status: newStatus,
  });

  // If it's a parent invite (identified by the presence of babyData), create/update the baby document.
  if (invite.babyData) {
      const babyDocId = invite.babyData.parentUsername;
      const babyDocRef = doc(db, BABIES_COLLECTION, babyDocId);
      const babySnap = await getDoc(babyDocRef);

      if (!babySnap.exists()) {
        // First parent redeeming: create the baby document
        const newBabyDocData: Omit<Baby, 'id' | 'sleepRecords'> = {
          ...invite.babyData,
          parentIds: [redeemingUserId],
          coachId: invite.coachId,
          isArchived: false,
          dateArchived: null,
          lastModified: (serverTimestamp() as Timestamp).toDate().toISOString(),
        };
        await setDoc(babyDocRef, newBabyDocData);
      } else {
        // Second (or subsequent) parent redeeming: update parentIds
        await updateDoc(babyDocRef, {
          parentIds: arrayUnion(redeemingUserId),
          lastModified: (serverTimestamp() as Timestamp).toDate().toISOString(),
        });
      }
  }
};

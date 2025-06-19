// src/services/coachService.ts
import { doc, setDoc, serverTimestamp, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface CoachProfile {
  userId: string; // Corresponds to Firebase Auth UID
  email: string;
  name: string;
  status: 'pending_approval' | 'pending_payment' | 'active' | 'suspended';
  createdAt: Timestamp;
  clientCount?: number; // Optional: example field
  // Add other coach-specific fields here
}

/**
 * Creates a new coach profile document in the 'coaches' collection in Firestore.
 * This is typically called after a coach successfully registers via Firebase Auth
 * and their user document in the 'users' collection is created.
 *
 * @param {string} uid - The Firebase Auth User ID of the coach.
 * @param {string} email - The coach's email address.
 * @param {string} name - The coach's full name.
 * @param {CoachProfile['status']} initialStatus - The initial status for the new coach profile.
 * @returns {Promise<void>} A promise that resolves when the profile is created.
 */
export const createCoachProfile = async (
  uid: string,
  email: string,
  name: string,
  initialStatus: CoachProfile['status'] = 'pending_approval'
): Promise<void> => {
  const coachProfileRef = doc(db, 'coaches', uid);
  const newCoachProfile: CoachProfile = {
    userId: uid,
    email,
    name,
    status: initialStatus,
    createdAt: serverTimestamp() as Timestamp,
    clientCount: 0, // Default client count
  };
  await setDoc(coachProfileRef, newCoachProfile);
};

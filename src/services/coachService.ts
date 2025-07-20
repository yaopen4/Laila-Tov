import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CoachProfile, User } from '@/types';

/**
 * Retrieves a coach's profile from the 'coaches' collection.
 * This collection holds data specific to a coach's professional activities.
 *
 * @param coachId The UID of the coach.
 * @returns A promise that resolves to the CoachProfile object or null if not found.
 */
export const getCoachProfile = async (coachId: string): Promise<CoachProfile | null> => {
  try {
    const docRef = doc(db, 'coaches', coachId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as CoachProfile;
    }
    console.warn(`No coach profile found for ID: ${coachId}`);
    return null;
  } catch (error) {
    console.error("Error fetching coach profile: ", error);
    throw new Error("Could not fetch coach profile.");
  }
};

/**
 * Retrieves a user's main data record from the 'users' collection.
 * This is the single source of truth for a user's role, name, and email.
 *
 * @param userId The UID of the user.
 * @returns A promise that resolves to the User object or null if not found.
 */
export const getUser = async (userId: string): Promise<User | null> => {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as User;
      }
      console.warn(`No user document found for ID: ${userId}`);
      return null;
    } catch (error) {
      console.error("Error fetching user data: ", error);
      throw new Error("Could not fetch user data.");
    }
  }; 
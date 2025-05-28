
// src/services/babyService.ts
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  collectionGroup,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Baby, SleepRecord, BabyFormData, SleepRecordFormData } from '@/types';
import { format } from 'date-fns';

const BABIES_COLLECTION = 'babies';
const SLEEP_RECORDS_SUBCOLLECTION = 'sleepRecords';

const getCurrentISODate = (): string => new Date().toISOString();

/**
 * Adds a new baby to Firestore.
 * @param {BabyFormData} babyData - The baby's data.
 * @param {string | undefined} coachAuthUid - UID of the coach adding the baby.
 * @returns {Promise<string>} The ID of the newly created baby document.
 */
export const addBabyToFirestore = async (babyData: BabyFormData, coachAuthUid?: string): Promise<string> => {
  const newBabyDoc: Omit<Baby, 'id' | 'sleepRecords'> = {
    ...babyData,
    isArchived: false,
    dateArchived: null,
    lastModified: getCurrentISODate(),
    ...(coachAuthUid && { coachAuthUid }), // Optionally add coach UID
  };
  const docRef = await addDoc(collection(db, BABIES_COLLECTION), newBabyDoc);
  return docRef.id;
};

/**
 * Retrieves a baby by its ID from Firestore.
 * @param {string} babyId - The ID of the baby.
 * @returns {Promise<Baby | null>} The baby object or null if not found.
 */
export const getBabyByIdFromFirestore = async (babyId: string): Promise<Baby | null> => {
  const docRef = doc(db, BABIES_COLLECTION, babyId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Baby;
  }
  return null;
};

/**
 * Retrieves a baby by parentUsername from Firestore.
 * This assumes parentUsername is unique for non-archived babies.
 * @param {string} parentUsername - The parent's username.
 * @returns {Promise<Baby | null>} The baby object or null if not found or archived.
 */
export const getBabyByParentUsernameFromFirestore = async (parentUsername: string): Promise<Baby | null> => {
  const q = query(
    collection(db, BABIES_COLLECTION),
    where('parentUsername', '==', parentUsername),
    where('isArchived', '==', false)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    // Assuming parentUsername is unique for active babies
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Baby;
  }
  return null;
};

/**
 * Updates an existing baby's data in Firestore.
 * @param {string} babyId - The ID of the baby to update.
 * @param {Partial<Omit<Baby, 'id'>>} updatedData - The data to update.
 * @returns {Promise<void>}
 */
export const updateBabyInFirestore = async (babyId: string, updatedData: Partial<Omit<Baby, 'id'>>): Promise<void> => {
  const babyDocRef = doc(db, BABIES_COLLECTION, babyId);
  await updateDoc(babyDocRef, {
    ...updatedData,
    lastModified: getCurrentISODate(),
  });
};

/**
 * Archives a baby in Firestore.
 * @param {string} babyId - The ID of the baby to archive.
 * @returns {Promise<void>}
 */
export const archiveBabyInFirestore = async (babyId: string): Promise<void> => {
  await updateBabyInFirestore(babyId, {
    isArchived: true,
    dateArchived: getCurrentISODate(),
  });
};

/**
 * Unarchives a baby in Firestore.
 * @param {string} babyId - The ID of the baby to unarchive.
 * @returns {Promise<void>}
 */
export const unarchiveBabyInFirestore = async (babyId: string): Promise<void> => {
  await updateBabyInFirestore(babyId, {
    isArchived: false,
    dateArchived: null,
  });
};

/**
 * Permanently deletes a baby and all their sleep records from Firestore.
 * @param {string} babyId - The ID of the baby to delete.
 * @returns {Promise<void>}
 */
export const deleteBabyPermanentlyFromFirestore = async (babyId: string): Promise<void> => {
  const batch = writeBatch(db);

  // Delete sleep records (subcollection)
  const sleepRecordsRef = collection(db, BABIES_COLLECTION, babyId, SLEEP_RECORDS_SUBCOLLECTION);
  const sleepRecordsSnap = await getDocs(sleepRecordsRef);
  sleepRecordsSnap.forEach((sleepDoc) => {
    batch.delete(doc(sleepRecordsRef, sleepDoc.id));
  });

  // Delete baby document
  const babyDocRef = doc(db, BABIES_COLLECTION, babyId);
  batch.delete(babyDocRef);

  await batch.commit();
};


/**
 * Retrieves all active babies from Firestore, ordered by family name.
 * @returns {Promise<Baby[]>} An array of active baby objects.
 */
export const getActiveBabiesFromFirestore = async (): Promise<Baby[]> => {
  const q = query(
    collection(db, BABIES_COLLECTION),
    where('isArchived', '==', false),
    orderBy('familyName'),
    orderBy('name')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Baby));
};


/**
 * Retrieves all archived babies from Firestore, ordered by family name.
 * @returns {Promise<Baby[]>} An array of archived baby objects.
 */
export const getArchivedBabiesFromFirestore = async (): Promise<Baby[]> => {
  const q = query(
    collection(db, BABIES_COLLECTION),
    where('isArchived', '==', true),
    orderBy('dateArchived', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Baby));
};

/**
 * Checks if a parent username is already taken by another non-archived baby.
 * @param {string} username - The username to check.
 * @param {string} [currentBabyId] - Optional. If provided, this baby ID will be excluded from the check.
 * @returns {Promise<boolean>} True if the username is taken, false otherwise.
 */
export const isParentUsernameTakenInFirestore = async (username: string, currentBabyId?: string): Promise<boolean> => {
  const normalizedUsername = username.toLowerCase();
  let q = query(
    collection(db, BABIES_COLLECTION),
    where('parentUsername', '==', normalizedUsername),
    where('isArchived', '==', false)
  );

  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    return false;
  }
  // If currentBabyId is provided, check if the found doc is not the current baby
  if (currentBabyId) {
    return querySnapshot.docs.some(docSnap => docSnap.id !== currentBabyId);
  }
  return true; // Username taken by at least one other baby
};


// --- Sleep Record Functions ---

/**
 * Adds a new sleep record to a baby's subcollection in Firestore.
 * @param {string} babyId - The ID of the baby.
 * @param {SleepRecordFormData} recordData - The sleep record data from the form.
 * @returns {Promise<string>} The ID of the newly created sleep record.
 */
export const addSleepRecordToFirestore = async (babyId: string, recordData: SleepRecordFormData): Promise<string> => {
  const sleepRecordsRef = collection(db, BABIES_COLLECTION, babyId, SLEEP_RECORDS_SUBCOLLECTION);
  const newRecord: Omit<SleepRecord, 'id'> = {
    date: format(recordData.date, "yyyy-MM-dd"),
    sleepCycles: recordData.sleepCycles.map((sc, index) => ({
      ...sc,
      id: `cycle-${Date.now()}-${index}` // Simple unique ID for cycles within a record
    })),
    timestamp: Timestamp.fromDate(new Date(recordData.date)), // For ordering
  };
  const docRef = await addDoc(sleepRecordsRef, newRecord);
  
  // Update baby's lastModified timestamp
  await updateBabyInFirestore(babyId, { lastModified: getCurrentISODate() });
  return docRef.id;
};

/**
 * Updates an existing sleep record in Firestore.
 * @param {string} babyId - The ID of the baby.
 * @param {string} recordId - The ID of the sleep record to update.
 * @param {SleepRecordFormData} updatedData - The updated sleep record data.
 * @returns {Promise<void>}
 */
export const updateSleepRecordInFirestore = async (babyId: string, recordId: string, updatedData: SleepRecordFormData): Promise<void> => {
  const recordDocRef = doc(db, BABIES_COLLECTION, babyId, SLEEP_RECORDS_SUBCOLLECTION, recordId);
  const updatedRecord: Partial<SleepRecord> = {
    date: format(updatedData.date, "yyyy-MM-dd"),
    sleepCycles: updatedData.sleepCycles.map((sc, index) => ({
      id: sc.id || `cycle-updated-${Date.now()}-${index}`, // Keep existing id or generate new if missing
      ...sc,
    })),
    timestamp: Timestamp.fromDate(new Date(updatedData.date)),
  };
  await updateDoc(recordDocRef, updatedRecord);
  await updateBabyInFirestore(babyId, { lastModified: getCurrentISODate() });
};

/**
 * Deletes a sleep record from Firestore.
 * @param {string} babyId - The ID of the baby.
 * @param {string} recordId - The ID of the sleep record to delete.
 * @returns {Promise<void>}
 */
export const deleteSleepRecordFromFirestore = async (babyId: string, recordId: string): Promise<void> => {
  const recordDocRef = doc(db, BABIES_COLLECTION, babyId, SLEEP_RECORDS_SUBCOLLECTION, recordId);
  await deleteDoc(recordDocRef);
  await updateBabyInFirestore(babyId, { lastModified: getCurrentISODate() });
};

/**
 * Retrieves all sleep records for a baby from Firestore, ordered by date descending.
 * @param {string} babyId - The ID of the baby.
 * @returns {Promise<SleepRecord[]>} An array of sleep records.
 */
export const getSleepRecordsForBabyFromFirestore = async (babyId: string): Promise<SleepRecord[]> => {
  const sleepRecordsRef = collection(db, BABIES_COLLECTION, babyId, SLEEP_RECORDS_SUBCOLLECTION);
  const q = query(sleepRecordsRef, orderBy('timestamp', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as SleepRecord));
};

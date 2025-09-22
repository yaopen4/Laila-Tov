// src/services/babyService.ts
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Baby, SleepRecord, BabyFormData, SleepRecordFormData } from '@/types';
import { EventCategory, AuditEventType } from '@/types';
import { format } from 'date-fns';
import { createInviteInFirestore } from './inviteService';
import { getAuth } from 'firebase/auth';
import { logger, logAudit, withPerformanceLogging } from '@/services/loggingService';

export type { Baby }; // Exporting the Baby type
const BABIES_COLLECTION = 'babies';
const SLEEP_RECORDS_SUBCOLLECTION = 'sleepRecords';

const getCurrentISODate = (): string => new Date().toISOString();

/**
 * Adds a new baby to Firestore and creates an associated invite.
 * @param {Omit<Baby, 'id' | 'sleepRecords'>} babyData - The complete baby data object, including coachId.
 * @returns {Promise<string>} The ID of the newly created baby document.
 */
export const addBabyToFirestore = async (
  babyData: Omit<Baby, 'id' | 'sleepRecords'>
): Promise<string> => {
  return withPerformanceLogging('addBabyToFirestore', async () => {
    const startTime = Date.now();

    try {
      await logger.info('Starting baby creation', EventCategory.BABY_MANAGEMENT, {
        coachId: babyData.coachId,
        parentUsername: babyData.parentUsername,
        name: babyData.name,
        familyName: babyData.familyName
      });

      // Verify the coach user exists and has the correct role
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== babyData.coachId) {
        const error = new Error('Coach authentication mismatch');
        await logAudit(AuditEventType.BABY_CREATED, 'Baby creation failed: Authentication mismatch', {
          success: false,
          metadata: {
            expectedCoachId: babyData.coachId,
            currentUserId: currentUser?.uid,
            reason: 'auth_mismatch'
          },
          error
        });
        throw error;
      }

      // Check if the user document exists in Firestore
      const userDocRef = doc(db, 'users', babyData.coachId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        const error = new Error('Coach user document not found in Firestore');
        await logAudit(AuditEventType.BABY_CREATED, 'Baby creation failed: Coach not found', {
          success: false,
          metadata: {
            coachId: babyData.coachId,
            reason: 'coach_not_found'
          },
          error
        });
        await logger.error('User document does not exist for coach', error, EventCategory.BABY_MANAGEMENT, {
          coachId: babyData.coachId
        });
        throw error;
      }
      
      const userData = userDoc.data();
      if (userData.role !== 'coach') {
        const error = new Error('User does not have coach role');
        await logAudit(AuditEventType.BABY_CREATED, 'Baby creation failed: Invalid role', {
          success: false,
          metadata: {
            coachId: babyData.coachId,
            actualRole: userData.role,
            reason: 'invalid_role'
          },
          error
        });
        await logger.error('User is not a coach', error, EventCategory.BABY_MANAGEMENT, {
          coachId: babyData.coachId,
          actualRole: userData.role
        });
        throw error;
      }
      
      await logger.info('Coach verification passed', EventCategory.BABY_MANAGEMENT, {
        uid: babyData.coachId,
        role: userData.role
      });

      // 1. Create the invite first to get its ID (the invite code)
      let inviteCode: string;
      try {
        await logger.info('Creating invite for baby', EventCategory.INVITATION);
        inviteCode = await createInviteInFirestore(
          babyData.coachId,
          {...babyData}, // Pass baby data to the invite
          [], // parentEmails are not part of the core baby doc anymore
          'parent' // Explicitly specify this is a parent invite
        );
        await logger.info('Invite created successfully', EventCategory.INVITATION, {
          inviteCode,
          coachId: babyData.coachId
        });
      } catch (inviteError) {
        const error = new Error(`Invite creation failed: ${inviteError instanceof Error ? inviteError.message : 'Unknown error'}`);
        await logAudit(AuditEventType.BABY_CREATED, 'Baby creation failed: Invite creation failed', {
          success: false,
          metadata: {
            coachId: babyData.coachId,
            parentUsername: babyData.parentUsername,
            reason: 'invite_creation_failed'
          },
          error
        });
        await logger.error('Failed to create invite', error, EventCategory.INVITATION, {
          coachId: babyData.coachId,
          originalError: inviteError instanceof Error ? inviteError.message : 'Unknown error'
        });
        throw error;
      }

      // 2. Create the baby document using the auto-generated username as its ID
      const babyDocRef = doc(db, BABIES_COLLECTION, babyData.parentUsername);
      
      const newBabyDoc: Omit<Baby, 'id' | 'sleepRecords'> = {
        ...babyData,
        parentIds: [], // Ensure parentIds is initialized as an empty array
        isArchived: false,
        dateArchived: null,
        lastModified: getCurrentISODate(),
        inviteCode: inviteCode, // Store the generated invite code
      };

      try {
        await logger.info('Creating baby document', EventCategory.BABY_MANAGEMENT, {
          babyId: babyDocRef.id,
          coachId: babyData.coachId,
          inviteCode
        });
        
        await setDoc(babyDocRef, newBabyDoc);

        // Log successful baby creation audit trail
        await logAudit(AuditEventType.BABY_CREATED, `Baby profile created: ${babyData.name} ${babyData.familyName}`, {
          resourceId: babyDocRef.id,
          resourceType: 'baby',
          newValue: {
            name: babyData.name,
            familyName: babyData.familyName,
            parentUsername: babyData.parentUsername,
            coachId: babyData.coachId,
            inviteCode
          },
          success: true,
          duration: Date.now() - startTime,
          metadata: {
            age: babyData.age,
            siblingsCount: babyData.siblingsCount,
            hasDescription: !!babyData.description,
            hasCoachNotes: !!babyData.coachNotes
          }
        });

        await logger.info('Baby document created successfully', EventCategory.BABY_MANAGEMENT, {
          babyId: babyDocRef.id,
          name: babyData.name,
          familyName: babyData.familyName,
          coachId: babyData.coachId,
          duration: Date.now() - startTime
        });
      } catch (babyError) {
        const error = new Error(`Baby document creation failed: ${babyError instanceof Error ? babyError.message : 'Unknown error'}`);
        await logAudit(AuditEventType.BABY_CREATED, 'Baby creation failed: Document creation failed', {
          success: false,
          duration: Date.now() - startTime,
          metadata: {
            coachId: babyData.coachId,
            parentUsername: babyData.parentUsername,
            inviteCode,
            reason: 'document_creation_failed'
          },
          error
        });
        await logger.error('Failed to create baby document', error, EventCategory.BABY_MANAGEMENT, {
          babyId: babyDocRef.id,
          coachId: babyData.coachId,
          originalError: babyError instanceof Error ? babyError.message : 'Unknown error'
        });
        // If baby creation fails, we should ideally clean up the invite, but for now just throw
        throw error;
      }

      return babyDocRef.id;
    } catch (error) {
      if (!(error instanceof Error) || !error.message?.includes('Baby creation failed:')) {
        // Log generic baby creation failure if not already logged
        await logAudit(AuditEventType.BABY_CREATED, `Baby creation failed for ${babyData.name} ${babyData.familyName}`, {
          success: false,
          duration: Date.now() - startTime,
          metadata: {
            coachId: babyData.coachId,
            parentUsername: babyData.parentUsername,
            stage: 'unknown'
          },
          error: error instanceof Error ? error : new Error('Unknown baby creation error')
        });
      }

      await logger.error('Error in addBabyToFirestore', error instanceof Error ? error : new Error('Unknown baby creation error'), EventCategory.BABY_MANAGEMENT, {
        coachId: babyData.coachId,
        parentUsername: babyData.parentUsername,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }, {
    coachId: babyData.coachId,
    parentUsername: babyData.parentUsername,
    operation: 'baby_creation'
  });
};

/**
 * Fetches a single baby document by its unique document ID.
 * @param {string} babyId - The unique ID of the baby document in Firestore.
 * @returns {Promise<Baby | null>} A promise that resolves with the Baby object or null if not found.
 */
export const getBabyByIdFromFirestore = async (babyId: string): Promise<Baby | null> => {
  try {
    const babyDocRef = doc(db, 'babies', babyId);
    const docSnap = await getDoc(babyDocRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Baby;
    }
    console.warn(`No baby found with document ID: ${babyId}`);
    return null;
  } catch (error) {
    console.error("Error fetching baby by ID:", error);
    throw error; // Rethrow the error to be handled by the caller
  }
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

  // TODO: Also delete the associated invite document if desired.
  // const babyData = await getBabyByIdFromFirestore(babyId);
  // if(babyData?.inviteCode) {
  //   const inviteRef = doc(db, 'invites', babyData.inviteCode);
  //   batch.delete(inviteRef);
  // }

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
 * Retrieves all archived babies for a specific coach from Firestore, ordered by archive date.
 * @param {string} coachId - The UID of the coach whose archived babies are to be fetched.
 * @returns {Promise<Baby[]>} An array of archived baby objects.
 */
export const getArchivedBabiesFromFirestore = async (coachId: string): Promise<Baby[]> => {
  const q = query(
    collection(db, BABIES_COLLECTION),
    where('isArchived', '==', true),
    where('coachId', '==', coachId)
    // Removed: orderBy('dateArchived', 'desc') - This will be handled on the client
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Baby));
};

/**
 * Checks if a parent username is already taken by another non-archived baby.
 * @param {string} username - The username to check.
 * @returns {Promise<boolean>} True if the username is taken, false otherwise.
 */
export const isParentUsernameTakenInFirestore = async (username: string): Promise<boolean> => {
  const docRef = doc(db, BABIES_COLLECTION, username.toLowerCase());
  const docSnap = await getDoc(docRef);
  return docSnap.exists();
};


// --- Sleep Record Functions ---

/**
 * Adds a new sleep record to a baby's subcollection in Firestore.
 * @param {string} babyId - The ID of the baby.
 * @param {SleepRecordFormData} recordData - The sleep record data from the form.
 * @returns {Promise<string>} The ID of the newly created sleep record.
 */
export const addSleepRecordToFirestore = async (babyId: string, recordData: SleepRecordFormData): Promise<string> => {
  return withPerformanceLogging('addSleepRecordToFirestore', async () => {
    const startTime = Date.now();

    try {
      await logger.info('Adding sleep record', EventCategory.SLEEP_DATA, {
        babyId,
        date: format(recordData.date, "yyyy-MM-dd"),
        cycleCount: recordData.sleepCycles.length
      });

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

      // Log successful sleep record creation
      await logAudit(AuditEventType.SLEEP_RECORD_CREATED, `Sleep record created for baby ${babyId}`, {
        resourceId: docRef.id,
        resourceType: 'sleep_record',
        newValue: {
          babyId,
          date: newRecord.date,
          cycleCount: newRecord.sleepCycles.length,
          cycles: newRecord.sleepCycles.map(cycle => ({
            bedtime: cycle.bedtime,
            wakeTime: cycle.wakeTime,
            timeToSleep: cycle.timeToSleep
          }))
        },
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          hasSleepCycles: newRecord.sleepCycles.length > 0,
          recordDate: newRecord.date
        }
      });

      await logger.info('Sleep record added successfully', EventCategory.SLEEP_DATA, {
        babyId,
        recordId: docRef.id,
        date: newRecord.date,
        cycleCount: newRecord.sleepCycles.length,
        duration: Date.now() - startTime
      });
      
      return docRef.id;
    } catch (error) {
      // Log failed sleep record creation
      await logAudit(AuditEventType.SLEEP_RECORD_CREATED, `Sleep record creation failed for baby ${babyId}`, {
        success: false,
        duration: Date.now() - startTime,
        metadata: {
          babyId,
          date: format(recordData.date, "yyyy-MM-dd"),
          cycleCount: recordData.sleepCycles.length
        },
        error: error instanceof Error ? error : new Error('Unknown sleep record creation error')
      });

      await logger.error('Failed to add sleep record', error instanceof Error ? error : new Error('Unknown sleep record creation error'), EventCategory.SLEEP_DATA, {
        babyId,
        date: format(recordData.date, "yyyy-MM-dd"),
        duration: Date.now() - startTime
      });

      throw error;
    }
  }, {
    babyId,
    operation: 'sleep_record_creation',
    date: format(recordData.date, "yyyy-MM-dd")
  });
};

/**
 * Updates an existing sleep record in Firestore.
 * @param {string} babyId - The ID of the baby.
 * @param {string} recordId - The ID of the sleep record to update.
 * @param {SleepRecordFormData} updatedData - The updated sleep record data.
 * @returns {Promise<void>}
 */
export const updateSleepRecordInFirestore = async (babyId: string, recordId: string, updatedData: SleepRecordFormData): Promise<void> => {
  return withPerformanceLogging('updateSleepRecordInFirestore', async () => {
    const startTime = Date.now();

    try {
      // Get the existing record for audit logging
      const recordDocRef = doc(db, BABIES_COLLECTION, babyId, SLEEP_RECORDS_SUBCOLLECTION, recordId);
      const existingRecordSnap = await getDoc(recordDocRef);
      const oldValue = existingRecordSnap.exists() ? existingRecordSnap.data() as SleepRecord : null;

      await logger.info('Updating sleep record', EventCategory.SLEEP_DATA, {
        babyId,
        recordId,
        date: format(updatedData.date, "yyyy-MM-dd"),
        cycleCount: updatedData.sleepCycles.length
      });

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

      // Log successful sleep record update
      await logAudit(AuditEventType.SLEEP_RECORD_UPDATED, `Sleep record updated for baby ${babyId}`, {
        resourceId: recordId,
        resourceType: 'sleep_record',
        oldValue: oldValue ? {
          date: oldValue.date,
          cycleCount: oldValue.sleepCycles?.length || 0,
          cycles: oldValue.sleepCycles?.map(cycle => ({
            bedtime: cycle.bedtime,
            wakeTime: cycle.wakeTime,
            timeToSleep: cycle.timeToSleep
          })) || []
        } : null,
        newValue: {
          date: updatedRecord.date,
          cycleCount: updatedRecord.sleepCycles?.length || 0,
          cycles: updatedRecord.sleepCycles?.map(cycle => ({
            bedtime: cycle.bedtime,
            wakeTime: cycle.wakeTime,
            timeToSleep: cycle.timeToSleep
          })) || []
        },
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          babyId,
          recordDate: updatedRecord.date,
          hadPreviousData: !!oldValue
        }
      });

      await logger.info('Sleep record updated successfully', EventCategory.SLEEP_DATA, {
        babyId,
        recordId,
        date: updatedRecord.date,
        cycleCount: updatedRecord.sleepCycles?.length || 0,
        duration: Date.now() - startTime
      });
    } catch (error) {
      // Log failed sleep record update
      await logAudit(AuditEventType.SLEEP_RECORD_UPDATED, `Sleep record update failed for baby ${babyId}`, {
        resourceId: recordId,
        resourceType: 'sleep_record',
        success: false,
        duration: Date.now() - startTime,
        metadata: {
          babyId,
          date: format(updatedData.date, "yyyy-MM-dd"),
          cycleCount: updatedData.sleepCycles.length
        },
        error: error instanceof Error ? error : new Error('Unknown sleep record update error')
      });

      await logger.error('Failed to update sleep record', error instanceof Error ? error : new Error('Unknown sleep record update error'), EventCategory.SLEEP_DATA, {
        babyId,
        recordId,
        date: format(updatedData.date, "yyyy-MM-dd"),
        duration: Date.now() - startTime
      });

      throw error;
    }
  }, {
    babyId,
    recordId,
    operation: 'sleep_record_update',
    date: format(updatedData.date, "yyyy-MM-dd")
  });
};

/**
 * Deletes a sleep record from Firestore.
 * @param {string} babyId - The ID of the baby.
 * @param {string} recordId - The ID of the sleep record to delete.
 * @returns {Promise<void>}
 */
export const deleteSleepRecordFromFirestore = async (babyId: string, recordId: string): Promise<void> => {
  return withPerformanceLogging('deleteSleepRecordFromFirestore', async () => {
    const startTime = Date.now();

    try {
      // Get the existing record for audit logging before deletion
      const recordDocRef = doc(db, BABIES_COLLECTION, babyId, SLEEP_RECORDS_SUBCOLLECTION, recordId);
      const existingRecordSnap = await getDoc(recordDocRef);
      const oldValue = existingRecordSnap.exists() ? existingRecordSnap.data() as SleepRecord : null;

      await logger.info('Deleting sleep record', EventCategory.SLEEP_DATA, {
        babyId,
        recordId,
        recordExists: !!oldValue
      });

      await deleteDoc(recordDocRef);
      await updateBabyInFirestore(babyId, { lastModified: getCurrentISODate() });

      // Log successful sleep record deletion
      await logAudit(AuditEventType.SLEEP_RECORD_DELETED, `Sleep record deleted for baby ${babyId}`, {
        resourceId: recordId,
        resourceType: 'sleep_record',
        oldValue: oldValue ? {
          date: oldValue.date,
          cycleCount: oldValue.sleepCycles?.length || 0,
          cycles: oldValue.sleepCycles?.map(cycle => ({
            bedtime: cycle.bedtime,
            wakeTime: cycle.wakeTime,
            timeToSleep: cycle.timeToSleep
          })) || []
        } : null,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          babyId,
          recordDate: oldValue?.date,
          hadData: !!oldValue
        }
      });

      await logger.info('Sleep record deleted successfully', EventCategory.SLEEP_DATA, {
        babyId,
        recordId,
        duration: Date.now() - startTime
      });
    } catch (error) {
      // Log failed sleep record deletion
      await logAudit(AuditEventType.SLEEP_RECORD_DELETED, `Sleep record deletion failed for baby ${babyId}`, {
        resourceId: recordId,
        resourceType: 'sleep_record',
        success: false,
        duration: Date.now() - startTime,
        metadata: {
          babyId
        },
        error: error instanceof Error ? error : new Error('Unknown sleep record deletion error')
      });

      await logger.error('Failed to delete sleep record', error instanceof Error ? error : new Error('Unknown sleep record deletion error'), EventCategory.SLEEP_DATA, {
        babyId,
        recordId,
        duration: Date.now() - startTime
      });

      throw error;
    }
  }, {
    babyId,
    recordId,
    operation: 'sleep_record_deletion'
  });
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

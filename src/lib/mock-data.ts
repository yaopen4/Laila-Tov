
import { format } from 'date-fns';

/**
 * @fileoverview Mock data and related functions for the Laila Tov application.
 * NOTE: This is in-memory mock data and is not suitable for production use.
 * It does not persist data and is reset on each application reload.
 */

/**
 * Represents a single sleep cycle within a sleep record.
 */
export interface SleepCycle {
  /** Unique identifier for the sleep cycle. */
  id: string;
  /** Time the baby was put to bed, in HH:MM format. */
  bedtime: string;
  /** Duration it took for the baby to fall asleep (e.g., "15 דקות", "מייד"). */
  timeToSleep: string;
  /** Person who put the baby to sleep (e.g., "אמא", "אבא", "לבד"). */
  whoPutToSleep: string;
  /** Description of how the baby fell asleep. */
  howFellAsleep: string;
  /** Time the baby woke up, in HH:MM format. Optional. */
  wakeTime?: string;
}

/**
 * Represents a collection of sleep cycles for a specific date.
 */
export interface SleepRecord {
  /** Unique identifier for the sleep record. */
  id: string;
  /** Date of the sleep record, in YYYY-MM-DD format. */
  date: string;
  /** Array of sleep cycles for this record. */
  sleepCycles: SleepCycle[];
}

/**
 * Represents a baby's profile and associated data.
 */
export interface Baby {
  /** Unique identifier for the baby. */
  id: string;
  /** Baby's first name. */
  name: string;
  /** Baby's family name. */
  familyName: string;
  /** Age of the baby in months. */
  age: number;
  /** Mother's name. */
  motherName: string;
  /** Father's name. */
  fatherName: string;
  /** Number of siblings the baby has. */
  siblingsCount: number;
  /** Optional string listing names and ages of siblings. */
  siblingsNames?: string;
  /** Optional general description about the baby (e.g., temperament, current sleep habits). */
  description?: string;
  /** Username for parents to log in and view/edit this baby's data. */
  parentUsername: string;
  /** Array of sleep records, sorted with the latest first. */
  sleepRecords?: SleepRecord[];
  /** Notes from the sleep coach, visible to parents. */
  coachNotes?: string;
  /** Flag indicating if the baby's profile is archived. */
  isArchived: boolean;
  /** ISO Date string representing when the baby was archived. Undefined if not archived. */
  dateArchived?: string;
  /** ISO Date string of the last modification to the baby's record. */
  lastModified: string;
}

/**
 * Helper function to get the current date and time as an ISO string.
 * @returns {string} The current date and time in ISO format.
 */
const getCurrentISODate = (): string => new Date().toISOString();

// Initial mock data for babies. This array is mutable and acts as a simple in-memory database.
export let mockBabies: Baby[] = [
  {
    id: "1",
    name: "אורי",
    familyName: "כהן",
    age: 6,
    motherName: "שרה",
    fatherName: "משה",
    siblingsCount: 0,
    parentUsername: "cohen-family",
    description: "תינוק חייכן ושמח, מתקשה להירדם בלילה.",
    coachNotes: "להמליץ על טקס שינה קבוע. לבדוק תזונה לפני השינה.",
    sleepRecords: [
      {
        id: "sr1",
        date: "2024-07-20", // Latest record for this baby
        sleepCycles: [
          { id: "sc1", bedtime: "19:00", timeToSleep: "30 דקות", whoPutToSleep: "אמא", howFellAsleep: "הנקה", wakeTime: "06:00" },
          { id: "sc2", bedtime: "10:00", timeToSleep: "15 דקות", whoPutToSleep: "אבא", howFellAsleep: "נענוע קל", wakeTime: "11:30" },
        ],
      },
      {
        id: "sr1-older",
        date: "2024-07-19", // Older record
        sleepCycles: [
          { id: "sc1-older-c1", bedtime: "19:30", timeToSleep: "40 דקות", whoPutToSleep: "אבא", howFellAsleep: "בקבוק", wakeTime: "05:00" },
        ],
      },
    ],
    isArchived: false,
    lastModified: new Date(2024, 6, 20).toISOString(),
  },
  {
    id: "2",
    name: "נועה",
    familyName: "לוי",
    age: 8,
    motherName: "רבקה",
    fatherName: "יעקב",
    siblingsCount: 1,
    siblingsNames: "דניאל (3)",
    parentUsername: "levi-family",
    description: "מתעוררת מספר פעמים בלילה.",
    coachNotes: "לנסות להפחית גירויים לפני השינה. לבדוק טמפרטורת חדר.",
     sleepRecords: [
      {
        id: "sr2-latest",
        date: "2024-07-21",
        sleepCycles: [
          { id: "sc3-latest", bedtime: "20:00", timeToSleep: "20 דקות", whoPutToSleep: "אמא", howFellAsleep: "שיר ערש", wakeTime: "05:30" },
        ],
      },
      {
        id: "sr2-older",
        date: "2024-07-20",
        sleepCycles: [
          { id: "sc3-older", bedtime: "20:15", timeToSleep: "25 דקות", whoPutToSleep: "אבא", howFellAsleep: "ליטוף", wakeTime: "06:00" },
        ],
      },
    ],
    isArchived: false,
    lastModified: new Date(2024, 6, 21).toISOString(),
  },
  {
    id: "3",
    name: "איתי",
    familyName: "ישראל",
    age: 12,
    motherName: "לאה",
    fatherName: "יוסף",
    siblingsCount: 2,
    siblingsNames: "רות (5), דוד (2)",
    parentUsername: "israel-family",
    description: "נרדם רק על הידיים.",
    coachNotes: "לעבוד על הרדמות עצמאית במיטה.",
    sleepRecords: [
      {
        id: "sr3-latest",
        date: "2024-07-22",
        sleepCycles: [
          { id: "sc4-latest", bedtime: "21:00", timeToSleep: "10 דקות", whoPutToSleep: "אמא", howFellAsleep: "לבד במיטה", wakeTime: "07:00" },
        ],
      },
    ],
    isArchived: false,
    lastModified: getCurrentISODate(),
  },
];

/**
 * Sorts sleep records for a baby by date in descending order (latest first).
 * Modifies the baby object in place if sleepRecords exist.
 * @param {Baby} baby - The baby object.
 */
const sortSleepRecords = (baby: Baby): void => {
  if (baby.sleepRecords) {
    baby.sleepRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
};

/**
 * Retrieves a baby's profile by their parent's username, excluding archived babies.
 * Ensures sleep records are sorted with the latest first.
 * @param {string} username - The parent's username.
 * @returns {Baby | undefined} The baby's profile if found and not archived, otherwise undefined.
 */
export const getBabyByParentUsername = (username: string): Baby | undefined => {
  const baby = mockBabies.find(baby => baby.parentUsername === username && !baby.isArchived);
  if (baby) {
    sortSleepRecords(baby);
  }
  return baby;
};

/**
 * Retrieves a baby's profile by their ID.
 * This function can fetch both active and archived babies.
 * Ensures sleep records are sorted with the latest first.
 * @param {string} id - The baby's ID.
 * @returns {Baby | undefined} The baby's profile if found, otherwise undefined.
 */
export const getBabyById = (id: string): Baby | undefined => {
  const baby = mockBabies.find(baby => baby.id === id);
  if (baby) {
    sortSleepRecords(baby);
  }
  return baby;
};

/**
 * Type definition for data used when adding a new baby.
 * Excludes fields that are auto-generated or managed internally.
 */
export type AddBabyData = Omit<Baby, 'id' | 'sleepRecords' | 'isArchived' | 'lastModified' | 'dateArchived'>;


/**
 * Adds a new baby to the mock data.
 * Generates a simple ID, initializes empty sleep records, sets default status, and `lastModified`.
 * @param {AddBabyData} babyData - The baby's data.
 * @returns {Baby} The newly created baby object.
 */
export const addBaby = (babyData: AddBabyData): Baby => {
  const newBaby: Baby = {
    ...babyData,
    id: (mockBabies.length + Date.now()).toString(), // Simple ID generation
    sleepRecords: [],
    isArchived: false,
    lastModified: getCurrentISODate(),
  };
  mockBabies.push(newBaby);
  return newBaby;
};

/**
 * Updates an existing baby's profile.
 * Merges the provided data with the existing baby data and updates the `lastModified` timestamp.
 * Sleep records are also re-sorted after update.
 * @param {Partial<Baby> & Pick<Baby, 'id'>} updatedBabyData - The data to update, must include the baby's ID.
 * @returns {boolean} True if the update was successful, false if the baby was not found.
 */
export const updateBaby = (updatedBabyData: Partial<Baby> & Pick<Baby, 'id'>): boolean => {
  const index = mockBabies.findIndex(baby => baby.id === updatedBabyData.id);
  if (index !== -1) {
    mockBabies[index] = {
        ...mockBabies[index],
        ...updatedBabyData,
        lastModified: getCurrentISODate()
    };
    sortSleepRecords(mockBabies[index]);
    return true;
  }
  console.error(`[MockData] Failed to update baby: ID ${updatedBabyData.id} not found.`);
  return false;
};

/**
 * Archives a baby's profile.
 * Sets `isArchived` to true, records `dateArchived`, and updates `lastModified`.
 * @param {string} babyId - The ID of the baby to archive.
 * @returns {boolean} True if archiving was successful, false if the baby was not found.
 */
export const archiveBaby = (babyId: string): boolean => {
  const index = mockBabies.findIndex(baby => baby.id === babyId);
  if (index !== -1) {
    mockBabies[index].isArchived = true;
    mockBabies[index].dateArchived = getCurrentISODate();
    mockBabies[index].lastModified = getCurrentISODate();
    return true;
  }
  console.error(`[MockData] Failed to archive baby: ID ${babyId} not found.`);
  return false;
};

/**
 * Unarchives a baby's profile.
 * Sets `isArchived` to false, clears `dateArchived`, and updates `lastModified`.
 * @param {string} babyId - The ID of the baby to unarchive.
 * @returns {boolean} True if unarchiving was successful, false if the baby was not found.
 */
export const unarchiveBaby = (babyId: string): boolean => {
  const index = mockBabies.findIndex(baby => baby.id === babyId);
  if (index !== -1) {
    mockBabies[index].isArchived = false;
    mockBabies[index].dateArchived = undefined;
    mockBabies[index].lastModified = getCurrentISODate();
    return true;
  }
  console.error(`[MockData] Failed to unarchive baby: ID ${babyId} not found.`);
  return false;
};

/**
 * Retrieves all active (non-archived) babies.
 * Ensures sleep records for each baby are sorted with the latest first.
 * @returns {Baby[]} An array of active baby profiles.
 */
export const getActiveBabies = (): Baby[] => {
  const activeBabies = mockBabies.filter(baby => !baby.isArchived);
  activeBabies.forEach(sortSleepRecords);
  return activeBabies;
};

/**
 * Retrieves all archived babies.
 * Ensures sleep records for each baby are sorted with the latest first.
 * @returns {Baby[]} An array of archived baby profiles.
 */
export const getArchivedBabies = (): Baby[] => {
  const archived = mockBabies.filter(baby => baby.isArchived);
  archived.forEach(sortSleepRecords);
  return archived;
};

/**
 * Deletes a specific sleep record for a baby.
 * Updates the baby's `lastModified` timestamp.
 * @param {string} babyId - The ID of the baby whose sleep record is to be deleted.
 * @param {string} recordId - The ID of the sleep record to delete.
 * @returns {boolean} True if deletion was successful, false otherwise (e.g., baby or record not found).
 */
export const deleteSleepRecord = (babyId: string, recordId: string): boolean => {
  const babyIndex = mockBabies.findIndex(b => b.id === babyId);
  if (babyIndex === -1) {
    console.error(`[MockData] Baby not found (ID: ${babyId}) for sleep record deletion (Record ID: ${recordId}).`);
    return false;
  }

  const baby = mockBabies[babyIndex];
  if (!baby.sleepRecords) {
    console.error(`[MockData] Baby (ID: ${babyId}) has no sleep records to delete from.`);
    return false;
  }

  const recordIndex = baby.sleepRecords.findIndex(sr => sr.id === recordId);
  if (recordIndex === -1) {
    console.error(`[MockData] Sleep record not found (ID: ${recordId}) for deletion for baby (ID: ${babyId}).`);
    return false;
  }

  baby.sleepRecords.splice(recordIndex, 1);
  mockBabies[babyIndex] = { ...baby, lastModified: getCurrentISODate() }; // Update the baby object in the array
  sortSleepRecords(mockBabies[babyIndex]); // Re-sort after modification
  return true;
};

/**
 * Permanently deletes a baby's profile from the system.
 * This action is irreversible.
 * @param {string} babyId - The ID of the baby to delete permanently.
 * @returns {boolean} True if deletion was successful, false if the baby was not found.
 */
export const deleteBabyPermanently = (babyId: string): boolean => {
  const initialLength = mockBabies.length;
  mockBabies = mockBabies.filter(baby => baby.id !== babyId);
  if (mockBabies.length < initialLength) {
    return true;
  }
  console.error(`[MockData] Failed to permanently delete baby: ID ${babyId} not found.`);
  return false;
};

/**
 * Type definition for the data structure used in the add/edit baby form.
 * Matches the Zod schema in AddBabyForm.
 */
export type BabyFormData = {
  name: string;
  familyName: string;
  age: number;
  motherName: string;
  fatherName: string;
  siblingsCount: number;
  siblingsNames?: string;
  description?: string;
  parentUsername: string;
  coachNotes?: string;
};

/**
 * Type definition for the data structure used in the sleep record form.
 * Uses a `Date` object for the date field (from calendar input) and omits IDs for new cycles.
 * Matches the Zod schema in SleepDataForm.
 */
export type SleepRecordFormData = {
  date: Date; // Date object from calendar input
  sleepCycles: Array<Omit<SleepCycle, 'id'| 'wakeTime'> & { wakeTime?: string }>;
};



import { format } from 'date-fns';

/**
 * Represents a single sleep cycle within a sleep record.
 */
export interface SleepCycle {
  id: string;
  bedtime: string; // HH:MM format
  timeToSleep: string; // e.g., "15 דקות", "מייד"
  whoPutToSleep: string; // e.g., "אמא", "אבא", "לבד"
  howFellAsleep: string; // Description of how the baby fell asleep
  wakeTime: string; // HH:MM format, optional
}

/**
 * Represents a collection of sleep cycles for a specific date and process stage.
 */
export interface SleepRecord {
  id: string;
  date: string; // YYYY-MM-DD format
  stage: string; // Stage in the sleep coaching process, e.g., "הסתגלות"
  sleepCycles: SleepCycle[];
}

/**
 * Represents a baby's profile and associated data.
 */
export interface Baby {
  id: string;
  name: string;
  familyName: string;
  age: number; // Age in months
  motherName: string;
  fatherName: string;
  siblingsCount: number;
  siblingsNames?: string; // Optional names of siblings
  description?: string; // Optional general description about the baby
  parentUsername: string; // Username for parents to log in
  sleepRecords?: SleepRecord[]; // Array of sleep records
  coachNotes?: string; // Notes from the sleep coach
  isArchived: boolean; // Flag indicating if the baby's profile is archived
  dateArchived?: string; // ISO Date string when the baby was archived
  lastModified: string; // ISO Date string of the last modification
}

/**
 * Helper function to get the current date and time as an ISO string.
 * @returns {string} The current date and time in ISO format.
 */
const getCurrentISODate = () => new Date().toISOString();

// Initial mock data for babies
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
        date: "2024-07-20",
        stage: "הסתגלות",
        sleepCycles: [
          { id: "sc1", bedtime: "19:00", timeToSleep: "30 דקות", whoPutToSleep: "אמא", howFellAsleep: "הנקה", wakeTime: "06:00" },
          { id: "sc2", bedtime: "10:00", timeToSleep: "15 דקות", whoPutToSleep: "אבא", howFellAsleep: "נענוע קל", wakeTime: "11:30" },
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
        id: "sr2",
        date: "2024-07-21",
        stage: "ביסוס הרגלים",
        sleepCycles: [
          { id: "sc3", bedtime: "20:00", timeToSleep: "20 דקות", whoPutToSleep: "אמא", howFellAsleep: "שיר ערש", wakeTime: "05:30" },
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
    isArchived: false,
    lastModified: getCurrentISODate(),
  },
];

/**
 * Retrieves a baby's profile by their parent's username, excluding archived babies.
 * @param {string} username - The parent's username.
 * @returns {Baby | undefined} The baby's profile if found and not archived, otherwise undefined.
 */
export const getBabyByParentUsername = (username: string): Baby | undefined => {
  return mockBabies.find(baby => baby.parentUsername === username && !baby.isArchived);
};

/**
 * Retrieves a baby's profile by their ID.
 * This function can fetch both active and archived babies.
 * @param {string} id - The baby's ID.
 * @returns {Baby | undefined} The baby's profile if found, otherwise undefined.
 */
export const getBabyById = (id: string): Baby | undefined => {
  return mockBabies.find(baby => baby.id === id);
};

/**
 * Adds a new baby to the mock data.
 * Generates a simple ID and initializes empty sleep records, coach notes, and default status.
 * @param {Omit<Baby, 'id' | 'sleepRecords' | 'coachNotes' | 'isArchived' | 'lastModified' | 'dateArchived'>} babyData - The baby's data excluding auto-generated fields.
 * @returns {Baby} The newly created baby object.
 */
export const addBaby = (babyData: Omit<Baby, 'id' | 'sleepRecords' | 'coachNotes' | 'isArchived' | 'lastModified' | 'dateArchived'>): Baby => {
  const newBaby: Baby = {
    ...babyData,
    id: (mockBabies.length + 1).toString(), // Simple ID generation
    sleepRecords: [],
    coachNotes: "",
    isArchived: false,
    lastModified: getCurrentISODate(),
  };
  mockBabies.push(newBaby);
  return newBaby;
};

/**
 * Updates an existing baby's profile.
 * Merges the provided data with the existing baby data and updates the `lastModified` timestamp.
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
    return true;
  }
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
  return false;
};

/**
 * Retrieves all active (non-archived) babies.
 * @returns {Baby[]} An array of active baby profiles.
 */
export const getActiveBabies = (): Baby[] => {
  return mockBabies.filter(baby => !baby.isArchived);
};

/**
 * Retrieves all archived babies.
 * @returns {Baby[]} An array of archived baby profiles.
 */
export const getArchivedBabies = (): Baby[] => {
  return mockBabies.filter(baby => baby.isArchived);
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
    console.error("Baby not found for sleep record deletion:", babyId);
    return false;
  }

  const baby = mockBabies[babyIndex];
  if (!baby.sleepRecords) {
    console.error("Baby has no sleep records to delete from:", babyId);
    return false;
  }

  const recordIndex = baby.sleepRecords.findIndex(sr => sr.id === recordId);
  if (recordIndex === -1) {
    console.error("Sleep record not found for deletion:", recordId, "for baby:", babyId);
    return false;
  }

  baby.sleepRecords.splice(recordIndex, 1);
  baby.lastModified = getCurrentISODate();
  mockBabies[babyIndex] = { ...baby }; // Ensure the main array is updated
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
  return mockBabies.length < initialLength;
};

/**
 * Type definition for the data structure used in the add/edit baby form.
 * Excludes fields that are auto-generated or managed internally.
 */
export type AddBabyFormData = Omit<Baby, 'id' | 'sleepRecords' | 'coachNotes' | 'isArchived' | 'lastModified' | 'dateArchived'>;

/**
 * Type definition for the data structure used in the sleep record form.
 * Uses a `Date` object for the date field (from calendar input) and omits IDs for new cycles.
 */
export type SleepRecordFormData = Omit<SleepRecord, 'id' | 'sleepCycles'> & {
  sleepCycles: Array<Omit<SleepCycle, 'id'>>;
  date: Date; // Date object from calendar input
};

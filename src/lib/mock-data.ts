
import { format } from 'date-fns';

export interface SleepCycle {
  id: string;
  bedtime: string;
  timeToSleep: string;
  whoPutToSleep: string;
  howFellAsleep: string;
  wakeTime: string;
}

export interface SleepRecord {
  id: string;
  date: string;
  stage: string;
  sleepCycles: SleepCycle[];
}

export interface Baby {
  id: string;
  name: string;
  familyName: string;
  age: number; // months
  motherName: string;
  fatherName: string;
  siblingsCount: number;
  siblingsNames?: string;
  description?: string;
  parentUsername: string;
  sleepRecords?: SleepRecord[];
  coachNotes?: string;
  isArchived: boolean;
  dateArchived?: string; // ISO Date string
  lastModified: string; // ISO Date string
}

// Helper to get current ISO date string
const getCurrentISODate = () => new Date().toISOString();

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

export const getBabyByParentUsername = (username: string): Baby | undefined => {
  return mockBabies.find(baby => baby.parentUsername === username && !baby.isArchived);
};

export const getBabyById = (id: string): Baby | undefined => {
  // Allows fetching archived babies too for edit page or direct access
  return mockBabies.find(baby => baby.id === id);
};

export const addBaby = (baby: Omit<Baby, 'id' | 'sleepRecords' | 'coachNotes' | 'isArchived' | 'lastModified' | 'dateArchived'>): Baby => {
  const newBaby: Baby = {
    ...baby,
    id: (mockBabies.length + 1).toString(), // Simple ID generation
    sleepRecords: [],
    coachNotes: "",
    isArchived: false,
    lastModified: getCurrentISODate(),
  };
  mockBabies.push(newBaby);
  return newBaby;
};

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

export const getActiveBabies = (): Baby[] => {
  return mockBabies.filter(baby => !baby.isArchived);
};

export const getArchivedBabies = (): Baby[] => {
  return mockBabies.filter(baby => baby.isArchived);
};

export const deleteSleepRecord = (babyId: string, recordId: string): boolean => {
  const babyIndex = mockBabies.findIndex(b => b.id === babyId);
  if (babyIndex === -1) {
    console.error("Baby not found for deletion:", babyId);
    return false;
  }

  const baby = mockBabies[babyIndex];
  if (!baby.sleepRecords) {
    console.error("Baby has no sleep records:", babyId);
    return false;
  }

  const recordIndex = baby.sleepRecords.findIndex(sr => sr.id === recordId);
  if (recordIndex === -1) {
    console.error("Sleep record not found for deletion:", recordId, "for baby:", babyId);
    return false;
  }

  baby.sleepRecords.splice(recordIndex, 1);
  baby.lastModified = getCurrentISODate();
  mockBabies[babyIndex] = { ...baby }; // Ensure the main array is updated with the modified baby object
  return true;
};

export const deleteBabyPermanently = (babyId: string): boolean => {
  const initialLength = mockBabies.length;
  mockBabies = mockBabies.filter(baby => baby.id !== babyId);
  return mockBabies.length < initialLength;
};


// Export type for form data if it's different or more specific than Baby
export type AddBabyFormData = Omit<Baby, 'id' | 'sleepRecords' | 'coachNotes' | 'isArchived' | 'lastModified' | 'dateArchived'>;

// For sleep record form, doesn't include baby details
export type SleepRecordFormData = Omit<SleepRecord, 'id' | 'sleepCycles'> & {
  sleepCycles: Array<Omit<SleepCycle, 'id'>>;
  date: Date; // Date object from calendar
};

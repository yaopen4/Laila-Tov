
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
}

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
  },
];

export const getBabyByParentUsername = (username: string): Baby | undefined => {
  return mockBabies.find(baby => baby.parentUsername === username);
};

export const getBabyById = (id: string): Baby | undefined => {
  return mockBabies.find(baby => baby.id === id);
};

export const addBaby = (baby: Omit<Baby, 'id' | 'sleepRecords' | 'coachNotes'>): Baby => {
  const newBaby: Baby = {
    ...baby,
    id: (mockBabies.length + 1).toString(), // Simple ID generation
    sleepRecords: [],
    coachNotes: "",
  };
  mockBabies.push(newBaby);
  return newBaby;
};

export const updateBaby = (updatedBaby: Baby): boolean => {
  const index = mockBabies.findIndex(baby => baby.id === updatedBaby.id);
  if (index !== -1) {
    mockBabies[index] = { ...mockBabies[index], ...updatedBaby };
    return true;
  }
  return false;
};

// Export type for form data if it's different or more specific than Baby
export type AddBabyFormData = Omit<Baby, 'id' | 'sleepRecords' | 'coachNotes'>;

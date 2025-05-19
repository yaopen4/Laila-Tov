"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Baby, SleepRecord, SleepRecordFormData } from '@/lib/mock-data';
import { getBabyByParentUsername } from '@/lib/mock-data'; // Using parentUsername as babyId for mock
import { SleepDataForm } from '@/components/parent/sleep-data-form';
import CoachRecommendationsDisplay from '@/components/parent/coach-recommendations-display';
import AppLogo from '@/components/shared/app-logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, History, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from "date-fns-jalali";
import { he } from 'date-fns/locale';
import Link from 'next/link';

export default function ParentBabyPage() {
  const params = useParams();
  const babyId = params.babyId as string; // This is parentUsername in mock setup
  const [baby, setBaby] = useState<Baby | null>(null);
  const [latestRecord, setLatestRecord] = useState<SleepRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (babyId) {
      // Simulate fetching baby data
      setIsLoading(true);
      setTimeout(() => {
        const foundBaby = getBabyByParentUsername(babyId);
        if (foundBaby) {
          setBaby(foundBaby);
          if (foundBaby.sleepRecords && foundBaby.sleepRecords.length > 0) {
             // Sort records by date descending to get the latest
            const sortedRecords = [...foundBaby.sleepRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setLatestRecord(sortedRecords[0]);
          }
        }
        setIsLoading(false);
      }, 500);
    }
  }, [babyId]);

  const handleFormSubmit = (data: SleepRecordFormData) => {
    // Mock: update latest record for display
    // In a real app, this would trigger a re-fetch or update from Firestore
    const newRecord: SleepRecord = {
      id: `new-${Date.now()}`,
      date: format(data.date, "yyyy-MM-dd"),
      stage: data.stage,
      sleepCycles: data.sleepCycles.map((sc, index) => ({ ...sc, id: `sc-new-${index}`}))
    };
    setLatestRecord(newRecord);
    if (baby) {
      setBaby(prevBaby => ({
        ...prevBaby!,
        sleepRecords: [newRecord, ...(prevBaby?.sleepRecords || [])]
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AppLogo className="mb-8 text-4xl" />
        <p className="text-lg text-muted-foreground">טוען נתונים...</p>
      </div>
    );
  }

  if (!baby) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AppLogo className="mb-8 text-4xl" />
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">אופס! לא נמצא תינוק.</h1>
        <p className="text-muted-foreground mb-6">
          לא הצלחנו למצוא את פרטי התינוק המשויכים לשם המשתמש שהוזן.
          <br />
          נא לוודא ששם המשתמש נכון או לפנות למאמן/ת השינה.
        </p>
        <Link href="/" passHref legacyBehavior>
          <Button>חזרה למסך הכניסה</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <header className="mb-8 text-center">
        <AppLogo className="mb-2 text-4xl" />
        <p className="text-muted-foreground">ממשק הורים למעקב שינה</p>
      </header>
      
      <SleepDataForm babyName={baby.name} onSubmitSuccess={handleFormSubmit} />

      <CoachRecommendationsDisplay notes={baby.coachNotes} />

      {latestRecord && (
        <Card className="mt-8 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <History className="h-5 w-5" />
              עדכון שינה אחרון ({format(new Date(latestRecord.date), "PPP", { locale: he })})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p><strong>שלב:</strong> {latestRecord.stage}</p>
            {latestRecord.sleepCycles.map((cycle, index) => (
              <div key={cycle.id || index} className="p-3 border rounded-md bg-background">
                <h4 className="font-semibold mb-1">מחזור שינה {index + 1}</h4>
                <p className="text-sm"><strong>שעת השכבה:</strong> {cycle.bedtime}</p>
                <p className="text-sm"><strong>זמן להירדם:</strong> {cycle.timeToSleep}</p>
                <p className="text-sm"><strong>מי הרדים:</strong> {cycle.whoPutToSleep}</p>
                <p className="text-sm"><strong>איך נרדם:</strong> {cycle.howFellAsleep}</p>
                <p className="text-sm"><strong>שעת יקיצה:</strong> {cycle.wakeTime}</p>
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" disabled> {/* Edit/Delete are placeholders */}
                <Edit3 className="me-2 h-4 w-4" />
                ערוך רשומה
              </Button>
              <Button variant="destructive" size="sm" disabled>
                <Trash2 className="me-2 h-4 w-4" />
                מחק רשומה
              </Button>
            </div>
             <p className="text-xs text-muted-foreground mt-2">
              * יכולת עריכה ומחיקה תהיה זמינה בגרסאות עתידיות. להצגת היסטוריה מלאה, יש לפנות למאמן/ת.
            </p>
          </CardContent>
        </Card>
      )}
       <div className="mt-12 text-center">
        <Link href="/" passHref legacyBehavior>
          <Button variant="link">התנתקות וחזרה למסך הכניסה</Button>
        </Link>
      </div>
    </div>
  );
}

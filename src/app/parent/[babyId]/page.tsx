
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Baby, SleepRecord, SleepRecordFormData } from '@/lib/mock-data';
import { getBabyByParentUsername } from '@/lib/mock-data'; 
import { SleepDataForm } from '@/components/parent/sleep-data-form';
import CoachRecommendationsDisplay from '@/components/parent/coach-recommendations-display';
import AppLogo from '@/components/shared/app-logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, History, Edit3, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from "date-fns";
import { he } from 'date-fns/locale';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";


export default function ParentBabyPage() {
  const params = useParams();
  const babyId = params.babyId as string; 
  const [baby, setBaby] = useState<Baby | null>(null);
  const [latestRecord, setLatestRecord] = useState<SleepRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<SleepRecord | null>(null);

  useEffect(() => {
    if (babyId) {
      setIsLoading(true);
      setTimeout(() => {
        const foundBaby = getBabyByParentUsername(babyId);
        if (foundBaby) {
          setBaby(foundBaby);
          if (foundBaby.sleepRecords && foundBaby.sleepRecords.length > 0) {
            const sortedRecords = [...foundBaby.sleepRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setLatestRecord(sortedRecords[0]);
          }
        }
        setIsLoading(false);
      }, 500);
    }
  }, [babyId]);

  const handleAddNewFormSubmit = (data: SleepRecordFormData) => {
    const newRecord: SleepRecord = {
      id: `new-${Date.now()}`,
      date: format(data.date, "yyyy-MM-dd"),
      stage: data.stage,
      sleepCycles: data.sleepCycles.map((sc, index) => ({ ...sc, id: `sc-new-${Date.now()}-${index}`})) // Ensure new IDs for new cycles
    };
    setLatestRecord(newRecord); // New record becomes the latest
    if (baby) {
      const updatedSleepRecords = [newRecord, ...(baby.sleepRecords || [])];
      setBaby(prevBaby => ({
        ...prevBaby!,
        sleepRecords: updatedSleepRecords
      }));
    }
  };

  const handleEditRecordClick = (record: SleepRecord) => {
    setRecordToEdit(record);
    setIsEditDialogOpen(true);
  };

  const handleEditFormSubmit = (data: SleepRecordFormData) => {
    if (!recordToEdit || !baby) return;

    const updatedRecord: SleepRecord = {
      ...recordToEdit,
      id: recordToEdit.id, // Keep original record ID
      date: format(data.date, "yyyy-MM-dd"),
      stage: data.stage,
      sleepCycles: data.sleepCycles.map((sc, index) => ({
        id: recordToEdit.sleepCycles[index]?.id || `sc-updated-${Date.now()}-${index}`, // Try to preserve ID, or new
        bedtime: sc.bedtime,
        timeToSleep: sc.timeToSleep,
        whoPutToSleep: sc.whoPutToSleep,
        howFellAsleep: sc.howFellAsleep,
        wakeTime: sc.wakeTime,
      })),
    };
    
    const updatedSleepRecords = baby.sleepRecords?.map(sr =>
      sr.id === recordToEdit.id ? updatedRecord : sr
    ) || [updatedRecord];
    
    setBaby(prevBaby => ({
      ...prevBaby!,
      sleepRecords: updatedSleepRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Re-sort after update
    }));

    // Update latestRecord if the edited one is still the latest (by date) or was the latest
     const sortedRecords = [...updatedSleepRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
     if (sortedRecords.length > 0) {
        setLatestRecord(sortedRecords[0]);
     }


    setIsEditDialogOpen(false);
    setRecordToEdit(null);
    // Toast is handled by SleepDataForm itself now
  };
  
  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setRecordToEdit(null);
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
      
      <SleepDataForm babyName={baby.name} onSubmitSuccess={handleAddNewFormSubmit} />

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
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => latestRecord && handleEditRecordClick(latestRecord)}>
                    <Edit3 className="me-2 h-4 w-4" />
                    ערוך רשומה
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[625px]">
                  <DialogHeader>
                    <DialogTitle>עריכת רשומת שינה</DialogTitle>
                    <DialogDescription>
                      עדכן את פרטי השינה עבור {baby.name} לתאריך {recordToEdit ? format(new Date(recordToEdit.date), "PPP", { locale: he }) : ''}.
                    </DialogDescription>
                  </DialogHeader>
                  {recordToEdit && baby && ( // Ensure recordToEdit and baby are available
                    <SleepDataForm
                      babyName={baby.name}
                      initialData={recordToEdit}
                      onSubmitSuccess={handleEditFormSubmit}
                      onCancel={handleCancelEdit}
                      submitButtonText="עדכן רשומה"
                      isDialog={true}
                    />
                  )}
                   {/* DialogFooter can be removed if buttons are inside SleepDataForm */}
                </DialogContent>
              </Dialog>
              <Button variant="destructive" size="sm" disabled>
                <Trash2 className="me-2 h-4 w-4" />
                מחק רשומה
              </Button>
            </div>
             <p className="text-xs text-muted-foreground mt-2">
              * יכולת מחיקה תהיה זמינה בגרסאות עתידיות.
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

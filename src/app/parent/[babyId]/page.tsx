
/**
 * @fileoverview Parent-facing page for a specific baby.
 * Allows parents to log sleep data, view coach recommendations, and manage recent sleep records.
 */
"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Baby, SleepRecord, SleepRecordFormData } from '@/lib/mock-data';
import { getBabyByParentUsername, deleteSleepRecord } from '@/lib/mock-data'; 
import { SleepDataForm } from '@/components/parent/sleep-data-form';
import CoachRecommendationsDisplay from '@/components/parent/coach-recommendations-display';
import AppLogo from '@/components/shared/app-logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, History, Edit3, Trash2, ListChecks } from 'lucide-react';
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
  // DialogTrigger, // Not used directly, form has its own buttons or manual control
  // DialogClose, // Not used directly, form cancellation handles closing
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter, // Added AlertDialogFooter
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";


export default function ParentBabyPage() {
  const params = useParams();
  const babyId = params.babyId as string; // This is actually the parentUsername from routing
  const [baby, setBaby] = useState<Baby | null>(null);
  const [latestRecord, setLatestRecord] = useState<SleepRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // State for edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<SleepRecord | null>(null);

  // State for delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [recordToDeleteId, setRecordToDeleteId] = useState<string | null>(null);

  // State for all history dialog
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);


  // Effect to fetch baby data based on parentUsername (babyId from route)
  useEffect(() => {
    if (babyId) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        const foundBaby = getBabyByParentUsername(babyId);
        if (foundBaby) {
          setBaby(foundBaby);
          if (foundBaby.sleepRecords && foundBaby.sleepRecords.length > 0) {
            // Sort records by date descending to get the latest (already sorted in mock-data)
            setLatestRecord(foundBaby.sleepRecords[0]);
          } else {
            setLatestRecord(null);
          }
        }
        setIsLoading(false);
      }, 500);
    }
  }, [babyId]);

  /**
   * Refreshes the `latestRecord` state based on the provided baby's sleep records.
   * @param {Baby} updatedBaby - The baby object with potentially updated sleep records.
   */
  const refreshLatestRecord = (updatedBaby: Baby) => {
    if (updatedBaby.sleepRecords && updatedBaby.sleepRecords.length > 0) {
      // Sleep records are assumed to be sorted by date descending in mock-data functions
      setLatestRecord(updatedBaby.sleepRecords[0]);
    } else {
      setLatestRecord(null);
    }
  };

  /**
   * Handles submission of a new sleep record.
   * Adds the new record to the baby's sleep records and updates state.
   * @param {SleepRecordFormData} data - The submitted sleep record form data.
   */
  const handleAddNewFormSubmit = (data: SleepRecordFormData) => {
    if (!baby) return;
    const newRecord: SleepRecord = {
      id: `new-${Date.now()}`, // Ensure new ID for new record
      date: format(data.date, "yyyy-MM-dd"),
      stage: data.stage,
      sleepCycles: data.sleepCycles.map((sc, index) => ({ ...sc, id: `sc-new-${Date.now()}-${index}`}))
    };
    
    const updatedSleepRecords = [newRecord, ...(baby.sleepRecords || [])]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Ensure sort
      
    const updatedBaby = {
        ...baby,
        sleepRecords: updatedSleepRecords
    };
    // Note: In a real app, this would be an API call.
    // For mock setup, we update local state. Actual mockBabies array isn't modified here
    // unless this page also calls an updateBaby function from mock-data.ts upon submission.
    setBaby(updatedBaby); 
    refreshLatestRecord(updatedBaby);
  };

  /**
   * Handles clicking the edit button for a sleep record.
   * Sets the record to be edited and opens the edit dialog.
   * @param {SleepRecord} record - The sleep record to edit.
   */
  const handleEditRecordClick = (record: SleepRecord) => {
    setRecordToEdit(record);
    setIsEditDialogOpen(true);
  };

  /**
   * Handles submission of an edited sleep record.
   * Updates the specific sleep record in the baby's data.
   * @param {SleepRecordFormData} data - The updated sleep record form data.
   */
  const handleEditFormSubmit = (data: SleepRecordFormData) => {
    if (!recordToEdit || !baby) return;

    const updatedRecord: SleepRecord = {
      ...recordToEdit,
      id: recordToEdit.id, 
      date: format(data.date, "yyyy-MM-dd"),
      stage: data.stage,
      sleepCycles: data.sleepCycles.map((sc, index) => ({
        id: recordToEdit.sleepCycles[index]?.id || `sc-updated-${Date.now()}-${index}`, 
        bedtime: sc.bedtime,
        timeToSleep: sc.timeToSleep,
        whoPutToSleep: sc.whoPutToSleep,
        howFellAsleep: sc.howFellAsleep,
        wakeTime: sc.wakeTime,
      })),
    };
    
    const updatedSleepRecords = (baby.sleepRecords?.map(sr =>
      sr.id === recordToEdit.id ? updatedRecord : sr
    ) || [updatedRecord])
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Ensure sort
    
    const updatedBaby = {
        ...baby,
        sleepRecords: updatedSleepRecords
    };
    setBaby(updatedBaby);
    refreshLatestRecord(updatedBaby);

    setIsEditDialogOpen(false);
    setRecordToEdit(null);
  };
  
  /**
   * Handles cancelling the edit operation from the dialog.
   */
  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setRecordToEdit(null);
  };

  /**
   * Handles clicking the delete button for a sleep record.
   * Sets the record ID to be deleted and opens the confirmation dialog.
   * @param {string} recordId - The ID of the sleep record to delete.
   */
  const handleDeleteRecordClick = (recordId: string) => {
    setRecordToDeleteId(recordId);
    setIsDeleteDialogOpen(true);
  };

  /**
   * Confirms and executes the deletion of a sleep record.
   */
  const confirmDeleteRecord = () => {
    if (!baby || !recordToDeleteId) return;

    // This calls the mock data function to persist the deletion
    const success = deleteSleepRecord(baby.id, recordToDeleteId); 
    if (success) {
      // Update local state to reflect the deletion
      const updatedRecords = baby.sleepRecords?.filter(sr => sr.id !== recordToDeleteId) || [];
      const updatedBaby = { ...baby, sleepRecords: updatedRecords };
      setBaby(updatedBaby);
      refreshLatestRecord(updatedBaby);
      toast({
        title: "רשומה נמחקה",
        description: "רשומת השינה נמחקה בהצלחה.",
      });
    } else {
      toast({
        title: "שגיאה במחיקה",
        description: "לא ניתן היה למחוק את רשומת השינה.",
        variant: "destructive",
      });
    }
    setIsDeleteDialogOpen(false);
    setRecordToDeleteId(null);
  };

  // Loading state UI
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AppLogo className="mb-8 text-4xl" />
        <p className="text-lg text-muted-foreground">טוען נתונים...</p>
      </div>
    );
  }

  // Baby not found UI
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

  // Main parent page UI
  return (
    <div className="container mx-auto py-8 px-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-1">
          <span className="text-primary">לילה</span> <span className="text-accent">טוב</span> <span className="text-primary">משפחת {baby.familyName}</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          ממשק הורים למעקב שינה
        </p>
      </header>
      
      {/* Form to add new sleep data */}
      <SleepDataForm babyName={baby.name} onSubmitSuccess={handleAddNewFormSubmit} />

      <CoachRecommendationsDisplay notes={baby.coachNotes} />

      {/* Display latest sleep record if available */}
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
                <p className="text-sm"><strong>שעת יקיצה:</strong> {cycle.wakeTime || '-'}</p>
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              {/* Edit Record Dialog */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                {/* Button to trigger edit dialog */}
                <Button variant="outline" size="sm" onClick={() => latestRecord && handleEditRecordClick(latestRecord)}>
                  <Edit3 className="me-2 h-4 w-4" />
                  ערוך רשומה
                </Button>
                <DialogContent className="sm:max-w-[625px] max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>עריכת רשומת שינה</DialogTitle>
                    <DialogDescription>
                      עדכן את פרטי השינה עבור {baby.name} לתאריך {recordToEdit ? format(new Date(recordToEdit.date), "PPP", { locale: he }) : ''}.
                    </DialogDescription>
                  </DialogHeader>
                  {recordToEdit && baby && (
                    <SleepDataForm
                      babyName={baby.name}
                      initialData={recordToEdit}
                      onSubmitSuccess={handleEditFormSubmit}
                      onCancel={handleCancelEdit}
                      submitButtonText="עדכן רשומה"
                      isDialog={true}
                    />
                  )}
                </DialogContent>
              </Dialog>
              {/* Delete Record Confirmation Dialog */}
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" onClick={() => latestRecord && handleDeleteRecordClick(latestRecord.id)}>
                    <Trash2 className="me-2 h-4 w-4" />
                    מחק רשומה
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>אישור מחיקת רשומה</AlertDialogTitle>
                    <AlertDialogDescription>
                      האם אתה בטוח שברצונך למחוק את רשומת השינה מתאריך {latestRecord ? format(new Date(latestRecord.date), "PPP", { locale: he }) : ''}?
                      לא ניתן לשחזר פעולה זו.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setRecordToDeleteId(null); }}>ביטול</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteRecord}>מחק</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Button to show all history */}
      {baby.sleepRecords && baby.sleepRecords.length > 0 && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={() => setIsHistoryDialogOpen(true)}>
            <ListChecks className="me-2 h-4 w-4" />
            הצג את כל ההיסטוריה
          </Button>
        </div>
      )}

      {/* Dialog for displaying all sleep history */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>היסטוריית שינה מלאה עבור {baby.name}</DialogTitle>
            <DialogDescription>
              כאן מוצגים כל רישומי השינה עבור {baby.name}, מהעדכני ביותר.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {baby.sleepRecords && baby.sleepRecords.length > 0 ? (
              baby.sleepRecords.map(record => (
                <Card key={record.id} className="shadow-md">
                  <CardHeader className="pb-3 pt-4 px-4">
                    <CardTitle className="text-lg">
                      {format(new Date(record.date), "PPP", { locale: he })} - (שלב: {record.stage})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    {record.sleepCycles.length > 0 ? (
                      record.sleepCycles.map((cycle, index) => (
                        <div key={cycle.id || index} className="p-3 border rounded-md bg-background/50">
                          <h4 className="font-semibold mb-1">מחזור שינה {index + 1}</h4>
                          <p className="text-sm"><strong>שעת השכבה:</strong> {cycle.bedtime}</p>
                          <p className="text-sm"><strong>זמן להירדם:</strong> {cycle.timeToSleep}</p>
                          <p className="text-sm"><strong>מי הרדים:</strong> {cycle.whoPutToSleep}</p>
                          <p className="text-sm"><strong>איך נרדם:</strong> {cycle.howFellAsleep}</p>
                          <p className="text-sm"><strong>שעת יקיצה:</strong> {cycle.wakeTime || '-'}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">אין מחזורי שינה מתועדים לרשומה זו.</p>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">אין היסטוריית שינה מתועדת.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-12 text-center">
        <Link href="/" passHref legacyBehavior>
          <Button variant="link">התנתקות וחזרה למסך הכניסה</Button>
        </Link>
      </div>
    </div>
  );
}


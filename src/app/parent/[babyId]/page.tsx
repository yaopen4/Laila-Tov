
/**
 * @fileoverview Parent-facing page for a specific baby.
 * Allows parents to log sleep data, view consultant recommendations, and manage recent sleep records.
 * Uses Firebase Auth for route protection and Firestore for data and real-time updates.
 */
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onSnapshot, doc, collection, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { BabyProfile } from '@/types/auth';
import { BabyService } from '@/services/babyService';
import { AuthService } from '@/services/authService';
import { SleepDataForm } from '@/components/parent/sleep-data-form';
import CoachRecommendationsDisplay from '@/components/parent/coach-recommendations-display';
import AppLogo from '@/components/shared/app-logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, History, Edit3, Trash2, BookOpenText, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from "date-fns";
import { he } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { AuthService as AuthServiceTypeOnly, type AuthUser } from '@/services/authService';
import { Skeleton } from '@/components/ui/skeleton';
import { fromDateKey } from '@/services/babyService';


export default function ParentBabyPage() {
  const params = useParams();
  const router = useRouter();
  const babyId = params.babyId as string; // This is the baby profile ID
  const [baby, setBaby] = useState<BabyProfile | null>(null);
  const [sleepRecords, setSleepRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any | null>(null);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [recordToDeleteId, setRecordToDeleteId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);


  // Auth check and initial data fetching
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsAuthLoading(true);
        const user = await AuthService.getCurrentUser();
        setCurrentUser(user);
        
        if (user) {
          // Check if user has access to this baby profile
          const isAuthorized = user.role === 'coach' || 
            (user.role === 'parent' && user.managedBabyProfiles?.includes(babyId)) ||
            user.role === 'admin';

          if (isAuthorized) {
            setIsLoading(true);
            try {
              const foundBaby = await BabyService.getBabyProfile(babyId);
              if (foundBaby) {
                setBaby(foundBaby);
              } else {
                setBaby(null);
                // If a parent can't find their baby, something is wrong. Log them out.
                // A coach might legitimately land here if they have a bad link, so don't log them out.
                if (user.role === 'parent') {
                  await AuthService.signOut();
                  router.push('/');
                }
              }
            } catch (error) {
              console.error("Error fetching initial baby data:", error);
              toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" });
            } finally {
              setIsLoading(false);
            }
          } else {
            // Not authorized for this page
            await AuthService.signOut();
            router.push('/');
          }
        } else {
          // No user logged in
          router.push('/');
        }
      } catch (error) {
        console.error("Error in loadData:", error);
        setIsAuthLoading(false);
      } finally {
        setIsAuthLoading(false);
      }
    };

    loadData();
  }, [babyId, router, toast]);


  // Real-time listener for Baby document changes (e.g., coachNotes)
  useEffect(() => {
    if (!baby?.id) return;

    const babyDocRef = doc(db, 'baby_profiles', baby.id);
    const unsubscribeBaby = onSnapshot(babyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setBaby({ id: docSnap.id, ...docSnap.data() } as BabyProfile);
      } else {
        // Baby document might have been deleted
        setBaby(null);
      }
    }, (error) => {
      console.error("Error listening to baby document:", error);
      toast({ title: "שגיאה בעדכון נתוני תינוק", variant: "destructive" });
    });

    return () => unsubscribeBaby();
  }, [baby?.id, toast]);


  // Load sleep records using service
  useEffect(() => {
    if (!baby?.id) {
      setSleepRecords([]); // Clear records if no baby
      return;
    }
    
    const loadSleepRecords = async () => {
      try {
        setIsLoading(true);
        const records = await BabyService.getSleepRecordsForBaby(baby.id);
        setSleepRecords(records);
      } catch (error) {
        console.error("Error loading sleep records:", error);
        toast({ title: "שגיאה בטעינת רשומות שינה", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    loadSleepRecords();
  }, [baby?.id, toast]);


  /**
   * Handles submission of a new sleep record.
   * @param {any} data - The submitted sleep record form data.
   */
  const handleAddNewFormSubmit = async (data: any) => {
    if (!baby) return;
    setIsProcessing(true);
    try {
      await BabyService.addSleepRecord(baby.id, data);
      toast({
        title: "נתוני שינה נשמרו!",
        description: `הנתונים עבור ${baby.name} נשלחו בהצלחה.`,
      });
      // Reload sleep records
      const records = await BabyService.getSleepRecordsForBaby(baby.id);
      setSleepRecords(records);
    } catch (error) {
      console.error("Error adding sleep record:", error);
      toast({ title: "שגיאה בשמירת נתונים", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handles clicking the edit button for a sleep record.
   * @param {any} record - The sleep record to edit.
   */
  const handleEditRecordClick = (record: any) => {
    setRecordToEdit(record);
    setIsEditDialogOpen(true);
  };

  /**
   * Handles submission of an edited sleep record.
   * @param {any} data - The updated sleep record form data.
   */
  const handleEditFormSubmit = async (data: any) => {
    if (!recordToEdit || !baby) return;
    setIsProcessing(true);
    try {
      await BabyService.updateSleepRecord(baby.id, recordToEdit.id, data);
      toast({
        title: "נתוני שינה עודכנו!",
        description: `הנתונים עודכנו בהצלחה.`,
      });
      setIsEditDialogOpen(false);
      setRecordToEdit(null);
      // Reload sleep records
      const records = await BabyService.getSleepRecordsForBaby(baby.id);
      setSleepRecords(records);
    } catch (error) {
      console.error("Error updating sleep record:", error);
      toast({ title: "שגיאה בעדכון נתונים", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCancelEdit = () => {
    setIsEditDialogOpen(false);
    setRecordToEdit(null);
  };

  const handleDeleteRecordClick = (recordId: string) => {
    setRecordToDeleteId(recordId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRecord = async () => {
    if (!baby || !recordToDeleteId) return;
    setIsProcessing(true);
    try {
      await BabyService.deleteSleepRecord(baby.id, recordToDeleteId);
      toast({
        title: "רשומה נמחקה",
        description: "רשומת השינה נמחקה בהצלחה.",
      });
      // Reload sleep records
      const records = await BabyService.getSleepRecordsForBaby(baby.id);
      setSleepRecords(records);
    } catch (error) {
      console.error("Error deleting sleep record:", error);
      toast({ title: "שגיאה במחיקה", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setIsDeleteDialogOpen(false);
      setRecordToDeleteId(null);
    }
  };

  const handleLogout = async () => {
    setIsProcessing(true);
    try {
      await AuthService.signOut();
      toast({ title: "התנתקת בהצלחה" });
      router.push('/');
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "שגיאה בהתנתקות", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const latestRecord = sleepRecords.length > 0 ? sleepRecords[0] : null;

  if (isAuthLoading || (isLoading && !baby)) { // Show loading if auth is loading OR (data is loading AND baby is not yet set)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AppLogo className="mb-8 text-4xl" />
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-6 w-64 mb-8" />
        <Skeleton className="h-48 w-full max-w-2xl mb-8" />
        <Skeleton className="h-32 w-full max-w-2xl" />
      </div>
    );
  }

  if (!baby) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AppLogo className="mb-8 text-4xl" />
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">אופס! גישה נדחתה או שלא נמצא תינוק.</h1>
        <p className="text-muted-foreground mb-6">
          לא הצלחנו למצוא את פרטי התינוק המשויכים או שאין לך הרשאה לצפות בדף זה.
          <br />
          נא לוודא ששם המשתמש נכון או לפנות ליועצת השינה.
        </p>
        <Button onClick={handleLogout} disabled={isProcessing}>חזרה למסך הכניסה</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-1">
          <span className="text-primary">לילה טוב, </span>
          <span className="text-accent">משפחת {baby.familyName}</span>
        </h1>
        <p className="text-lg text-muted-foreground">
          ממשק הורים למעקב שינה
        </p>
      </header>

      <SleepDataForm babyName={baby.name} onSubmitSuccess={handleAddNewFormSubmit} isSubmitting={isProcessing} />
      
      <CoachRecommendationsDisplay notes={baby.coachNotes} />

      {latestRecord && (
        <Card className="mt-8 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <History className="h-5 w-5" />
              עדכון שינה אחרון ({format(fromDateKey(latestRecord.date), "PPP", { locale: he })})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestRecord.sleepCycles.map((cycle: any, index: number) => (
              <div key={cycle.id || index} className="p-3 border rounded-md bg-background">
                <h4 className="font-semibold mb-1">מחזור שינה {index + 1}</h4>
                <p className="text-sm"><strong>שעת השכבה:</strong> {cycle.bedtime}</p>
                <p className="text-sm"><strong>זמן להירדם:</strong> {cycle.timeToSleep}</p>
                <p className="text-sm"><strong>מי הרדים:</strong> {cycle.whoPutToSleep}</p>
                <p className="text-sm"><strong>איך נרדם:</strong> {cycle.howFellAsleep}</p>
                <p className="text-sm"><strong>שעת יקיצה:</strong> {cycle.wakeTime || '-'}</p>
              </div>
            ))}
            {!(currentUser?.role === 'coach') && ( // Only show edit/delete to the parent, not the coach on this view
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => latestRecord && handleEditRecordClick(latestRecord)} disabled={isProcessing}>
                <Edit3 className="me-2 h-4 w-4" />
                ערוך רשומה
              </Button>
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" onClick={() => latestRecord && handleDeleteRecordClick(latestRecord.id)} disabled={isProcessing}>
                    <Trash2 className="me-2 h-4 w-4" />
                    מחק רשומה
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>אישור מחיקת רשומה</AlertDialogTitle>
                    <AlertDialogDescription>
                      האם אתה בטוח שברצונך למחוק את רשומת השינה מתאריך {latestRecord ? format(fromDateKey(latestRecord.date), "PPP", { locale: he }) : ''}?
                      לא ניתן לשחזר פעולה זו.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setRecordToDeleteId(null); }} disabled={isProcessing}>ביטול</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDeleteRecord} disabled={isProcessing}>
                      {isProcessing ? "מוחק..." : "מחק"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            )}
          </CardContent>
        </Card>
      )}
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[625px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>עריכת רשומת שינה</DialogTitle>
            <DialogDescription>
              עדכן את פרטי השינה עבור {baby.name} לתאריך {recordToEdit ? format(fromDateKey(recordToEdit.date), "PPP", { locale: he }) : ''}.
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
              isSubmitting={isProcessing}
            />
          )}
        </DialogContent>
      </Dialog>

      {sleepRecords.length > 1 && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() => setShowFullHistory(!showFullHistory)}
            className="w-full md:w-auto"
            disabled={isProcessing}
          >
            {showFullHistory ? "הסתר היסטוריית שינה" : "הצג היסטוריית שינה מלאה"}
            {showFullHistory ? <ChevronUp className="ms-2 h-4 w-4" /> : <ChevronDown className="ms-2 h-4 w-4" />}
          </Button>
        </div>
      )}

      {showFullHistory && sleepRecords.length > 1 && (
        <div className="mt-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <BookOpenText className="h-6 w-6 text-primary" />
            היסטוריית שינה קודמת
          </h2>
          <div className="space-y-6">
            {sleepRecords.slice(1).map(record => (
              <Card key={record.id} className="shadow-md">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-lg">
                    {format(fromDateKey(record.date), "PPP", { locale: he })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  {record.sleepCycles.length > 0 ? (
                    record.sleepCycles.map((cycle: any, index: number) => (
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
            ))}
          </div>
        </div>
      )}

      {sleepRecords.length === 0 && !latestRecord && (
         <p className="text-center text-muted-foreground py-8 mt-8">אין היסטוריית שינה מתועדת עבור {baby.name}.</p>
      )}

      <div className="mt-12 text-center">
         <Button variant="link" onClick={handleLogout} disabled={isProcessing}>התנתקות וחזרה למסך הכניסה</Button>
      </div>
    </div>
  );
}

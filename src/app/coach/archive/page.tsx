
/**
 * @fileoverview Page for viewing and managing archived baby profiles from Firestore.
 * Consultants can unarchive babies or permanently delete them from this page.
 */
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Baby } from '@/types';
import { 
  getArchivedBabiesFromFirestore, 
  unarchiveBabyInFirestore, 
  deleteBabyPermanentlyFromFirestore 
} from '@/services/babyService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArchiveRestore, Inbox, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from "date-fns";
import { he } from 'date-fns/locale';
import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { onAuthChange, type AuthUser } from '@/services/authService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ArchivePage() {
  const [archivedBabies, setArchivedBabies] = useState<Baby[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [babyToDelete, setBabyToDelete] = useState<Baby | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);


  // Get the currently authenticated user
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  /**
   * Fetches the list of archived babies from Firestore for the current coach.
   */
  const fetchArchivedBabies = useCallback(async () => {
    if (!currentUser) return; // Don't fetch if no user is logged in
    
    setIsLoading(true);
    try {
      const babies = await getArchivedBabiesFromFirestore(currentUser.uid);
      // Sort on the client to handle potential null or undefined dates gracefully
      const sortedBabies = babies.sort((a, b) => {
        if (a.dateArchived && b.dateArchived) {
          // Both dates are valid strings, so compare them
          return new Date(b.dateArchived).getTime() - new Date(a.dateArchived).getTime();
        }
        if (a.dateArchived) return -1; // a is valid, b is not, so a comes first
        if (b.dateArchived) return 1;  // b is valid, a is not, so b comes first
        return 0; // Neither has a date, so keep original order
      });
      setArchivedBabies(sortedBabies);
    } catch (error) {
      console.error("Error fetching archived babies:", error);
      toast({
        title: "שגיאה בטעינת הארכיון",
        description: "לא ניתן היה לטעון את רשימת התינוקות מהארכיון.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, currentUser]);

  useEffect(() => {
    if(currentUser) {
      fetchArchivedBabies();
    }
  }, [currentUser, fetchArchivedBabies]);

  /**
   * Handles unarchiving a baby.
   * @param {string} babyId - The ID of the baby to unarchive.
   * @param {string} babyName - The full name of the baby for toast messages.
   */
  const handleUnarchive = async (babyId: string, babyName: string) => {
    setIsProcessing(true);
    try {
      await unarchiveBabyInFirestore(babyId);
      toast({
        title: "תינוק שוחזר מהארכיון",
        description: `${babyName} הועבר בהצלחה לרשימת התינוקות הפעילים.`,
      });
      fetchArchivedBabies(); // Refresh list
    } catch (error) {
      console.error("Error unarchiving baby:", error);
      toast({
        title: "שגיאה בשחזור",
        description: `לא ניתן היה לשחזר את ${babyName} מהארכיון.`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Opens the confirmation dialog for permanent deletion.
   * @param {Baby} baby - The baby object to be deleted.
   */
  const openDeleteDialog = (baby: Baby) => {
    setBabyToDelete(baby);
    setIsDeleteDialogOpen(true);
  };

  /**
   * Confirms and executes the permanent deletion of a baby.
   */
  const confirmDeleteBaby = async () => {
    if (!babyToDelete) return;
    setIsProcessing(true);
    try {
      await deleteBabyPermanentlyFromFirestore(babyToDelete.id);
      toast({
        title: "תינוק נמחק לצמיתות",
        description: `התינוק ${babyToDelete.name} ${babyToDelete.familyName} נמחק מהמערכת.`,
      });
      fetchArchivedBabies(); // Refresh list
    } catch (error) {
      console.error("Error deleting baby permanently:", error);
      toast({
        title: "שגיאה במחיקה",
        description: `לא ניתן היה למחוק את ${babyToDelete.name} ${babyToDelete.familyName} לצמיתות.`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setIsDeleteDialogOpen(false);
      setBabyToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6 text-primary">ארכיון תינוקות</h1>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-grow">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-10 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">ארכיון תינוקות</h1>
        <Link href="/coach/dashboard" passHref legacyBehavior>
          <Button variant="outline" disabled={isProcessing}>חזרה ללוח הבקרה</Button>
        </Link>
      </div>

      {archivedBabies.length === 0 ? (
        <div className="text-center py-12">
          <Inbox className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-xl text-muted-foreground">הארכיון ריק.</p>
          <p className="text-sm text-muted-foreground">אין כרגע תינוקות שהועברו לארכיון.</p>
        </div>
      ) : (
        <Card className="shadow-xl">
          <CardContent className="p-0">
            <Table>
              <TableCaption className="py-4">רשימת כל התינוקות שנמצאים בארכיון.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">שם מלא</TableHead>
                  <TableHead>תאריך העברה לארכיון</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedBabies.map((baby) => (
                  <TableRow key={baby.id}>
                    <TableCell className="font-medium">{baby.name} {baby.familyName}</TableCell>
                    <TableCell>
                      {baby.dateArchived ? format(new Date(baby.dateArchived), "PPP HH:mm", { locale: he }) : 'לא זמין'}
                    </TableCell>
                    <TableCell className="text-right space-x-2 rtl:space-x-reverse">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnarchive(baby.id, `${baby.name} ${baby.familyName}`)}
                        disabled={isProcessing}
                      >
                        <ArchiveRestore className="me-2 h-4 w-4" />
                        הוצא מארכיון
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openDeleteDialog(baby)}
                        disabled={isProcessing}
                      >
                        <Trash2 className="me-2 h-4 w-4" />
                        מחק לצמיתות
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {babyToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>אישור מחיקה לצמיתות</AlertDialogTitle>
              <AlertDialogDescription>
                האם אתה בטוח שברצונך למחוק את {babyToDelete.name} {babyToDelete.familyName} לצמיתות?
                <br />
                <strong>פעולה זו אינה ניתנת לשחזור.</strong> כל הנתונים המשויכים לתינוק זה יימחקו.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setBabyToDelete(null); }} disabled={isProcessing}>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteBaby} disabled={isProcessing}>
                {isProcessing ? "מוחק..." : "מחק לצמיתות"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

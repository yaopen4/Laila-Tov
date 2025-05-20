
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Baby } from '@/lib/mock-data';
import { getArchivedBabies, unarchiveBaby, deleteBabyPermanently } from '@/lib/mock-data';
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


export default function ArchivePage() {
  const [archivedBabies, setArchivedBabies] = useState<Baby[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [babyToDelete, setBabyToDelete] = useState<Baby | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const fetchArchivedBabies = useCallback(() => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setArchivedBabies(getArchivedBabies());
      setIsLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    fetchArchivedBabies();
  }, [fetchArchivedBabies]);

  const handleUnarchive = (babyId: string, babyName: string) => {
    if (unarchiveBaby(babyId)) {
      toast({
        title: "תינוק שוחזר מהארכיון",
        description: `${babyName} הועבר בהצלחה לרשימת התינוקות הפעילים.`,
      });
      fetchArchivedBabies(); // Refresh list
    } else {
      toast({
        title: "שגיאה בשחזור",
        description: `לא ניתן היה לשחזר את ${babyName} מהארכיון.`,
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (baby: Baby) => {
    setBabyToDelete(baby);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteBaby = () => {
    if (!babyToDelete) return;
    if (deleteBabyPermanently(babyToDelete.id)) {
      toast({
        title: "תינוק נמחק לצמיתות",
        description: `התינוק ${babyToDelete.name} ${babyToDelete.familyName} נמחק מהמערכת.`,
      });
      fetchArchivedBabies(); // Refresh list
    } else {
      toast({
        title: "שגיאה במחיקה",
        description: `לא ניתן היה למחוק את ${babyToDelete.name} ${babyToDelete.familyName} לצמיתות.`,
        variant: "destructive",
      });
    }
    setIsDeleteDialogOpen(false);
    setBabyToDelete(null);
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
          <Button variant="outline">חזרה ללוח הבקרה</Button>
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
                      >
                        <ArchiveRestore className="me-2 h-4 w-4" />
                        הוצא מארכיון
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openDeleteDialog(baby)}
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
              <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setBabyToDelete(null); }}>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteBaby}>מחק לצמיתות</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

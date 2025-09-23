/**
 * @fileoverview Page for editing an existing baby's profile from Firestore.
 * Fetches baby data by ID and uses AddBabyForm in edit mode.
 * Allows archiving the baby from this page.
 */
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AddBabyForm, type BabyFormData } from '@/components/coach/add-baby-form';
import { BabyService } from '@/services/babyService';
import { AuthService } from '@/services/authService';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Archive as ArchiveIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
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

export default function EditBabyPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const babyId = params.babyId as string;
  const [baby, setBaby] = useState<any | null | undefined>(undefined); // undefined: loading, null: not found
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const fetchBabyData = useCallback(async () => {
    if (babyId) {
      setIsLoading(true);
      try {
        const foundBaby = await BabyService.getBabyProfile(babyId);
        setBaby(foundBaby);
      } catch (error) {
        console.error("Error fetching baby data:", error);
        setBaby(null); // Set to null if error occurs
        toast({
          title: "שגיאה בטעינת נתונים",
          description: "לא ניתן היה לטעון את פרטי התינוק.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
  }, [babyId, toast]);

  useEffect(() => {
    fetchBabyData();
  }, [fetchBabyData]);

  /**
   * Handles the submission of the edited baby form.
   * Updates the baby's data and associated invite in Firestore.
   * @param {BabyFormData} values - The updated form data.
   * @param {string} [id] - The ID of the baby being edited.
   */
  const handleEditBabySubmit = async (values: BabyFormData, id?: string) => {
    if (!id || !baby) return;
    setIsSubmitting(true);
    
    try {
      // Update the baby profile using service
      await BabyService.updateBabyProfile(id, values);

      toast({
        title: "פרטי תינוק עודכנו!",
        description: `הפרופיל של ${values.name} ${values.familyName} עודכן.`,
      });
      // No need to redirect, just refresh data if needed or let user stay on page
      await fetchBabyData(); 
    } catch (error) {
      console.error("Error updating baby:", error);
      toast({
        title: "שגיאה בעדכון",
        description: "לא ניתן היה לעדכן את פרטי התינוק.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles archiving the baby.
   */
  const handleArchive = async () => {
    if (!babyId || !baby) return;
    setIsSubmitting(true);
    try {
      await BabyService.archiveBabyProfile(babyId);
      toast({
        title: "תינוק הועבר לארכיון",
        description: `${baby.name} ${baby.familyName} הועבר בהצלחה לארכיון.`
      });
      router.push('/coach/dashboard');
    } catch (error) {
      console.error("Error archiving baby:", error);
      toast({
        title: "שגיאה בארכוב",
        description: "לא ניתן היה להעביר את התינוק לארכיון.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="container mx-auto py-8"><Skeleton className="h-96 w-full" /></div>;
  }

  if (!baby) {
    return (
      <div className="container mx-auto py-8 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">תינוק לא נמצא</h1>
        <p className="text-muted-foreground mb-6">לא הצלחנו למצוא את פרטי התינוק.</p>
        <Link href="/coach/dashboard" passHref legacyBehavior><Button>חזרה ללוח הבקרה</Button></Link>
      </div>
    );
  }
  
  if (baby.isArchived) {
     return (
      <div className="container mx-auto py-8 text-center">
        <ArchiveIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">{baby.name} {baby.familyName} נמצא בארכיון</h1>
        <p className="text-muted-foreground mb-6">לא ניתן לערוך פרופיל בארכיון. יש לשחזר אותו תחילה.</p>
         <div className="flex justify-center gap-4">
          <Link href="/coach/dashboard" passHref legacyBehavior><Button>חזרה ללוח הבקרה</Button></Link>
          <Link href="/coach/archive" passHref legacyBehavior><Button variant="outline">מעבר לארכיון</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <AddBabyForm
        initialData={baby}
        isEditMode={true}
        onSubmitProp={handleEditBabySubmit}
        isSubmitting={isSubmitting}
      />
      <div className="mt-8 max-w-2xl mx-auto border-t pt-6">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/5 hover:text-destructive">
              <ArchiveIcon className="me-2 h-4 w-4" />
              העבר את התינוק לארכיון
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
              <AlertDialogDescription>
                העברת תינוק לארכיון תסיר אותו מלוח הבקרה הראשי ותמנע מההורים גישה. ניתן לשחזר תינוק מהארכיון בכל עת.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleArchive} disabled={isSubmitting}>
                {isSubmitting ? "מעביר..." : "כן, העבר לארכיון"}
              </AlertDialogAction>
              <AlertDialogCancel disabled={isSubmitting}>ביטול</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

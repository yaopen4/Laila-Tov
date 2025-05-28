
/**
 * @fileoverview Page for editing an existing baby's profile from Firestore.
 * Fetches baby data by ID and uses AddBabyForm in edit mode.
 * Allows archiving the baby from this page.
 */
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AddBabyForm, type BabyFormData } from '@/components/coach/add-baby-form';
import { getBabyByIdFromFirestore, updateBabyInFirestore, archiveBabyInFirestore, type Baby } from '@/services/babyService';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Archive as ArchiveIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

export default function EditBabyPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const babyId = params.babyId as string;
  const [baby, setBaby] = useState<Baby | null | undefined>(undefined); // undefined: loading, null: not found
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const fetchBabyData = useCallback(async () => {
    if (babyId) {
      setIsLoading(true);
      try {
        const foundBaby = await getBabyByIdFromFirestore(babyId);
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

  // Effect to fetch baby data when babyId changes
  useEffect(() => {
    fetchBabyData();
  }, [fetchBabyData]);

  /**
   * Handles the submission of the edited baby form.
   * Updates the baby's data in Firestore.
   * @param {BabyFormData} values - The updated form data.
   * @param {string} [id] - The ID of the baby being edited.
   */
  const handleEditBabySubmit = async (values: BabyFormData, id?: string) => {
    if (!id || !baby) return;
    setIsSubmitting(true);
    
    const updatedBabyData: Partial<Omit<Baby, 'id'>> = { ...values };
    // parentUsername is not editable, so no need to check for uniqueness again.
    // Ensure parentUsername is stored in lowercase if it were editable
    // updatedBabyData.parentUsername = values.parentUsername.toLowerCase();


    try {
      await updateBabyInFirestore(id, updatedBabyData);
      toast({
        title: "פרטי תינוק עודכנו!",
        description: `הפרופיל של ${values.name} ${values.familyName} עודכן.`,
      });
      router.push('/coach/dashboard');
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
      await archiveBabyInFirestore(babyId);
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

  // Loading state UI
  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-12 w-1/2 mb-6" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-10 w-1/4 mt-4" />
      </div>
    );
  }

  // Baby not found UI
  if (!baby) {
    return (
      <div className="container mx-auto py-8 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">תינוק לא נמצא</h1>
        <p className="text-muted-foreground mb-6">
          לא הצלחנו למצוא את פרטי התינוק עם המזהה שהתקבל. ייתכן שהוא נמחק.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/coach/dashboard" passHref legacyBehavior>
            <Button>חזרה ללוח הבקרה</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  // Baby is archived, show message instead of edit form
  if (baby.isArchived) {
     return (
      <div className="container mx-auto py-8 text-center">
        <ArchiveIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">{baby.name} {baby.familyName} נמצא בארכיון</h1>
        <p className="text-muted-foreground mb-6">
          תינוק זה הועבר לארכיון ולא ניתן לערוך אותו. ניתן לשחזר אותו מהארכיון.
        </p>
         <div className="flex justify-center gap-4">
          <Link href="/coach/dashboard" passHref legacyBehavior>
            <Button>חזרה ללוח הבקרה</Button>
          </Link>
          <Link href="/coach/archive" passHref legacyBehavior>
            <Button variant="outline">מעבר לארכיון</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Main edit form UI
  return (
    <div className="container mx-auto py-8">
      <AddBabyForm
        initialData={baby}
        isEditMode={true}
        onSubmitProp={handleEditBabySubmit}
        isSubmitting={isSubmitting}
      />
      <div className="mt-8 max-w-2xl mx-auto">
        <Button variant="outline" onClick={handleArchive} className="w-full md:w-auto" disabled={isSubmitting}>
          <ArchiveIcon className="me-2 h-4 w-4" />
          {isSubmitting && baby?.id === babyId ? "מעביר לארכיון..." : "העבר לארכיון"}
        </Button>
      </div>
    </div>
  );
}

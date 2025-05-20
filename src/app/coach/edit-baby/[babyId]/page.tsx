
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AddBabyForm, type BabyFormData } from '@/components/coach/add-baby-form';
import { getBabyById, updateBaby, type Baby, archiveBaby } from '@/lib/mock-data';
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
  const [baby, setBaby] = useState<Baby | null | undefined>(undefined); // undefined for loading, null for not found
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (babyId) {
      setIsLoading(true);
      // Simulate API call
      setTimeout(() => {
        const foundBaby = getBabyById(babyId);
        setBaby(foundBaby);
        setIsLoading(false);
      }, 500);
    }
  }, [babyId]);

  const handleEditBabySubmit = (values: BabyFormData, id?: string) => {
    if (!id || !baby) return;
    
    const updatedBabyData: Partial<Baby> = { ...values };
    // Ensure sleepRecords and other non-form fields are preserved if not edited by the form
    const currentBabyData = getBabyById(id);
    if (!currentBabyData) return;

    const success = updateBaby({
      ...currentBabyData, // Start with all existing data
      ...updatedBabyData, // Override with form values
      id, // Ensure ID is correctly passed
    });

    if (success) {
      toast({
        title: "פרטי תינוק עודכנו!",
        description: `הפרופיל של ${values.name} ${values.familyName} עודכן.`,
      });
      router.push('/coach/dashboard');
    } else {
      toast({
        title: "שגיאה בעדכון",
        description: "לא ניתן היה לעדכן את פרטי התינוק.",
        variant: "destructive",
      });
    }
  };

  const handleArchive = () => {
    if (!babyId || !baby) return;
    if (archiveBaby(babyId)) {
      toast({
        title: "תינוק הועבר לארכיון",
        description: `${baby.name} ${baby.familyName} הועבר בהצלחה לארכיון.`
      });
      router.push('/coach/dashboard');
    } else {
      toast({
        title: "שגיאה בארכוב",
        description: "לא ניתן היה להעביר את התינוק לארכיון.",
        variant: "destructive"
      });
    }
  };


  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-12 w-1/2 mb-6" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-10 w-1/4 mt-4" />
      </div>
    );
  }

  if (!baby) {
    return (
      <div className="container mx-auto py-8 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">תינוק לא נמצא</h1>
        <p className="text-muted-foreground mb-6">
          לא הצלחנו למצוא את פרטי התינוק עם המזהה שהתקבל. ייתכן שהוא הועבר לארכיון או נמחק.
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
  
  // If baby is archived, don't show edit form, show message instead
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


  return (
    <div className="container mx-auto py-8">
      <AddBabyForm
        initialData={baby}
        isEditMode={true}
        onSubmitProp={handleEditBabySubmit}
      />
      <div className="mt-8 max-w-2xl mx-auto">
        <Button variant="outline" onClick={handleArchive} className="w-full md:w-auto">
          <ArchiveIcon className="me-2 h-4 w-4" />
          העבר לארכיון
        </Button>
      </div>
    </div>
  );
}

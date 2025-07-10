/**
 * @fileoverview Page for coaches to create a new baby profile.
 * This page uses the AddBabyForm component to capture baby details.
 * It then calls a service to create the baby and a corresponding invite in Firestore.
 */
"use client";
import { AddBabyForm, type BabyFormData } from "@/components/coach/add-baby-form";
import { addBabyToFirestore, isParentUsernameTakenInFirestore } from "@/services/babyService";
import { getCurrentUser } from "@/services/authService";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

export default function AddBabyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [coachUid, setCoachUid] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      if (user && user.role === 'coach') {
        setCoachUid(user.uid);
      } else {
        router.push('/coach/dashboard');
         toast({
          title: "גישה נדחתה",
          description: "עליך להיות מחובר כיועצת כדי ליצור פרופילי תינוקות.",
          variant: "destructive",
        });
      }
    };
    fetchUser();
  }, [router, toast]);

  /**
   * Handles the submission of the new baby form.
   * Creates a baby document and an associated invite in Firestore.
   * @param {BabyFormData} values - The form data including baby details and optional parent emails.
   */
  const handleCreateBabySubmit = async (values: BabyFormData) => {
    setIsSubmitting(true);
    if (!coachUid) {
      toast({
        title: "שגיאה: יועצת לא מזוהה",
        description: "לא ניתן ליצור פרופיל ללא מזהה יועצת.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Auto-generate a unique parentUsername for the baby document ID
      const parentUsername = `${values.name.toLowerCase().replace(/\s+/g, '-')}-${values.familyName.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substring(2, 6)}`;
      
      if (await isParentUsernameTakenInFirestore(parentUsername)) {
         // This is highly unlikely with the random suffix, but good practice to check
         toast({
          title: "שגיאה ביצירת מזהה",
          description: "אירעה שגיאה נדירה ביצירת מזהה ייחודי. אנא נסה שוב.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Filter out empty strings from parent emails
      const parentEmails = [values.parentEmail1, values.parentEmail2].filter((email): email is string => !!email);

      const babyDataForCreation = { ...values, parentUsername, parentEmails };

      await addBabyToFirestore(babyDataForCreation, coachUid);
      
      toast({
        title: "פרופיל תינוק נוצר בהצלחה!",
        description: `הפרופיל עבור ${values.name} ${values.familyName} נוסף. תוכל למצוא את קוד ההזמנה בעריכת הפרופיל.`,
        duration: 7000,
      });
      router.push('/coach/dashboard');
    } catch (error) {
      console.error("Error creating baby:", error);
      toast({
        title: "שגיאה ביצירת פרופיל",
        description: "אירעה שגיאה בעת ניסיון ליצור את הפרופיל. נסה שוב.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <AddBabyForm onSubmitProp={handleCreateBabySubmit} isSubmitting={isSubmitting} isEditMode={false} />
    </div>
  );
}

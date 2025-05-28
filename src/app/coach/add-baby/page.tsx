
/**
 * @fileoverview Page for adding a new baby profile.
 * This page uses the AddBabyForm component to capture baby details.
 * It includes validation to prevent duplicate parent usernames by checking Firestore.
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
      if (user) {
        setCoachUid(user.uid);
      }
    };
    fetchUser();
  }, []);

  /**
   * Handles the submission of the new baby form.
   * Validates parent username uniqueness against Firestore before adding the baby.
   * Adds the baby to Firestore and navigates to the dashboard.
   * @param {BabyFormData} values - The form data for the new baby.
   */
  const handleAddBabySubmit = async (values: BabyFormData) => {
    setIsSubmitting(true);
    try {
      if (await isParentUsernameTakenInFirestore(values.parentUsername.toLowerCase())) {
        toast({
          title: "שם משתמש תפוס",
          description: `שם המשתמש להורים "${values.parentUsername}" כבר קיים. נא לבחור שם אחר.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return; // Stop submission
      }

      await addBabyToFirestore({
        ...values,
        parentUsername: values.parentUsername.toLowerCase(), // Store lowercase username
      }, coachUid);
      
      toast({
        title: "תינוק נוסף בהצלחה!",
        description: `הפרופיל של ${values.name} ${values.familyName} נוצר.`,
      });
      router.push('/coach/dashboard');
    } catch (error) {
      console.error("Error adding baby:", error);
      toast({
        title: "שגיאה בהוספת תינוק",
        description: "אירעה שגיאה בעת ניסיון להוסיף את התינוק. נסה שוב.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <AddBabyForm onSubmitProp={handleAddBabySubmit} isSubmitting={isSubmitting} />
    </div>
  );
}

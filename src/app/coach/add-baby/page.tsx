/**
 * @fileoverview Page for adding a new baby profile.
 * This page uses the AddBabyForm component to capture baby details.
 * It includes validation to prevent duplicate parent usernames.
 */
"use client";
import { AddBabyForm, type BabyFormData } from "@/components/coach/add-baby-form";
import { addBaby, isParentUsernameTaken } from "@/lib/mock-data";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";

export default function AddBabyPage() {
  const router = useRouter();
  const { toast } = useToast();

  /**
   * Handles the submission of the new baby form.
   * Validates parent username uniqueness before adding the baby.
   * Adds the baby to mock data and navigates to the dashboard.
   * @param {BabyFormData} values - The form data for the new baby.
   */
  const handleAddBabySubmit = (values: BabyFormData) => {
    if (isParentUsernameTaken(values.parentUsername)) {
      toast({
        title: "שם משתמש תפוס",
        description: `שם המשתמש "${values.parentUsername}" להורים כבר קיים. נא לבחור שם אחר.`,
        variant: "destructive",
      });
      return; // Stop submission
    }

    addBaby(values); // addBaby handles ID generation and full Baby object creation
    toast({
      title: "תינוק נוסף בהצלחה!",
      description: `הפרופיל של ${values.name} ${values.familyName} נוצר.`,
    });
    router.push('/coach/dashboard'); // Navigate to dashboard after adding
  };

  return (
    <div className="container mx-auto py-8">
      <AddBabyForm onSubmitProp={handleAddBabySubmit} />
    </div>
  );
}

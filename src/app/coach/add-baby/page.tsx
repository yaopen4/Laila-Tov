
/**
 * @fileoverview Page for coaches to create an invite for parents.
 * This page uses the AddBabyForm component to capture baby details and parent emails.
 * It then calls the invite service to generate an invite code.
 */
"use client";
import { AddBabyForm, type AddBabyAndInviteFormData } from "@/components/coach/add-baby-form";
import { isParentUsernameTakenInFirestore } from "@/services/babyService"; // To check if baby's unique ID (parentUsername) is taken
import { createInviteInFirestore } from "@/services/inviteService";
import { getCurrentUser } from "@/services/authService";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { BabyFormData } from "@/types"; // For the babyData part of the invite

export default function CreateInvitePage() {
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
        // Redirect if not a coach or no user
        router.push('/coach/dashboard');
         toast({
          title: "גישה נדחתה",
          description: "עליך להיות מחובר כיועצת כדי ליצור הזמנות.",
          variant: "destructive",
        });
      }
    };
    fetchUser();
  }, [router, toast]);

  /**
   * Handles the submission of the new invite form.
   * Validates parent username uniqueness against Firestore before creating the invite.
   * Creates an invite in Firestore and navigates to the dashboard.
   * @param {AddBabyAndInviteFormData} values - The form data including baby details and parent emails.
   */
  const handleCreateInviteSubmit = async (values: AddBabyAndInviteFormData) => {
    setIsSubmitting(true);
    if (!coachUid) {
      toast({
        title: "שגיאה: יועצת לא מזוהה",
        description: "לא ניתן ליצור הזמנה ללא מזהה יועצת.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // The parentUsername will be used as the baby's document ID eventually.
      // It needs to be unique among existing babies.
      if (await isParentUsernameTakenInFirestore(values.parentUsername.toLowerCase())) {
        toast({
          title: "כינוי תינוק תפוס",
          description: `הכינוי "${values.parentUsername}" כבר קיים עבור תינוק אחר. נא לבחור כינוי אחר.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return; 
      }

      const parentEmails = [values.parentEmail1.toLowerCase(), values.parentEmail2.toLowerCase()];

      // Prepare babyData for the invite (conforms to BabyFormData type)
      const babyDataForInvite: BabyFormData = {
        name: values.name,
        familyName: values.familyName,
        age: values.age,
        motherName: values.motherName,
        fatherName: values.fatherName,
        siblingsCount: values.siblingsCount,
        siblingsNames: values.siblingsNames,
        description: values.description,
        parentUsername: values.parentUsername.toLowerCase(), // Stored lowercase, used as baby doc ID
        coachNotes: values.coachNotes,
      };

      const inviteCode = await createInviteInFirestore(coachUid, babyDataForInvite, parentEmails);
      
      toast({
        title: "הזמנה נוצרה בהצלחה!",
        description: (
          <div>
            <p>ההזמנה עבור {values.name} {values.familyName} נוצרה.</p>
            <p className="mt-1"><strong>קוד ההזמנה:</strong> <span className="font-mono bg-muted px-1 py-0.5 rounded">{inviteCode}</span></p>
            <p className="text-xs mt-1">יש למסור קוד זה להורים.</p>
          </div>
        ),
        duration: 10000, // Keep toast longer to copy code
      });
      router.push('/coach/dashboard');
    } catch (error) {
      console.error("Error creating invite:", error);
      toast({
        title: "שגיאה ביצירת הזמנה",
        description: "אירעה שגיאה בעת ניסיון ליצור את ההזמנה. נסה שוב.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      {/* The AddBabyForm is now used for creating invites; initialData is null for new invites */}
      <AddBabyForm onSubmitProp={handleCreateInviteSubmit} isSubmitting={isSubmitting} isEditMode={false} />
    </div>
  );
}


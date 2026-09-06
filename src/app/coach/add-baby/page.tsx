/**
 * @fileoverview Page for coaches to create a new baby profile.
 * This page uses the AddBabyForm component to capture baby details.
 * It then calls a service to create the baby and a corresponding invite in Firestore.
 * Includes error handling and authentication diagnostics.
 */
"use client";
import { AddBabyForm, type BabyFormData } from "@/components/coach/add-baby-form";
import { BabyService } from "@/services/babyService";
import { AuthService } from "@/services/authService";
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AddBabyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [coachUid, setCoachUid] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await AuthService.getCurrentUser();
        
        // Debugging
        console.log('Current user:', {
          uid: user?.uid,
          email: user?.email,
          role: user?.role,
          status: user?.status
        });
        
        if (user && user.role === 'coach') {
          setCoachUid(user.uid);
          setAuthError(null);
          
          // Verify user document exists in Firestore
          const auth = getAuth();
          const firebaseUser = auth.currentUser;
          if (firebaseUser) {
            console.log('Firebase Auth user:', {
              uid: firebaseUser.uid,
              email: firebaseUser.email
            });
            
            // Test direct Firestore access
            try {
              const userDocRef = doc(db, 'users', firebaseUser.uid);
              const userDocSnap = await getDoc(userDocRef);
              console.log('Direct Firestore user doc check:', {
                exists: userDocSnap.exists(),
                data: userDocSnap.exists() ? userDocSnap.data() : null
              });
            } catch (fsError) {
              console.error('Failed to read user doc directly:', fsError);
            }
          }
        } else if (user && !user.role) {
          // User exists but has no role - try to fix it
          // A role lives in the account's custom claims, set server-side at
          // registration. There is no client-side repair for a missing one -- the
          // previous code here called upsertUserDocument, which is defined nowhere
          // in the repository and threw ReferenceError every time.
          setAuthError("אין הרשאה ליצור פרופילי תינוקות - תפקיד המשתמש לא מוגדר כיועצת");
          router.push('/coach/dashboard');
          toast({
            title: "שגיאה בתיקון הרשאות",
            description: "לא ניתן לתקן את הרשאות המשתמש. אנא פנה לתמיכה.",
            variant: "destructive",
          });
        } else {
          const errorMsg = user ? `המשתמש אינו מוגדר כיועצת (role: ${user.role})` : "המשתמש אינו מחובר";
          setAuthError(errorMsg);
          router.push('/coach/dashboard');
          toast({
            title: "גישה נדחתה",
            description: "עליך להיות מחובר כיועצת כדי ליצור פרופילי תינוקות.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error in fetchUser:', error);
        setAuthError("שגיאה בבדיקת הרשאות המשתמש");
        toast({
          title: "שגיאת אימות",
          description: "אירעה שגיאה בבדיקת ההרשאות. אנא נסה שוב.",
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
      // Verify user document exists and has coach role before proceeding
      console.log('Verifying coach permissions for:', coachUid);
        const currentUser = await AuthService.getCurrentUser();
      if (!currentUser || currentUser.role !== 'coach') {
        console.error('User verification failed:', {
          exists: !!currentUser,
          role: currentUser?.role,
          uid: currentUser?.uid
        });
        toast({
          title: "שגיאת הרשאות",
          description: "אין לך הרשאה ליצור פרופילי תינוקות. ודא שאתה מחובר כיועצת.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      console.log('Coach verification successful');
      
      // The 'default-org' fallback that used to be here guaranteed a mismatch with
      // firestore.rules, which compares the document's organizationId against the
      // caller's. The organization now comes from the account's claims server-side.
      const organizationId = currentUser.organizationId;
      if (!organizationId) {
        toast({
          title: "שגיאת הרשאות",
          description: "לחשבון לא משויך ארגון. יש לפנות למנהל המערכת.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const result = await BabyService.createBabyProfile(
        values,
        coachUid,
        organizationId
      );
      const babyId = result.id;

      // Report the code that was actually issued, rather than promising one that was
      // never created (inviteCode used to be hardcoded to '').
      const codeMessage = result.invitationCode
        ? ` קוד ההזמנה להורה: ${result.invitationCode}`
        : ' לא הוזן אימייל הורה, ולכן לא נוצר קוד הזמנה.';

      toast({
        title: "פרופיל תינוק נוצר בהצלחה!",
        description: `הפרופיל עבור ${values.name} ${values.familyName} נוסף.${codeMessage}`,
        duration: 7000,
      });
      router.push('/coach/dashboard');
    } catch (error) {
      console.error("Error creating baby:", error);
      
      // Enhanced error handling with specific feedback
      let errorTitle = "שגיאה ביצירת פרופיל";
      let errorDescription = "אירעה שגיאה בעת ניסיון ליצור את הפרופיל.";
      
      if (error instanceof Error) {
        // Check for specific Firebase errors
        if (error.message.includes('Missing or insufficient permissions')) {
          errorTitle = "שגיאת הרשאות";
          errorDescription = "אין לך הרשאה ליצור פרופילי תינוקות. אנא ודא שאתה מחובר כיועצת.";
          
          // Log additional debug information
          console.error("Permission error occurred - check user role in Firestore");
        } else if (error.message.includes('network')) {
          errorTitle = "שגיאת רשת";
          errorDescription = "בעיה בחיבור לשרת. אנא בדוק את החיבור לאינטרנט ונסה שוב.";
        } else {
          errorDescription = `פרטי שגיאה: ${error.message}`;
        }
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
        duration: 10000, // Longer duration for error messages
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      {/* Show authentication error if there are issues */}
      {authError && (
        <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-lg">
          <h3 className="text-lg font-semibold text-red-800 mb-2">⚠️ בעיית הרשאות</h3>
          <p className="text-sm text-red-700">{authError}</p>
          <p className="text-xs text-red-600 mt-2">
            אם הבעיה נמשכת, אנא פנה לתמיכה או בדוק את הגדרות המשתמש שלך.
          </p>
        </div>
      )}
      
      <AddBabyForm onSubmitProp={handleCreateBabySubmit} isSubmitting={isSubmitting} isEditMode={false} />
    </div>
  );
}

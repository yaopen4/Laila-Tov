
/**
 * @fileoverview Reusable form component for adding or editing baby profiles.
 * Uses react-hook-form and Zod for validation.
 */
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Edit3, MessageSquareText } from "lucide-react";
import type { Baby } from "@/lib/mock-data"; 
import { useEffect } from "react";

// Zod schema for form validation
const formSchema = z.object({
  name: z.string().min(2, { message: "שם פרטי חייב להכיל לפחות 2 תווים." }),
  familyName: z.string().min(2, { message: "שם משפחה חייב להכיל לפחות 2 תווים." }),
  age: z.coerce.number().min(0, { message: "גיל חייב להיות מספר חיובי." }).max(36, { message: "גיל מקסימלי 36 חודשים."}),
  motherName: z.string().min(2, { message: "שם האם חייב להכיל לפחות 2 תווים." }),
  fatherName: z.string().min(2, { message: "שם האב חייב להכיל לפחות 2 תווים." }),
  siblingsCount: z.coerce.number().min(0, { message: "מספר אחים חייב להיות מספר חיובי." }),
  siblingsNames: z.string().optional(),
  description: z.string().optional(),
  parentUsername: z.string().min(3, { message: "שם משתמש להורים חייב להכיל לפחות 3 תווים." }),
  coachNotes: z.string().optional(), // Added coachNotes field
});

/**
 * Type definition for the baby form data, inferred from the Zod schema.
 */
export type BabyFormData = z.infer<typeof formSchema>;

/**
 * Props for the AddBabyForm component.
 */
interface AddBabyFormProps {
  /** Initial data to pre-fill the form, used in edit mode. */
  initialData?: Partial<Baby>;
  /** Flag to indicate if the form is in edit mode. Defaults to false. */
  isEditMode?: boolean;
  /** Callback function to handle form submission. Passes form values and an optional ID (for updates). */
  onSubmitProp: (values: BabyFormData, id?: string) => void;
}

export function AddBabyForm({ initialData, isEditMode = false, onSubmitProp }: AddBabyFormProps) {
  const { toast } = useToast();
  const form = useForm<BabyFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      name: initialData?.name || "",
      familyName: initialData?.familyName || "",
      age: initialData?.age || 0,
      motherName: initialData?.motherName || "",
      fatherName: initialData?.fatherName || "",
      siblingsCount: initialData?.siblingsCount || 0,
      siblingsNames: initialData?.siblingsNames || "",
      description: initialData?.description || "",
      parentUsername: initialData?.parentUsername || "",
      coachNotes: initialData?.coachNotes || "", // Initialize coachNotes
    },
  });

  /**
   * Effect to reset form fields when initialData changes.
   * This is useful if the same form instance is used for editing different babies,
   * or if initialData loads asynchronously.
   */
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name || "",
        familyName: initialData.familyName || "",
        age: initialData.age || 0,
        motherName: initialData.motherName || "",
        fatherName: initialData.fatherName || "",
        siblingsCount: initialData.siblingsCount || 0,
        siblingsNames: initialData.siblingsNames || "",
        description: initialData.description || "",
        parentUsername: initialData.parentUsername || "",
        coachNotes: initialData.coachNotes || "", // Reset coachNotes
      });
    }
  }, [initialData, form]); 

  /**
   * Handles the actual form submission.
   * Calls the onSubmitProp with form values and shows a toast notification.
   * Resets the form if not in edit mode.
   * @param {BabyFormData} values - The validated form data.
   */
  function onSubmit(values: BabyFormData) {
    onSubmitProp(values, initialData?.id); 
    // Toast is usually handled by the parent page after successful submission
    // to provide more context. If keeping toast here, ensure it's desired.
    // toast({
    //   title: isEditMode ? "פרטי תינוק עודכנו!" : "תינוק נוסף בהצלחה!",
    //   description: isEditMode 
    //     ? `הפרופיל של ${values.name} ${values.familyName} עודכן.`
    //     : `הפרופיל של ${values.name} ${values.familyName} נוצר.`,
    // });
    if (!isEditMode) {
      form.reset({ 
        name: "", familyName: "", age: 0, motherName: "", fatherName: "",
        siblingsCount: 0, siblingsNames: "", description: "", parentUsername: "",
        coachNotes: "" // Reset coachNotes for new entry
      });
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          {isEditMode ? <Edit3 className="h-6 w-6 text-primary" /> : <UserPlus className="h-6 w-6 text-primary" />}
          {isEditMode ? `עריכת פרטי ${initialData?.name || 'תינוק'}` : "הוספת תינוק חדש"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם התינוק/ת</FormLabel>
                    <FormControl>
                      <Input placeholder="שם פרטי" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="familyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם משפחה</FormLabel>
                    <FormControl>
                      <Input placeholder="שם משפחה" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>גיל (בחודשים)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="גיל בחודשים" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentUsername"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם משתמש להורים</FormLabel>
                    <FormControl>
                      <Input placeholder="שם משתמש ייחודי" {...field} disabled={isEditMode} />
                    </FormControl>
                    <FormDescription>
                      {isEditMode ? "שם משתמש אינו ניתן לעריכה." : "הורים ישתמשו בזה להתחברות."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="motherName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם האם</FormLabel>
                    <FormControl>
                      <Input placeholder="שם האם" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fatherName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם האב</FormLabel>
                    <FormControl>
                      <Input placeholder="שם האב" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="siblingsCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מספר אחים/אחיות</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="מספר אחים/אחיות" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="siblingsNames"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שמות האחים/אחיות (אופציונלי)</FormLabel>
                    <FormControl>
                      <Input placeholder="לדוגמה: דני (5), רותי (3)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תיאור קצר (אופציונלי)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="תיאור כללי על התינוק, הרגלי שינה נוכחיים וכו'." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Coach Notes Field - visible in edit mode, or always if desired */}
            {/* For now, let's make it always visible as coaches might add notes during creation too */}
             <FormField
              control={form.control}
              name="coachNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <MessageSquareText className="h-4 w-4" />
                    הערות מאמן/ת (אופציונלי)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="המלצות, תוכנית פעולה, דגשים להורים..."
                      {...field}
                      rows={4}
                    />
                  </FormControl>
                  <FormDescription>
                    הערות אלו יוצגו להורים בממשק שלהם.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full md:w-auto">
              {isEditMode ? "עדכן פרטי תינוק" : "הוסף תינוק"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

    

/**
 * @fileoverview Reusable form component for adding or editing baby profiles.
 * Uses react-hook-form and Zod for validation. Data is saved to Firestore.
 * Handles both creating new babies and updating existing ones.
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Edit3, MessageSquareText } from "lucide-react";
import type { Baby } from "@/types"; // Using Baby type for initialData
import { useEffect } from "react";

// Zod schema for form validation. Defines the structure and validation rules for baby data.
const formSchema = z.object({
  name: z.string().min(2, { message: "שם פרטי חייב להכיל לפחות 2 תווים." }).max(50, { message: "שם פרטי ארוך מדי." }),
  familyName: z.string().min(2, { message: "שם משפחה חייב להכיל לפחות 2 תווים." }).max(50, { message: "שם משפחה ארוך מדי." }),
  age: z.coerce.number().min(0, { message: "גיל חייב להיות מספר חיובי." }).max(36, { message: "גיל מקסימלי 36 חודשים."}),
  motherName: z.string().min(2, { message: "שם האם חייב להכיל לפחות 2 תווים." }).max(50, { message: "שם האם ארוך מדי." }),
  fatherName: z.string().min(2, { message: "שם האב חייב להכיל לפחות 2 תווים." }).max(50, { message: "שם האב ארוך מדי." }),
  siblingsCount: z.coerce.number().min(0, { message: "מספר אחים חייב להיות מספר חיובי." }),
  siblingsNames: z.string().max(100, { message: "שמות האחים ארוכים מדי." }).optional(),
  description: z.string().max(500, { message: "תיאור ארוך מדי." }).optional(),
  parentUsername: z.string().min(3, { message: "שם משתמש להורים חייב להכיל לפחות 3 תווים." })
                      .max(30, { message: "שם משתמש ארוך מדי."})
                      .regex(/^[a-zA-Z0-9_-]+$/, { message: "שם משתמש יכול להכיל אותיות באנגלית, מספרים, קו תחתון ומקף בלבד." }),
  coachNotes: z.string().max(1000, { message: "הערות יועצת ארוכות מדי." }).optional(),
});

/**
 * Type definition for the baby form data, inferred from the Zod schema.
 */
export type BabyFormData = z.infer<typeof formSchema>;

/**
 * Props for the AddBabyForm component.
 */
interface AddBabyFormProps {
  /** Initial data to pre-fill the form, used in edit mode. Can be null if data is still loading. */
  initialData?: Partial<Baby> | null;
  /** Flag to indicate if the form is in edit mode (true) or add mode (false). Defaults to false. */
  isEditMode?: boolean;
  /** Callback function to handle form submission. Passes form values and an optional ID (for updates). */
  onSubmitProp: (values: BabyFormData, id?: string) => Promise<void>;
  /** Flag to indicate if the form is currently submitting. */
  isSubmitting?: boolean;
}

/**
 * A form for adding a new baby or editing an existing baby's details.
 * @param {AddBabyFormProps} props - The component's props.
 */
export function AddBabyForm({ initialData, isEditMode = false, onSubmitProp, isSubmitting = false }: AddBabyFormProps) {
  const form = useForm<BabyFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      name: "",
      familyName: "",
      age: 0,
      motherName: "",
      fatherName: "",
      siblingsCount: 0,
      siblingsNames: "",
      description: "",
      parentUsername: "",
      coachNotes: "",
    },
  });

  /**
   * Effect to reset form fields when initialData changes (e.g., when editing a different baby or when data loads).
   * This ensures the form is correctly pre-filled or cleared.
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
        coachNotes: initialData.coachNotes || "",
      });
    } else if (!isEditMode) { 
        form.reset({
            name: "", familyName: "", age: 0, motherName: "", fatherName: "",
            siblingsCount: 0, siblingsNames: "", description: "", parentUsername: "",
            coachNotes: ""
        });
    }
  }, [initialData, form, isEditMode]);

  /**
   * Handles the actual form submission after validation.
   * Calls the `onSubmitProp` callback with the form values and the baby's ID (if editing).
   * @param {BabyFormData} values - The validated form data.
   */
  async function onSubmit(values: BabyFormData) {
    // Parent username is converted to lowercase before sending to onSubmitProp
    // The actual saving to Firestore should handle this if needed, but good to be consistent.
    await onSubmitProp({ ...values, parentUsername: values.parentUsername.toLowerCase() }, initialData?.id);
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
                      <Input placeholder="שם פרטי" {...field} disabled={isSubmitting} />
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
                      <Input placeholder="שם משפחה" {...field} disabled={isSubmitting} />
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
                      <Input type="number" placeholder="גיל בחודשים" {...field} disabled={isSubmitting} />
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
                      <Input placeholder="baby-family" {...field} disabled={isEditMode || isSubmitting} />
                    </FormControl>
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
                      <Input placeholder="שם האם" {...field} disabled={isSubmitting} />
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
                      <Input placeholder="שם האב" {...field} disabled={isSubmitting} />
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
                      <Input type="number" placeholder="מספר אחים/אחיות" {...field} disabled={isSubmitting} />
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
                      <Input placeholder="לדוגמה: דני (5), רותי (3)" {...field} disabled={isSubmitting} />
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
                    <Textarea placeholder="תיאור כללי על התינוק, הרגלי שינה נוכחיים וכו'." {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coachNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <MessageSquareText className="h-4 w-4" />
                    הערות יועצת (אופציונלי)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="המלצות, תוכנית פעולה, דגשים להורים..."
                      {...field}
                      rows={4}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    הערות אלו יוצגו להורים בממשק שלהם.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
              {isSubmitting ? (isEditMode ? "מעדכן..." : "מוסיף...") : (isEditMode ? "עדכן פרטי תינוק" : "הוסף תינוק")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

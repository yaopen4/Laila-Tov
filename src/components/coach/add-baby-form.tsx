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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, Edit3, MessageSquareText, Mail, KeySquare } from "lucide-react";
import type { BabyProfile } from "@/types/auth"; // Using BabyProfile type for initialData
import { useEffect } from "react";

// Zod schema for form validation. Defines the structure and validation rules for baby data.
const addBabyFormSchema = z.object({
  name: z.string().min(2, { message: "שם פרטי חייב להכיל לפחות 2 תווים." }).max(50, { message: "שם פרטי ארוך מדי." }),
  familyName: z.string().min(2, { message: "שם משפחה חייב להכיל לפחות 2 תווים." }).max(50, { message: "שם משפחה ארוך מדי." }),
  age: z.coerce.number().min(0, { message: "גיל חייב להיות מספר חיובי." }).max(36, { message: "גיל מקסימלי 36 חודשים."}),
  motherName: z.string().min(2, { message: "שם האם חייב להכיל לפחות 2 תווים." }).max(50, { message: "שם האם ארוך מדי." }),
  fatherName: z.string().min(2, { message: "שם האב חייב להכיל לפחות 2 תווים." }).max(50, { message: "שם האב ארוך מדי." }),
  siblingsCount: z.coerce.number().min(0, { message: "מספר אחים חייב להיות מספר חיובי." }),
  siblingsNames: z.string().max(100, { message: "שמות האחים ארוכים מדי." }).optional(),
  description: z.string().max(500, { message: "תיאור ארוך מדי." }).optional(),
  coachNotes: z.string().max(1000, { message: "הערות יועצת ארוכות מדי." }).optional(),
  parentEmail1: z.string().email({ message: "כתובת אימייל לא תקינה." }).optional().or(z.literal('')),
  parentEmail2: z.string().email({ message: "כתובת אימייל לא תקינה." }).optional().or(z.literal('')),
  inviteCode: z.string().optional(), // For display only in edit mode
}).refine(data => !data.parentEmail1 || !data.parentEmail2 || data.parentEmail1.toLowerCase() !== data.parentEmail2.toLowerCase(), {
  message: "כתובות האימייל של ההורים חייבות להיות שונות.",
  path: ["parentEmail2"], // Attach error to the second email field
});

/**
 * Type definition for the form data.
 * This is specific to this form's needs.
 */
export type BabyFormData = z.infer<typeof addBabyFormSchema>;

/**
 * Props for the AddBabyForm component.
 */
interface AddBabyFormProps {
  initialData?: Partial<BabyProfile> | null;
  isEditMode?: boolean;
  onSubmitProp: (values: BabyFormData, id?: string) => Promise<void>;
  isSubmitting?: boolean;
}

/**
 * A form for adding a new baby or editing an existing baby's details.
 * @param {AddBabyFormProps} props - The component's props.
 */
export function AddBabyForm({ initialData, isEditMode = false, onSubmitProp, isSubmitting = false }: AddBabyFormProps) {
  const form = useForm<BabyFormData>({
    resolver: zodResolver(addBabyFormSchema),
    defaultValues: {
      name: "", familyName: "", age: 0, motherName: "", fatherName: "",
      siblingsCount: 0, siblingsNames: "", description: "", coachNotes: "",
      parentEmail1: "", parentEmail2: "", inviteCode: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      const parentEmails = initialData.parentEmails || [];
      form.reset({
        name: initialData.name || "",
        familyName: initialData.familyName || "",
        age: initialData.age || 0,
        motherName: initialData.motherName || "",
        fatherName: initialData.fatherName || "",
        siblingsCount: initialData.siblingsCount || 0,
        siblingsNames: initialData.siblingsNames || "",
        description: initialData.description || "",
        coachNotes: initialData.coachNotes || "",
        parentEmail1: parentEmails[0] || "",
        parentEmail2: parentEmails[1] || "",
        inviteCode: initialData.inviteCode || "",
      });
    } else if (!isEditMode) {
      form.reset();
    }
  }, [initialData, form, isEditMode]);

  async function onSubmit(values: BabyFormData) {
    await onSubmitProp(values, initialData?.id);
  }

  const formTitle = isEditMode ? `עריכת פרטי ${initialData?.name || 'תינוק'}` : "הוספת תינוק חדש ויצירת קוד הזמנה";
  const submitButtonText = isEditMode ? "עדכן פרטי תינוק" : "צור פרופיל וקוד הזמנה";

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          {isEditMode ? <Edit3 className="h-6 w-6 text-primary" /> : <UserPlus className="h-6 w-6 text-primary" />}
          {formTitle}
        </CardTitle>
        <CardDescription>
          {isEditMode
            ? "עדכן את פרטי התינוק וההורים. ניתן למסור להורים את קוד ההזמנה כדי שיוכלו להירשם."
            : "מלא את פרטי התינוק כדי ליצור פרופיל וקוד הזמנה ייחודי. ניתן להוסיף את אימייל ההורים עכשיו או מאוחר יותר."
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            <h3 className="text-lg font-semibold border-b pb-2 pt-2">פרטי התינוק/ת</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField name="name" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>שם התינוק/ת</FormLabel><FormControl><Input placeholder="שם פרטי" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="familyName" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>שם משפחה</FormLabel><FormControl><Input placeholder="שם משפחה" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="age" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>גיל (בחודשים)</FormLabel><FormControl><Input type="number" placeholder="גיל בחודשים" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField name="motherName" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>שם האם</FormLabel><FormControl><Input placeholder="שם האם" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="fatherName" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>שם האב</FormLabel><FormControl><Input placeholder="שם האב" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField name="siblingsCount" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>מספר אחים/אחיות</FormLabel><FormControl><Input type="number" placeholder="מספר אחים/אחיות" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="siblingsNames" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>שמות האחים/אחיות</FormLabel><FormControl><Input placeholder="לדוגמה: דני (5), רותי (3)" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>
            <FormField name="description" control={form.control} render={({ field }) => (
              <FormItem><FormLabel>תיאור המצב</FormLabel><FormControl><Textarea placeholder="תיאור כללי על התינוק, הרגלי שינה נוכחיים וכו'." {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField name="coachNotes" control={form.control} render={({ field }) => (
              <FormItem><FormLabel className="flex items-center gap-1"><MessageSquareText className="h-4 w-4" />הערות יועצת (יוצגו להורים)</FormLabel><FormControl><Textarea placeholder="המלצות, תוכנית פעולה, דגשים להורים..." {...field} rows={4} disabled={isSubmitting}/></FormControl><FormMessage /></FormItem>
            )}/>
            
            <h3 className="text-lg font-semibold border-b pb-2 pt-4">פרטי הורים להזמנה</h3>
             {isEditMode && initialData?.inviteCode && (
              <FormField name="inviteCode" control={form.control} render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><KeySquare className="h-4 w-4" />קוד הזמנה</FormLabel>
                  <FormControl><Input {...field} readOnly disabled className="font-mono bg-muted cursor-copy" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField name="parentEmail1" control={form.control} render={({ field }) => (
                <FormItem><FormLabel className="flex items-center gap-1"><Mail className="h-4 w-4" />אימייל הורה 1</FormLabel><FormControl><Input type="email" placeholder="parent1@example.com" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField name="parentEmail2" control={form.control} render={({ field }) => (
                <FormItem><FormLabel className="flex items-center gap-1"><Mail className="h-4 w-4" />אימייל הורה 2</FormLabel><FormControl><Input type="email" placeholder="parent2@example.com" {...field} disabled={isSubmitting} /></FormControl><FormMessage /></FormItem>
              )}/>
            </div>
            
            <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
              {isSubmitting ? (isEditMode ? "מעדכן..." : "יוצר פרופיל...") : submitButtonText}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

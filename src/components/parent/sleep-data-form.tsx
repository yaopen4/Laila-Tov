/**
 * @fileoverview Form for parents to log sleep data for their baby.
 * Includes fields for date, stage in the process, and multiple sleep cycles.
 * Uses react-hook-form and Zod for validation.
 */
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form"; // Controller removed as not directly used
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription, // Not currently used but available
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { he } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, PlusCircle, Send, Trash2, BedDouble, Timer, UserCircle2, Moon, Sunrise, Layers } from 'lucide-react';
import type { SleepRecord } from "@/lib/mock-data";
import { useEffect } from "react";

// Zod schema for a single sleep cycle
const sleepCycleSchema = z.object({
  bedtime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "פורמט שעה לא תקין (HH:MM)."}),
  timeToSleep: z.string().min(1, { message: "שדה חובה." }),
  whoPutToSleep: z.string().min(1, { message: "שדה חובה." }),
  howFellAsleep: z.string().min(1, { message: "שדה חובה." }),
  wakeTime: z.string()
    .optional() // Make wakeTime optional
    .refine(val => val === undefined || val === '' || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val), { 
      message: "פורמט שעה לא תקין (HH:MM), או השאר ריק." 
    }),
});

// Zod schema for a sleep record, including an array of sleep cycles
const sleepRecordSchema = z.object({
  date: z.date({ required_error: "תאריך הוא שדה חובה." }),
  stage: z.string().min(1, { message: "שלב הוא שדה חובה." }),
  sleepCycles: z.array(sleepCycleSchema).min(1, { message: "חובה להוסיף לפחות מחזור שינה אחד." }),
});

/**
 * Type definition for the sleep record form data, inferred from Zod schema.
 */
export type SleepRecordFormData = z.infer<typeof sleepRecordSchema>;

/**
 * Props for the SleepDataForm component.
 */
interface SleepDataFormProps {
  /** Name of the baby, displayed in the form title. */
  babyName: string;
  /** Callback function executed on successful form submission. */
  onSubmitSuccess?: (data: SleepRecordFormData) => void;
  /** Initial data to pre-fill the form, used for editing existing records. */
  initialData?: SleepRecord | null;
  /** Callback function for cancelling the form, typically used in dialogs. */
  onCancel?: () => void;
  /** Custom text for the submit button (e.g., "Update Record"). */
  submitButtonText?: string;
  /** Flag to adjust layout if the form is rendered inside a dialog. Defaults to false. */
  isDialog?: boolean;
}

export function SleepDataForm({ 
  babyName, 
  onSubmitSuccess, 
  initialData = null, 
  onCancel, 
  submitButtonText, 
  isDialog = false 
}: SleepDataFormProps) {
  const { toast } = useToast();
  const form = useForm<SleepRecordFormData>({
    resolver: zodResolver(sleepRecordSchema),
    defaultValues: initialData
      ? { // Pre-fill form if initialData is provided (edit mode)
          date: new Date(initialData.date), // Ensure date is a Date object
          stage: initialData.stage,
          sleepCycles: initialData.sleepCycles.map(sc => ({
            bedtime: sc.bedtime,
            timeToSleep: sc.timeToSleep,
            whoPutToSleep: sc.whoPutToSleep,
            howFellAsleep: sc.howFellAsleep,
            wakeTime: sc.wakeTime || "", // Ensure wakeTime is string or empty string
          })),
        }
      : { // Default values for a new record
          date: new Date(),
          stage: "",
          sleepCycles: [{ bedtime: "", timeToSleep: "", whoPutToSleep: "", howFellAsleep: "", wakeTime: "" }],
        },
  });

  // Effect to reset form fields if initialData changes or when component mounts/dialog opens.
  // This is useful if the same form instance is used for adding then editing, or editing different records.
  useEffect(() => {
    if (initialData) {
      form.reset({
        date: new Date(initialData.date),
        stage: initialData.stage,
        sleepCycles: initialData.sleepCycles.map(sc => ({
          bedtime: sc.bedtime,
          timeToSleep: sc.timeToSleep,
          whoPutToSleep: sc.whoPutToSleep,
          howFellAsleep: sc.howFellAsleep,
          wakeTime: sc.wakeTime || "",
        })),
      });
    } else if (!isDialog) { 
      // Only reset to completely blank if not in a dialog and not initialData
      // This prevents dialog form from clearing if it's re-rendered without initialData temporarily
      form.reset({
        date: new Date(),
        stage: "",
        sleepCycles: [{ bedtime: "", timeToSleep: "", whoPutToSleep: "", howFellAsleep: "", wakeTime: "" }],
      });
    }
  }, [initialData, form.reset, isDialog]); // form.reset is stable, but common to include

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sleepCycles",
  });

  /**
   * Handles form submission.
   * Shows a toast notification and calls onSubmitSuccess callback.
   * @param {SleepRecordFormData} values - The validated form data.
   */
  function onSubmit(values: SleepRecordFormData) {
    // In a real app, data would be sent to a backend/Firebase here.
    toast({
      title: initialData ? "נתוני שינה עודכנו!" : "נתוני שינה נשמרו!",
      description: `הנתונים עבור ${babyName} ${initialData ? 'עודכנו' : 'נשלחו'} בהצלחה.`,
    });
    if (onSubmitSuccess) onSubmitSuccess(values);
    if (!initialData && !isDialog) { 
      // Reset form only for new entries not in a dialog, to allow user to enter another record.
      // For edits or dialogs, parent component usually handles closing/clearing.
      form.reset({
        date: new Date(),
        stage: "",
        sleepCycles: [{ bedtime: "", timeToSleep: "", whoPutToSleep: "", howFellAsleep: "", wakeTime: "" }],
      });
    }
  }
  
  // Dynamically choose Card or div as the root component based on whether it's in a dialog
  const CardComponent = isDialog ? 'div' : Card;
  const cardComponentProps = isDialog ? {} : { className: "w-full max-w-2xl mx-auto shadow-xl" };

  return (
    <CardComponent {...cardComponentProps}>
      {!isDialog && ( // Only show CardHeader if not in a dialog
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <BedDouble className="h-6 w-6 text-primary" />
            הזנת נתוני שינה עבור {babyName}
          </CardTitle>
          <CardDescription>נא למלא את כל הפרטים הרלוונטיים.</CardDescription>
        </CardHeader>
      )}
      <CardContent className={isDialog ? "pt-0" : ""}> {/* Adjust padding if in dialog */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Date and Stage fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>תאריך</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-right font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="ms-2 me-auto h-4 w-4 opacity-50" />
                            {field.value ? format(field.value, "PPP", { locale: he }) : <span>בחירת תאריך</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => // Disable future dates and dates before 1900
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                          dir="rtl"
                          locale={he}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1"><Layers className="h-4 w-4" />שלב בתהליך</FormLabel>
                    <FormControl>
                      <Input placeholder="לדוגמה: הסתגלות, ביסוס הרגלים" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Sleep Cycles dynamic array */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium border-b pb-2">מחזורי שינה</h3>
              {fields.map((item, index) => (
                <Card key={item.id} className="p-4 relative bg-background shadow-md">
                  <CardHeader className="p-0 mb-4">
                     <CardTitle className="text-md">מחזור שינה {index + 1}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <FormField
                      control={form.control}
                      name={`sleepCycles.${index}.bedtime`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><Moon className="h-4 w-4" />שעת השכבה</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`sleepCycles.${index}.wakeTime`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><Sunrise className="h-4 w-4" />שעת יקיצה (אופציונלי)</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name={`sleepCycles.${index}.timeToSleep`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><Timer className="h-4 w-4" />כמה זמן עד שנרדמ/ה</FormLabel>
                          <FormControl>
                            <Input placeholder="לדוגמה: 15 דקות, מייד" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`sleepCycles.${index}.whoPutToSleep`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1"><UserCircle2 className="h-4 w-4" />מי הרדים/ה</FormLabel>
                          <FormControl>
                            <Input placeholder="לדוגמה: אמא, אבא, לבד" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`sleepCycles.${index}.howFellAsleep`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>איך נרדמ/ה</FormLabel>
                          <FormControl>
                            <Textarea placeholder="תיאור מפורט של תהליך ההרדמות..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  {fields.length > 1 && ( // Show delete button only if more than one cycle exists
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="absolute top-2 start-2 text-destructive hover:bg-destructive/10"
                    aria-label="מחק מחזור שינה"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  )}
                </Card>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ bedtime: "", timeToSleep: "", whoPutToSleep: "", howFellAsleep: "", wakeTime: "" })}
                className="w-full md:w-auto"
              >
                <PlusCircle className="me-2 h-4 w-4" />
                הוסף מחזור שינה נוסף
              </Button>
            </div>

            {/* Form actions: Cancel (if applicable) and Submit */}
            <div className={cn("flex gap-2", isDialog ? "justify-end" : "")}>
              {onCancel && ( // Show cancel button if onCancel prop is provided (typically in dialogs)
                 <Button type="button" variant="outline" onClick={onCancel} className="w-full md:w-auto">
                    ביטול
                 </Button>
              )}
              <Button type="submit" className={cn("w-full md:w-auto", !isDialog && "text-lg py-6")}>
                <Send className="me-2 h-5 w-5" />
                {submitButtonText || "שמור נתוני שינה"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </CardComponent>
  );
}

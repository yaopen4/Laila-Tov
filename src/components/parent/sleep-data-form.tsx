
/**
 * @fileoverview Form for parents to log sleep data for their baby.
 * Includes fields for date, and multiple sleep cycles.
 * Uses react-hook-form and Zod for validation.
 * Can be used for adding new records or editing existing ones.
 */
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { he } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, PlusCircle, Send, Trash2, BedDouble, Timer, UserCircle2, Moon, Sunrise } from 'lucide-react';
import type { SleepRecord } from "@/lib/mock-data";
import { useEffect } from "react";

// Zod schema for a single sleep cycle
const sleepCycleSchema = z.object({
  bedtime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "פורמט שעה לא תקין (HH:MM)."}),
  timeToSleep: z.string().min(1, { message: "שדה חובה." }),
  whoPutToSleep: z.string().min(1, { message: "שדה חובה." }),
  howFellAsleep: z.string().min(1, { message: "שדה חובה." }),
  wakeTime: z.string() // Optional field
    .optional()
    .refine(val => val === undefined || val === '' || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val || ''), {
      message: "פורמט שעה לא תקין (HH:MM), או השאר ריק." // Validation if value is provided
    }),
});

// Zod schema for a sleep record, including an array of sleep cycles
const sleepRecordSchema = z.object({
  date: z.date({ required_error: "תאריך הוא שדה חובה." }),
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
  /** Custom text for the submit button (e.g., "עדכן רשומה"). Defaults to "שמור נתוני שינה". */
  submitButtonText?: string;
  /** Flag to adjust layout if the form is rendered inside a dialog. Defaults to false. */
  isDialog?: boolean;
}

/**
 * A form for parents to log or edit sleep data for their baby.
 * @param {SleepDataFormProps} props - The component's props.
 */
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
          sleepCycles: initialData.sleepCycles.map(sc => ({
            bedtime: sc.bedtime,
            timeToSleep: sc.timeToSleep,
            whoPutToSleep: sc.whoPutToSleep,
            howFellAsleep: sc.howFellAsleep,
            wakeTime: sc.wakeTime || "", // Ensure wakeTime is string or empty string for optional field
          })),
        }
      : { // Default values for a new record
          date: new Date(),
          sleepCycles: [{ bedtime: "", timeToSleep: "", whoPutToSleep: "", howFellAsleep: "", wakeTime: "" }],
        },
  });

  /**
   * Effect to reset form fields if initialData changes (e.g. editing a different record)
   * or when component mounts/dialog opens for a new record (unless it's a dialog for editing).
   */
  useEffect(() => {
    if (initialData) { // If editing an existing record
      form.reset({
        date: new Date(initialData.date),
        sleepCycles: initialData.sleepCycles.map(sc => ({
          bedtime: sc.bedtime,
          timeToSleep: sc.timeToSleep,
          whoPutToSleep: sc.whoPutToSleep,
          howFellAsleep: sc.howFellAsleep,
          wakeTime: sc.wakeTime || "",
        })),
      });
    } else if (!isDialog) { // If adding a new record (not in a dialog context, e.g. main page form)
      form.reset({
        date: new Date(),
        sleepCycles: [{ bedtime: "", timeToSleep: "", whoPutToSleep: "", howFellAsleep: "", wakeTime: "" }],
      });
    }
    // If it's a dialog for a new record, defaultValues from useForm handle the initial state.
  }, [initialData, form.reset, isDialog]); // form.reset is stable but included for completeness

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sleepCycles",
  });

  /**
   * Handles form submission after successful validation.
   * Shows a toast notification and calls the `onSubmitSuccess` callback.
   * Resets the form if it's for a new record and not in a dialog.
   * @param {SleepRecordFormData} values - The validated form data.
   */
  function onSubmit(values: SleepRecordFormData) {
    toast({
      title: initialData ? "נתוני שינה עודכנו!" : "נתוני שינה נשמרו!",
      description: `הנתונים עבור ${babyName} ${initialData ? 'עודכנו' : 'נשלחו'} בהצלחה.`,
    });
    if (onSubmitSuccess) onSubmitSuccess(values);

    // Reset form only if it's for a new record and not part of a dialog (which handles its own lifecycle)
    if (!initialData && !isDialog) {
      form.reset({
        date: new Date(),
        sleepCycles: [{ bedtime: "", timeToSleep: "", whoPutToSleep: "", howFellAsleep: "", wakeTime: "" }],
      });
    }
  }

  // Dynamically choose between Card or div wrapper based on whether form is in a dialog
  const CardComponent = isDialog ? 'div' : Card;
  const cardComponentProps = isDialog ? {} : { className: "w-full max-w-2xl mx-auto shadow-xl" };

  return (
    <CardComponent {...cardComponentProps}>
      {!isDialog && ( // Display header only if not in a dialog
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
            {/* Date field */}
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
                              "w-full justify-start text-right font-normal", // RTL: text-right for placeholder
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="ms-2 me-auto h-4 w-4 opacity-50" /> {/* RTL: icon on left */}
                            {field.value ? format(field.value, "PPP", { locale: he }) : <span>בחירת תאריך</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                          dir="rtl" // Ensure calendar itself is RTL
                          locale={he}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Sleep Cycles dynamic array */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium border-b pb-2">מחזורי שינה</h3>
              {fields.map((item, index) => (
                <Card key={item.id} className="bg-background shadow-md">
                  {/* Header for each sleep cycle card, uses flexbox for RTL layout */}
                  <div className="flex items-center justify-between p-4 border-b">
                     <h4 className="text-md font-semibold">מחזור שינה {index + 1}</h4>
                     {fields.length > 1 && ( // Show delete button only if there's more than one cycle
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="text-destructive hover:bg-destructive/10"
                          aria-label="מחק מחזור שינה"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                     )}
                  </div>
                  <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
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
                        <FormItem className="md:col-span-2"> {/* Spans two columns on medium screens and up */}
                          <FormLabel>איך נרדמ/ה</FormLabel>
                          <FormControl>
                            <Textarea placeholder="תיאור מפורט של תהליך ההרדמות..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
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
              {onCancel && ( // Display Cancel button only if onCancel prop is provided (typically in dialogs)
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

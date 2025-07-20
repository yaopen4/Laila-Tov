
/**
 * @fileoverview Form for parents to log sleep data for their baby.
 * Includes fields for date, and multiple sleep cycles.
 * Uses react-hook-form and Zod for validation. Data saved to Firestore.
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
import { CalendarIcon, PlusCircle, Send, Trash2, BedDouble, Timer, UserCircle2, Moon, Sunrise } from 'lucide-react';
import type { SleepRecord, SleepRecordFormData } from "@/types";
import { useEffect } from "react";

// Zod schema for a single sleep cycle
const sleepCycleSchema = z.object({
  id: z.string().optional(), // Optional ID, useful for existing cycles during edit
  bedtime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "פורמט שעה לא תקין (HH:MM)."}),
  timeToSleep: z.string().min(1, { message: "שדה חובה." }).max(50, {message: "תיאור ארוך מדי."}),
  whoPutToSleep: z.string().min(1, { message: "שדה חובה." }).max(50, {message: "תיאור ארוך מדי."}),
  howFellAsleep: z.string().min(1, { message: "שדה חובה." }).max(200, {message: "תיאור ארוך מדי."}),
  wakeTime: z.string()
    .optional()
    .refine(val => val === undefined || val === '' || /^([01]\d|2[0-3]):([0-5]\d)$/.test(val || ''), {
      message: "פורמט שעה לא תקין (HH:MM), או השאר ריק."
    }),
});

// Zod schema for a sleep record, including an array of sleep cycles
const sleepRecordSchema = z.object({
  date: z.date({ required_error: "תאריך הוא שדה חובה." }),
  sleepCycles: z.array(sleepCycleSchema).min(1, { message: "חובה להוסיף לפחות מחזור שינה אחד." }),
});


/**
 * Props for the SleepDataForm component.
 */
interface SleepDataFormProps {
  /** Name of the baby, displayed in the form title. */
  babyName: string;
  /** Callback function executed on successful form submission. */
  onSubmitSuccess?: (data: SleepRecordFormData) => Promise<void>;
  /** Initial data to pre-fill the form, used for editing existing records. */
  initialData?: SleepRecord | null;
  /** Callback function for cancelling the form, typically used in dialogs. */
  onCancel?: () => void;
  /** Custom text for the submit button. */
  submitButtonText?: string;
  /** Flag to adjust layout if the form is rendered inside a dialog. Defaults to false. */
  isDialog?: boolean;
  /** Flag to indicate if the form is currently submitting data. */
  isSubmitting?: boolean;
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
  isDialog = false,
  isSubmitting = false,
}: SleepDataFormProps) {
  const form = useForm<SleepRecordFormData>({
    resolver: zodResolver(sleepRecordSchema),
    defaultValues: initialData
      ? { 
          date: new Date(initialData.date), 
          sleepCycles: initialData.sleepCycles.map(sc => ({
            ...sc,
            wakeTime: sc.wakeTime || "", 
          })),
        }
      : { 
          date: new Date(),
          sleepCycles: [{ bedtime: "", timeToSleep: "", whoPutToSleep: "", howFellAsleep: "", wakeTime: "" }],
        },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        date: new Date(initialData.date),
        sleepCycles: initialData.sleepCycles.map(sc => ({
          ...sc,
          wakeTime: sc.wakeTime || "",
        })),
      });
    } else if (!isDialog) {
      form.reset({
        date: new Date(),
        sleepCycles: [{ bedtime: "", timeToSleep: "", whoPutToSleep: "", howFellAsleep: "", wakeTime: "" }],
      });
    }
  }, [initialData, form.reset, isDialog]); 

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sleepCycles",
  });

  async function onSubmit(values: SleepRecordFormData) {
    if (onSubmitSuccess) {
      await onSubmitSuccess(values);
    }
    // Form reset is handled by parent component or dialog lifecycle
    // if not dialog and not initialData (i.e. adding new, not editing)
    if (!isDialog && !initialData) {
        form.reset({
            date: new Date(),
            sleepCycles: [{ bedtime: "", timeToSleep: "", whoPutToSleep: "", howFellAsleep: "", wakeTime: "" }],
        });
    }
  }

  const CardComponent = isDialog ? 'div' : Card;
  const cardComponentProps = isDialog ? {} : { className: "w-full max-w-2xl mx-auto shadow-xl" };

  return (
    <CardComponent {...cardComponentProps}>
      {!isDialog && (
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <BedDouble className="h-6 w-6 text-primary" />
            הזנת נתוני שינה עבור {babyName}
          </CardTitle>
          <CardDescription>נא למלא את כל הפרטים הרלוונטיים.</CardDescription>
        </CardHeader>
      )}
      <CardContent className={isDialog ? "pt-0" : ""}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                            disabled={isSubmitting}
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
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01") || isSubmitting }
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
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-medium border-b pb-2">מחזורי שינה</h3>
              {fields.map((item, index) => (
                <Card key={item.id} className="bg-background shadow-md">
                  <div className="flex items-center justify-between p-4 border-b">
                     <h4 className="text-md font-semibold">מחזור שינה {index + 1}</h4>
                     {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="text-destructive hover:bg-destructive/10"
                          aria-label="מחק מחזור שינה"
                          disabled={isSubmitting}
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
                            <Input type="time" {...field} disabled={isSubmitting} />
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
                            <Input type="time" {...field} disabled={isSubmitting} />
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
                          <FormLabel className="flex items-center gap-1"><Timer className="h-4 w-4" />כמה זמן עד הרדמות</FormLabel>
                          <FormControl>
                            <Input placeholder="לדוגמה: 15 דקות, מייד" {...field} disabled={isSubmitting} />
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
                          <FormLabel className="flex items-center gap-1"><UserCircle2 className="h-4 w-4" />מי הרדים</FormLabel>
                          <FormControl>
                            <Input placeholder="לדוגמה: אמא, אבא, לבד" {...field} disabled={isSubmitting} />
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
                          <FormLabel>איך נרדם</FormLabel>
                          <FormControl>
                            <Textarea placeholder="תיאור מפורט של תהליך ההרדמות..." {...field} disabled={isSubmitting} />
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
                disabled={isSubmitting}
              >
                <PlusCircle className="me-2 h-4 w-4" />
                הוסף מחזור שינה נוסף
              </Button>
            </div>

            <div className={cn("flex gap-2", isDialog ? "justify-end" : "")}>
              {onCancel && (
                 <Button type="button" variant="outline" onClick={onCancel} className="w-full md:w-auto" disabled={isSubmitting}>
                    ביטול
                 </Button>
              )}
              <Button type="submit" className={cn("w-full md:w-auto", !isDialog && "text-lg py-6")} disabled={isSubmitting}>
                <Send className="me-2 h-5 w-5" />
                {isSubmitting ? (initialData ? "מעדכן..." : "שומר...") : (submitButtonText || "שמור נתוני שינה")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </CardComponent>
  );
}

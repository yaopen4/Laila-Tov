"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
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
import { format } from "date-fns"; // Changed from date-fns-jalali
import { he } from 'date-fns/locale'; // For Hebrew locale with date-fns
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, PlusCircle, Send, Trash2, BedDouble, Timer, UserCircle2, Moon, Sunrise, Layers } from 'lucide-react';

const sleepCycleSchema = z.object({
  bedtime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "פורמט שעה לא תקין (HH:MM)."}),
  timeToSleep: z.string().min(1, { message: "שדה חובה." }),
  whoPutToSleep: z.string().min(1, { message: "שדה חובה." }),
  howFellAsleep: z.string().min(1, { message: "שדה חובה." }),
  wakeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "פורמט שעה לא תקין (HH:MM)."}),
});

const sleepRecordSchema = z.object({
  date: z.date({ required_error: "תאריך הוא שדה חובה." }),
  stage: z.string().min(1, { message: "שלב הוא שדה חובה." }),
  sleepCycles: z.array(sleepCycleSchema).min(1, { message: "חובה להוסיף לפחות מחזור שינה אחד." }),
});

export type SleepRecordFormData = z.infer<typeof sleepRecordSchema>;

interface SleepDataFormProps {
  babyName: string;
  onSubmitSuccess?: (data: SleepRecordFormData) => void;
}

export function SleepDataForm({ babyName, onSubmitSuccess }: SleepDataFormProps) {
  const { toast } = useToast();
  const form = useForm<SleepRecordFormData>({
    resolver: zodResolver(sleepRecordSchema),
    defaultValues: {
      date: new Date(),
      stage: "",
      sleepCycles: [{ bedtime: "", timeToSleep: "", whoPutToSleep: "", howFellAsleep: "", wakeTime: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sleepCycles",
  });

  function onSubmit(values: SleepRecordFormData) {
    console.log("Sleep data:", values);
    // Here you would typically send data to Firebase
    toast({
      title: "נתוני שינה נשמרו!",
      description: `הנתונים עבור ${babyName} נשלחו בהצלחה.`,
    });
    if (onSubmitSuccess) onSubmitSuccess(values);
    // form.reset(); // Optionally reset form
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <BedDouble className="h-6 w-6 text-primary" />
          הזנת נתוני שינה עבור {babyName}
        </CardTitle>
        <CardDescription>נא למלא את כל הפרטים הרלוונטיים.</CardDescription>
      </CardHeader>
      <CardContent>
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
                          disabled={(date) =>
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
                          <FormLabel className="flex items-center gap-1"><Sunrise className="h-4 w-4" />שעת יקיצה</FormLabel>
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
                  {fields.length > 1 && (
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

            <Button type="submit" className="w-full md:w-auto text-lg py-6">
              <Send className="me-2 h-5 w-5" />
              שמור נתוני שינה
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

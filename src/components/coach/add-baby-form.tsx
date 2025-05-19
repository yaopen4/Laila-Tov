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
import { UserPlus } from "lucide-react";

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
});

export function AddBabyForm() {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
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
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("New baby data:", values);
    // Here you would typically send data to Firebase
    toast({
      title: "תינוק נוסף בהצלחה!",
      description: `הפרופיל של ${values.name} ${values.familyName} נוצר.`,
    });
    form.reset();
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-primary" />
          הוספת תינוק חדש
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
                      <Input placeholder="שם משתמש ייחודי" {...field} />
                    </FormControl>
                    <FormDescription>
                      הורים ישתמשו בזה להתחברות.
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
            <Button type="submit" className="w-full md:w-auto">הוסף תינוק</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

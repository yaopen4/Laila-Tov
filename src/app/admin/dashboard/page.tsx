/**
 * @fileoverview Admin dashboard page.
 * Provides a central point for administrative tasks like managing coaches.
 */
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCog } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-primary">לוח בקרה - מנהל</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-6 w-6" />
            ניהול יועצות
          </CardTitle>
          <CardDescription>
            כאן ניתן לצפות, לאשר ולנהל יועצות שינה.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            בקרוב: טבלה של כל היועצות עם הסטטוס שלהן (ממתינה לאישור, פעילה, מושעית) ופעולות לניהולן.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

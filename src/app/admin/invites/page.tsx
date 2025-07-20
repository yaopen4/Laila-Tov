/**
 * @fileoverview Admin page for creating and managing user invite codes.
 * Allows admins to generate separate invites for coaches and parents.
 */
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminInvitesPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">ניהול הזמנות</h1>
      <Card>
        <CardHeader>
          <CardTitle>יצירת הזמנה חדשה</CardTitle>
          <CardDescription>
            יצירת קוד הזמנה חד פעמי עבור יועצת או הורה.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>כאן יוצג טופס יצירת ההזמנה.</p>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>הזמנות קיימות</CardTitle>
          <CardDescription>
            רשימת כל ההזמנות שנוצרו והסטטוס שלהן.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>כאן תוצג טבלת ההזמנות הקיימות.</p>
        </CardContent>
      </Card>
    </div>
  );
} 
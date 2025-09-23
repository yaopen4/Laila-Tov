/**
 * @fileoverview Coach calendar page.
 * Meeting and appointment management.
 */
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus, Clock, User } from 'lucide-react';

export default function CoachCalendarPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">יומן פגישות</h1>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          קביעת פגישה חדשה
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            יומן פגישות
          </CardTitle>
          <CardDescription>
            ניהול פגישות ופגישות עם הורים
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>יומן הפגישות יהיה זמין בקרוב</p>
            <p className="text-sm mt-2">תוכל לקבוע פגישות, לנהל זמנים ולעקוב אחר פגישות עם הורים</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

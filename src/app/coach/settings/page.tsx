/**
 * @fileoverview Coach settings page.
 * Personal settings and preferences.
 */
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Save, User, Bell, Shield } from 'lucide-react';

export default function CoachSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">הגדרות אישיות</h1>
        <Button className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          שמירת הגדרות
        </Button>
      </div>

      <div className="space-y-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-6 w-6" />
              פרטים אישיים
            </CardTitle>
            <CardDescription>
              עדכון פרטים אישיים ומידע קשר
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">שם פרטי</Label>
                <Input id="firstName" placeholder="הזן שם פרטי" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">שם משפחה</Label>
                <Input id="lastName" placeholder="הזן שם משפחה" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input id="email" type="email" placeholder="הזן כתובת אימייל" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">טלפון</Label>
              <Input id="phone" placeholder="הזן מספר טלפון" />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-6 w-6" />
              הגדרות התראות
            </CardTitle>
            <CardDescription>
              ניהול התראות ואימיילים
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>התראות אימייל</Label>
                <p className="text-sm text-muted-foreground">
                  קבלת התראות באימייל על פעולות חשובות
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>התראות פגישות</Label>
                <p className="text-sm text-muted-foreground">
                  תזכורות לפני פגישות
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>התראות הודעות</Label>
                <p className="text-sm text-muted-foreground">
                  התראות על הודעות חדשות מהורים
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              הגדרות אבטחה
            </CardTitle>
            <CardDescription>
              ניהול סיסמה והגדרות אבטחה
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">סיסמה נוכחית</Label>
              <Input id="currentPassword" type="password" placeholder="הזן סיסמה נוכחית" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">סיסמה חדשה</Label>
              <Input id="newPassword" type="password" placeholder="הזן סיסמה חדשה" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אישור סיסמה</Label>
              <Input id="confirmPassword" type="password" placeholder="אשר סיסמה חדשה" />
            </div>
            <Button variant="outline">שינוי סיסמה</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

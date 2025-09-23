/**
 * @fileoverview Admin system settings page.
 * Dedicated page for system configuration and settings.
 */
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, 
  Save,
  Database,
  Mail,
  Shield,
  Bell
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    organizationName: '',
    maxUsers: 100,
    invitationExpiryDays: 7,
    auditRetentionDays: 90,
    emailNotifications: true,
    securityAlerts: true,
    autoBackup: false,
    maintenanceMode: false
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // TODO: Load actual settings from database
      // For now, using default values
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "שגיאה בטעינת הגדרות",
        description: "לא ניתן לטעון את הגדרות המערכת",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      // TODO: Save settings to database
      toast({
        title: "הגדרות נשמרו",
        description: "הגדרות המערכת נשמרו בהצלחה",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "שגיאה בשמירת הגדרות",
        description: "לא ניתן לשמור את הגדרות המערכת",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">הגדרות מערכת</h1>
        <Button onClick={handleSaveSettings} disabled={loading} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          שמירת הגדרות
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Organization Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-6 w-6" />
              הגדרות ארגון
            </CardTitle>
            <CardDescription>
              הגדרות כלליות של הארגון
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">שם הארגון</Label>
              <Input
                id="organizationName"
                value={settings.organizationName}
                onChange={(e) => handleSettingChange('organizationName', e.target.value)}
                placeholder="הזן שם ארגון"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxUsers">מספר משתמשים מקסימלי</Label>
              <Input
                id="maxUsers"
                type="number"
                value={settings.maxUsers}
                onChange={(e) => handleSettingChange('maxUsers', parseInt(e.target.value))}
              />
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
              הגדרות אבטחה ופרטיות
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invitationExpiryDays">תוקף הזמנות (ימים)</Label>
              <Input
                id="invitationExpiryDays"
                type="number"
                value={settings.invitationExpiryDays}
                onChange={(e) => handleSettingChange('invitationExpiryDays', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auditRetentionDays">שמירת יומן ביקורת (ימים)</Label>
              <Input
                id="auditRetentionDays"
                type="number"
                value={settings.auditRetentionDays}
                onChange={(e) => handleSettingChange('auditRetentionDays', parseInt(e.target.value))}
              />
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
              הגדרות התראות ואימיילים
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>התראות אימייל</Label>
                <p className="text-sm text-muted-foreground">
                  שליחת התראות באימייל על פעולות חשובות
                </p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>התראות אבטחה</Label>
                <p className="text-sm text-muted-foreground">
                  התראות על אירועי אבטחה חשובים
                </p>
              </div>
              <Switch
                checked={settings.securityAlerts}
                onCheckedChange={(checked) => handleSettingChange('securityAlerts', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-6 w-6" />
              הגדרות מערכת
            </CardTitle>
            <CardDescription>
              הגדרות כלליות של המערכת
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>גיבוי אוטומטי</Label>
                <p className="text-sm text-muted-foreground">
                  ביצוע גיבויים אוטומטיים של הנתונים
                </p>
              </div>
              <Switch
                checked={settings.autoBackup}
                onCheckedChange={(checked) => handleSettingChange('autoBackup', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>מצב תחזוקה</Label>
                <p className="text-sm text-muted-foreground">
                  הגבלת גישה למערכת לצורך תחזוקה
                </p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => handleSettingChange('maintenanceMode', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

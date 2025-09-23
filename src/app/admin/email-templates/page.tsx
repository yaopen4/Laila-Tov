"use client";

import { EmailTemplateManager } from "@/components/admin/email-template-manager";

export default function EmailTemplatesPage() {
  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary">ניהול תבניות אימייל</h1>
        <p className="text-muted-foreground">יצירה ועריכה של תבניות הזמנה מותאמות אישית</p>
      </div>
      <EmailTemplateManager />
    </div>
  );
}

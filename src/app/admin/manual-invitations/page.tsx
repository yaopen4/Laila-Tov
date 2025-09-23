/**
 * @fileoverview Admin manual invitations page.
 * Dedicated page for managing manual invitations.
 */
"use client";

import { ManualInvitationManager } from "@/components/admin/manual-invitation-manager";

export default function AdminManualInvitationsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-primary">הזמנות ידניות</h1>
        <p className="text-muted-foreground">יצירה וניהול הזמנות משתמשים עם קודי הזמנה ידניים</p>
      </div>
      <ManualInvitationManager />
    </div>
  );
}

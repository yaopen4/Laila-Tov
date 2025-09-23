/**
 * Test page for manual invitation system
 * This page can be used to test the manual invitation functionality independently
 */
"use client";

import { ManualInvitationManager } from "@/components/admin/manual-invitation-manager";

export default function TestManualInvitationsPage() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary">בדיקת הזמנות ידניות</h1>
        <p className="text-muted-foreground">דף בדיקה למערכת ההזמנות הידניות</p>
      </div>
      
      <ManualInvitationManager />
    </div>
  );
}

/**
 * @fileoverview Admin audit logs page.
 * Dedicated page for viewing and managing audit logs.
 */
"use client";

import { AuditLogViewer } from "@/components/admin/audit-log-viewer";

export default function AdminAuditPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-primary">יומן ביקורת</h1>
      <AuditLogViewer />
    </div>
  );
}

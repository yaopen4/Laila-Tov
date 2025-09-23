/**
 * @fileoverview Admin users management page.
 * Dedicated page for user management with full CRUD operations.
 */
"use client";

import { UserManagement } from "@/components/admin/user-management";

export default function AdminUsersPage() {
  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-6 text-primary">ניהול משתמשים</h1>
      <UserManagement />
    </div>
  );
}

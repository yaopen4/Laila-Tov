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
      <h1 className="text-3xl font-bold mb-6 text-primary">Admin Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-6 w-6" />
            Coach Management
          </CardTitle>
          <CardDescription>
            This is where you can view, approve, and manage sleep consultants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Feature coming soon: A table of all coaches with their status (pending, active, suspended) and actions to manage them.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

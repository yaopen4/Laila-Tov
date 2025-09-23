/**
 * @fileoverview Admin roles management page.
 * Dedicated page for role and permission management.
 */
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2,
  Users,
  Key
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { RoleService } from '@/services/roleService';
import { AuthService } from '@/services/authService';
import type { Role } from '@/types/auth';

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) return;

      // Get roles for the user's organization (matches Firestore rules)
      const rolesData = await RoleService.getAllRoles(currentUser.organizationId!);
      setRoles(rolesData);
    } catch (error) {
      console.error('Error loading roles:', error);
      toast({
        title: "שגיאה בטעינת תפקידים",
        description: "לא ניתן לטעון את רשימת התפקידים",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    toast({
      title: "יצירת תפקיד חדש",
      description: "פונקציונליות זו תהיה זמינה בקרוב",
    });
  };

  const handleEditRole = (roleId: string) => {
    toast({
      title: "עריכת תפקיד",
      description: `עריכת תפקיד ${roleId} - פונקציונליות זו תהיה זמינה בקרוב`,
    });
  };

  const handleDeleteRole = (roleId: string) => {
    toast({
      title: "מחיקת תפקיד",
      description: `מחיקת תפקיד ${roleId} - פונקציונליות זו תהיה זמינה בקרוב`,
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <h1 className="text-3xl font-bold mb-6 text-primary">ניהול תפקידים</h1>
        <div className="flex justify-center items-center h-64">
          <p>טוען תפקידים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-primary">ניהול תפקידים</h1>
        <Button onClick={handleCreateRole} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          יצירת תפקיד חדש
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            תפקידי מערכת
          </CardTitle>
          <CardDescription>
            ניהול תפקידים והרשאות במערכת
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם התפקיד</TableHead>
                <TableHead>תיאור</TableHead>
                <TableHead>הרשאות</TableHead>
                <TableHead>סוג</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {role.name}
                    </div>
                  </TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.slice(0, 3).map((permission) => (
                        <Badge key={permission} variant="secondary" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                      {role.permissions.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{role.permissions.length - 3} נוספות
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.isSystemRole ? "default" : "secondary"}>
                      {role.isSystemRole ? "מערכת" : "מותאם אישית"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRole(role.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!role.isSystemRole && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

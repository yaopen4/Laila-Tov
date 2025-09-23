/**
 * @fileoverview Admin email invitations page.
 * Dedicated page for managing email-based invitations.
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
import { MailPlus, Plus, Eye, Mail } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { AuthService } from '@/services/authService';
import type { Invitation } from '@/types/auth';

export default function AdminEmailInvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      setIsLoading(true);
      
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.organizationId) return;

      // TODO: Load email invitations from the invitation service
      // For now, we'll show a placeholder
      setInvitations([]);
      
    } catch (error) {
      console.error('Error loading email invitations:', error);
      toast({
        title: "שגיאה בטעינת הזמנות אימייל",
        description: "לא ניתן היה לטעון את רשימת ההזמנות",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEmailInvitation = async () => {
    // TODO: Implement email invitation creation
    toast({
      title: "הזמנת אימייל",
      description: "פונקציונליות הזמנות אימייל תתווסף בעתיד",
      variant: "default"
    });
  };

  const getRoleDisplayName = (role: string): string => {
    const roleNames = {
      admin: 'מנהל מערכת',
      coach: 'יועץ שינה',
      parent: 'הורה'
    };
    return roleNames[role] || role;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>הזמנות אימייל</CardTitle>
          <CardDescription>טוען נתונים...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-primary">הזמנות אימייל</h1>
        <p className="text-muted-foreground">הזמנות שנשלחות אוטומטית באימייל</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MailPlus className="h-5 w-5" />
                הזמנות אימייל אוטומטיות
              </CardTitle>
              <CardDescription>
                הזמנות שנשלחות אוטומטית באימייל (מערכת קיימת)
              </CardDescription>
            </div>
            <Button onClick={handleCreateEmailInvitation} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              הזמנה חדשה
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">אין הזמנות אימייל פעילות</h3>
              <p className="text-sm mb-4">הזמנות אימייל אוטומטיות יופיעו כאן</p>
              <Button onClick={handleCreateEmailInvitation}>
                <MailPlus className="h-4 w-4 mr-2" />
                צור הזמנה ראשונה
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>אימייל</TableHead>
                    <TableHead>תפקיד</TableHead>
                    <TableHead>תאריך יצירה</TableHead>
                    <TableHead>סטטוס</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getRoleDisplayName(invitation.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        {invitation.createdAt.toDate().toLocaleDateString('he-IL')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          invitation.status === 'pending' ? 'default' :
                          invitation.status === 'accepted' ? 'secondary' :
                          invitation.status === 'expired' ? 'destructive' : 'outline'
                        }>
                          {invitation.status === 'pending' ? 'ממתין' :
                           invitation.status === 'accepted' ? 'אושר' :
                           invitation.status === 'expired' ? 'פג תוקף' : invitation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2 rtl:space-x-reverse">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {invitation.status === 'pending' && (
                            <Button variant="outline" size="sm">
                              <MailPlus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

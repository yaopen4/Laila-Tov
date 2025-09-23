// User Management Interface for Admin Dashboard
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Users, 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  UserX,
  Mail,
  Shield
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { AuthService } from '@/services/authService';
import { OrganizationService } from '@/services/organizationService';
import { InvitationService } from '@/services/invitationService';
import { RoleService } from '@/services/roleService';
import type { User, Role } from '@/types/auth';

interface UserWithPermissions extends User {
  roleAssignments?: any[];
  effectivePermissions?: string[];
}

export function UserManagement() {
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'parent' as 'admin' | 'coach' | 'parent',
    welcomeMessage: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.organizationId) return;

      // Load users and roles in parallel
      const [organizationUsers, organizationRoles] = await Promise.all([
        OrganizationService.getOrganizationUsers(currentUser.organizationId),
        loadOrganizationRoles(currentUser.organizationId)
      ]);

      // Enrich users with permission data
      const usersWithPermissions = await Promise.all(
        organizationUsers.map(async (user) => {
          const permissions = await RoleService.getUserPermissions(user.uid);
          const roleAssignments = await RoleService.getUserRoleAssignments(user.uid, currentUser.organizationId);
          
          return {
            ...user,
            effectivePermissions: permissions,
            roleAssignments
          };
        })
      );

      setUsers(usersWithPermissions);
      setRoles(organizationRoles);
      
    } catch (error) {
      console.error('Error loading user management data:', error);
      toast({
        title: "שגיאה בטעינת נתונים",
        description: "לא ניתן היה לטעון את נתוני המשתמשים",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrganizationRoles = async (organizationId: string): Promise<Role[]> => {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const rolesQuery = query(
        collection(db, 'roles'),
        where('organizationId', '==', organizationId),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(rolesQuery);
      return snapshot.docs.map(doc => doc.data() as Role);
      
    } catch (error) {
      console.error('Error loading roles:', error);
      return [];
    }
  };

  const handleCreateInvitation = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) return;

      const invitationService = new InvitationService();
      
      await invitationService.createInvitation({
        email: inviteForm.email,
        role: inviteForm.role,
        organizationId: currentUser.organizationId!,
        createdBy: currentUser.uid,
        metadata: {
          welcomeMessage: inviteForm.welcomeMessage || undefined
        }
      });

      toast({
        title: "הזמנה נשלחה",
        description: `הזמנה נשלחה בהצלחה ל-${inviteForm.email}`,
        variant: "default"
      });

      setIsInviteDialogOpen(false);
      setInviteForm({ email: '', role: 'parent', welcomeMessage: '' });
      
      // Reload data to show new invitation
      await loadData();
      
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast({
        title: "שגיאה ביצירת הזמנה",
        description: error instanceof Error ? error.message : "אירעה שגיאה לא צפויה",
        variant: "destructive"
      });
    }
  };

  const handleDeactivateUser = async (userId: string) => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) return;

      // Update user status
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      await updateDoc(doc(db, 'users', userId), {
        status: 'inactive',
        deactivatedAt: new Date(),
        deactivatedBy: currentUser.uid
      });

      toast({
        title: "משתמש הושעה",
        description: "המשתמש הושעה בהצלחה",
        variant: "default"
      });

      // Reload data
      await loadData();
      
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast({
        title: "שגיאה בהשעיית משתמש",
        description: "לא ניתן היה להשעות את המשתמש",
        variant: "destructive"
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleDisplayName = (role: string): string => {
    const roleNames = {
      admin: 'מנהל מערכת',
      coach: 'יועץ שינה',
      parent: 'הורה'
    };
    return roleNames[role] || role;
  };

  const getStatusDisplayName = (status: string): string => {
    const statusNames = {
      active: 'פעיל',
      inactive: 'לא פעיל',
      suspended: 'מושעה'
    };
    return statusNames[status] || status;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ניהול משתמשים</CardTitle>
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                ניהול משתמשים
              </CardTitle>
              <CardDescription>
                צפה ונהל את כל המשתמשים בארגון ({users.length} משתמשים)
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 rtl:space-x-reverse">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חפש משתמשים..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <Button onClick={() => setIsInviteDialogOpen(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                הזמן משתמש
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>אימייל</TableHead>
                  <TableHead>תפקיד</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>הרשאות</TableHead>
                  <TableHead>התחברות אחרונה</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'לא נמצאו משתמשים התואמים לחיפוש' : 'אין משתמשים להצגה'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.uid}>
                    <TableCell className="font-medium">
                      {user.displayName || 'לא הוגדר'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getRoleDisplayName(user.role)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                        {getStatusDisplayName(user.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {user.effectivePermissions?.length || 0} הרשאות
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt?.toDate().toLocaleDateString('he-IL') || 'מעולם לא'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2 rtl:space-x-reverse">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsUserDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setIsUserDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user.status === 'active' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeactivateUser(user.uid)}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>פרטי משתמש</DialogTitle>
            <DialogDescription>
              {selectedUser?.displayName || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">שם מלא</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.displayName || 'לא הוגדר'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">אימייל</label>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">תפקיד</label>
                  <p className="text-sm text-muted-foreground">
                    {getRoleDisplayName(selectedUser.role)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">סטטוס</label>
                  <p className="text-sm text-muted-foreground">
                    {getStatusDisplayName(selectedUser.status)}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">הרשאות פעילות</label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedUser.effectivePermissions?.map(permission => (
                    <Badge key={permission} variant="outline" className="text-xs">
                      {permission}
                    </Badge>
                  )) || <span className="text-sm text-muted-foreground">אין הרשאות</span>}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">תינוקות מנוהלים</label>
                <p className="text-sm text-muted-foreground">
                  {selectedUser.managedBabyProfiles.length} תינוקות
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>הזמן משתמש חדש</DialogTitle>
            <DialogDescription>
              צור הזמנה חדשה למשתמש
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">כתובת אימייל</label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">תפקיד</label>
              <Select
                value={inviteForm.role}
                onValueChange={(value: 'admin' | 'coach' | 'parent') => 
                  setInviteForm(prev => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">הורה</SelectItem>
                  <SelectItem value="coach">יועץ שינה</SelectItem>
                  <SelectItem value="admin">מנהל מערכת</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">הודעה אישית (אופציונלי)</label>
              <Input
                placeholder="הודעת ברכה או הסבר נוסף..."
                value={inviteForm.welcomeMessage}
                onChange={(e) => setInviteForm(prev => ({ ...prev, welcomeMessage: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsInviteDialogOpen(false)}
            >
              ביטול
            </Button>
            <Button 
              onClick={handleCreateInvitation}
              disabled={!inviteForm.email || !inviteForm.role}
            >
              <Mail className="h-4 w-4 mr-2" />
              שלח הזמנה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

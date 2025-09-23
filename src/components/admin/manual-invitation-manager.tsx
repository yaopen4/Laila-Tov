// Manual Invitation Manager Component
// Provides admin interface for creating invitations and copying invitation codes
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  MailPlus, 
  Copy, 
  Check, 
  Eye, 
  Trash2, 
  Clock,
  UserPlus,
  AlertCircle,
  Calendar,
  Users
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { ManualInvitationService, type CreateManualInvitationParams } from '@/services/manualInvitationService';
import { AuthService } from '@/services/authService';
import type { Invitation } from '@/types/auth';

interface InvitationFormData {
  email: string;
  role: 'admin' | 'coach' | 'parent';
  welcomeMessage: string;
  babyProfileId?: string;
  assignedCoachId?: string;
}

interface InvitationWithDetails extends Invitation {
  daysUntilExpiry: number;
  isExpired: boolean;
}

export function ManualInvitationManager() {
  const [invitations, setInvitations] = useState<InvitationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<InvitationWithDetails | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [invitationToDelete, setInvitationToDelete] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState<InvitationFormData>({
    email: '',
    role: 'parent',
    welcomeMessage: '',
    babyProfileId: '',
    assignedCoachId: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const manualInvitationService = new ManualInvitationService();

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      setIsLoading(true);
      
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.organizationId) return;

      const pendingInvitations = await manualInvitationService.getPendingInvitations(currentUser.organizationId);
      
      // Enrich invitations with additional details
      const invitationsWithDetails: InvitationWithDetails[] = pendingInvitations.map(invitation => {
        const now = new Date();
        const expiryDate = invitation.expiresAt.toDate();
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isExpired = now > expiryDate;

        return {
          ...invitation,
          daysUntilExpiry,
          isExpired
        };
      });

      setInvitations(invitationsWithDetails);
      
    } catch (error) {
      console.error('Error loading invitations:', error);
      toast({
        title: "שגיאה בטעינת הזמנות",
        description: "לא ניתן היה לטעון את רשימת ההזמנות",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInvitation = async () => {
    try {
      setIsCreating(true);
      
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) return;

      // Validate form
      if (!inviteForm.email || !inviteForm.role) {
        toast({
          title: "שגיאה בטופס",
          description: "יש למלא את כל השדות הנדרשים",
          variant: "destructive"
        });
        return;
      }

      const params: CreateManualInvitationParams = {
        email: inviteForm.email,
        role: inviteForm.role,
        organizationId: currentUser.organizationId!,
        createdBy: currentUser.uid,
        metadata: {
          welcomeMessage: inviteForm.welcomeMessage || undefined,
          babyProfileId: inviteForm.babyProfileId || undefined,
          assignedCoachId: inviteForm.assignedCoachId || undefined
        }
      };

      const result = await manualInvitationService.createManualInvitation(params);

      if (result.success && result.invitation && result.invitationCode) {
        toast({
          title: "הזמנה נוצרה בהצלחה",
          description: `קוד ההזמנה: ${result.invitationCode}`,
          variant: "default"
        });

        // Reset form and close dialog
        setInviteForm({
          email: '',
          role: 'parent',
          welcomeMessage: '',
          babyProfileId: '',
          assignedCoachId: ''
        });
        setIsCreateDialogOpen(false);

        // Reload invitations
        await loadInvitations();
      } else {
        toast({
          title: "שגיאה ביצירת הזמנה",
          description: result.error || "אירעה שגיאה לא צפויה",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('Error creating invitation:', error);
      toast({
        title: "שגיאה ביצירת הזמנה",
        description: "אירעה שגיאה לא צפויה",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyInvitationCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      
      toast({
        title: "קוד הועתק",
        description: "קוד ההזמנה הועתק ללוח",
        variant: "default"
      });

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "שגיאה בהעתקה",
        description: "לא ניתן היה להעתיק את הקוד",
        variant: "destructive"
      });
    }
  };

  const handleViewInvitationDetails = (invitation: InvitationWithDetails) => {
    setSelectedInvitation(invitation);
    setIsDetailsDialogOpen(true);
  };

  const handleDeleteInvitation = async () => {
    if (!invitationToDelete) return;

    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) return;

      await manualInvitationService.cancelInvitation(invitationToDelete, currentUser.uid);

      toast({
        title: "הזמנה בוטלה",
        description: "ההזמנה בוטלה בהצלחה",
        variant: "default"
      });

      setIsDeleteDialogOpen(false);
      setInvitationToDelete(null);
      
      // Reload invitations
      await loadInvitations();
      
    } catch (error) {
      console.error('Error deleting invitation:', error);
      toast({
        title: "שגיאה בביטול הזמנה",
        description: "לא ניתן היה לבטל את ההזמנה",
        variant: "destructive"
      });
    }
  };

  const getRoleDisplayName = (role: 'admin' | 'coach' | 'parent'): string => {
    const roleNames: Record<'admin' | 'coach' | 'parent', string> = {
      admin: 'מנהל מערכת',
      coach: 'יועץ שינה',
      parent: 'הורה'
    };
    return roleNames[role];
  };

  const getStatusBadge = (invitation: InvitationWithDetails) => {
    if (invitation.isExpired) {
      return <Badge variant="destructive">פג תוקף</Badge>;
    }
    
    if (invitation.daysUntilExpiry <= 1) {
      return <Badge variant="secondary">פג בקרוב</Badge>;
    }
    
    return <Badge variant="default">פעיל</Badge>;
  };

  const getExpiryText = (invitation: InvitationWithDetails): string => {
    if (invitation.isExpired) {
      return 'פג תוקף';
    }
    
    if (invitation.daysUntilExpiry === 0) {
      return 'פג היום';
    }
    
    if (invitation.daysUntilExpiry === 1) {
      return 'פג מחר';
    }
    
    return `פג בעוד ${invitation.daysUntilExpiry} ימים`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ניהול הזמנות ידני</CardTitle>
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
                <MailPlus className="h-5 w-5" />
                ניהול הזמנות ידני
              </CardTitle>
              <CardDescription>
                יצירה וניהול הזמנות משתמשים עם קודי הזמנה ידניים
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto">
              <UserPlus className="h-4 w-4 mr-2" />
              הזמנה חדשה
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MailPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">אין הזמנות פעילות</h3>
              <p className="text-sm mb-4">צור הזמנה חדשה כדי להתחיל</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
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
                    <TableHead>קוד הזמנה</TableHead>
                    <TableHead>תאריך יצירה</TableHead>
                    <TableHead>תוקף</TableHead>
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
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {invitation.invitationCode}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyInvitationCode(invitation.invitationCode)}
                          >
                            {copiedCode === invitation.invitationCode ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {invitation.createdAt.toDate().toLocaleDateString('he-IL')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{getExpiryText(invitation)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invitation)}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2 rtl:space-x-reverse">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewInvitationDetails(invitation)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setInvitationToDelete(invitation.id);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Create Invitation Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>הזמן משתמש חדש</DialogTitle>
            <DialogDescription>
              צור הזמנה חדשה עם קוד הזמנה ידני
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">כתובת אימייל *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="role">תפקיד *</Label>
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
              <Label htmlFor="welcomeMessage">הודעה אישית (אופציונלי)</Label>
              <Textarea
                id="welcomeMessage"
                placeholder="הודעת ברכה או הסבר נוסף..."
                value={inviteForm.welcomeMessage}
                onChange={(e) => setInviteForm(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                rows={3}
              />
            </div>

            {inviteForm.role === 'parent' && (
              <div>
                <Label htmlFor="babyProfileId">מזהה תינוק (אופציונלי)</Label>
                <Input
                  id="babyProfileId"
                  placeholder="מזהה תינוק קיים"
                  value={inviteForm.babyProfileId}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, babyProfileId: e.target.value }))}
                />
              </div>
            )}

            {inviteForm.role === 'parent' && (
              <div>
                <Label htmlFor="assignedCoachId">מזהה יועץ מוקצה (אופציונלי)</Label>
                <Input
                  id="assignedCoachId"
                  placeholder="מזהה יועץ"
                  value={inviteForm.assignedCoachId}
                  onChange={(e) => setInviteForm(prev => ({ ...prev, assignedCoachId: e.target.value }))}
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreating}
            >
              ביטול
            </Button>
            <Button 
              onClick={handleCreateInvitation}
              disabled={!inviteForm.email || !inviteForm.role || isCreating}
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  יוצר הזמנה...
                </>
              ) : (
                <>
                  <MailPlus className="h-4 w-4 mr-2" />
                  צור הזמנה
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invitation Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>פרטי הזמנה</DialogTitle>
            <DialogDescription>
              {selectedInvitation?.email}
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvitation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">אימייל</Label>
                  <p className="text-sm text-muted-foreground">{selectedInvitation.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">תפקיד</Label>
                  <p className="text-sm text-muted-foreground">
                    {getRoleDisplayName(selectedInvitation.role)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">קוד הזמנה</Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                      {selectedInvitation.invitationCode}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyInvitationCode(selectedInvitation.invitationCode)}
                    >
                      {copiedCode === selectedInvitation.invitationCode ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">תאריך יצירה</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedInvitation.createdAt.toDate().toLocaleString('he-IL')}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">תוקף</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedInvitation.expiresAt.toDate().toLocaleString('he-IL')}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">סטטוס</Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedInvitation)}
                  </div>
                </div>
              </div>
              
              {selectedInvitation.metadata.welcomeMessage && (
                <div>
                  <Label className="text-sm font-medium">הודעה אישית</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedInvitation.metadata.welcomeMessage}
                  </p>
                </div>
              )}

              {selectedInvitation.metadata.babyProfileId && (
                <div>
                  <Label className="text-sm font-medium">מזהה תינוק</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedInvitation.metadata.babyProfileId}
                  </p>
                </div>
              )}

              {selectedInvitation.metadata.assignedCoachId && (
                <div>
                  <Label className="text-sm font-medium">יועץ מוקצה</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedInvitation.metadata.assignedCoachId}
                  </p>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">הוראות שימוש</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      העתק את קוד ההזמנה ושלח אותו למשתמש. המשתמש יוכל להשתמש בקוד זה כדי להירשם למערכת.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>בטל הזמנה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך לבטל את ההזמנה? פעולה זו לא ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvitation}>
              בטל הזמנה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

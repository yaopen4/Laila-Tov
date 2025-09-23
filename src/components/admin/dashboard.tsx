// Admin Dashboard with Advanced RBAC Features
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, 
  Shield, 
  Activity, 
  AlertTriangle, 
  UserCheck, 
  Mail,
  MailPlus,
  Settings,
  Download,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  FileText
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { AuthService } from '@/services/authService';
import { RoleService } from '@/services/roleService';
import { AuditLogger } from '@/services/auditLogger';
import { UserManagement } from './user-management';
import { AuditLogViewer } from './audit-log-viewer';
import { ManualInvitationManager } from './manual-invitation-manager';
import { EmailTemplateManager } from './email-template-manager';
import type { 
  User, 
  Invitation, 
  AuditLogEntry,
  Role
} from '@/types/auth';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingInvitations: number;
  securityAlerts: number;
  totalRoles: number;
  auditEvents24h: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingInvitations: 0,
    securityAlerts: 0,
    totalRoles: 0,
    auditEvents24h: 0
  });
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Verify admin access
      await AuthService.ensureAdminAccess();
      
      // Load all data in parallel
      await Promise.all([
        loadUsers(),
        loadInvitations(),
        loadAuditLogs(),
        loadRoles(),
        loadStats()
      ]);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "שגיאה בטעינת נתונים",
        description: "לא ניתן היה לטעון את נתוני הדשבורד",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.organizationId) return;
      
      const { OrganizationService } = await import('@/services/organizationService');
      const organizationUsers = await OrganizationService.getOrganizationUsers(currentUser.organizationId);
      setUsers(organizationUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadInvitations = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.organizationId) return;
      
      const { OrganizationService } = await import('@/services/organizationService');
      const organizationInvitations = await OrganizationService.getOrganizationInvitations(currentUser.organizationId);
      setInvitations(organizationInvitations);
    } catch (error) {
      console.error('Error loading invitations:', error);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.organizationId) return;
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const auditResult = await AuditLogger.searchAuditLogs({
        organizationId: currentUser.organizationId,
        startDate: yesterday,
        endDate: new Date(),
        limitCount: 10
      });
      
      setAuditLogs(auditResult.logs);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  };

  const loadRoles = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.organizationId) return;
      
      const rolesQuery = query(
        collection(db, 'roles'),
        where('organizationId', '==', currentUser.organizationId),
        where('isActive', '==', true)
      );
      
      const snapshot = await getDocs(rolesQuery);
      const organizationRoles = snapshot.docs.map(doc => doc.data() as Role);
      setRoles(organizationRoles);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const loadStats = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.organizationId) return;
      
      const { OrganizationService } = await import('@/services/organizationService');
      const orgStats = await OrganizationService.getOrganizationStats(currentUser.organizationId);
      
      // Get recent audit events count
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const auditResult = await AuditLogger.searchAuditLogs({
        organizationId: currentUser.organizationId,
        startDate: yesterday,
        endDate: new Date()
      });
      
      // Count security alerts
      const securityAlerts = auditResult.logs.filter(log => 
        log.category === 'security' && log.severity === 'high'
      ).length;
      
      setStats({
        totalUsers: orgStats.totalUsers,
        activeUsers: orgStats.activeUsers,
        pendingInvitations: orgStats.pendingInvitations,
        securityAlerts: securityAlerts,
        totalRoles: roles.length,
        auditEvents24h: auditResult.logs.length
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleCreateInvitation = async () => {
    // Navigate to invitation creation
    toast({
      title: "יצירת הזמנה",
      description: "מעביר לדף יצירת הזמנה חדשה",
      variant: "default"
    });
  };

  const handleGenerateAuditReport = async () => {
    try {
      const result = await AuditLogger.generateComplianceReport({
        organizationId: 'current-org',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate: new Date(),
        userId: 'current-user-id',
        reportType: 'full'
      });

      toast({
        title: "דוח ביקורת נוצר",
        description: `דוח ${result.reportId} נוצר בהצלחה`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "שגיאה ביצירת דוח",
        description: "לא ניתן היה ליצור דוח ביקורת",
        variant: "destructive"
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">לוח בקרה - מנהל מערכת</h1>
          <p className="text-muted-foreground">ניהול משתמשים, הרשאות וביקורת מערכת</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 rtl:space-x-reverse">
          <Button onClick={handleGenerateAuditReport} variant="outline" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            יצירת דוח ביקורת
          </Button>
          <Button onClick={handleCreateInvitation} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            הזמנה חדשה
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה״כ משתמשים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              +2 מהחודש הקודם
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">משתמשים פעילים</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              92% מסך המשתמשים
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">הזמנות ממתינות</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingInvitations}</div>
            <p className="text-xs text-muted-foreground">
              צריכות טיפול
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">התראות אבטחה</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.securityAlerts}</div>
            <p className="text-xs text-muted-foreground">
              דורש בדיקה
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">תפקידים</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRoles}</div>
            <p className="text-xs text-muted-foreground">
              כולל מותאמים אישית
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">אירועי ביקורת</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.auditEvents24h}</div>
            <p className="text-xs text-muted-foreground">
              ב-24 השעות האחרונות
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts */}
      {stats.securityAlerts > 0 && (
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            יש {stats.securityAlerts} התראות אבטחה שדורשות טיפול מיידי.{' '}
            <Button variant="link" className="p-0 h-auto">
              צפה בפרטים
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7">
          <TabsTrigger value="overview">סקירה כללית</TabsTrigger>
          <TabsTrigger value="users">ניהול משתמשים</TabsTrigger>
          <TabsTrigger value="invitations">הזמנות אימייל</TabsTrigger>
          <TabsTrigger value="manual-invitations">הזמנות ידניות</TabsTrigger>
          <TabsTrigger value="email-templates">תבניות אימייל</TabsTrigger>
          <TabsTrigger value="roles">ניהול תפקידים</TabsTrigger>
          <TabsTrigger value="audit">יומני ביקורת</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>פעילות אחרונה</CardTitle>
                <CardDescription>אירועים חשובים מהשעות האחרונות</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { time: '10:30', event: 'משתמש חדש נרשם - sarah@example.com', type: 'success' },
                    { time: '09:15', event: 'ניסיון התחברות כושל מ-IP 192.168.1.100', type: 'warning' },
                    { time: '08:45', event: 'הזמנה חדשה נשלחה - coach@clinic.com', type: 'info' },
                    { time: '08:30', event: 'דוח ביקורת נוצר על ידי admin@system.com', type: 'info' }
                  ].map((activity, index) => (
                    <div key={index} className="flex items-center space-x-3 rtl:space-x-reverse">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.type === 'success' ? 'bg-green-500' :
                        activity.type === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <div className="text-sm">{activity.event}</div>
                        <div className="text-xs text-muted-foreground">{activity.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle>בריאות המערכת</CardTitle>
                <CardDescription>מצב מרכיבי המערכת השונים</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { component: 'Firebase Authentication', status: 'תקין', health: 'good' },
                    { component: 'Firestore Database', status: 'תקין', health: 'good' },
                    { component: 'Cloud Functions', status: 'תקין', health: 'good' },
                    { component: 'Email Service', status: 'בדיקה', health: 'warning' }
                  ].map((system, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-sm">{system.component}</span>
                      <Badge variant={system.health === 'good' ? 'default' : 'secondary'}>
                        {system.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserManagement />
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailPlus className="h-6 w-6" />
                ניהול הזמנות (אוטומטי)
              </CardTitle>
              <CardDescription>
                הזמנות שנשלחות אוטומטית באימייל
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">הזמנות פעילות</h3>
                    <p className="text-sm text-muted-foreground">
                      {invitations.length} הזמנות פעילות
                    </p>
                  </div>
                  <Button onClick={handleCreateInvitation} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    הזמנה חדשה
                  </Button>
                </div>
                
                <div className="border rounded-lg">
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
                            <Badge variant="outline">{invitation.role}</Badge>
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
                            <div className="flex gap-2">
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
                  
                  {invitations.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      אין הזמנות פעילות
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual-invitations" className="space-y-4">
          <ManualInvitationManager />
        </TabsContent>

        <TabsContent value="email-templates" className="space-y-4">
          <EmailTemplateManager />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>ניהול תפקידים והרשאות</CardTitle>
                  <CardDescription>צור ונהל תפקידים עם הרשאות מותאמות אישית</CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  תפקיד חדש
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                ניהול תפקידים - בפיתוח
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditLogViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}


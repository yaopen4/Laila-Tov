// Audit Log Viewer Component
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Activity, 
  Download, 
  Search, 
  Filter,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { format } from "date-fns";
import { he } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { AuthService } from '@/services/authService';
import { AuditLogger } from '@/services/auditLogger';
import type { AuditLogEntry, AuditCategory, AuditAction } from '@/types/auth';

interface AuditFilters {
  category?: AuditCategory;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  action?: AuditAction;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  successOnly?: boolean;
}

export function AuditLogViewer() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    loadAuditLogs();
  }, [filters, currentPage]);

  const loadAuditLogs = async () => {
    try {
      setIsLoading(true);
      
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.organizationId) return;

      // searchAuditLogs takes arrays for action/category/severity; the filter UI
      // holds a single value for each.
      const result = await AuditLogger.searchAuditLogs({
        organizationId: currentUser.organizationId,
        userId: filters.userId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        successOnly: filters.successOnly,
        categories: filters.category ? [filters.category] : undefined,
        severity: filters.severity ? [filters.severity] : undefined,
        actions: filters.action ? [filters.action] : undefined,
        limitCount: 50,
        offset: (currentPage - 1) * 50
      });

      setAuditLogs(result.logs);
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
      
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast({
        title: "שגיאה בטעינת יומני ביקורת",
        description: "לא ניתן היה לטעון את יומני הביקורת",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser?.organizationId) return;

      const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = filters.endDate || new Date();

      const result = await AuditLogger.generateComplianceReport({
        organizationId: currentUser.organizationId,
        startDate,
        endDate,
        userId: currentUser.uid,
        reportType: 'full'
      });

      // Download the report
      const link = document.createElement('a');
      link.href = result.downloadUrl;
      link.download = `audit-report-${result.reportId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "דוח ביקורת נוצר",
        description: `דוח ${result.reportId} הורד בהצלחה`,
        variant: "default"
      });
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "שגיאה ביצירת דוח",
        description: "לא ניתן היה ליצור דוח ביקורת",
        variant: "destructive"
      });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'secondary';
      case 'medium':
        return 'outline';
      default:
        return 'default';
    }
  };

  const filteredLogs = auditLogs.filter(log =>
    log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details?.toString().toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                יומני ביקורת
              </CardTitle>
              <CardDescription>
                עקוב אחר כל הפעילויות במערכת ({totalCount} אירועים)
              </CardDescription>
            </div>
            <div className="flex space-x-2 rtl:space-x-reverse">
              <Button variant="outline" onClick={handleGenerateReport}>
                <Download className="h-4 w-4 mr-2" />
                ייצא דוח
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted rounded-lg">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חפש באירועים..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select
              value={filters.category || 'all'}
              onValueChange={(value) => 
                setFilters(prev => ({ 
                  ...prev, 
                  category: value === 'all' ? undefined : value as AuditCategory 
                }))
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="קטגוריה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקטגוריות</SelectItem>
                <SelectItem value="authentication">אימות</SelectItem>
                <SelectItem value="user_management">ניהול משתמשים</SelectItem>
                <SelectItem value="data_access">גישה לנתונים</SelectItem>
                <SelectItem value="security">אבטחה</SelectItem>
                <SelectItem value="system_admin">ניהול מערכת</SelectItem>
              </SelectContent>
            </Select>
            
            <Select
              value={filters.severity || 'all'}
              onValueChange={(value) => 
                setFilters(prev => ({ 
                  ...prev, 
                  severity: value === 'all' ? undefined : value as any 
                }))
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="חומרה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="low">נמוכה</SelectItem>
                <SelectItem value="medium">בינונית</SelectItem>
                <SelectItem value="high">גבוהה</SelectItem>
                <SelectItem value="critical">קריטית</SelectItem>
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  תאריכים
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={{
                    from: filters.startDate,
                    to: filters.endDate
                  }}
                  onSelect={(range) => {
                    setFilters(prev => ({
                      ...prev,
                      startDate: range?.from,
                      endDate: range?.to
                    }));
                  }}
                  locale={he}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Audit Logs Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>זמן</TableHead>
                <TableHead>משתמש</TableHead>
                <TableHead>פעולה</TableHead>
                <TableHead>קטגוריה</TableHead>
                <TableHead>חומרה</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>פרטים</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <div className="animate-pulse h-4 bg-gray-200 rounded"></div>
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm || Object.keys(filters).length > 0 
                      ? 'לא נמצאו אירועים התואמים לחיפוש' 
                      : 'אין אירועי ביקורת להצגה'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm">
                        {format(log.timestamp.toDate(), 'dd/MM/yyyy', { locale: he })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(log.timestamp.toDate(), 'HH:mm:ss')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{log.userEmail}</div>
                      <div className="text-xs text-muted-foreground">{log.userRole}</div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {log.action}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(log.severity)}
                        <Badge variant={getSeverityVariant(log.severity) as any}>
                          {log.severity}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <details className="cursor-pointer">
                          <summary className="text-sm text-muted-foreground hover:text-foreground">
                            צפה בפרטים
                          </summary>
                          <div className="mt-2 p-2 bg-muted rounded text-xs">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                            {log.errorMessage && (
                              <div className="mt-2 text-red-600">
                                <strong>שגיאה:</strong> {log.errorMessage}
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalCount > 50 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-muted-foreground">
                מציג {(currentPage - 1) * 50 + 1}-{Math.min(currentPage * 50, totalCount)} מתוך {totalCount} אירועים
              </div>
              <div className="flex space-x-2 rtl:space-x-reverse">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  הקודם
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={!hasMore}
                >
                  הבא
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

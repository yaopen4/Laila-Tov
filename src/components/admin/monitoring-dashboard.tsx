/**
 * @fileoverview Admin monitoring dashboard for viewing application logs and audit trails
 * Provides real-time monitoring, error tracking, and system health overview
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Activity, 
  Users, 
  Clock, 
  Download, 
  RefreshCw,
  Shield,
  Database,
  Zap
} from 'lucide-react';
import { logger } from '@/services/loggingService';
import { LogLevel, EventCategory, LogEntry, AuditLogEntry } from '@/types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface MonitoringStats {
  totalLogs: number;
  errorCount: number;
  warningCount: number;
  criticalCount: number;
  activeUsers: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export function MonitoringDashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<MonitoringStats>({
    totalLogs: 0,
    errorCount: 0,
    warningCount: 0,
    criticalCount: 0,
    activeUsers: 0,
    systemHealth: 'healthy'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  useEffect(() => {
    loadDashboardData();
    
    // Set up real-time updates every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Load recent logs and audit logs
      const [recentLogs, recentAuditLogs] = await Promise.all([
        logger.getRecentLogs(100),
        logger.getRecentAuditLogs(50)
      ]);

      setLogs(recentLogs);
      setAuditLogs(recentAuditLogs);

      // Calculate stats
      const errorCount = recentLogs.filter(log => log.level === LogLevel.ERROR).length;
      const warningCount = recentLogs.filter(log => log.level === LogLevel.WARN).length;
      const criticalCount = recentLogs.filter(log => log.level === LogLevel.CRITICAL).length;
      
      // Estimate active users from recent authentication logs
      const activeUsers = new Set(
        recentLogs
          .filter(log => log.category === EventCategory.AUTHENTICATION && log.userId)
          .map(log => log.userId)
      ).size;

      // Determine system health
      let systemHealth: MonitoringStats['systemHealth'] = 'healthy';
      if (criticalCount > 0) {
        systemHealth = 'critical';
      } else if (errorCount > 10 || warningCount > 20) {
        systemHealth = 'warning';
      }

      setStats({
        totalLogs: recentLogs.length,
        errorCount,
        warningCount,
        criticalCount,
        activeUsers,
        systemHealth
      });
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        logs,
        auditLogs,
        stats
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laila-tov-logs-${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log the export action
      await logger.info('Admin exported system logs', EventCategory.SYSTEM, {
        exportedLogCount: logs.length,
        exportedAuditLogCount: auditLogs.length,
        timeRange: selectedTimeRange
      });
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const getLogLevelBadge = (level: LogLevel) => {
    const variants = {
      [LogLevel.DEBUG]: 'secondary',
      [LogLevel.INFO]: 'default',
      [LogLevel.WARN]: 'default',
      [LogLevel.ERROR]: 'destructive',
      [LogLevel.CRITICAL]: 'destructive'
    } as const;

    const colors = {
      [LogLevel.DEBUG]: 'bg-gray-100 text-gray-800',
      [LogLevel.INFO]: 'bg-blue-100 text-blue-800',
      [LogLevel.WARN]: 'bg-yellow-100 text-yellow-800',
      [LogLevel.ERROR]: 'bg-red-100 text-red-800',
      [LogLevel.CRITICAL]: 'bg-red-200 text-red-900'
    };

    return (
      <Badge variant={variants[level]} className={colors[level]}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  const getSystemHealthIndicator = () => {
    const indicators = {
      healthy: { color: 'text-green-600', bg: 'bg-green-100', text: 'תקין' },
      warning: { color: 'text-yellow-600', bg: 'bg-yellow-100', text: 'אזהרה' },
      critical: { color: 'text-red-600', bg: 'bg-red-100', text: 'קריטי' }
    };

    const indicator = indicators[stats.systemHealth];

    return (
      <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${indicator.bg}`}>
        <div className={`w-2 h-2 rounded-full ${indicator.color.replace('text-', 'bg-')}`} />
        <span className={`text-sm font-medium ${indicator.color}`}>
          {indicator.text}
        </span>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">מוקד ניטור מערכת</h1>
          <p className="text-gray-600 mt-1">
            ניטור בזמן אמת של מערכת לילה טוב
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {getSystemHealthIndicator()}
          <Button onClick={loadDashboardData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            רענן
          </Button>
          <Button onClick={handleExportLogs} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            ייצא לוגים
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סך הכל לוגים</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLogs}</div>
            <p className="text-xs text-muted-foreground">ב-24 השעות האחרונות</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">שגיאות</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.errorCount + stats.criticalCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.criticalCount} קריטיות, {stats.errorCount} רגילות
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">משתמשים פעילים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">ב-24 השעות האחרונות</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">אזהרות</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.warningCount}</div>
            <p className="text-xs text-muted-foreground">דורשות תשומת לב</p>
          </CardContent>
        </Card>
      </div>

      {/* Logs Tabs */}
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="logs" className="flex items-center space-x-2">
            <Database className="w-4 h-4" />
            <span>לוגים כלליים</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>לוגי ביקורת</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>ביצועים</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>לוגים אחרונים</CardTitle>
              <CardDescription>
                {logs.length} לוגים אחרונים מהמערכת
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getLogLevelBadge(log.level)}
                        {log.category && (
                          <Badge variant="outline">{log.category}</Badge>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {format(log.timestamp, 'HH:mm:ss dd/MM/yyyy', { locale: he })}
                      </span>
                    </div>
                    <p className="text-sm">{log.message}</p>
                    {log.userId && (
                      <p className="text-xs text-gray-600">משתמש: {log.userId}</p>
                    )}
                    {log.error && (
                      <div className="text-xs bg-red-50 p-2 rounded">
                        <span className="font-medium">שגיאה:</span> {log.error.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>לוגי ביקורת</CardTitle>
              <CardDescription>
                פעולות רגישות ושינויים במערכת
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {auditLogs.map((log, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant={log.success ? "default" : "destructive"}>
                          {log.eventType}
                        </Badge>
                        {log.resourceType && (
                          <Badge variant="outline">{log.resourceType}</Badge>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {format(log.timestamp, 'HH:mm:ss dd/MM/yyyy', { locale: he })}
                      </span>
                    </div>
                    <p className="text-sm">{log.message}</p>
                    {log.userId && (
                      <p className="text-xs text-gray-600">משתמש: {log.userId}</p>
                    )}
                    {log.resourceId && (
                      <p className="text-xs text-gray-600">משאב: {log.resourceId}</p>
                    )}
                    {log.duration && (
                      <p className="text-xs text-gray-600">זמן ביצוע: {log.duration}ms</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>מדדי ביצועים</CardTitle>
              <CardDescription>
                ביצועי המערכת וזמני תגובה
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {logs
                  .filter(log => log.category === EventCategory.PERFORMANCE)
                  .slice(0, 20)
                  .map((log, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{log.message}</span>
                        <span className="text-sm text-gray-500">
                          {format(log.timestamp, 'HH:mm:ss', { locale: he })}
                        </span>
                      </div>
                      {log.metadata?.duration && (
                        <div className="text-sm">
                          <span className="text-gray-600">זמן ביצוע: </span>
                          <span className={`font-medium ${
                            log.metadata.duration > 5000 ? 'text-red-600' : 
                            log.metadata.duration > 2000 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {log.metadata.duration}ms
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MonitoringDashboard;

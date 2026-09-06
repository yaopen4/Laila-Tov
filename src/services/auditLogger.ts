// Comprehensive Audit Logging Service
import { 
  doc, 
  collection, 
  setDoc, 
  query, 
  where, 
  getDocs, 
  getDoc,
  orderBy, 
  limit, 
  startAfter,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { 
  AuditLogEntry, 
  AuditAction, 
  AuditCategory,
  User,
  AuditReportSummary 
} from '@/types/auth';

export class AuditLogger {
  
  /**
   * Log an audit event
   */
  static async log(params: {
    action: AuditAction;
    userId: string;
    targetType?: AuditLogEntry['targetType'];
    targetId?: string;
    targetUserId?: string;
    details?: Record<string, any>;
    success?: boolean;
    errorMessage?: string;
    previousValues?: Record<string, any>;
    newValues?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      // Get user context (Firestore v9 modular API)
      const userSnap = await getDoc(doc(db, 'users', params.userId));
      
      const user = userSnap.exists() ? userSnap.data() as User : null;
      
      const auditEntry: AuditLogEntry = {
        id: doc(collection(db, 'audit_logs')).id,
        timestamp: Timestamp.now(),
        
        // Actor information
        userId: params.userId,
        userEmail: user?.email || 'unknown',
        userRole: user?.role || 'unknown',
        organizationId: user?.organizationId || 'unknown',
        
        // Action details
        action: params.action,
        category: this.categorizeAction(params.action),
        severity: this.determineSeverity(params.action, params.success),
        
        // Target information
        targetType: params.targetType,
        targetId: params.targetId,
        targetUserId: params.targetUserId,
        
        // Context
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        sessionId: this.generateSessionId(params.userId),
        
        // Details
        details: params.details || {},
        success: params.success !== false, // Default to true if not specified
        errorMessage: params.errorMessage,
        previousValues: params.previousValues,
        newValues: params.newValues
      };
      
      // Store in appropriate collection based on sensitivity
      const collectionName = this.getAuditCollection(auditEntry.category, auditEntry.severity);
      
      await setDoc(
        doc(db, collectionName, auditEntry.id),
        auditEntry
      );
      
      // Check for security alerts
      await this.checkSecurityAlerts(auditEntry);
      
      // Real-time monitoring for critical events
      if (auditEntry.severity === 'critical') {
        await this.triggerRealTimeAlert(auditEntry);
      }
      
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - logging failure shouldn't break application flow
      await this.logToBackupSystem(params, error);
    }
  }

  /**
   * Log user session activity
   */
  static async logSession(params: {
    userId: string;
    action: 'login' | 'logout' | 'session_expired';
    ipAddress?: string;
    userAgent?: string;
    loginMethod?: 'email' | 'google' | 'microsoft';
    success?: boolean;
    failureReason?: string;
  }): Promise<void> {
    const sessionDetails = {
      loginMethod: params.loginMethod,
      failureReason: params.failureReason,
      browserInfo: this.parseBrowserInfo(params.userAgent),
      location: await this.getLocationFromIP(params.ipAddress)
    };

    await this.log({
      action: params.action === 'login' ? 
        (params.success ? 'user_login' : 'user_login_failed') : 
        params.action === 'logout' ? 'user_logout' : 'user_login_failed',
      userId: params.userId,
      details: sessionDetails,
      success: params.success,
      errorMessage: params.failureReason,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Log data access events
   */
  static async logDataAccess(params: {
    userId: string;
    targetType: 'baby_profile' | 'sleep_log' | 'user' | 'report';
    targetId: string;
    action: 'read' | 'write' | 'delete' | 'export';
    dataScope?: string; // e.g., "last_30_days", "all_data"
    recordCount?: number;
    ipAddress?: string;
  }): Promise<void> {
    await this.log({
      action: 'data_accessed',
      userId: params.userId,
      targetType: params.targetType,
      targetId: params.targetId,
      details: {
        accessType: params.action,
        dataScope: params.dataScope,
        recordCount: params.recordCount,
        timestamp: new Date().toISOString()
      },
      ipAddress: params.ipAddress
    });
  }

  /**
   * Log data modifications with before/after values
   */
  static async logDataModification(params: {
    userId: string;
    action: AuditAction;
    targetType: AuditLogEntry['targetType'];
    targetId: string;
    previousValues: Record<string, any>;
    newValues: Record<string, any>;
    changeReason?: string;
  }): Promise<void> {
    // Calculate what actually changed
    const changes = this.calculateChanges(params.previousValues, params.newValues);
    
    await this.log({
      action: params.action,
      userId: params.userId,
      targetType: params.targetType,
      targetId: params.targetId,
      previousValues: params.previousValues,
      newValues: params.newValues,
      details: {
        changedFields: Object.keys(changes),
        changeCount: Object.keys(changes).length,
        changeReason: params.changeReason,
        significantChanges: this.identifySignificantChanges(changes, params.targetType)
      }
    });
  }

  /**
   * Log security events
   */
  static async logSecurityEvent(params: {
    userId?: string;
    action: AuditAction;
    severity: 'medium' | 'high' | 'critical';
    details: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    automaticResponse?: string;
  }): Promise<void> {
    await this.log({
      action: params.action,
      userId: params.userId || 'system',
      details: {
        ...params.details,
        automaticResponse: params.automaticResponse,
        detectionTime: new Date().toISOString()
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent
    });
  }

  /**
   * Generate audit report for compliance
   */
  static async generateComplianceReport(params: {
    organizationId: string;
    startDate: Date;
    endDate: Date;
    userId: string;
    reportType: 'security' | 'data_access' | 'user_activity' | 'full';
  }): Promise<{
    reportId: string;
    downloadUrl: string;
    summary: AuditReportSummary;
  }> {
    // Log the report generation
    await this.log({
      action: 'report_generated',
      userId: params.userId,
      details: {
        reportType: params.reportType,
        dateRange: {
          start: params.startDate.toISOString(),
          end: params.endDate.toISOString()
        },
        organizationId: params.organizationId
      }
    });

    // Query audit logs based on report type
    const queryRef = this.buildReportQuery(params);
    const auditLogs = await getDocs(queryRef);
    
    // Generate report data
    const reportData = this.processAuditLogsForReport(auditLogs.docs, params.reportType);
    
    // Create report document
    const reportId = doc(collection(db, 'compliance_reports')).id;
    const reportDoc = {
      id: reportId,
      organizationId: params.organizationId,
      generatedBy: params.userId,
      generatedAt: Timestamp.now(),
      reportType: params.reportType,
      dateRange: {
        start: Timestamp.fromDate(params.startDate),
        end: Timestamp.fromDate(params.endDate)
      },
      summary: this.generateReportSummary(reportData),
      data: reportData
    };
    
    // The report is generated for immediate download and not persisted:
    // firestore.rules denies clients any write to compliance_reports, so this
    // setDoc always failed. Persisting it would need a server route; nothing
    // currently reads stored reports back.

    // Generate downloadable file (PDF/Excel)
    const downloadUrl = await this.generateReportFile(reportDoc);
    
    return {
      reportId,
      downloadUrl,
      summary: reportDoc.summary
    };
  }

  /**
   * Search audit logs with advanced filtering
   */
  static async searchAuditLogs(params: {
    organizationId: string;
    userId?: string;
    targetUserId?: string;
    actions?: AuditAction[];
    categories?: AuditCategory[];
    severity?: ('low' | 'medium' | 'high' | 'critical')[];
    startDate?: Date;
    endDate?: Date;
    targetType?: AuditLogEntry['targetType'];
    targetId?: string;
    successOnly?: boolean;
    ipAddress?: string;
    limitCount?: number;
    offset?: number;
  }): Promise<{
    logs: AuditLogEntry[];
    totalCount: number;
    hasMore: boolean;
  }> {
    let queryRef = query(
      collection(db, 'audit_logs'),
      where('organizationId', '==', params.organizationId)
    );

    // Apply filters
    if (params.userId) {
      queryRef = query(queryRef, where('userId', '==', params.userId));
    }
    
    if (params.targetUserId) {
      queryRef = query(queryRef, where('targetUserId', '==', params.targetUserId));
    }
    
    if (params.actions && params.actions.length > 0) {
      queryRef = query(queryRef, where('action', 'in', params.actions));
    }
    
    if (params.categories && params.categories.length > 0) {
      queryRef = query(queryRef, where('category', 'in', params.categories));
    }
    
    if (params.startDate) {
      queryRef = query(queryRef, where('timestamp', '>=', Timestamp.fromDate(params.startDate)));
    }
    
    if (params.endDate) {
      queryRef = query(queryRef, where('timestamp', '<=', Timestamp.fromDate(params.endDate)));
    }
    
    if (params.successOnly !== undefined) {
      queryRef = query(queryRef, where('success', '==', params.successOnly));
    }

    // Order and paginate
    queryRef = query(queryRef, orderBy('timestamp', 'desc'));
    
    const limitCount = params.limitCount || 50;
    queryRef = query(queryRef, limit(limitCount + 1)); // Get one extra to check if there are more

    const snapshot = await getDocs(queryRef);
    const logs = snapshot.docs.slice(0, limitCount).map(doc => doc.data() as AuditLogEntry);
    const hasMore = snapshot.docs.length > limitCount;

    return {
      logs,
      totalCount: await this.getAuditLogCount(params.organizationId, params),
      hasMore
    };
  }

  // Private helper methods

  /**
   * Categorize action for proper indexing and filtering
   */
  private static categorizeAction(action: AuditAction): AuditCategory {
    const categoryMap: Record<AuditAction, AuditCategory> = {
      // Authentication
      'user_login': 'authentication',
      'user_logout': 'authentication',
      'user_login_failed': 'security',
      'password_changed': 'security',
      'password_reset_requested': 'security',
      'password_reset_completed': 'security',
      
      // User Management
      'user_registered': 'user_management',
      'user_deactivated': 'user_management',
      'role_assigned': 'user_management',
      'role_unassigned': 'user_management',
      
      // Data Access
      'data_accessed': 'data_access',
      'sleep_data_exported': 'data_access',
      'report_generated': 'data_access',
      
      // Data Modification
      'sleep_log_created': 'data_modification',
      'sleep_log_updated': 'data_modification',
      'baby_profile_created': 'data_modification',
      'baby_profile_updated': 'data_modification',
      
      // Security
      'unauthorized_access_attempt': 'security',
      'suspicious_activity_blocked': 'security',
      'security_incident_detected': 'security',
      
      // System Admin
      'organization_settings_updated': 'system_admin',
      'system_bootstrapped': 'system_admin',
      'role_created': 'system_admin',
      'system_backup_created': 'system_admin',
      
      // Additional mappings for all other actions...
      'invitation_created': 'user_management',
      'invitation_sent': 'user_management',
      'invitation_accepted': 'user_management',
      'invitation_expired': 'user_management',
      'invitation_cancelled': 'user_management',
      'invitation_resent': 'user_management',
      'role_updated': 'system_admin',
      'role_deleted': 'system_admin',
      'permission_granted': 'user_management',
      'permission_revoked': 'user_management',
      'baby_profile_archived': 'data_modification',
      'baby_profile_transferred': 'data_modification',
      'baby_profile_deleted': 'data_modification',
      'baby_profile_restored': 'data_modification',
      'parent_added_to_baby': 'data_modification',
      'parent_removed_from_baby': 'data_modification',
      'sleep_log_deleted': 'data_modification',
      'sleep_data_imported': 'data_modification',
      'recommendation_created': 'data_modification',
      'recommendation_updated': 'data_modification',
      'recommendation_viewed': 'data_access',
      'consultation_note_added': 'data_modification',
      'report_exported': 'data_access',
      'report_shared': 'data_access',
      'dashboard_viewed': 'data_access',
      'analytics_accessed': 'data_access',
      'data_migration_started': 'system_admin',
      'data_migration_completed': 'system_admin',
      'data_download_requested': 'data_access',
      'bulk_data_operation': 'data_modification',
      'sensitive_data_viewed': 'data_access'
    };
    
    return categoryMap[action] || 'system_admin';
  }

  /**
   * Determine severity level based on action and success
   */
  private static determineSeverity(
    action: AuditAction, 
    success?: boolean
  ): AuditLogEntry['severity'] {
    // Critical events
    const criticalActions: AuditAction[] = [
      'security_incident_detected', 'unauthorized_access_attempt',
      'data_migration_started', 'system_backup_created'
    ];
    
    // High severity events
    const highActions: AuditAction[] = [
      'user_deactivated', 'role_created', 'organization_settings_updated',
      'bulk_data_operation', 'sensitive_data_viewed'
    ];
    
    // Medium severity events
    const mediumActions: AuditAction[] = [
      'baby_profile_created', 'baby_profile_archived', 'sleep_data_exported',
      'user_login_failed', 'password_changed'
    ];
    
    if (criticalActions.includes(action)) return 'critical';
    if (highActions.includes(action)) return 'high';
    if (mediumActions.includes(action)) return 'medium';
    
    // Failed operations are higher severity
    if (success === false) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Get appropriate collection based on data sensitivity
   */
  private static getAuditCollection(
    category: AuditCategory, 
    severity: AuditLogEntry['severity']
  ): string {
    // Store high-sensitivity data in separate collections for better security
    if (severity === 'critical' || category === 'security') {
      return 'audit_logs_security';
    }
    
    if (category === 'compliance' || severity === 'high') {
      return 'audit_logs_compliance';
    }
    
    return 'audit_logs';
  }

  /**
   * Generate session ID for tracking
   */
  private static generateSessionId(userId: string): string {
    return `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check for security alerts and patterns
   */
  private static async checkSecurityAlerts(auditEntry: AuditLogEntry): Promise<void> {
    // Check for failed login attempts pattern
    if (auditEntry.action === 'user_login_failed') {
      await this.checkFailedLoginPattern(auditEntry);
    }
    
    // Check for unusual data access patterns
    if (auditEntry.category === 'data_access') {
      await this.checkDataAccessPatterns(auditEntry);
    }
    
    // Check for privilege escalation attempts
    if (auditEntry.action === 'role_assigned' || auditEntry.action === 'permission_granted') {
      await this.checkPrivilegeEscalation(auditEntry);
    }
  }

  private static async checkFailedLoginPattern(auditEntry: AuditLogEntry): Promise<void> {
    // Get recent failed login attempts for this IP/user
    const recentAttempts = await getDocs(
      query(
        collection(db, 'audit_logs'),
        where('action', '==', 'user_login_failed'),
        where('ipAddress', '==', auditEntry.ipAddress),
        where('timestamp', '>=', Timestamp.fromDate(new Date(Date.now() - 15 * 60 * 1000))) // 15 minutes
      )
    );
    
    if (recentAttempts.size >= 5) {
      await this.logSecurityEvent({
        action: 'suspicious_activity_blocked',
        severity: 'high',
        details: {
          type: 'brute_force_attempt',
          attemptCount: recentAttempts.size,
          targetUser: auditEntry.userId,
          ipAddress: auditEntry.ipAddress,
          timeWindow: '15_minutes'
        },
        ipAddress: auditEntry.ipAddress,
        automaticResponse: 'ip_temporary_block'
      });
    }
  }

  private static async checkDataAccessPatterns(auditEntry: AuditLogEntry): Promise<void> {
    // Check for unusual data access patterns
    if (auditEntry.details.recordCount && auditEntry.details.recordCount > 100) {
      // Large data access - flag for review
      await this.logSecurityEvent({
        action: 'bulk_data_operation',
        severity: 'medium',
        details: {
          type: 'large_data_access',
          recordCount: auditEntry.details.recordCount,
          userId: auditEntry.userId,
          targetType: auditEntry.targetType,
          dataScope: auditEntry.details.dataScope
        },
        userId: auditEntry.userId
      });
    }
    
    // Check for rapid successive access
    const recentAccess = await getDocs(
      query(
        collection(db, 'audit_logs'),
        where('userId', '==', auditEntry.userId),
        where('category', '==', 'data_access'),
        where('timestamp', '>=', Timestamp.fromDate(new Date(Date.now() - 5 * 60 * 1000))) // 5 minutes
      )
    );
    
    if (recentAccess.size > 20) {
      await this.logSecurityEvent({
        action: 'suspicious_activity_blocked',
        severity: 'high',
        details: {
          type: 'rapid_data_access',
          accessCount: recentAccess.size,
          timeWindow: '5_minutes',
          userId: auditEntry.userId
        },
        userId: auditEntry.userId
      });
    }
  }

  private static async checkPrivilegeEscalation(auditEntry: AuditLogEntry): Promise<void> {
    // Check for suspicious role assignments or permission grants
    if (auditEntry.action === 'role_assigned') {
      const currentUser = await getDoc(doc(db, 'users', auditEntry.userId));
      const targetUser = auditEntry.targetUserId ? 
        await getDoc(doc(db, 'users', auditEntry.targetUserId)) : null;
      
      if (currentUser.exists() && targetUser?.exists()) {
        const assignerRole = currentUser.data()?.role;
        const targetRole = auditEntry.details.roleId;
        
        // Flag if non-admin assigns admin role
        if (assignerRole !== 'admin' && targetRole?.includes('admin')) {
          await this.logSecurityEvent({
            action: 'security_incident_detected',
            severity: 'critical',
            details: {
              type: 'privilege_escalation_attempt',
              assignerId: auditEntry.userId,
              targetUserId: auditEntry.targetUserId,
              assignerRole,
              targetRole
            },
            userId: auditEntry.userId
          });
        }
      }
    }
  }

  private static calculateChanges(
    previousValues: Record<string, any>, 
    newValues: Record<string, any>
  ): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};
    
    // Check for modified and new fields
    for (const [key, newValue] of Object.entries(newValues)) {
      const oldValue = previousValues[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = { from: oldValue, to: newValue };
      }
    }
    
    // Check for removed fields
    for (const [key, oldValue] of Object.entries(previousValues)) {
      if (!(key in newValues)) {
        changes[key] = { from: oldValue, to: undefined };
      }
    }
    
    return changes;
  }

  private static identifySignificantChanges(
    changes: Record<string, { from: any; to: any }>,
    targetType?: AuditLogEntry['targetType']
  ): string[] {
    const significantFields = {
      user: ['role', 'status', 'permissions', 'organizationId'],
      baby_profile: ['assignedCoachId', 'parentIds', 'status'],
      role: ['permissions', 'isActive'],
      organization: ['settings', 'isActive']
    };
    
    const significant = significantFields[targetType as keyof typeof significantFields] || [];
    return Object.keys(changes).filter(field => significant.includes(field));
  }

  private static parseBrowserInfo(userAgent?: string): any {
    // Basic browser info parsing
    return {
      userAgent: userAgent || 'unknown',
      timestamp: new Date().toISOString()
    };
  }

  private static async getLocationFromIP(ipAddress?: string): Promise<any> {
    // Mock implementation - in real scenario, would use IP geolocation service
    return {
      ip: ipAddress || 'unknown',
      country: 'unknown',
      city: 'unknown'
    };
  }

  private static async triggerRealTimeAlert(auditEntry: AuditLogEntry): Promise<void> {
    // Implementation for real-time alerts (email, SMS, etc.)
    console.warn('CRITICAL SECURITY EVENT:', auditEntry);
  }

  private static async logToBackupSystem(params: any, error: any): Promise<void> {
    // Backup logging mechanism
    console.error('Audit logging failed, logging to backup:', { params, error });
  }

  private static buildReportQuery(params: {
    organizationId: string;
    startDate: Date;
    endDate: Date;
    reportType: string;
  }): any {
    let queryRef = query(
      collection(db, 'audit_logs'),
      where('organizationId', '==', params.organizationId),
      where('timestamp', '>=', Timestamp.fromDate(params.startDate)),
      where('timestamp', '<=', Timestamp.fromDate(params.endDate))
    );
    
    // Add report type specific filters
    if (params.reportType === 'security') {
      queryRef = query(queryRef, where('category', '==', 'security'));
    } else if (params.reportType === 'data_access') {
      queryRef = query(queryRef, where('category', '==', 'data_access'));
    }
    
    return query(queryRef, orderBy('timestamp', 'desc'));
  }

  private static processAuditLogsForReport(docs: any[], reportType: string): any[] {
    return docs.map(doc => {
      const data = doc.data();
      return {
        timestamp: data.timestamp.toDate().toISOString(),
        userId: data.userId,
        userEmail: data.userEmail,
        action: data.action,
        category: data.category,
        severity: data.severity,
        success: data.success,
        details: data.details
      };
    });
  }

  private static generateReportSummary(reportData: any[]): AuditReportSummary {
    const eventsByCategory: Record<AuditCategory, number> = {
      authentication: 0,
      user_management: 0,
      data_access: 0,
      data_modification: 0,
      system_admin: 0,
      security: 0,
      compliance: 0,
      performance: 0
    };
    
    const eventsBySeverity: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    const uniqueUsers = new Set<string>();
    let securityIncidents = 0;
    let failedAttempts = 0;
    let dataAccessCount = 0;
    
    reportData.forEach(event => {
      const category = event.category as AuditCategory;
      eventsByCategory[category] = (eventsByCategory[category] || 0) + 1;
      eventsBySeverity[String(event.severity)] = (eventsBySeverity[String(event.severity)] || 0) + 1;
      uniqueUsers.add(event.userId);
      
      if (event.category === 'security') securityIncidents++;
      if (!event.success) failedAttempts++;
      if (event.category === 'data_access') dataAccessCount++;
    });
    
    return {
      totalEvents: reportData.length,
      eventsByCategory,
      eventsBySeverity,
      uniqueUsers: uniqueUsers.size,
      securityIncidents,
      failedAttempts,
      dataAccessCount,
      dateRange: {
        start: reportData[reportData.length - 1]?.timestamp || new Date().toISOString(),
        end: reportData[0]?.timestamp || new Date().toISOString()
      }
    };
  }

  private static async generateReportFile(reportDoc: any): Promise<string> {
    // Generate CSV report file
    const csvContent = this.generateCSVReport(reportDoc.data);
    
    // In a real implementation, this would upload to cloud storage
    // For now, create a data URL that can be downloaded
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    return url;
  }

  private static generateCSVReport(reportData: any[]): string {
    const headers = ['Timestamp', 'User Email', 'Action', 'Category', 'Severity', 'Success', 'Details'];
    const csvRows = [headers.join(',')];
    
    reportData.forEach(event => {
      const row = [
        event.timestamp,
        event.userEmail,
        event.action,
        event.category,
        event.severity,
        event.success,
        JSON.stringify(event.details).replace(/"/g, '""')
      ];
      csvRows.push(row.map(field => `"${field}"`).join(','));
    });
    
    return csvRows.join('\n');
  }

  private static async getAuditLogCount(organizationId: string, params: any): Promise<number> {
    // Build count query with same filters
    let queryRef = query(
      collection(db, 'audit_logs'),
      where('organizationId', '==', organizationId)
    );
    
    if (params.startDate) {
      queryRef = query(queryRef, where('timestamp', '>=', Timestamp.fromDate(params.startDate)));
    }
    
    if (params.endDate) {
      queryRef = query(queryRef, where('timestamp', '<=', Timestamp.fromDate(params.endDate)));
    }
    
    const snapshot = await getDocs(queryRef);
    return snapshot.size;
  }
}


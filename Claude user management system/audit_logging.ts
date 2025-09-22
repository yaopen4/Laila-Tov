// types/audit.ts

export interface AuditLogEntry {
  id: string;
  timestamp: FirebaseFirestore.Timestamp;
  
  // Actor information
  userId: string;
  userEmail: string;
  userRole: string;
  organizationId: string;
  
  // Action details
  action: AuditAction;
  category: AuditCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Target information
  targetType?: 'user' | 'baby_profile' | 'sleep_log' | 'role' | 'organization' | 'invitation';
  targetId?: string;
  targetUserId?: string; // If action affects another user
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  
  // Additional details (structured data)
  details: Record<string, any>;
  
  // Success/failure tracking
  success: boolean;
  errorMessage?: string;
  
  // Data changes (for update operations)
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export type AuditAction = 
  // Authentication & User Management
  | 'user_login' | 'user_logout' | 'user_login_failed' | 'user_registered' | 'user_deactivated'
  | 'password_changed' | 'password_reset_requested' | 'password_reset_completed'
  
  // Invitation Management
  | 'invitation_created' | 'invitation_sent' | 'invitation_accepted' | 'invitation_expired'
  | 'invitation_cancelled' | 'invitation_resent'
  
  // Role Management
  | 'role_created' | 'role_updated' | 'role_deleted' | 'role_assigned' | 'role_unassigned'
  | 'permission_granted' | 'permission_revoked'
  
  // Baby Profile Management
  | 'baby_profile_created' | 'baby_profile_updated' | 'baby_profile_archived'
  | 'baby_profile_transferred' | 'baby_profile_restored'
  | 'parent_added_to_baby' | 'parent_removed_from_baby'
  
  // Sleep Data
  | 'sleep_log_created' | 'sleep_log_updated' | 'sleep_log_deleted'
  | 'sleep_data_exported' | 'sleep_data_imported'
  
  // Consultation & Recommendations
  | 'recommendation_created' | 'recommendation_updated' | 'recommendation_viewed'
  | 'consultation_note_added'
  
  // Reports & Analytics
  | 'report_generated' | 'report_exported' | 'report_shared'
  | 'dashboard_viewed' | 'analytics_accessed'
  
  // System Administration
  | 'organization_settings_updated' | 'system_backup_created'
  | 'data_migration_started' | 'data_migration_completed'
  | 'security_incident_detected' | 'suspicious_activity_blocked'
  
  // Data Access
  | 'data_accessed' | 'unauthorized_access_attempt' | 'data_download_requested'
  | 'bulk_data_operation' | 'sensitive_data_viewed';

export type AuditCategory = 
  | 'authentication' | 'user_management' | 'data_access' | 'data_modification'
  | 'system_admin' | 'security' | 'compliance' | 'performance';

// services/auditLogger.ts
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
      // Get user context
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(params.userId)
        .get();
      
      const user = userDoc.exists ? userDoc.data() as User : null;
      
      const auditEntry: AuditLogEntry = {
        id: admin.firestore().collection('audit_logs').doc().id,
        timestamp: admin.firestore.Timestamp.now(),
        
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
      const collection = this.getAuditCollection(auditEntry.category, auditEntry.severity);
      
      await admin.firestore()
        .collection(collection)
        .doc(auditEntry.id)
        .set(auditEntry);
      
      // Check for security alerts
      await this.checkSecurityAlerts(auditEntry);
      
      // Real-time monitoring for critical events
      if (auditEntry.severity === 'critical') {
        await this.triggerRealTimeAlert(auditEntry);
      }
      
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - logging failure shouldn't break application flow
      // But we should log this failure to a backup system
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
    const query = this.buildReportQuery(params);
    const auditLogs = await query.get();
    
    // Generate report data
    const reportData = this.processAuditLogsForReport(auditLogs.docs, params.reportType);
    
    // Create report document
    const reportId = admin.firestore().collection('compliance_reports').doc().id;
    const reportDoc = {
      id: reportId,
      organizationId: params.organizationId,
      generatedBy: params.userId,
      generatedAt: admin.firestore.Timestamp.now(),
      reportType: params.reportType,
      dateRange: {
        start: admin.firestore.Timestamp.fromDate(params.startDate),
        end: admin.firestore.Timestamp.fromDate(params.endDate)
      },
      summary: this.generateReportSummary(reportData),
      data: reportData
    };
    
    await admin.firestore()
      .collection('compliance_reports')
      .doc(reportId)
      .set(reportDoc);
    
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
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: AuditLogEntry[];
    totalCount: number;
    hasMore: boolean;
  }> {
    let query = admin.firestore()
      .collection('audit_logs')
      .where('organizationId', '==', params.organizationId) as any;

    // Apply filters
    if (params.userId) {
      query = query.where('userId', '==', params.userId);
    }
    
    if (params.targetUserId) {
      query = query.where('targetUserId', '==', params.targetUserId);
    }
    
    if (params.actions && params.actions.length > 0) {
      query = query.where('action', 'in', params.actions);
    }
    
    if (params.categories && params.categories.length > 0) {
      query = query.where('category', 'in', params.categories);
    }
    
    if (params.startDate) {
      query = query.where('timestamp', '>=', 
        admin.firestore.Timestamp.fromDate(params.startDate));
    }
    
    if (params.endDate) {
      query = query.where('timestamp', '<=', 
        admin.firestore.Timestamp.fromDate(params.endDate));
    }
    
    if (params.successOnly !== undefined) {
      query = query.where('success', '==', params.successOnly);
    }

    // Order and paginate
    query = query.orderBy('timestamp', 'desc');
    
    if (params.offset) {
      // Get document to start after for pagination
      const offsetDoc = await admin.firestore()
        .collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(params.offset)
        .get();
      
      if (!offsetDoc.empty) {
        query = query.startAfter(offsetDoc.docs[offsetDoc.docs.length - 1]);
      }
    }
    
    const limit = params.limit || 50;
    query = query.limit(limit + 1); // Get one extra to check if there are more

    const snapshot = await query.get();
    const logs = snapshot.docs.slice(0, limit).map(doc => doc.data() as AuditLogEntry);
    const hasMore = snapshot.docs.length > limit;

    return {
      logs,
      totalCount: await this.getAuditLogCount(params.organizationId, params),
      hasMore
    };
  }

  /**
   * Real-time audit log monitoring
   */
  static setupRealTimeMonitoring(organizationId: string, callback: (log: AuditLogEntry) => void) {
    return admin.firestore()
      .collection('audit_logs')
      .where('organizationId', '==', organizationId)
      .where('timestamp', '>=', admin.firestore.Timestamp.now())
      .orderBy('timestamp', 'desc')
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const auditLog = change.doc.data() as AuditLogEntry;
            callback(auditLog);
          }
        });
      });
  }

  // Private helper methods...

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
      'role_created': 'system_admin',
      'system_backup_created': 'system_admin'
      
      // Add mappings for all other actions...
    } as any;
    
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
    const recentAttempts = await admin.firestore()
      .collection('audit_logs')
      .where('action', '==', 'user_login_failed')
      .where('ipAddress', '==', auditEntry.ipAddress)
      .where('timestamp', '>=', 
        admin.firestore.Timestamp.fromDate(new Date(Date.now() - 15 * 60 * 1000))) // 15 minutes
      .get();
    
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
}

interface AuditReportSummary {
  totalEvents: number;
  eventsByCategory: Record<AuditCategory, number>;
  eventsBySeverity: Record<string, number>;
  uniqueUsers: number;
  securityIncidents: number;
  failedAttempts: number;
  dataAccessCount: number;
  dateRange: {
    start: string;
    end: string;
  };
}
  
/**
 * @fileoverview Comprehensive logging service for Laila Tov application
 * Provides structured logging, audit trails, monitoring, and alerting capabilities
 */

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';

// Log levels for different types of events
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Event categories for audit trails
export enum EventCategory {
  AUTHENTICATION = 'authentication',
  USER_MANAGEMENT = 'user_management',
  BABY_MANAGEMENT = 'baby_management',
  SLEEP_DATA = 'sleep_data',
  INVITATION = 'invitation',
  SYSTEM = 'system',
  SECURITY = 'security',
  PERFORMANCE = 'performance'
}

// Audit event types for detailed tracking
export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_SUCCESS = 'password_reset_success',
  SIGNUP_SUCCESS = 'signup_success',
  SIGNUP_FAILED = 'signup_failed',
  
  // User management events
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  ROLE_ASSIGNED = 'role_assigned',
  ROLE_CHANGED = 'role_changed',
  
  // Baby management events
  BABY_CREATED = 'baby_created',
  BABY_UPDATED = 'baby_updated',
  BABY_ARCHIVED = 'baby_archived',
  BABY_RESTORED = 'baby_restored',
  BABY_DELETED = 'baby_deleted',
  
  // Sleep data events
  SLEEP_RECORD_CREATED = 'sleep_record_created',
  SLEEP_RECORD_UPDATED = 'sleep_record_updated',
  SLEEP_RECORD_DELETED = 'sleep_record_deleted',
  
  // Invitation events
  INVITATION_CREATED = 'invitation_created',
  INVITATION_REDEEMED = 'invitation_redeemed',
  INVITATION_CANCELLED = 'invitation_cancelled',
  INVITATION_EXPIRED = 'invitation_expired',
  
  // System events
  DATA_EXPORT = 'data_export',
  BULK_OPERATION = 'bulk_operation',
  SYSTEM_ERROR = 'system_error',
  
  // Security events
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PERMISSION_DENIED = 'permission_denied',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity'
}

// Base log entry interface
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  category?: EventCategory;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Audit log entry interface for sensitive operations
export interface AuditLogEntry extends LogEntry {
  eventType: AuditEventType;
  resourceId?: string;
  resourceType?: string;
  oldValue?: any;
  newValue?: any;
  success: boolean;
  duration?: number;
}

// Performance metrics interface
export interface PerformanceMetric {
  timestamp: Date;
  operation: string;
  duration: number;
  userId?: string;
  metadata?: Record<string, any>;
}

class LoggingService {
  private static instance: LoggingService;
  private isEnabled: boolean = true;
  private logBuffer: LogEntry[] = [];
  private auditBuffer: AuditLogEntry[] = [];
  private maxBufferSize: number = 100;
  private flushInterval: number = 30000; // 30 seconds
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startPeriodicFlush();
  }

  public static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  /**
   * Generate a unique session ID for tracking user sessions
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get browser information for logging context
   */
  private getBrowserInfo() {
    if (typeof window === 'undefined') return {};
    
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    };
  }

  /**
   * Get user context information
   */
  private async getUserContext(): Promise<{
    userId?: string;
    userEmail?: string;
    userRole?: string;
  }> {
    try {
      // Try to get current user from Firebase Auth
      const { getCurrentUser } = await import('./authService');
      const user = await getCurrentUser();
      
      return {
        userId: user?.uid,
        userEmail: user?.email,
        userRole: user?.role
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Core logging method
   */
  private async log(
    level: LogLevel,
    message: string,
    category?: EventCategory,
    metadata?: Record<string, any>,
    error?: Error
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const userContext = await this.getUserContext();
      const browserInfo = this.getBrowserInfo();

      const logEntry: LogEntry = {
        timestamp: new Date(),
        level,
        message,
        category,
        sessionId: this.sessionId,
        userAgent: browserInfo.userAgent,
        metadata: {
          ...metadata,
          browserInfo
        },
        ...userContext
      };

      if (error) {
        logEntry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack
        };
      }

      // Add to buffer
      this.logBuffer.push(logEntry);

      // Console logging for development
      if (process.env.NODE_ENV === 'development') {
        const consoleMethod = level === LogLevel.ERROR || level === LogLevel.CRITICAL ? 'error' 
                           : level === LogLevel.WARN ? 'warn' 
                           : 'log';
        console[consoleMethod](`[${level.toUpperCase()}] ${message}`, metadata || '', error || '');
      }

      // Flush if buffer is full
      if (this.logBuffer.length >= this.maxBufferSize) {
        await this.flush();
      }
    } catch (err) {
      // Fallback to console if logging service fails
      console.error('Logging service error:', err);
      console.log(`[${level.toUpperCase()}] ${message}`, metadata || '');
    }
  }

  /**
   * Debug level logging
   */
  public async debug(message: string, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.DEBUG, message, undefined, metadata);
  }

  /**
   * Info level logging
   */
  public async info(message: string, category?: EventCategory, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.INFO, message, category, metadata);
  }

  /**
   * Warning level logging
   */
  public async warn(message: string, category?: EventCategory, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.WARN, message, category, metadata);
  }

  /**
   * Error level logging
   */
  public async error(message: string, error?: Error, category?: EventCategory, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.ERROR, message, category, metadata, error);
  }

  /**
   * Critical level logging
   */
  public async critical(message: string, error?: Error, category?: EventCategory, metadata?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.CRITICAL, message, category, metadata, error);
  }

  /**
   * Audit logging for sensitive operations
   */
  public async audit(
    eventType: AuditEventType,
    message: string,
    options: {
      resourceId?: string;
      resourceType?: string;
      oldValue?: any;
      newValue?: any;
      success: boolean;
      duration?: number;
      metadata?: Record<string, any>;
      error?: Error;
    }
  ): Promise<void> {
    try {
      const userContext = await this.getUserContext();
      const browserInfo = this.getBrowserInfo();

      const auditEntry: AuditLogEntry = {
        timestamp: new Date(),
        level: options.success ? LogLevel.INFO : LogLevel.ERROR,
        message,
        category: this.getCategoryFromEventType(eventType),
        eventType,
        sessionId: this.sessionId,
        userAgent: browserInfo.userAgent,
        success: options.success,
        resourceId: options.resourceId,
        resourceType: options.resourceType,
        oldValue: options.oldValue,
        newValue: options.newValue,
        duration: options.duration,
        metadata: {
          ...options.metadata,
          browserInfo
        },
        ...userContext
      };

      if (options.error) {
        auditEntry.error = {
          name: options.error.name,
          message: options.error.message,
          stack: options.error.stack
        };
      }

      this.auditBuffer.push(auditEntry);

      // Also log to regular logs for immediate visibility
      await this.log(
        auditEntry.level,
        `[AUDIT] ${message}`,
        auditEntry.category,
        {
          eventType,
          resourceId: options.resourceId,
          resourceType: options.resourceType,
          success: options.success,
          ...options.metadata
        },
        options.error
      );

      // Flush audit logs immediately for critical events
      if (!options.success || eventType.includes('FAILED') || eventType.includes('UNAUTHORIZED')) {
        await this.flushAuditLogs();
      }
    } catch (err) {
      console.error('Audit logging failed:', err);
    }
  }

  /**
   * Performance monitoring
   */
  public async recordPerformance(
    operation: string,
    startTime: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const duration = Date.now() - startTime;
    const userContext = await this.getUserContext();

    const metric: PerformanceMetric = {
      timestamp: new Date(),
      operation,
      duration,
      userId: userContext.userId,
      metadata
    };

    // Log performance metrics
    await this.info(
      `Performance: ${operation} completed in ${duration}ms`,
      EventCategory.PERFORMANCE,
      metric
    );

    // Alert on slow operations (>5 seconds)
    if (duration > 5000) {
      await this.warn(
        `Slow operation detected: ${operation} took ${duration}ms`,
        EventCategory.PERFORMANCE,
        metric
      );
    }
  }

  /**
   * Sanitize data for Firestore by removing undefined values
   */
  private sanitizeForFirestore(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForFirestore(item));
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          sanitized[key] = this.sanitizeForFirestore(value);
        }
      }
      return sanitized;
    }
    
    return obj;
  }

  /**
   * Get category from audit event type
   */
  private getCategoryFromEventType(eventType: AuditEventType): EventCategory {
    if (eventType.includes('LOGIN') || eventType.includes('LOGOUT') || eventType.includes('SIGNUP') || eventType.includes('PASSWORD')) {
      return EventCategory.AUTHENTICATION;
    }
    if (eventType.includes('USER')) {
      return EventCategory.USER_MANAGEMENT;
    }
    if (eventType.includes('BABY')) {
      return EventCategory.BABY_MANAGEMENT;
    }
    if (eventType.includes('SLEEP')) {
      return EventCategory.SLEEP_DATA;
    }
    if (eventType.includes('INVITATION')) {
      return EventCategory.INVITATION;
    }
    if (eventType.includes('UNAUTHORIZED') || eventType.includes('PERMISSION') || eventType.includes('SUSPICIOUS')) {
      return EventCategory.SECURITY;
    }
    return EventCategory.SYSTEM;
  }

  /**
   * Flush logs to Firestore
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    try {
      const logsToFlush = [...this.logBuffer];
      this.logBuffer = [];

      // Store in Firestore
      const logsCollection = collection(db, 'logs');
      const promises = logsToFlush.map(log => 
        addDoc(logsCollection, this.sanitizeForFirestore({
          ...log,
          timestamp: serverTimestamp()
        }))
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to flush logs to Firestore:', error);
      // Re-add logs to buffer for retry
      this.logBuffer.unshift(...this.logBuffer);
    }
  }

  /**
   * Flush audit logs to Firestore
   */
  private async flushAuditLogs(): Promise<void> {
    if (this.auditBuffer.length === 0) return;

    try {
      const auditLogsToFlush = [...this.auditBuffer];
      this.auditBuffer = [];

      // Store in Firestore
      const auditCollection = collection(db, 'auditLogs');
      const promises = auditLogsToFlush.map(auditLog => 
        addDoc(auditCollection, this.sanitizeForFirestore({
          ...auditLog,
          timestamp: serverTimestamp()
        }))
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to flush audit logs to Firestore:', error);
      // Re-add audit logs to buffer for retry
      this.auditBuffer.unshift(...this.auditBuffer);
    }
  }

  /**
   * Start periodic flushing
   */
  private startPeriodicFlush(): void {
    setInterval(async () => {
      await this.flush();
      await this.flushAuditLogs();
    }, this.flushInterval);
  }

  /**
   * Get recent logs for debugging (admin only)
   */
  public async getRecentLogs(limitCount: number = 50): Promise<LogEntry[]> {
    try {
      const logsCollection = collection(db, 'logs');
      const q = query(logsCollection, orderBy('timestamp', 'desc'), limit(limitCount));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as LogEntry));
    } catch (error) {
      console.error('Failed to retrieve logs:', error);
      return [];
    }
  }

  /**
   * Get recent audit logs (admin only)
   */
  public async getRecentAuditLogs(limitCount: number = 50): Promise<AuditLogEntry[]> {
    try {
      const auditCollection = collection(db, 'auditLogs');
      const q = query(auditCollection, orderBy('timestamp', 'desc'), limit(limitCount));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as AuditLogEntry));
    } catch (error) {
      console.error('Failed to retrieve audit logs:', error);
      return [];
    }
  }

  /**
   * Enable/disable logging
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Force flush all pending logs
   */
  public async forceFlush(): Promise<void> {
    await Promise.all([
      this.flush(),
      this.flushAuditLogs()
    ]);
  }
}

// Export singleton instance
export const logger = LoggingService.getInstance();

// Convenience wrapper functions
export const logDebug = logger.debug.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logError = logger.error.bind(logger);
export const logCritical = logger.critical.bind(logger);
export const logAudit = logger.audit.bind(logger);
export const recordPerformance = logger.recordPerformance.bind(logger);

// Performance timing wrapper
export function withPerformanceLogging<T>(
  operation: string,
  func: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    try {
      const result = await func();
      await recordPerformance(operation, startTime, metadata);
      resolve(result);
    } catch (error) {
      await recordPerformance(operation, startTime, { ...metadata, error: true });
      reject(error);
    }
  });
}

// Error boundary logging
export async function logErrorBoundary(
  error: Error,
  errorInfo: { componentStack: string },
  metadata?: Record<string, any>
): Promise<void> {
  await logger.critical(
    'React Error Boundary caught an error',
    error,
    EventCategory.SYSTEM,
    {
      componentStack: errorInfo.componentStack,
      ...metadata
    }
  );
}

export default logger;

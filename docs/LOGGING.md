# Laila Tov Logging System Documentation

## Overview

The Laila Tov application implements a comprehensive logging and monitoring system designed to provide full visibility into application behavior, security events, and system performance. This system is built with production-ready features including structured logging, audit trails, error tracking, and performance monitoring.

## Architecture

### Core Components

1. ~~LoggingService (`src/services/loggingService.ts`)~~ [Deprecated]
   - Deprecated in favor of dedicated `AuditLogger` usage patterns
   - Keep for reference only; not used in current code
   - Prefer `AuditLogger` and service-specific logging where needed

2. **AuditLogger** (`src/services/auditLogger.ts`)
   - Comprehensive audit logging for security-sensitive operations
   - Advanced filtering and search capabilities
   - Compliance reporting and data export
   - Real-time security monitoring and alerting
   - Multi-collection storage based on data sensitivity

3. **Audit Log Viewer** (`src/components/admin/audit-log-viewer.tsx`)
   - Real-time audit log viewing and analysis
   - Advanced filtering by category, severity, and date range
   - Compliance report generation and export
   - Security event monitoring

4. **Service Integration**
   - **AuthService** - Authentication with comprehensive audit logging
   - **BabyService** - Baby management with detailed change tracking
   - **InvitationService** - Invitation system with full audit trails
   - **RoleService** - Role management with permission change logging

5. **Security Rules** (`firestore.rules`)
   - Secure access to log collections with organization-based isolation
   - Admin-only read access to audit logs
   - Separate collections for different sensitivity levels
   - Immutable log storage with write restrictions

## Log Types

### 1. Application Logs (`logs` collection)

Standard application logs with the following levels:
- **DEBUG**: Development information
- **INFO**: General information 
- **WARN**: Warning conditions
- **ERROR**: Error conditions
- **CRITICAL**: Critical system failures

### 2. Audit Logs (Multiple Collections)

Security-focused logs for sensitive operations stored in separate collections based on sensitivity:

**Standard Audit Logs** (`audit_logs` collection):
- User management (creation, updates, role changes)
- Baby management (creation, updates, archiving)
- Sleep data operations (create, update, delete)
- Invitation management
- Data access and modifications

**Security Audit Logs** (`audit_logs_security` collection):
- Authentication events (login, logout, registration)
- Security events (unauthorized access, permission denied)
- Suspicious activity detection
- Failed login attempts and brute force protection

**Compliance Audit Logs** (`audit_logs_compliance` collection):
- High-severity administrative actions
- Data export and bulk operations
- System configuration changes
- Compliance-related events

### 3. Performance Metrics

Embedded within application logs with performance category:
- Operation timing and duration
- Slow operation alerts (>5 seconds)
- Resource usage patterns

## Usage

### Basic Logging

Use `AuditLogger` for structured logging of significant events. For incidental console logs in development, use `console.log` minimally.

### Performance Monitoring

Wrap critical operations with timestamps and include durations in `AuditLogger` details if needed. A dedicated performance wrapper may be reintroduced later if required.

### Audit Logging

```typescript
import { AuditLogger } from '@/services/auditLogger';

// Log user session activity
await AuditLogger.logSession({
  userId: 'user123',
  action: 'login',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  loginMethod: 'email',
  success: true
});

// Log data access events
await AuditLogger.logDataAccess({
  userId: 'user123',
  targetType: 'baby_profile',
  targetId: 'baby456',
  action: 'read',
  dataScope: 'last_30_days',
  recordCount: 25
});

// Log data modifications with before/after values
await AuditLogger.logDataModification({
  userId: 'user123',
  action: 'baby_profile_updated',
  targetType: 'baby_profile',
  targetId: 'baby456',
  previousValues: { name: 'Old Name', age: 6 },
  newValues: { name: 'New Name', age: 7 },
  changeReason: 'Parent requested name change'
});
```

## Event Categories

- **AUTHENTICATION**: Login, logout, registration events
- **USER_MANAGEMENT**: User creation, updates, role changes
- **BABY_MANAGEMENT**: Baby profile operations
- **SLEEP_DATA**: Sleep record operations
- **INVITATION**: Invitation system events
- **SYSTEM**: System-level events and errors
- **SECURITY**: Security-related events
- **PERFORMANCE**: Performance metrics and monitoring

## Audit Event Types

### Authentication Events
- `user_login` / `user_login_failed` / `user_logout`
- `user_registered` / `password_changed`
- `password_reset_requested` / `password_reset_completed`

### User Management Events
- `user_registered` / `user_deactivated`
- `role_assigned` / `role_unassigned`
- `permission_granted` / `permission_revoked`

### Baby Management Events
- `baby_profile_created` / `baby_profile_updated` / `baby_profile_archived`
- `baby_profile_transferred` / `baby_profile_restored`
- `parent_added_to_baby` / `parent_removed_from_baby`

### Sleep Data Events
- `sleep_log_created` / `sleep_log_updated` / `sleep_log_deleted`
- `sleep_data_exported` / `sleep_data_imported`

### Invitation Events
- `invitation_created` / `invitation_sent` / `invitation_accepted`
- `invitation_expired` / `invitation_cancelled` / `invitation_resent`

### Security Events
- `unauthorized_access_attempt` / `suspicious_activity_blocked`
- `security_incident_detected` / `bulk_data_operation`
- `sensitive_data_viewed`

### System Admin Events
- `organization_settings_updated` / `role_created` / `role_updated`
- `system_backup_created` / `data_migration_started`
- `report_generated` / `report_exported`

## Configuration

### Environment Variables

No additional environment variables are required. The logging system uses the existing Firebase configuration.

### Buffer Settings

- **Buffer Size**: 100 logs before auto-flush
- **Flush Interval**: 30 seconds
- **Performance Alert Threshold**: 5 seconds

### Log Retention

Logs are stored in Firestore with no automatic expiration. For production, consider implementing log rotation or archival policies based on your requirements.

## Security Considerations

1. **Access Control**: Only admins can read logs via Firestore security rules with organization-based isolation
2. **Data Sanitization**: Sensitive data is automatically masked in logs
3. **Immutable Storage**: Logs cannot be modified or deleted once created
4. **Encryption**: All logs are encrypted at rest in Firestore
5. **Collection Separation**: Different sensitivity levels stored in separate collections
6. **Real-time Monitoring**: Automatic security alert detection and response
7. **IP-based Protection**: Brute force detection and automatic IP blocking

## Monitoring and Alerting

### Real-time Monitoring

The audit log viewer provides:
- Live audit log streaming with real-time updates
- Advanced filtering by category, severity, and date range
- Security event monitoring and alerting
- Performance metrics and system health indicators

### Alerting Triggers

- Critical security events (unauthorized access, privilege escalation)
- Failed login attempts (brute force detection after 5 attempts in 15 minutes)
- Suspicious data access patterns (rapid successive access, large data exports)
- Performance degradation (operations >5s)
- High error rates (>10 errors in recent logs)
- Bulk data operations and sensitive data access

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check Firestore security rules and user permissions
2. **Performance issues**: Verify buffer settings and flush intervals
3. **Missing audit logs**: Ensure audit logging is called after successful operations

### Debug Mode

In development, logs are also output to the browser console for immediate debugging.

### Log Export

Admins can export audit logs via the audit log viewer for external analysis or compliance requirements. The system supports:
- CSV export of filtered audit logs
- Compliance report generation with summary statistics
- Date range filtering for specific reporting periods
- Organization-specific data isolation

## Best Practices

1. **Structured Data**: Always include relevant metadata in log entries
2. **Error Context**: Provide sufficient context for debugging errors
3. **Performance Logging**: Wrap slow operations with performance monitoring
4. **Security Events**: Log all security-sensitive operations
5. **Data Privacy**: Avoid logging sensitive user data directly

## Integration Examples

### Service Integration

```typescript
// In BabyService
export class BabyService {
  async createBaby(babyData: CreateBabyParams): Promise<BabyProfile> {
    return withPerformanceLogging('createBaby', async () => {
      try {
        await logger.info('Starting baby creation', EventCategory.BABY_MANAGEMENT, {
          coachId: babyData.assignedCoachId,
          hasParentEmail: !!babyData.parentEmail
        });

        const result = await this.createBabyInFirestore(babyData);

        // Enhanced audit logging with detailed context
        await AuditLogger.log({
          action: 'baby_profile_created',
          userId: babyData.assignedCoachId,
          targetType: 'baby_profile',
          targetId: result.id,
          details: {
            name: babyData.name,
            age: babyData.age,
            parentEmail: babyData.parentEmail
          },
          success: true
        });

        return result;
      } catch (error) {
        await AuditLogger.log({
          action: 'baby_profile_created',
          userId: babyData.assignedCoachId,
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    });
  }
}
```

### Component Integration

```typescript
// In a React component with audit logging
import { AuditLogger } from '@/services/auditLogger';

function BabyManagementComponent() {
  const handleBabyUpdate = async (babyId: string, updates: any) => {
    try {
      // Log data access
      await AuditLogger.logDataAccess({
        userId: currentUser.uid,
        targetType: 'baby_profile',
        targetId: babyId,
        action: 'write',
        dataScope: 'single_record'
      });

      // Perform update
      await updateBaby(babyId, updates);

      // Log successful modification
      await AuditLogger.logDataModification({
        userId: currentUser.uid,
        action: 'baby_profile_updated',
        targetType: 'baby_profile',
        targetId: babyId,
        previousValues: originalData,
        newValues: updates,
        changeReason: 'User initiated update'
      });
    } catch (error) {
      // Log failed operation
      await AuditLogger.log({
        action: 'baby_profile_updated',
        userId: currentUser.uid,
        targetType: 'baby_profile',
        targetId: babyId,
        success: false,
        errorMessage: error.message
      });
    }
  };

  return (
    <div>
      {/* Component content */}
    </div>
  );
}
```

## Compliance and Auditing

The logging system supports compliance requirements by:
- Maintaining immutable audit trails with organization-based isolation
- Logging all data access and modifications with detailed change tracking
- Providing comprehensive user activity tracking with session management
- Supporting data export for compliance reporting with summary statistics
- Real-time security monitoring and automatic threat detection
- Multi-level audit storage based on data sensitivity
- IP-based access tracking and geographic location logging
- Automatic compliance report generation with customizable date ranges

## Performance Impact

The logging system is designed for minimal performance impact:
- Asynchronous logging operations with non-blocking execution
- Intelligent buffering and batching with configurable flush intervals
- Automatic retry logic for failed log writes with exponential backoff
- Graceful degradation when logging fails (fallback to console)
- Multi-collection storage optimization based on data sensitivity
- Real-time security monitoring without performance overhead
- Efficient querying with indexed fields for fast log retrieval

---

For additional questions or support, please refer to the main project documentation or contact the development team.

# Laila Tov Logging System Documentation

## Overview

The Laila Tov application implements a comprehensive logging and monitoring system designed to provide full visibility into application behavior, security events, and system performance. This system is built with production-ready features including structured logging, audit trails, error tracking, and performance monitoring.

## Architecture

### Core Components

1. **LoggingService** (`src/services/loggingService.ts`)
   - Centralized singleton service for all logging operations
   - Structured logging with consistent metadata
   - Automatic buffering and periodic flushing to Firestore
   - Performance monitoring and metrics collection

2. **Error Boundary** (`src/components/shared/error-boundary.tsx`)
   - React error boundary with automatic error reporting
   - User-friendly error UI with retry capabilities
   - Comprehensive error context logging

3. **Monitoring Dashboard** (`src/components/admin/monitoring-dashboard.tsx`)
   - Real-time log viewing and analysis
   - System health monitoring
   - Log export functionality

4. **Security Rules** (`firestore.rules`)
   - Secure access to log collections
   - Admin-only read access to logs
   - Immutable log storage

## Log Types

### 1. Application Logs (`logs` collection)

Standard application logs with the following levels:
- **DEBUG**: Development information
- **INFO**: General information 
- **WARN**: Warning conditions
- **ERROR**: Error conditions
- **CRITICAL**: Critical system failures

### 2. Audit Logs (`auditLogs` collection)

Security-focused logs for sensitive operations:
- Authentication events (login, logout, registration)
- User management (creation, updates, role changes)
- Baby management (creation, updates, archiving)
- Sleep data operations (create, update, delete)
- Invitation management
- Administrative actions
- Security events (unauthorized access, permission denied)

### 3. Performance Metrics

Embedded within application logs with performance category:
- Operation timing and duration
- Slow operation alerts (>5 seconds)
- Resource usage patterns

## Usage

### Basic Logging

```typescript
import { logger, EventCategory } from '@/services/loggingService';

// Info logging
await logger.info('User logged in', EventCategory.AUTHENTICATION, {
  userId: 'user123',
  email: 'user@example.com'
});

// Error logging
await logger.error('Database connection failed', error, EventCategory.SYSTEM, {
  connectionString: 'masked',
  retryCount: 3
});
```

### Audit Logging

```typescript
import { logAudit, AuditEventType } from '@/services/loggingService';

await logAudit(AuditEventType.BABY_CREATED, 'Baby profile created', {
  resourceId: 'baby123',
  resourceType: 'baby',
  newValue: { name: 'Baby Name', age: 6 },
  success: true,
  metadata: { coachId: 'coach123' }
});
```

### Performance Monitoring

```typescript
import { withPerformanceLogging } from '@/services/loggingService';

const result = await withPerformanceLogging('databaseQuery', async () => {
  return await complexDatabaseOperation();
}, { queryType: 'baby_search' });
```

### Error Reporting

```typescript
import { useErrorReporting } from '@/components/shared/error-boundary';

const { reportError } = useErrorReporting();

try {
  // Some operation
} catch (error) {
  await reportError(error, { context: 'user_action', action: 'create_baby' });
}
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
- `LOGIN_SUCCESS` / `LOGIN_FAILED`
- `LOGOUT`
- `SIGNUP_SUCCESS` / `SIGNUP_FAILED`
- `PASSWORD_RESET_REQUEST` / `PASSWORD_RESET_SUCCESS`

### User Management Events
- `USER_CREATED` / `USER_UPDATED` / `USER_DELETED`
- `ROLE_ASSIGNED` / `ROLE_CHANGED`

### Baby Management Events
- `BABY_CREATED` / `BABY_UPDATED` / `BABY_DELETED`
- `BABY_ARCHIVED` / `BABY_RESTORED`

### Sleep Data Events
- `SLEEP_RECORD_CREATED` / `SLEEP_RECORD_UPDATED` / `SLEEP_RECORD_DELETED`

### Security Events
- `UNAUTHORIZED_ACCESS`
- `PERMISSION_DENIED`
- `SUSPICIOUS_ACTIVITY`

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

1. **Access Control**: Only admins can read logs via Firestore security rules
2. **Data Sanitization**: Sensitive data is automatically masked in logs
3. **Immutable Storage**: Logs cannot be modified or deleted once created
4. **Encryption**: All logs are encrypted at rest in Firestore

## Monitoring and Alerting

### Real-time Monitoring

The monitoring dashboard provides:
- Live log streaming
- Error rate monitoring
- System health indicators
- Performance metrics

### Alerting Triggers

- Critical errors (logged at CRITICAL level)
- High error rates (>10 errors in recent logs)
- Performance degradation (operations >5s)
- Security events (unauthorized access attempts)

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check Firestore security rules and user permissions
2. **Performance issues**: Verify buffer settings and flush intervals
3. **Missing audit logs**: Ensure audit logging is called after successful operations

### Debug Mode

In development, logs are also output to the browser console for immediate debugging.

### Log Export

Admins can export logs via the monitoring dashboard for external analysis or compliance requirements.

## Best Practices

1. **Structured Data**: Always include relevant metadata in log entries
2. **Error Context**: Provide sufficient context for debugging errors
3. **Performance Logging**: Wrap slow operations with performance monitoring
4. **Security Events**: Log all security-sensitive operations
5. **Data Privacy**: Avoid logging sensitive user data directly

## Integration Examples

### Service Integration

```typescript
// In a service function
export const createBaby = async (babyData: BabyData) => {
  return withPerformanceLogging('createBaby', async () => {
    try {
      await logger.info('Starting baby creation', EventCategory.BABY_MANAGEMENT, {
        coachId: babyData.coachId,
        hasParentEmail: !!babyData.parentEmail
      });

      const result = await createBabyInFirestore(babyData);

      await logAudit(AuditEventType.BABY_CREATED, 'Baby created successfully', {
        resourceId: result.id,
        resourceType: 'baby',
        success: true,
        newValue: { name: babyData.name, age: babyData.age }
      });

      return result;
    } catch (error) {
      await logAudit(AuditEventType.BABY_CREATED, 'Baby creation failed', {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error')
      });
      throw error;
    }
  });
};
```

### Component Integration

```typescript
// In a React component
import ErrorBoundary from '@/components/shared/error-boundary';

function MyComponent() {
  return (
    <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
      <MyAppContent />
    </ErrorBoundary>
  );
}
```

## Compliance and Auditing

The logging system supports compliance requirements by:
- Maintaining immutable audit trails
- Logging all data access and modifications
- Providing comprehensive user activity tracking
- Supporting data export for compliance reporting

## Performance Impact

The logging system is designed for minimal performance impact:
- Asynchronous logging operations
- Intelligent buffering and batching
- Automatic retry logic for failed log writes
- Graceful degradation when logging fails

---

For additional questions or support, please refer to the main project documentation or contact the development team.

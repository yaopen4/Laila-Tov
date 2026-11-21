# Audit Logging

**Last updated:** 2026-09-07

> This document previously described a broader logging system — application logs, a
> `logs` collection, buffered flushes, performance metrics, and real-time alerting.
> None of that exists. `LoggingService` was deleted (it had zero imports and wrote to
> collections with no security rules), and the client-side audit calls were removed
> because Firestore denied every one of them. What follows is what the code actually
> does.

## The model

Audit entries are written **server-side only**, by the Admin SDK.

`firestore.rules` denies every client write to `audit_logs` (`allow write: if false`).
That is deliberate: an audit log the subject can write is not an audit log. The Admin
SDK bypasses security rules, so the server is the only thing that can append to it.

| Concern | Where |
|---|---|
| Writing entries | `src/lib/server/audit.ts` — `auditLog()` |
| Reading entries | `src/services/auditLogger.ts` — `searchAuditLogs()`, `generateComplianceReport()` |
| Access control | `firestore.rules` — admins read, nobody writes from a client |
| Event vocabulary | `src/types/auth.ts` — the `AuditAction` union |

## Writing an entry

Only from a server context — an API route under `src/app/api/**`:

```ts
import { auditLog, requestContext } from '@/lib/server/audit';

await auditLog({
  action: 'invitation_created',
  userId: user.uid,
  organizationId: user.organizationId,
  targetType: 'invitation',
  targetId: invitation.id,
  success: true,
  details: { email, role },
  ...requestContext(req),   // client IP and user-agent
});
```

Two behaviours worth knowing:

- **Failures never propagate.** `auditLog` catches and logs its own errors rather than
  rethrowing. A broken audit write must not fail the operation being audited.
- **`undefined` fields are stripped.** Firestore rejects `undefined` outright, which
  previously caused audit writes to fail on optional fields.

## What is currently audited

Every write to family data goes through an API route, and `firestore.rules` denies those
writes to clients, so the trail cannot be bypassed:

| Action | Route |
|---|---|
| `user_registered` | `POST /api/auth/register` |
| `invitation_created` | `POST /api/invitations` |
| `invitation_cancelled` | `POST /api/invitations/{id}/cancel` |
| `baby_profile_created` | `POST /api/babies` |
| `baby_profile_updated` | `PATCH /api/babies/{id}` (field names only, never values) |
| `baby_profile_archived` / `baby_profile_restored` | `POST /api/babies/{id}/archive` |
| `baby_profile_deleted` | `DELETE /api/babies/{id}` |
| `sleep_record_created` / `_updated` / `_deleted` | `/api/babies/{id}/sleep-records[/{rid}]` |
| `system_bootstrapped` | `POST /api/admin/bootstrap` |

Not audited: a user editing their own profile document (display name, preferences),
which the rules allow directly and which carries no authorization.

## Reading entries

`AuditLogger.searchAuditLogs()` supports filtering by user, action, category,
severity, target and date range, with pagination. Admin-only, enforced by the rules.

`AuditLogger.generateComplianceReport()` aggregates entries into a downloadable
report. It does **not** persist the report: `compliance_reports` is client-write-denied
like the audit collections, so the previous `setDoc` always failed. Persisting reports
would need a server route, and nothing currently reads stored reports back.

## Collections

| Collection | Written by | Read by |
|---|---|---|
| `audit_logs` | server (`auditLog`) | admins |
| `audit_logs_security` | nothing | admins |
| `audit_logs_compliance` | nothing | admins |
| `compliance_reports` | nothing | admins |

The three unwritten collections remain declared in `firestore.rules` from the earlier
design. They are harmless but currently dead — if severity-based routing is not going
to be built, they should be removed along with their rules blocks.

## Adding a new action

1. Add the action name to the `AuditAction` union in `src/types/auth.ts`.
2. Map it to a category in `categorizeAction` in `src/services/auditLogger.ts` —
   TypeScript enforces this: the map is typed `Record<AuditAction, AuditCategory>`, so
   an unmapped action fails the build.
3. Call `auditLog()` from the server route that performs the operation.

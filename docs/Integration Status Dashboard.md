# Integration Status

**Last updated:** 2026-09-06

> The previous version of this document reported "29/29 components, 100% integrated" for a
> system in which no account could complete signup. It measured whether a component
> imported a service, not whether the resulting operation succeeded. What follows tracks
> the latter.

## How authorization works now

| Layer | Role |
|---|---|
| Firebase Auth custom claims (`role`, `organizationId`) | Set server-side at registration. The basis for every check below. |
| `firestore.rules` | The enforced boundary. Reads claims; no document lookups on hot paths. |
| Next.js API routes (`src/app/api/**`) | All privileged work, via the Admin SDK. Verifies the caller's ID token. |
| `src/lib/permissions.ts` | Static role→permission map. Advisory: shapes UI and error messages. |

## Working, with test coverage

| Flow | Verified by |
|---|---|
| Registration by invitation code (all roles) | `tests/api.test.ts` |
| Custom claims set on the new account | `tests/api.test.ts` |
| Parent linked to the baby their invitation names | `tests/api.test.ts` |
| Invitation code validation before signup (unauthenticated) | `tests/api.test.ts` |
| Invitation create / list / cancel, with role scoping | `tests/api.test.ts` |
| Baby profile creation, issuing a real parent invitation code | `tests/api.test.ts` |
| First-admin bootstrap, and its refusal to run twice | `tests/api.test.ts` |
| Family isolation: a parent cannot reach another family's data | `tests/rules.test.ts` |
| Coach isolation: only babies assigned to them | `tests/rules.test.ts` |
| Organization isolation, admins included | `tests/rules.test.ts` |
| Users cannot escalate their own role or permissions | `tests/rules.test.ts` |
| Clients cannot create users or forge audit logs | `tests/rules.test.ts` |

## Known gaps

These are real and currently unaddressed. None of them block the core flows.

- **No route-level auth on the server.** `admin/layout.tsx` and `coach/layout.tsx` check
  the role on the client, so an unauthorized user briefly loads the page shell before
  being redirected. The data behind it is protected by Firestore rules, so this is a
  polish issue rather than an exposure. Next.js middleware would close it.
- **No auth context provider.** Every component calls `AuthService.getCurrentUser()`
  independently, and each call attaches a fresh `onAuthStateChanged` listener and re-reads
  the user document. Works, but re-fetches far more than it needs to.
- **Client-side audit calls are inert.** `AuditLogger` still runs in some client paths;
  `audit_logs` is client-write-denied by design, and those writes are swallowed. Real
  audit entries come from the server (`src/lib/server/audit.ts`). The remaining client
  calls should be removed rather than left looking functional.
- **Placeholder screens.** `/coach/calendar`, `/coach/reports` and `/coach/settings` are
  static shells. `/admin/roles` lists system roles but its create/edit/delete buttons are
  toast-only no-ops — custom roles are not on the authorization path, so nothing depends
  on them.
- **No rate limiting** on `/api/invitations/validate` or `/api/auth/register`.
- **Email templates are stored but unused.** Nothing sends email; invitation codes are
  shared manually. `/admin/email-templates` works as a content editor only.

# Integration Status

**Last updated:** 2026-11-21

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
| Baby edits, archive/restore, delete and sleep-record writes are server-only and audited | `tests/api.test.ts`, `tests/rules.test.ts` |
| Admins read only their own organization's audit logs | `tests/rules.test.ts` |
| Protected pages redirect before rendering without a valid session cookie | `tests/session.test.ts`, `e2e/route-protection.spec.ts` |
| Rate limiting on the unauthenticated endpoints | `tests/api.test.ts` |
| Every role's main screens, signup, sleep logging (in a real browser, dev and production builds) | `e2e/*.spec.ts` |
| Security headers, not-found page, health check | `e2e/route-protection.spec.ts` |

## Known gaps

- **Never run against a real Firebase project** (issue #14). Everything above runs
  against the emulators, which do not enforce composite indexes or real credentials.
  `firestore.indexes.json` was audited against every compound query in `src/`, and
  `GET /api/health` checks credentials on a live deploy, but the first production deploy
  is still the first real test.
- **Placeholder screens** (`/coach/calendar`, `/coach/reports`, `/coach/settings`,
  `/admin/settings`, `/admin/roles` create/edit/delete) remain, by product decision
  (issues #5–#7 closed as won't-fix).
- **Email templates are stored but unused.** Invitation codes are shared manually.
- **Rate limits are per instance**, not distributed.

# Laila Tov – Baby Sleep Tracking App

**Laila Tov** (לילה טוב – “Good Night”) is a web application that helps sleep consultants and parents track and manage baby sleep patterns.  
It provides an organized, collaborative environment where consultants can monitor multiple families while parents record daily sleep data.

---

## Overview

The platform enables consultants to follow each baby's sleep history and provide personalized feedback, while parents easily log sleep cycles and view their coach’s notes — all in one secure, real-time system.

The application is built on **Next.js**, **React**, and **Firebase** (Authentication + Firestore) for data storage and real-time synchronization.

---

## Key Features

### For Coaches
- Dashboard showing all assigned babies and their latest sleep updates.  
- Add, edit, archive, or restore baby profiles.  
- Write consultant notes visible to parents.  
- Generate unique invite codes for new parent accounts.  
- Export baby sleep data to CSV or PDF.  

### For Parents
- Log daily sleep cycles (bedtime, wake time, and other details).  
- Edit or delete recent sleep records.  
- View full sleep history for their baby.  
- See consultant notes and recommendations (read-only).  

### System
- Real-time updates between parents and coaches.  
- Secure Firebase Authentication and Firestore data storage.  
- Responsive design with full Hebrew right-to-left support.  

---

## User Roles & Permissions

| Role | Access | Description |
|------|---------|-------------|
| **Parent** | Read/write only their own baby's records | Can log, edit, and delete personal sleep data. Can view coach notes but cannot modify them or see other families. |
| **Coach** | Read/write for babies they created | Can manage assigned babies, add notes, and invite parents. Cannot access other coaches’ data. |
| **Admin** | Full system access | Can manage all users and data, approve new coaches, and impersonate any account for support. |

All data is synchronized securely through Firebase. Each user’s permissions are enforced both in the interface and at the database level.

---

## Technology

- **Next.js + React** – Front-end framework and UI logic  
- **TypeScript** – Type-safe development  
- **Firebase (Auth + Firestore)** – Authentication, database, and hosting  
- **Tailwind CSS + ShadCN UI** – Responsive design system  
- **Lucide Icons**, **date-fns** – Utilities and visuals  

---

## Architecture

The app is a Next.js front end talking to Firebase, plus a small server layer.

**Authorization keys off Firebase Auth custom claims.** `role` and `organizationId` are
set server-side with the Admin SDK when an account is created, so `firestore.rules` can
read `request.auth.token.role` directly instead of fetching a user document to decide
whether that document may be read.

**Privileged work happens in Next.js API routes** (`src/app/api/**`), not in the browser.
Creating accounts, setting claims, minting and cancelling invitation codes, and writing
audit logs all require the Admin SDK. Running them server-side keeps Firestore rules able
to deny those writes to clients outright.

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/auth/register` | none | Redeem a code: create the account, set claims, link a parent to their baby |
| `GET /api/invitations/validate` | none | Check a code from the signup page, before any account exists |
| `POST /api/invitations` | admin, coach | Mint an invitation code |
| `GET /api/invitations` | admin, coach | List invitations (admin: whole org, coach: their own) |
| `POST /api/invitations/{id}/cancel` | admin, coach | Soft-cancel, keeping history |
| `POST /api/babies` | coach, admin | Create a baby profile and its parent invitation together |
| `PATCH /api/babies/{id}` | assigned coach, admin | Edit a profile's descriptive fields |
| `DELETE /api/babies/{id}` | admin | Delete a profile and its sleep records |
| `POST /api/babies/{id}/archive` | assigned coach, admin | Archive or restore (`{ archived: boolean }`) |
| `POST /api/babies/{id}/sleep-records` | parent of the baby, assigned coach, admin | Log a day's sleep |
| `PATCH`/`DELETE /api/babies/{id}/sleep-records/{rid}` | same | Edit or delete a record |
| `POST`/`DELETE /api/auth/session` | fresh ID token / none | Create or clear the session cookie |
| `POST /api/admin/bootstrap` | shared secret | Create the first organization and admin |
| `GET /api/health` | none (rate limited) | 200 when Firestore and Auth are reachable with the server credentials |

**Every write to family data goes through these routes**, and `firestore.rules` denies
those writes to clients. Each route re-checks access and writes an audit entry, so the
audit trail is complete (see `docs/LOGGING.md`). Reads still go straight from the
browser to Firestore, guarded by the rules.

**Protected pages are checked on the server.** At sign-in the client exchanges its ID
token for an httpOnly session cookie (`POST /api/auth/session`); `src/middleware.ts`
verifies it at the edge and redirects before `/admin`, `/coach` or `/parent` render for
anyone without the right role.

**Permissions** come from a static role-to-permission map (`src/lib/permissions.ts`) — no
Firestore lookup, so a permission check cannot fail merely because a collection is empty.
That map is advisory, for UI and error messages; the enforced boundary is
`firestore.rules` plus the API routes.

**Invitations are delivered manually.** A coach or admin generates a code and shares it
directly. There is no email provider and nothing to configure.

---

## Getting started

Requirements: Node 22+ (firebase-admin requires it), and a JDK 21+ for the Firestore emulator (`npm run emulators`
finds a suitable JDK automatically and will tell you how to install one if there is none).

```bash
npm install
cp .env.example .env.local     # defaults target the emulators; no edits needed
```

Then, in two terminals:

```bash
npm run emulators              # Firebase Auth + Firestore, local and free
npm run seed                   # demo organization, users, baby and sleep data
```

```bash
npm run dev                    # http://localhost:9002
```

The seed prints its logins. All use the password `Password123!`:

| Role | Email |
|---|---|
| Admin | `admin@lailatov.test` |
| Coach | `coach@lailatov.test` |
| Parent | `parent@lailatov.test` |

It also leaves an unused invitation code, `DEMO2468`, so the signup flow can be tried
immediately.

No Firebase project or credentials are required for any of this — the emulators run
entirely offline, and the `demo-` project prefix guarantees nothing reaches a real
project.

### Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # unit + security-rules tests, in their own emulator
npm run test:e2e    # browser tests, in their own emulator and app instance
npm run build
```

Both test commands start and stop the emulator they need, on ports separate from the
development one — so they can run while `npm run dev` is up, and cannot touch the data
`npm run seed` created.

> **Stop the dev server before building.** `npm run dev` uses Turbopack and
> `npm run build` uses Webpack, and both write to `.next`. Running them at the same
> time leaves a mixed directory, and the resulting server starts fine but returns 500
> on every route with *"Expected to use Webpack bindings ... referencing Turbopack
> bindings"*. `npm run build` now clears `.next` first, so a stale mix is cleaned up
> on the next build either way.

The unit suite covers the security rules (family isolation, cross-organization access,
privilege escalation) and the API routes (registration, invitation lifecycle, baby
creation). Rules tests matter most: rules are the real boundary, since anything in the
client can be bypassed by talking to Firestore directly.

The browser suite (`e2e/`) drives the real UI in Chromium: sign-in for each role,
invitation redemption, baby creation, sleep logging and family isolation. Several specs
exist to catch regressions this project has already had — the sleep-logging spec
reloads the page before asserting, because the date bug it guards only appeared after a
reload.

---

## Deploying

The site is set up for **Netlify** (`netlify.toml`), which runs the pages, the API
routes and the middleware with no extra configuration. Firebase stays on the free
**Spark** plan: Cloud Functions are not used.

**1. Create a Firebase project** (region `me-west1`, matching `firebase.json`). Enable
**Authentication → Email/Password** and **Firestore**. Register a web app to get the
`NEXT_PUBLIC_FIREBASE_*` values.

**2. Deploy rules and indexes**, then wait until every index shows *Enabled* in the
console (queries that need a still-building index fail with `FAILED_PRECONDITION`):

```bash
npx firebase login
npx firebase use --add            # pick the project
npx firebase deploy --only firestore
```

**3. Set environment variables in Netlify** (Site configuration → Environment
variables), then trigger a deploy:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`, `_APP_ID` | From Firebase Console → Project settings → Your apps. Not secret. |
| `NEXT_PUBLIC_USE_EMULATORS` | `false`. The build refuses `true` on Netlify. |
| `FIREBASE_CLIENT_EMAIL` | **Secret.** `client_email` from the service-account JSON (Project settings → Service accounts → Generate new private key). |
| `FIREBASE_PRIVATE_KEY` | **Secret.** `private_key` from the same file, pasted as-is (the `\n` sequences are handled). |
| `ADMIN_BOOTSTRAP_SECRET` | **Secret.** A long random string (`openssl rand -hex 32`). Delete after step 4. |
| `NEXT_PUBLIC_APP_URL` | The site's public URL. |

Netlify limits a function's environment to 4 KB in total, which is why the two-variable
form is recommended over `FIREBASE_SERVICE_ACCOUNT_KEY` (the whole JSON, still
supported, but ~2.4 KB on its own). Mark the secret variables *Contains secret values*
and scope them to **Functions** only, so they are never exposed to the build output.

**4. Check the deploy and create the first admin.** `GET /api/health` must return
`{"status":"ok"}` — if it returns 503, the server credentials are wrong (details are in
the Netlify function log). Then:

```bash
curl -X POST https://your-site.netlify.app/api/admin/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"secret":"<ADMIN_BOOTSTRAP_SECRET>","email":"you@example.com",
       "password":"<strong password>","displayName":"Your Name",
       "organizationName":"Your Clinic"}'
```

The endpoint refuses to run once any admin exists. Delete `ADMIN_BOOTSTRAP_SECRET` from
Netlify afterwards.

**5. Lock down the web API key and auth domain.** In Google Cloud Console → APIs &
Services → Credentials, restrict the browser key to your site's domain (HTTP referrers).
In Firebase Console → Authentication → Settings → Authorized domains, add the Netlify
domain (and your custom domain, if any).

From there: sign in as the admin, invite a coach, and the coach invites parents when
they create a baby profile.

### Backups

Managed Firestore backups need the paid Blaze plan. On Spark, run the export script from
a trusted machine (it reads the same credential variables as the server):

```bash
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<project> FIREBASE_CLIENT_EMAIL=... FIREBASE_PRIVATE_KEY=... \
  npm run backup              # -> backups/firestore-<project>-<time>.json (git-ignored)
npx firebase auth:export backups/auth.json --project <project>
```

The files contain family data: store them encrypted and private.

---

## Security

Authorization is enforced in two places, both server-side:

- **`firestore.rules`** — the real boundary. Parents reach only their own baby's records;
  coaches only babies assigned to them; admins only their own organization. Users cannot
  modify their own `role`, `permissions`, `status`, or baby assignments, and no client can
  create a user document or write an audit log.
- **API routes** — verify the caller's Firebase ID token with the Admin SDK and check role
  and permission before acting. All writes to family data go through them.
- **Middleware** — verifies the httpOnly session cookie before protected pages render.
- **Response headers** — a Content-Security-Policy limiting network access to Firebase,
  HSTS, `X-Frame-Options: DENY` and friends, set in `next.config.ts`.
- **Rate limits** on the unauthenticated endpoints (`src/lib/server/rateLimit.ts`).
  Per-instance memory: on serverless the effective limit is higher, so treat it as
  friction for scripted probing, not a hard cap.

Client-side role checks exist only to shape the UI. They are not a security boundary and
are not treated as one.

**Secrets:** the `NEXT_PUBLIC_FIREBASE_*` values are not secret (a web API key identifies a
project, it does not authenticate). `FIREBASE_PRIVATE_KEY` / `FIREBASE_SERVICE_ACCOUNT_KEY`
and `ADMIN_BOOTSTRAP_SECRET` are, and belong only in `.env.local` or your host's secret
store.

**Known, accepted:** `npm audit` still flags build-time tooling (`picomatch`, the PostCSS
copy bundled inside Next.js, which only ever processes this repo's own CSS) and `zod`
(used only for in-browser form validation). None of them handles untrusted input on the
server; the fixes are breaking major upgrades.

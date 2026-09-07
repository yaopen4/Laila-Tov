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
| `POST /api/admin/bootstrap` | shared secret | Create the first organization and admin |

**Permissions** come from a static role-to-permission map (`src/lib/permissions.ts`) — no
Firestore lookup, so a permission check cannot fail merely because a collection is empty.
That map is advisory, for UI and error messages; the enforced boundary is
`firestore.rules` plus the API routes.

**Invitations are delivered manually.** A coach or admin generates a code and shares it
directly. There is no email provider and nothing to configure.

---

## Getting started

Requirements: Node 20+, and a JDK 21+ for the Firestore emulator (`npm run emulators`
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
npm test            # starts emulators, runs the suite, shuts them down
npm run build
```

> **Stop the dev server before building.** `npm run dev` uses Turbopack and
> `npm run build` uses Webpack, and both write to `.next`. Running them at the same
> time leaves a mixed directory, and the resulting server starts fine but returns 500
> on every route with *"Expected to use Webpack bindings ... referencing Turbopack
> bindings"*. `npm run build` now clears `.next` first, so a stale mix is cleaned up
> on the next build either way.

The test suite covers the security rules (family isolation, cross-organization access,
privilege escalation) and the API routes (registration, invitation lifecycle, baby
creation). Rules tests matter most: rules are the real boundary, since anything in the
client can be bypassed by talking to Firestore directly.

---

## Deploying

Everything below fits in free tiers. Cloud Functions are not used, so the Firebase
**Spark** plan is sufficient — no billing account required.

**1. Create a Firebase project**, enable Email/Password authentication and Firestore.

**2. Deploy rules and indexes:**

```bash
npx firebase use --add            # select your project
npx firebase deploy --only firestore
```

**3. Host the app** on Vercel's free tier or Firebase App Hosting — both run the Next.js
API routes. Set these environment variables on the host:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | From Firebase Console → Project settings. Not secret. |
| `NEXT_PUBLIC_USE_EMULATORS` | `false` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | **Secret.** The service-account JSON on one line, from Project settings → Service accounts. Never commit it. |
| `ADMIN_BOOTSTRAP_SECRET` | A long random string. Rotate or unset after first use. |

**4. Create the first admin.** Invitations can only be issued by an admin, and admins are
created by redeeming an invitation, so one has to be seeded:

```bash
curl -X POST https://your-app/api/admin/bootstrap   -H "Content-Type: application/json"   -d '{"secret":"<ADMIN_BOOTSTRAP_SECRET>","email":"you@example.com",
       "password":"<strong password>","displayName":"Your Name",
       "organizationName":"Your Clinic"}'
```

The endpoint refuses to run once any admin exists. Unset `ADMIN_BOOTSTRAP_SECRET`
afterwards.

From there: sign in as the admin, invite a coach, and the coach invites parents when
they create a baby profile.

---

## Security

Authorization is enforced in two places, both server-side:

- **`firestore.rules`** — the real boundary. Parents reach only their own baby's records;
  coaches only babies assigned to them; admins only their own organization. Users cannot
  modify their own `role`, `permissions`, `status`, or baby assignments, and no client can
  create a user document or write an audit log.
- **API routes** — verify the caller's Firebase ID token with the Admin SDK and check role
  and permission before acting.

Client-side role checks exist only to shape the UI. They are not a security boundary and
are not treated as one.

**Secrets:** the `NEXT_PUBLIC_FIREBASE_*` values are not secret (a web API key identifies a
project, it does not authenticate). `FIREBASE_SERVICE_ACCOUNT_KEY` and
`ADMIN_BOOTSTRAP_SECRET` are, and belong only in `.env.local` or your host's secret store.

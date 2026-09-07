import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end browser tests.
 *
 * Run with `npm run test:e2e`, which starts a dedicated Firebase emulator, seeds it,
 * and then invokes this config. Running `npx playwright test` directly will fail at
 * the first request, because nothing is serving the emulator this config points at.
 *
 * ## Isolation
 *
 * These tests sign users in, create babies and write sleep records. They must never do
 * that to the emulator a developer is using: an earlier test run silently deleted the
 * seeded demo data mid-session, and it surfaced later as "the invitation code doesn't
 * work". So e2e gets its own emulator (firebase.test.json, Firestore 8090 / Auth 9089,
 * project demo-laila-tov-test) and its own app port, leaving `npm run dev` on 9002 and
 * the dev emulator on 8080/9099 untouched.
 *
 * ## Why the dev server rather than a production build
 *
 * `NEXT_PUBLIC_*` values are inlined into the client bundle at build time. A production
 * build would therefore bake in whatever `.env.local` says — the *dev* emulator — and
 * pointing it elsewhere would need a separate build with different env. `next dev`
 * compiles per request from the running process's environment, so passing the e2e
 * values through `webServer.env` below is enough. It also writes to `.next-dev`, so it
 * cannot disturb a production build in `.next`.
 */

const APP_PORT = 9003;
const FIRESTORE_PORT = 8090;
const AUTH_PORT = 9089;
const PROJECT_ID = 'demo-laila-tov-test';

export default defineConfig({
  testDir: './e2e',
  // The app is Hebrew and right-to-left; render it the way users see it.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Serial: the specs share one seeded dataset and some of them mutate it.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // Retry once everywhere. These drive a real browser against a real server and
  // emulator, so a transient network suspension or a slow first compile can fail a
  // run for reasons unrelated to the code. A retry cannot hide a deterministic
  // assertion failure -- that fails again -- only genuinely flaky infrastructure.
  retries: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: `npx next dev -p ${APP_PORT}`,
    url: `http://localhost:${APP_PORT}`,
    reuseExistingServer: !process.env.CI,
    // Turbopack's first compile of a route is slow; each page is compiled on demand.
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      // Point the app at the e2e emulator, not the developer's.
      NEXT_PUBLIC_USE_EMULATORS: 'true',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
      NEXT_PUBLIC_AUTH_EMULATOR_HOST: `localhost:${AUTH_PORT}`,
      NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: `localhost:${FIRESTORE_PORT}`,
      // Server-side (API routes) Admin SDK.
      FIREBASE_PROJECT_ID: PROJECT_ID,
      FIRESTORE_EMULATOR_HOST: `localhost:${FIRESTORE_PORT}`,
      FIREBASE_AUTH_EMULATOR_HOST: `localhost:${AUTH_PORT}`,
      ADMIN_BOOTSTRAP_SECRET: 'e2e-bootstrap-secret-not-a-real-one',
    },
  },
});

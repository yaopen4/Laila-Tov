/**
 * Point the Admin SDK at the emulators before any test imports it.
 *
 * `npm test` runs under `firebase emulators:exec`, which exports these itself; this
 * fills them in when running vitest directly against already-running emulators.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

/**
 * Tests run against their OWN emulator instance, on separate ports from the one
 * `npm run emulators` starts for development.
 *
 * The suite wipes Firestore and Auth between cases. Sharing an emulator with the dev
 * environment means a test run destroys the data `npm run seed` created -- which is
 * exactly what happened once, silently, mid-session. Separate ports make that
 * impossible rather than merely discouraged, and let the suite run while the app is
 * in use.
 *
 * `npm test` starts this instance via firebase.test.json. Running `npx vitest run`
 * bare will simply find nothing on these ports and fail fast, instead of quietly
 * eating the dev data.
 *
 * Set unconditionally: values inherited from .env.local point at the DEV emulator.
 */
export const TEST_PROJECT_ID = 'demo-laila-tov-test';
export const TEST_FIRESTORE_PORT = 8090;
export const TEST_AUTH_PORT = 9089;

process.env.FIRESTORE_EMULATOR_HOST = `localhost:${TEST_FIRESTORE_PORT}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `localhost:${TEST_AUTH_PORT}`;
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = TEST_PROJECT_ID;
process.env.FIREBASE_PROJECT_ID = TEST_PROJECT_ID;

process.env.ADMIN_BOOTSTRAP_SECRET ??= 'test-bootstrap-secret-value';

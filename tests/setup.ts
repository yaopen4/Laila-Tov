/**
 * Point the Admin SDK at the emulators before any test imports it.
 *
 * `npm test` runs under `firebase emulators:exec`, which exports these itself; this
 * fills them in when running vitest directly against already-running emulators.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= 'localhost:9099';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= 'demo-laila-tov';
process.env.FIREBASE_PROJECT_ID ??= process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
process.env.ADMIN_BOOTSTRAP_SECRET ??= 'test-bootstrap-secret-value';

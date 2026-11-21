#!/usr/bin/env node
/**
 * Run the end-to-end browser tests.
 *
 *   emulators (own instance) -> seed -> playwright
 *
 * The emulator is started by `firebase emulators:exec`, which tears it down again
 * afterwards, so this leaves nothing running. It uses firebase.test.json — separate
 * ports and a separate project from the emulator `npm run emulators` starts, so a
 * developer's seeded data is never touched.
 *
 * Usage:  npm run test:e2e            (all specs)
 *         npm run test:e2e -- --ui    (Playwright's interactive mode)
 *         npm run test:e2e -- e2e/signup.spec.ts
 */
import { spawn } from 'node:child_process';

const PROJECT_ID = 'demo-laila-tov-test';
const FIRESTORE_PORT = 8090;
const AUTH_PORT = 9089;

/** Env the seed and the test runner both need to reach the e2e emulator. */
const emulatorEnv = {
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
  FIREBASE_PROJECT_ID: PROJECT_ID,
  FIRESTORE_EMULATOR_HOST: `localhost:${FIRESTORE_PORT}`,
  FIREBASE_AUTH_EMULATOR_HOST: `localhost:${AUTH_PORT}`,
};

function run(command, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv },
    });
    child.on('exit', (code, signal) => {
      if (signal) return reject(new Error(`killed by ${signal}`));
      if (code !== 0) return reject(new Error(`exited with ${code}`));
      resolve();
    });
  });
}

// Everything inside emulators:exec runs against the e2e emulator; the CLI exports
// FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST to the child for us, but we
// set them anyway so the seed's own emulator-only guard is satisfied deterministically.
const args = process.argv.slice(2).join(' ');
const inner = [
  'npx tsx scripts/seed.ts',
  `npx playwright test ${args}`.trim(),
].join(' && ');

const command =
  `node scripts/with-java.mjs firebase emulators:exec ` +
  `--config firebase.test.json --project ${PROJECT_ID} ` +
  `"${inner.replace(/"/g, '\\"')}"`;

run(command, emulatorEnv).catch((error) => {
  console.error(`\ne2e run failed: ${error.message}`);
  process.exit(1);
});

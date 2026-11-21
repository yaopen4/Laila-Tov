import 'server-only';

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { readServiceAccount } from './serviceAccount';

export { normalizePrivateKey, readServiceAccount } from './serviceAccount';

/**
 * Firebase Admin SDK — server only.
 *
 * Every privileged operation (creating users, setting custom claims, writing audit
 * logs) runs through here. The Admin SDK bypasses Firestore security rules, so it is
 * the only place those operations can legally happen; the browser cannot and must not
 * do them.
 *
 * Credentials, in order of preference:
 *  1. Emulators — when FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST are set,
 *     the SDK talks to the local emulator and needs no real credentials at all.
 *  2. FIREBASE_SERVICE_ACCOUNT_KEY — the service-account JSON, as a single-line string.
 *     This IS a secret. It belongs in .env.local or the host's secret store, never in git.
 *  3. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY — the same credential split in two.
 *     Smaller than the whole JSON, which matters on hosts that cap the total size of
 *     a function's environment (Netlify and AWS Lambda allow 4 KB in all).
 *  4. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS), for Google-hosted
 *     environments that inject them automatically.
 */

const usingEmulators = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST
);

function createApp(): App {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error(
      'FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID) must be set for the Admin SDK.'
    );
  }

  // Against the emulators no credential is required — a projectId is enough.
  if (usingEmulators) {
    return initializeApp({ projectId });
  }

  const serviceAccount = readServiceAccount(process.env);
  if (serviceAccount) {
    const resolvedProjectId = serviceAccount.projectId ?? projectId;
    return initializeApp({
      credential: cert({
        projectId: resolvedProjectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
      projectId: resolvedProjectId,
    });
  }

  // Falls back to Application Default Credentials.
  return initializeApp({ projectId });
}

const adminApp: App = getApps().length === 0 ? createApp() : getApps()[0];

export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp);
export const isUsingEmulators = usingEmulators;

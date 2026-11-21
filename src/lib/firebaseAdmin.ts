import 'server-only';

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

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

interface ServiceAccount {
  projectId?: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * Hosts that store a PEM key in a single-line variable often leave the newlines as a
 * literal backslash-n. The PEM parser rejects that with an opaque error, so restore
 * real newlines. Harmless when the key already contains them.
 */
export function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n');
}

/** Read a service account from the environment, or return null if none is configured. */
export function readServiceAccount(env: NodeJS.ProcessEnv): ServiceAccount | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (raw) {
    let parsed: { project_id?: string; client_email?: string; private_key?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON. It should be the whole service-account ' +
          'file contents on one line. Alternatively set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
      );
    }
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is missing client_email or private_key.');
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    };
  }

  const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = env.FIREBASE_PRIVATE_KEY?.trim();
  if (clientEmail || privateKey) {
    if (!clientEmail || !privateKey) {
      throw new Error('FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must be set together.');
    }
    // Some dashboards keep surrounding quotes when the value is pasted with them.
    const unquoted = privateKey.replace(/^"|"$/g, '');
    return { clientEmail, privateKey: normalizePrivateKey(unquoted) };
  }

  return null;
}

const adminApp: App = getApps().length === 0 ? createApp() : getApps()[0];

export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp);
export const isUsingEmulators = usingEmulators;

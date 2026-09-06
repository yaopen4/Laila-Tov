import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

/**
 * Client-side Firebase configuration.
 *
 * These values come from NEXT_PUBLIC_* env vars so the project can be pointed at
 * an emulator, a staging project, or production without a code change. A Firebase
 * web API key is not a secret (it identifies the project, it does not authenticate),
 * but hardcoding it left no way to switch environments.
 *
 * When NEXT_PUBLIC_USE_EMULATORS is 'true' the SDK is pointed at the local
 * Firebase Emulator Suite and the config values are only placeholders.
 */
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const REQUIRED: Array<[keyof typeof firebaseConfig, string]> = [
  ['apiKey', 'NEXT_PUBLIC_FIREBASE_API_KEY'],
  ['projectId', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
];

const missing = REQUIRED.filter(([key]) => !firebaseConfig[key]?.trim()).map(([, name]) => name);

if (missing.length > 0) {
  throw new Error(
    `Firebase config is missing: ${missing.join(', ')}. ` +
      `Copy .env.example to .env.local and fill it in, then restart the dev server. ` +
      `To run without a real Firebase project, set NEXT_PUBLIC_USE_EMULATORS=true and keep the emulator defaults.`
  );
}

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

/**
 * Connect to the local emulators exactly once. getApps() guards re-initialisation of
 * the app itself, but the connect* helpers throw if called twice on the same instance,
 * which happens under Next.js fast refresh — hence the global flag.
 */
declare global {
  // eslint-disable-next-line no-var
  var __lailaTovEmulatorsConnected: boolean | undefined;
}

if (useEmulators && !globalThis.__lailaTovEmulatorsConnected) {
  const authHost = process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST ?? 'localhost:9099';
  const [firestoreHost, firestorePort] = (
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? 'localhost:8080'
  ).split(':');

  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));

  globalThis.__lailaTovEmulatorsConnected = true;
  console.info(`[firebase] Using emulators (auth: ${authHost}, firestore: ${firestoreHost}:${firestorePort})`);
}

export { app, auth, db };

/**
 * Reading Admin SDK credentials from the environment.
 *
 * Separate from firebaseAdmin.ts (which is `server-only`) so command-line scripts such
 * as scripts/backup.ts can share the exact same parsing.
 */

export interface ServiceAccount {
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


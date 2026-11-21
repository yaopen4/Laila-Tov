/**
 * Firebase session-cookie verification that runs on the edge (Next.js middleware).
 *
 * The Admin SDK cannot run in middleware, so this verifies the cookie with `jose`
 * against Google's published signing keys — the same check
 * `adminAuth.verifySessionCookie` performs, minus the revocation lookup (which needs
 * a network call to the Auth backend on every request).
 *
 * That trade-off is acceptable because this layer only decides whether a page *shell*
 * may render. Data is protected independently by firestore.rules and the API routes,
 * both of which verify against live state. A revoked user with a still-valid cookie
 * sees an empty page, not anyone's records.
 *
 * Kept free of Node-only imports so it can be bundled for the edge runtime.
 */
import {
  decodeJwt,
  importX509,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';

import type { SessionRole } from './routeAccess';

export type { SessionRole } from './routeAccess';
export { rolesForPath } from './routeAccess';

export const SESSION_COOKIE = '__session';

/** Five days: long enough not to nag, short enough to bound a stolen cookie. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;


export interface Session {
  uid: string;
  role: SessionRole;
  organizationId: string;
}

const SESSION_KEYS_URL =
  'https://www.googleapis.com/identitytoolkit/v3/relyingparty/publicKeys';

let cachedKeys: { keys: Record<string, string>; expiresAt: number } | null = null;

/** Google's session-cookie signing certificates, cached per their Cache-Control. */
async function fetchSessionKeys(): Promise<Record<string, string>> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) {
    return cachedKeys.keys;
  }
  const response = await fetch(SESSION_KEYS_URL);
  if (!response.ok) {
    throw new Error(`Fetching session keys failed: ${response.status}`);
  }
  const keys = (await response.json()) as Record<string, string>;
  const maxAge = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1]);
  cachedKeys = {
    keys,
    expiresAt: Date.now() + (Number.isFinite(maxAge) && maxAge > 0 ? maxAge * 1000 : 3_600_000),
  };
  return keys;
}

const googleSessionKey: JWTVerifyGetKey = async (header) => {
  const keys = await fetchSessionKeys();
  const pem = header.kid ? keys[header.kid] : undefined;
  if (!pem) {
    throw new Error(`Unknown session key id: ${header.kid}`);
  }
  return importX509(pem, 'RS256');
};

function toSession(payload: JWTPayload): Session | null {
  const { sub, role, organizationId } = payload as JWTPayload & {
    role?: unknown;
    organizationId?: unknown;
  };
  if (
    typeof sub !== 'string' ||
    sub === '' ||
    (role !== 'admin' && role !== 'coach' && role !== 'parent') ||
    typeof organizationId !== 'string'
  ) {
    return null;
  }
  return { uid: sub, role, organizationId };
}

/**
 * The Auth emulator issues unsigned session cookies (alg "none"), which no key can
 * verify. Accept them only when the build targets the emulators AND a `demo-` project,
 * the prefix Firebase reserves for projects that can never exist in production.
 */
export function emulatorSessionsAllowed(env: {
  useEmulators?: string;
  projectId?: string;
}): boolean {
  return env.useEmulators === 'true' && Boolean(env.projectId?.startsWith('demo-'));
}

export interface VerifyOptions {
  projectId: string;
  allowUnsigned?: boolean;
  /** Override the key source; tests inject a local key pair. */
  getKey?: JWTVerifyGetKey;
}

/** Verify a session cookie and return its identity, or null if it is not acceptable. */
export async function verifySessionCookie(
  cookie: string | undefined,
  { projectId, allowUnsigned = false, getKey = googleSessionKey }: VerifyOptions
): Promise<Session | null> {
  if (!cookie) return null;

  const issuer = `https://session.firebase.google.com/${projectId}`;

  try {
    if (allowUnsigned) {
      const payload = decodeJwt(cookie);
      const now = Math.floor(Date.now() / 1000);
      if (payload.iss !== issuer || payload.aud !== projectId) return null;
      if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
      return toSession(payload);
    }

    const { payload } = await jwtVerify(cookie, getKey, {
      issuer,
      audience: projectId,
      algorithms: ['RS256'],
    });
    return toSession(payload);
  } catch {
    return null;
  }
}

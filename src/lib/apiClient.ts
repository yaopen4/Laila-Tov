import { auth } from './firebase';

/**
 * Thin client for the server API routes.
 *
 * Privileged work (creating accounts, minting invitation codes, cancelling them)
 * happens server-side, because it needs the Admin SDK. This attaches the caller's
 * Firebase ID token so the route can verify who is asking.
 */

export class ApiClientError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiClientError(401, 'לא מחובר. יש להתחבר מחדש.');
  }
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}) as Record<string, unknown>);
  if (!response.ok) {
    const message = typeof body.error === 'string' ? body.error : 'שגיאת שרת. נסה שוב.';
    throw new ApiClientError(response.status, message);
  }
  return body as T;
}

/** Authenticated request. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeaders()),
      ...(init.headers ?? {}),
    },
  });
  return parse<T>(response);
}

/** Unauthenticated request, for signup-time calls made before a token exists. */
export async function apiFetchPublic<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  return parse<T>(response);
}

import { NextResponse } from 'next/server';

import { adminAuth, adminDb, isUsingEmulators } from '@/lib/firebaseAdmin';
import { handleRoute } from '@/lib/apiAuth';
import { enforceRateLimit, LIMITS } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — is this deployment able to do its job?
 *
 * Checks the two things a fresh deploy most often gets wrong: the Admin SDK
 * credentials (FIREBASE_SERVICE_ACCOUNT_KEY / FIREBASE_CLIENT_EMAIL+PRIVATE_KEY) and
 * reachability of Firestore and Auth with them. Returns 200 only when both work, so it
 * can back an uptime monitor.
 *
 * Deliberately says nothing beyond ok/failed per check: error details (project ids,
 * key fragments) go to the server log, not to an unauthenticated caller.
 */
export async function GET(req: Request) {
  return handleRoute(async () => {
    enforceRateLimit(req, LIMITS.health);

    const check = async (name: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        return [name, 'ok'] as const;
      } catch (error) {
        console.error(`[health] ${name} check failed:`, error);
        return [name, 'failed'] as const;
      }
    };

    const results = Object.fromEntries(
      await Promise.all([
        check('firestore', () => adminDb.collection('organizations').limit(1).get()),
        check('auth', () => adminAuth.listUsers(1)),
      ])
    );

    const healthy = Object.values(results).every((r) => r === 'ok');

    return NextResponse.json(
      {
        status: healthy ? 'ok' : 'degraded',
        checks: results,
        emulators: isUsingEmulators,
        version: process.env.COMMIT_REF?.slice(0, 7) ?? null,
      },
      { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
    );
  });
}

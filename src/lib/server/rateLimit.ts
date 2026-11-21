import 'server-only';

import { ApiError } from '../apiAuth';

/**
 * Rate limiting for the endpoints that must accept unauthenticated callers.
 *
 * `POST /api/auth/register` and `GET /api/invitations/validate` cannot require a token:
 * the caller is a visitor redeeming an invitation and has no account yet. That makes
 * the validate endpoint an oracle for probing whether a code exists, and register a
 * way to burn codes. Neither was throttled.
 *
 * ## What this is, and what it is not
 *
 * State lives in this process's memory. On a serverless host each warm instance keeps
 * its own counters, so the effective limit is (configured limit x live instances), and
 * counters reset whenever an instance is recycled. It raises the cost of probing
 * enough to matter; it is **not** a distributed limiter and should not be described as
 * one.
 *
 * A durable limit needs shared storage — Vercel KV, Upstash, or Firestore with a TTL.
 * Worth doing if abuse ever shows up in the audit log; over-engineering it before then
 * would be building ahead of need.
 *
 * Guessing a code blindly is already impractical: the space is 29^8 (~5x10^11), codes
 * expire after 30 days, and registration additionally checks the invited email. This
 * is defence in depth.
 */

interface Window {
  /** Request timestamps (ms) inside the current window, oldest first. */
  hits: number[];
  /** When this entry was last touched, for cleanup. */
  lastSeen: number;
}

const buckets = new Map<string, Window>();

/** Drop entries untouched for an hour, so the map cannot grow without bound. */
const CLEANUP_AFTER_MS = 60 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_AFTER_MS) return;
  for (const [key, window] of buckets) {
    if (now - window.lastSeen > CLEANUP_AFTER_MS) buckets.delete(key);
  }
  lastCleanup = now;
}

/**
 * Best-effort client IP.
 *
 * `x-forwarded-for` is set by the proxy in front of the app; its first entry is the
 * original client. It is spoofable when the app is reached directly, which is another
 * reason not to treat this as a security boundary on its own.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export interface RateLimitOptions {
  /** Distinguishes one endpoint's budget from another's. */
  name: string;
  /** Requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Throws ApiError(429) when the caller has exceeded the budget.
 *
 * Sliding window rather than fixed buckets: a fixed window lets a caller send `limit`
 * requests at the end of one window and `limit` more at the start of the next.
 */
export function enforceRateLimit(req: Request, options: RateLimitOptions): void {
  const now = Date.now();
  cleanup(now);

  const key = `${options.name}:${clientIp(req)}`;
  const window = buckets.get(key) ?? { hits: [], lastSeen: now };

  // Discard hits that have aged out of the window.
  const cutoff = now - options.windowMs;
  window.hits = window.hits.filter((t) => t > cutoff);
  window.lastSeen = now;

  if (window.hits.length >= options.limit) {
    buckets.set(key, window);
    const retryAfterMs = window.hits[0]! + options.windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    throw new ApiError(
      429,
      `Rate limit exceeded for ${options.name} from ${clientIp(req)}`,
      `יותר מדי בקשות. נסה שוב בעוד ${retryAfterSeconds} שניות.`
    );
  }

  window.hits.push(now);
  buckets.set(key, window);
}

/** Budgets, kept together so they can be read at a glance. */
export const LIMITS = {
  /** Registration burns an invitation code; legitimate users need one or two attempts. */
  register: { name: 'register', limit: 10, windowMs: 15 * 60 * 1000 },
  /** Validation is the probing oracle, so it gets the tightest useful budget. */
  validateInvitation: { name: 'validate-invitation', limit: 30, windowMs: 15 * 60 * 1000 },
  /** Bootstrap runs once in a system's lifetime; anything more is an attack. */
  bootstrap: { name: 'bootstrap', limit: 5, windowMs: 60 * 60 * 1000 },
  /** Each health check makes two backend reads; keep it from becoming a cost lever. */
  health: { name: 'health', limit: 30, windowMs: 60 * 1000 },
} as const satisfies Record<string, RateLimitOptions>;

/** Test seam: clears all counters. */
export function __resetRateLimits(): void {
  buckets.clear();
}

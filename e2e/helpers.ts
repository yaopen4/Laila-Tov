import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared helpers and the seeded fixtures the specs rely on.
 *
 * Everything here mirrors `scripts/seed.ts`. If the seed changes, this changes with it.
 */

export const PASSWORD = 'Password123!';

export const USERS = {
  admin: { email: 'admin@lailatov.test', name: 'מנהלת המערכת' },
  coach: { email: 'coach@lailatov.test', name: 'יועצת שינה' },
  parent: { email: 'parent@lailatov.test', name: 'מיכל כהן' },
} as const;

export const SEEDED = {
  /** The baby `parent@` is linked to. */
  babyId: 'demo-baby',
  babyName: 'נועם',
  familyName: 'כהן',
  /** A second baby owned by the same coach, with NO parents — used for isolation tests. */
  foreignBabyId: 'demo-baby-2',
  /** Unused invitation, bound to this address. */
  inviteCode: 'DEMO2468',
  inviteEmail: 'newparent@lailatov.test',
} as const;

/** Sign in through the real login form and wait for the role redirect. */
export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/');
  await page.fill('#email-login', email);
  await page.fill('#password-login', password);
  await page.getByRole('button', { name: 'התחבר' }).click();

  // Landing anywhere other than '/' means auth resolved and the redirect ran.
  await page.waitForURL((url) => !url.pathname.match(/^\/?$/), { timeout: 30_000 });
}

/** Sign out by clearing client auth state, so the next spec starts clean. */
export async function logout(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(async () => {
    // Firebase persists the session in IndexedDB, not cookies.
    const databases = await indexedDB.databases?.();
    for (const db of databases ?? []) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Assert the page is not showing a crash.
 *
 * Next.js renders its error boundary text on an unhandled exception; the parent page
 * used to throw `RangeError: Invalid time value` from date-fns when a sleep record's
 * date came back as a Timestamp. Worth asserting explicitly rather than trusting that
 * a missing element would have failed the test.
 */
export async function expectNoCrash(page: Page): Promise<void> {
  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.locator('body')).not.toContainText('Invalid time value');
  await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
}

/**
 * Test object that surfaces browser-side failures in the Playwright output.
 *
 * Without it, a spec that fails because the app threw in the browser reports only
 * "expected URL X, got Y", and the actual cause stays buried in a trace file. The
 * `diagnostics` fixture is auto-instantiated, so every spec gets it without asking.
 */
export const test = base.extend<{ diagnostics: void }>({
  diagnostics: [
    async ({ page }, use, testInfo) => {
      const notes: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') notes.push('console.error: ' + msg.text());
      });
      page.on('pageerror', (error) => notes.push('pageerror: ' + error.message));
      page.on('requestfailed', (request) => {
        const reason = request.failure()?.errorText ?? 'unknown';
        notes.push('requestfailed: ' + request.method() + ' ' + request.url() + ' — ' + reason);
      });
      // Non-2xx responses from our own API are the most useful signal of all.
      page.on('response', async (response) => {
        if (!response.url().includes('/api/') || response.ok()) return;
        const body = await response.text().catch(() => '<unreadable>');
        notes.push('HTTP ' + response.status() + ' ' + response.url() + ' — ' + body.slice(0, 300));
      });

      await use();

      if (testInfo.status !== testInfo.expectedStatus && notes.length > 0) {
        const report = ['', '--- browser diagnostics: ' + testInfo.title + ' ---']
          .concat(notes.map((n) => '   ' + n))
          .concat(['--- end ---', ''])
          .join('\n');
        console.log(report);
      }
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';

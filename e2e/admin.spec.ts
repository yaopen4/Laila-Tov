import { USERS, expectNoCrash, login, logout, expect, test } from './helpers';

/**
 * Admin surfaces.
 *
 * These are smoke tests: each page reads from Firestore or the API and previously had
 * ways to fail silently — the audit viewer rendered an empty list because every audit
 * write was denied, and the invitations screen crashed on `.toDate()` after the API
 * started returning ISO strings. Loading without an error boundary is the bar here.
 */

test.describe('admin', () => {
  test.beforeEach(async ({ page }) => {
    await logout(page);
    await login(page, USERS.admin.email);
  });

  test('the dashboard loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expectNoCrash(page);
  });

  test('the manual invitations page loads and lists invitations', async ({ page }) => {
    await page.goto('/admin/manual-invitations');
    await expectNoCrash(page);
    // The API serialises timestamps as ISO strings; the page used to call .toDate() on them.
    await expect(page.locator('body')).not.toContainText('toDate is not a function');
    await expect(page.locator('body')).not.toContainText('Invalid Date');
  });

  test('the audit log page loads', async ({ page }) => {
    await page.goto('/admin/audit');
    await expectNoCrash(page);
  });

  test('the users page loads', async ({ page }) => {
    await page.goto('/admin/users');
    await expectNoCrash(page);
  });
});

test.describe('role separation in the UI', () => {
  test('a parent is kept out of the admin area', async ({ page }) => {
    await logout(page);
    await login(page, USERS.parent.email);

    await page.goto('/admin/dashboard');

    // Client-side guards redirect rather than block at the edge — see issue #3. What
    // must hold either way is that no admin data is rendered to a parent.
    await expect(page.locator('body')).not.toContainText('ניהול משתמשים', { timeout: 30_000 });
    await expectNoCrash(page);
  });

  test('a coach is kept out of the admin area', async ({ page }) => {
    await logout(page);
    await login(page, USERS.coach.email);

    await page.goto('/admin/dashboard');
    await expect(page.locator('body')).not.toContainText('ניהול משתמשים', { timeout: 30_000 });
    await expectNoCrash(page);
  });
});

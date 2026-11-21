import { PASSWORD, USERS, expect, login, logout, test } from './helpers';

/**
 * Server-side route protection (#3).
 *
 * The checks are made on the raw HTTP response, not on what the page shows after
 * hydration: the old client-side guard also ended on the login page, but only after
 * serving the protected shell. A 307 before any HTML is what distinguishes the two.
 */

test.describe('route protection', () => {
  test('a visitor without a session is redirected before the page renders', async ({ request }) => {
    const response = await request.get('/admin/dashboard', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()['location']).toContain('/?next=%2Fadmin%2Fdashboard');

    for (const path of ['/coach/dashboard', '/parent/some-baby']) {
      expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(307);
    }
  });

  test('a forged session cookie is rejected', async ({ request }) => {
    const response = await request.get('/coach/dashboard', {
      maxRedirects: 0,
      headers: { cookie: '__session=not.a.jwt' },
    });
    expect(response.status()).toBe(307);
  });

  test('a coach cannot open admin pages', async ({ page }) => {
    await logout(page);
    await login(page, USERS.coach.email);
    await expect(page).toHaveURL(/\/coach\/dashboard/);

    const response = await page.request.get('/admin/users', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
  });

  test('after signing in, the user returns to the page they asked for', async ({ page }) => {
    await logout(page);
    await page.goto('/coach/archive');
    await expect(page).toHaveURL(/\/\?next=%2Fcoach%2Farchive/);

    await page.fill('#email-login', USERS.coach.email);
    await page.fill('#password-login', PASSWORD);
    await page.getByRole('button', { name: 'התחבר' }).click();
    await expect(page).toHaveURL(/\/coach\/archive/);
  });

  test('signing out clears the session', async ({ page }) => {
    await logout(page);
    await login(page, USERS.coach.email);
    await expect(page).toHaveURL(/\/coach\/dashboard/);
    await page.getByRole('button', { name: 'התנתקות' }).click();
    await expect(page).toHaveURL(/\/$|\/\?/);

    const response = await page.request.get('/coach/dashboard', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
  });
});

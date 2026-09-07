import { SEEDED, USERS, expect, expectNoCrash, login, logout, test } from './helpers';

/**
 * Sign-in and sign-up.
 *
 * Registration deserves the most attention here: before the backend rebuild it could
 * never succeed. Creating /users/{uid} was gated on a rule that read /users/{uid}, so
 * the write was always denied — and the client then deleted the auth account it had
 * just created. Every registration rolled itself back. These specs would have caught
 * that on the first run.
 */

test.describe('sign in', () => {
  test.beforeEach(async ({ page }) => logout(page));

  test('a coach lands on the coach dashboard', async ({ page }) => {
    await login(page, USERS.coach.email);
    await expect(page).toHaveURL(/\/coach\/dashboard/);
    await expectNoCrash(page);
  });

  test('an admin lands on the admin dashboard', async ({ page }) => {
    await login(page, USERS.admin.email);
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expectNoCrash(page);
  });

  test("a parent lands on their own baby's page", async ({ page }) => {
    await login(page, USERS.parent.email);
    // The redirect target comes from the user's managedBabyProfiles, not a fixed route.
    await expect(page).toHaveURL(new RegExp(`/parent/${SEEDED.babyId}`));
    await expectNoCrash(page);
  });

  test('a wrong password is rejected and stays on the login page', async ({ page }) => {
    await page.goto('/');
    await page.fill('#email-login', USERS.coach.email);
    await page.fill('#password-login', 'definitely-not-the-password');
    await page.getByRole('button', { name: 'התחבר' }).click();

    // Still on login; no redirect happened.
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?$/);
    await expectNoCrash(page);
  });
});

test.describe('sign up with an invitation code', () => {
  test.beforeEach(async ({ page }) => logout(page));

  test('rejects a code that does not exist', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('#signup-name', 'לא קיים');
    await page.fill('#signup-email', 'nobody@lailatov.test');
    await page.fill('#signup-password', 'Password123!');
    await page.fill('#signup-invite-code', 'NOSUCH12');
    await page.getByRole('button', { name: /הירשם/ }).click();

    // The server answers in Hebrew; the form must surface it rather than crash.
    await expect(page.locator('body')).toContainText(/קוד ההזמנה|שגיאה/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/signup/);
    await expectNoCrash(page);
  });

  test('rejects a valid code offered with the wrong email address', async ({ page }) => {
    // Invitations are bound to the address they were issued for, so a leaked code
    // cannot be used to join another family. This asserts that binding holds in the UI.
    await page.goto('/signup');
    await page.fill('#signup-name', 'מישהו אחר');
    await page.fill('#signup-email', 'someone.else@lailatov.test');
    await page.fill('#signup-password', 'Password123!');
    await page.fill('#signup-invite-code', SEEDED.inviteCode);
    await page.getByRole('button', { name: /הירשם/ }).click();

    await expect(page.locator('body')).toContainText(/אינו תואם|קוד ההזמנה/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/signup/);
  });

  test('redeems a valid code and links the new parent to their baby', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('#signup-name', 'הורה חדש');
    await page.fill('#signup-email', SEEDED.inviteEmail);
    await page.fill('#signup-password', 'Password123!');
    await page.fill('#signup-invite-code', SEEDED.inviteCode);
    await page.getByRole('button', { name: /הירשם/ }).click();

    // Lands on the baby the invitation named -- proving the account was created, the
    // claims were set, AND the parent was linked. The old flow deleted the account here.
    await expect(page).toHaveURL(new RegExp(`/parent/${SEEDED.babyId}`), { timeout: 45_000 });
    await expectNoCrash(page);
  });

  test('refuses to reuse a code that has already been redeemed', async ({ page }) => {
    // Depends on the redemption above; the specs in this file run in order.
    await page.goto('/signup');
    await page.fill('#signup-name', 'שוב');
    await page.fill('#signup-email', SEEDED.inviteEmail);
    await page.fill('#signup-password', 'Password123!');
    await page.fill('#signup-invite-code', SEEDED.inviteCode);
    await page.getByRole('button', { name: /הירשם/ }).click();

    await expect(page.locator('body')).toContainText(/כבר נעשה שימוש|קוד ההזמנה|כבר רשומה/, {
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/\/signup/);
  });
});

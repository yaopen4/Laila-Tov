import { SEEDED, USERS, expectNoCrash, login, logout, expect, test } from './helpers';

/**
 * Parent flows — logging sleep, and family isolation.
 *
 * The reload assertion below is the most valuable test in the suite. Sleep record dates
 * were written as JS `Date` objects, which Firestore persisted as Timestamps; the page
 * then read them back with `new Date(...)`, got Invalid Date, and date-fns threw
 * "RangeError: Invalid time value", crashing the record card. It only appeared *after*
 * a reload, so writing the record and seeing a success toast proved nothing.
 */

test.describe('parent', () => {
  test.beforeEach(async ({ page }) => {
    await logout(page);
    await login(page, USERS.parent.email);
  });

  test('sees their own baby and the seeded sleep history', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`/parent/${SEEDED.babyId}`));
    await expect(page.locator('body')).toContainText(SEEDED.familyName, { timeout: 30_000 });
    await expectNoCrash(page);
  });

  test('the seeded sleep records render without a date crash', async ({ page }) => {
    // The seed writes dates as 'YYYY-MM-DD' strings. If anything reintroduces Date or
    // Timestamp storage, this page throws instead of rendering.
    await expect(page.locator('body')).toContainText(/עדכון שינה אחרון|היסטוריית/, {
      timeout: 30_000,
    });
    await expectNoCrash(page);
  });

  test('logs a sleep cycle that survives a reload', async ({ page }) => {
    await expectNoCrash(page);

    // The form is inline on the parent page and starts with one empty cycle.
    await page.fill('input[name="sleepCycles.0.bedtime"]', '20:15');
    await page.fill('input[name="sleepCycles.0.wakeTime"]', '06:40');
    await page.fill('input[name="sleepCycles.0.timeToSleep"]', '10 דקות');
    await page.fill('input[name="sleepCycles.0.whoPutToSleep"]', 'אמא');
    await page.fill('textarea[name="sleepCycles.0.howFellAsleep"]', 'שיר ערש');

    await page.getByRole('button', { name: /שמור נתוני שינה|שומר/ }).click();

    // Saved.
    await expect(page.locator('body')).toContainText(/נשמר|בהצלחה|עדכון שינה אחרון/, {
      timeout: 45_000,
    });

    // The real assertion: reload and confirm it renders. This is where the date bug
    // surfaced, and where a regression would surface again.
    await page.reload();
    await expect(page.locator('body')).toContainText('20:15', { timeout: 30_000 });
    await expectNoCrash(page);
    await expect(page.locator('body')).not.toContainText('Invalid Date');
  });

  test("cannot open another family's baby", async ({ page }) => {
    // demo-baby-2 belongs to the same coach but has no parents linked.
    await page.goto(`/parent/${SEEDED.foreignBabyId}`);

    // Whatever the UI chooses to do — redirect, sign out, or show "not found" — it must
    // not render the other family's data.
    await expect(page.locator('body')).not.toContainText('לוי', { timeout: 30_000 });
    await expect(page.locator('body')).not.toContainText('שירה');
    await expectNoCrash(page);
  });

  test('cannot open a baby that does not exist', async ({ page }) => {
    await page.goto('/parent/no-such-baby-id');
    await expectNoCrash(page);
    await expect(page.locator('body')).not.toContainText('Unhandled');
  });
});

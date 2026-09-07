import { SEEDED, USERS, expectNoCrash, login, logout, expect, test } from './helpers';

/**
 * Coach flows.
 *
 * Creating a baby is the flow that was most visibly broken. Two separate defects:
 * the permission check resolved from a collection nothing ever wrote (so it returned
 * false for every coach), and the profile was written with `inviteCode: ''` while both
 * parent email addresses were discarded — so the button labelled "צור פרופיל וקוד
 * הזמנה" produced a profile and no code, and the baby could never be linked to a
 * parent.
 */

test.describe('coach', () => {
  test.beforeEach(async ({ page }) => {
    await logout(page);
    await login(page, USERS.coach.email);
  });

  test('the dashboard lists the coach’s babies', async ({ page }) => {
    await expect(page).toHaveURL(/\/coach\/dashboard/);
    await expect(page.locator('body')).toContainText(SEEDED.babyName, { timeout: 30_000 });
    await expectNoCrash(page);
  });

  test('creating a baby with a parent email produces a real invitation code', async ({ page }) => {
    await page.goto('/coach/add-baby');
    await expectNoCrash(page);

    const unique = Date.now().toString().slice(-6);
    const parentEmail = `e2e.parent.${unique}@lailatov.test`;

    await page.fill('input[name="name"]', 'אורי');
    await page.fill('input[name="familyName"]', `בדיקה${unique}`);
    await page.fill('input[name="age"]', '6');
    await page.fill('input[name="motherName"]', 'אמא בדיקה');
    await page.fill('input[name="fatherName"]', 'אבא בדיקה');
    await page.fill('input[name="siblingsCount"]', '0');
    await page.fill('input[name="parentEmail1"]', parentEmail);

    await page.getByRole('button', { name: /צור פרופיל/ }).click();

    // The confirmation must contain an actual 8-character code. Asserting the shape
    // is the point: the old implementation reported success with no code at all.
    await expect(page.locator('body')).toContainText(/[A-Z0-9]{8}/, { timeout: 45_000 });
    await expectNoCrash(page);
  });

  test('creating a baby without a parent email still succeeds', async ({ page }) => {
    await page.goto('/coach/add-baby');

    const unique = Date.now().toString().slice(-6);
    await page.fill('input[name="name"]', 'ללא הורה');
    await page.fill('input[name="familyName"]', `יחיד${unique}`);
    await page.fill('input[name="age"]', '3');
    await page.fill('input[name="motherName"]', 'אמא');
    await page.fill('input[name="fatherName"]', 'אבא');
    await page.fill('input[name="siblingsCount"]', '0');

    await page.getByRole('button', { name: /צור פרופיל/ }).click();

    // No email means no invitation; the UI should say so rather than imply a code exists.
    await expect(page.locator('body')).toContainText(/נוצר|בהצלחה|לא הוזן/, { timeout: 45_000 });
    await expectNoCrash(page);
  });

  test('the archive page loads', async ({ page }) => {
    // This page called three BabyService methods that did not exist
    // (getArchivedBabiesForCoach, unarchiveBabyProfile, deleteBabyProfile), so it threw
    // at runtime. ignoreBuildErrors meant the build never said so.
    await page.goto('/coach/archive');
    await expectNoCrash(page);
    await expect(page.locator('body')).not.toContainText('is not a function');
  });

  test('the babies list loads', async ({ page }) => {
    // Rendered createdAt with new Date(<Timestamp>), which is Invalid Date.
    await page.goto('/coach/babies');
    await expectNoCrash(page);
    await expect(page.locator('body')).not.toContainText('Invalid Date');
  });
});

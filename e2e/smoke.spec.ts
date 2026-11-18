import { expect, test } from '@playwright/test';
import { adminFromEnv, expectShell, missingAdminMessage, signInOnKeycloak } from './support';

const admin = adminFromEnv();

test('signs in against local Keycloak and returns to the deep link', async ({ page }) => {
  test.skip(!admin, missingAdminMessage);
  await page.goto('/teams');
  await signInOnKeycloak(page, admin!);
  await expect(page).toHaveURL(/\/teams$/);
  await expectShell(page);

  const stored = await page.evaluate(() =>
    [localStorage, sessionStorage].flatMap((s) => Object.keys(s).map((k) => s.getItem(k) ?? '')).join('\n'),
  );
  expect(stored).not.toMatch(/access_token|refresh_token/);

  // Sign out ends the Keycloak session: after the post-logout redirect, a new visit must show the login form.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL(
    (url) => url.origin === new URL(page.url()).origin && !url.pathname.includes('/realms/'),
  );
  await page.waitForURL('http://localhost:5175/**');
  await page.goto('/users');
  await page.waitForURL(/\/realms\/crm-admin\/protocol\/openid-connect\/auth/);
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});

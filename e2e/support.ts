import { expect, type Page } from '@playwright/test';

export interface AdminCredentials {
  username: string;
  password: string;
}

/** Reads an admin account from the environment, e.g. E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD. */
export function adminFromEnv(prefix = 'E2E_ADMIN'): AdminCredentials | undefined {
  const username = process.env[`${prefix}_USERNAME`];
  const password = process.env[`${prefix}_PASSWORD`];
  return username && password ? { username, password } : undefined;
}

export const missingAdminMessage =
  'Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to a crm-admin user with realm role admin and no pending required actions';

/** Signs in on the Keycloak login page the app redirected to. */
export async function signInOnKeycloak(page: Page, { username, password }: AdminCredentials) {
  await page.waitForURL(/\/realms\/crm-admin\/protocol\/openid-connect\/auth/);
  await page.getByLabel(/username|email/i).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
}

export async function expectShell(page: Page) {
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav).toBeVisible();
  for (const area of ['Users', 'Teams', 'Roles', 'Approvals', 'Audit']) {
    await expect(nav.getByRole('link', { name: area })).toBeVisible();
  }
}

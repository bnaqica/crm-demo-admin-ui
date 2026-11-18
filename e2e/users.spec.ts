import { expect, test } from '@playwright/test';
import { adminFromEnv, missingAdminMessage, signInOnKeycloak } from './support';

const admin = adminFromEnv();
/** An ACTIVE internal test user to disable (and enable again). New users start INVITED and can't be disabled. */
const activeUserEmail = process.env.E2E_ACTIVE_USER_EMAIL;
const corporateDomain = process.env.E2E_CORPORATE_DOMAIN ?? 'crm.local';

test.beforeEach(async ({ page }) => {
  test.skip(!admin, missingAdminMessage);
  await page.goto('/users');
  await signInOnKeycloak(page, admin!);
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
});

test('creates an internal user, who starts INVITED without a Disable action', async ({ page }) => {
  const email = `e2e-${Date.now()}@${corporateDomain}`;
  await page.getByRole('link', { name: 'Create internal user' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('First name').fill('E2E');
  await page.getByLabel('Last name').fill('User');
  await page.getByLabel('Ticket reference').fill('OPS-1');
  await page.getByRole('button', { name: 'Create user' }).click();

  await expect(page.getByRole('heading', { name: 'E2E User' })).toBeVisible();
  await expect(page.getByText('INVITED', { exact: true })).toBeVisible();
  const actions = page.getByRole('group', { name: 'Account actions' });
  await expect(actions.getByRole('button', { name: 'Disable' })).toHaveCount(0);
});

test('disables and re-enables an active user', async ({ page }) => {
  test.skip(!activeUserEmail, 'Set E2E_ACTIVE_USER_EMAIL to an ACTIVE internal test user');
  await page.getByLabel('Email').fill(activeUserEmail!);
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('link', { name: activeUserEmail! }).click();

  const actions = page.getByRole('group', { name: 'Account actions' });
  await actions.getByRole('button', { name: 'Disable' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Disable account' });
  await confirm.getByLabel('Ticket reference').fill('OPS-2');
  await confirm.getByRole('button', { name: 'Disable' }).click();
  await expect(page.getByRole('status')).toHaveText('Account disabled.');
  await expect(page.getByText('DISABLED', { exact: true })).toBeVisible();

  await actions.getByRole('button', { name: 'Enable' }).click();
  const enable = page.getByRole('dialog', { name: 'Enable account' });
  await enable.getByLabel('Ticket reference').fill('OPS-2');
  await enable.getByRole('button', { name: 'Enable' }).click();
  await expect(page.getByText('ACTIVE', { exact: true })).toBeVisible();
});

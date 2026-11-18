import { expect, test, type Browser } from '@playwright/test';
import { adminFromEnv, missingAdminMessage, signInOnKeycloak, type AdminCredentials } from './support';

const adminA = adminFromEnv('E2E_ADMIN');
const adminB = adminFromEnv('E2E_ADMIN2');
const targetEmail = process.env.E2E_SUPER_MANAGER_TARGET_EMAIL;

/** Each admin gets their own browser context, so their Keycloak sessions stay apart. */
async function signedIn(browser: Browser, admin: AdminCredentials, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(path);
  await signInOnKeycloak(page, admin);
  return { context, page };
}

test('admin A requests Super Manager; A cannot approve it; admin B approves it', async ({ browser }) => {
  test.skip(!adminA || !adminB, `${missingAdminMessage}, plus E2E_ADMIN2_USERNAME / E2E_ADMIN2_PASSWORD`);
  test.skip(
    !targetEmail,
    'Set E2E_SUPER_MANAGER_TARGET_EMAIL to an ACTIVE internal user without super-manager',
  );
  const ticket = `OPS-${Date.now() % 100000}`;

  const a = await signedIn(browser, adminA!, '/users');
  await a.page.getByLabel('Email').fill(targetEmail!);
  await a.page.getByRole('button', { name: 'Search' }).click();
  await a.page.getByRole('link', { name: targetEmail! }).click();
  const roles = a.page.getByRole('region', { name: 'Roles' });
  // Precondition: otherwise a leftover role from an earlier run would make the final check meaningless.
  await expect(roles.getByText('super-manager', { exact: true })).toHaveCount(0);
  await roles.getByRole('button', { name: 'Assign role' }).click();
  const assign = a.page.getByRole('dialog', { name: 'Assign role' });
  await assign.getByLabel('Role').selectOption('super-manager');
  await assign.getByLabel('Ticket reference').fill(ticket);
  await assign.getByRole('button', { name: 'Assign' }).click();
  await expect(a.page.getByRole('status')).toContainText('pending approval by a second admin');

  await a.page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: /Approvals/ })
    .click();
  const byTicket = (page: typeof a.page) =>
    page.getByRole('row').filter({ has: page.getByRole('cell', { name: ticket, exact: true }) });
  const ownRow = byTicket(a.page);
  await expect(ownRow).toContainText('You');
  await expect(ownRow.getByRole('button', { name: 'Approve' })).toHaveCount(0);

  const b = await signedIn(browser, adminB!, '/approvals');
  const row = byTicket(b.page);
  await row.getByRole('button', { name: 'Approve' }).click();
  const approve = b.page.getByRole('alertdialog', { name: 'Approve grant' });
  await approve.getByLabel('Ticket reference').fill(ticket);
  await approve.getByRole('button', { name: 'Approve' }).click();
  await expect(b.page.getByRole('status')).toHaveText('Request approved.');

  await a.page.goto('/users');
  await a.page.getByLabel('Email').fill(targetEmail!);
  await a.page.getByRole('button', { name: 'Search' }).click();
  await a.page.getByRole('link', { name: targetEmail! }).click();
  const rolesAfter = a.page.getByRole('region', { name: 'Roles' });
  await expect(rolesAfter.getByText('super-manager', { exact: true })).toBeVisible();

  // Clean up so the test can run again: revoke the role it granted.
  await rolesAfter.getByRole('button', { name: 'Revoke super-manager' }).click();
  const revoke = a.page.getByRole('alertdialog', { name: 'Revoke role' });
  await revoke.getByLabel('Ticket reference').fill(ticket);
  await revoke.getByRole('button', { name: 'Revoke' }).click();
  await expect(a.page.getByRole('status')).toHaveText('super-manager revoked.');

  await a.context.close();
  await b.context.close();
});

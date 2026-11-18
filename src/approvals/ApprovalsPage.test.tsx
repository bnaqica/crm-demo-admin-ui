import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../test/server';
import { ADMIN_SUB, renderWithProviders } from '../test/fakeAuth';
import { aGrantRequest, aUser, allHandlers, createUmsDb, type UmsDb } from '../test/umsHandlers';
import { ApprovalsPage } from './ApprovalsPage';

function renderApprovals(db: UmsDb) {
  server.use(...allHandlers(db));
  return renderWithProviders(<ApprovalsPage />, { route: '/approvals' });
}

const rowFor = (text: string) => screen.getByText(text).closest('tr')!;

test('lists pending requests with requester, target, grant and expiry', async () => {
  const target = aUser({ email: 'ana@corp.example' });
  const db = createUmsDb({
    users: [target],
    grantRequests: [
      aGrantRequest({ target: target.sub, requestedBy: 'admin-b', expiresAt: '2026-11-15T09:00:00Z' }),
      aGrantRequest({
        type: 'ADMIN_ACCOUNT',
        target: 'new.admin@crm.local',
        details: { email: 'new.admin@crm.local', firstName: 'New', lastName: 'Admin' },
      }),
      aGrantRequest({ status: 'APPROVED' }),
    ],
  });
  renderApprovals(db);

  expect(await screen.findByText('ana@corp.example')).toBeInTheDocument();
  const row = rowFor('ana@corp.example');
  expect(row).toHaveTextContent('Super Manager role');
  expect(row).toHaveTextContent('admin-b');
  expect(within(row).getByRole('time')).toHaveAttribute('dateTime', '2026-11-15T09:00:00Z');
  expect(rowFor('new.admin@crm.local')).toHaveTextContent('New admin account');
  expect(screen.getAllByRole('row')).toHaveLength(3);
});

test('shows no Approve button for a request the admin created', async () => {
  const db = createUmsDb({
    grantRequests: [aGrantRequest({ target: 'mine-target', requestedBy: ADMIN_SUB, ticketRef: 'OPS-1' })],
  });
  renderApprovals(db);
  const row = (await screen.findByText('You')).closest('tr')!;
  expect(within(row).queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  expect(within(row).getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  expect(row).toHaveTextContent(/needs another admin/i);
});

test("approves another admin's request with confirmation and a ticket", async () => {
  const target = aUser({ email: 'ana@corp.example' });
  const grant = aGrantRequest({ target: target.sub, requestedBy: 'admin-b' });
  const db = createUmsDb({ users: [target], grantRequests: [grant] });
  renderApprovals(db);
  await screen.findByText('ana@corp.example');
  await userEvent.click(within(rowFor('ana@corp.example')).getByRole('button', { name: 'Approve' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Approve grant' });
  expect(dialog).toHaveTextContent(/super manager/i);
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-22');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));

  expect(await screen.findByRole('status')).toHaveTextContent('Request approved.');
  expect(await screen.findByText('No pending requests.')).toBeInTheDocument();
  expect(db.writes).toEqual([
    { method: 'POST', path: `/admin/grant-requests/${grant.id}/approve`, body: { ticketRef: 'OPS-22' } },
  ]);
  expect(db.userRoles[target.sub]).toContain('super-manager');
});

test('rejects a request with a ticket', async () => {
  const grant = aGrantRequest({ requestedBy: ADMIN_SUB });
  const db = createUmsDb({ grantRequests: [grant] });
  renderApprovals(db);
  await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
  const dialog = screen.getByRole('dialog', { name: 'Reject grant' });
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-23');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Request rejected.');
  expect(grant.status).toBe('REJECTED');
});

test('shows the UMS refusal when approving fails', async () => {
  const grant = aGrantRequest({ requestedBy: 'admin-b' });
  const db = createUmsDb({ grantRequests: [grant] });
  renderApprovals(db);
  await screen.findByRole('button', { name: 'Approve' });
  grant.status = 'EXPIRED';
  await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
  const dialog = screen.getByRole('alertdialog');
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-24');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('The grant request is closed');
});

test('a failed decision refreshes the list so a closed request disappears', async () => {
  const grant = aGrantRequest({ requestedBy: 'admin-b' });
  const db = createUmsDb({ grantRequests: [grant] });
  renderApprovals(db);
  await screen.findByRole('button', { name: /Approve/ });
  grant.status = 'EXPIRED';
  await userEvent.click(screen.getByRole('button', { name: /Approve/ }));
  const dialog = screen.getByRole('alertdialog');
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-24');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
  await within(dialog).findByRole('alert');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(await screen.findByText('No pending requests.')).toBeInTheDocument();
});

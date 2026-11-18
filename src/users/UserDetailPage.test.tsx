import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes } from 'react-router';
import { server } from '../test/server';
import { renderWithProviders } from '../test/fakeAuth';
import { aUser, createUmsDb, problem, UMS, userHandlers, type UmsDb } from '../test/umsHandlers';
import { UserDetailPage } from './UserDetailPage';
import type { UserResponse } from '../api/ums';

function renderDetail(db: UmsDb, user: UserResponse) {
  server.use(...userHandlers(db));
  return renderWithProviders(
    <Routes>
      <Route path="/users/:sub" element={<UserDetailPage />} />
    </Routes>,
    { route: `/users/${user.sub}` },
  );
}

const actions = () => within(screen.getByRole('group', { name: 'Account actions' }));
const loadedActions = async () => within(await screen.findByRole('group', { name: 'Account actions' }));

test('shows the account details', async () => {
  const user = aUser({ email: 'ana@corp.example', firstName: 'Ana', lastName: 'Test', status: 'ACTIVE' });
  renderDetail(createUmsDb({ users: [user] }), user);
  expect(await screen.findByRole('heading', { name: 'Ana Test' })).toBeInTheDocument();
  expect(screen.getByText('ana@corp.example')).toBeInTheDocument();
  expect(screen.getByText('INTERNAL')).toBeInTheDocument();
  expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  expect(screen.queryByText('Locked')).not.toBeInTheDocument();
});

test('an INVITED user is not offered Disable', async () => {
  const user = aUser({ status: 'INVITED' });
  renderDetail(createUmsDb({ users: [user] }), user);
  await screen.findByText('INVITED');
  expect(actions().queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
  expect(actions().getByRole('button', { name: 'Force logout' })).toBeInTheDocument();
});

test('unlocking with ticket OPS-5 shows success and clears the lockout indicator', async () => {
  const user = aUser({ status: 'ACTIVE', locked: true });
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);
  expect(await screen.findByText('Locked')).toBeInTheDocument();

  await userEvent.click(actions().getByRole('button', { name: 'Unlock' }));
  const dialog = screen.getByRole('dialog', { name: 'Unlock account' });
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-5');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Unlock' }));

  expect(await screen.findByRole('status')).toHaveTextContent('Account unlocked.');
  expect(screen.queryByText('Locked')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(actions().queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument();
  expect(db.writes).toEqual([
    { method: 'POST', path: `/admin/users/${user.sub}/unlock`, body: { ticketRef: 'OPS-5' } },
  ]);
});

test('every action needs a ticket before anything is sent', async () => {
  const user = aUser({ status: 'ACTIVE', locked: true });
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);
  await userEvent.click(await (await loadedActions()).findByRole('button', { name: 'Unlock' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Unlock' }));
  expect(within(screen.getByRole('dialog')).getByLabelText('Ticket reference')).toHaveAccessibleDescription(
    'Enter a ticket reference, such as OPS-12',
  );
  expect(db.writes).toEqual([]);
});

test.each([
  ['Disable', 'Disable account', /signs them out/i, 'disable', 'DISABLED'],
  ['Force logout', 'Force logout', /ends every session/i, 'logout', undefined],
  ['Reset MFA', 'Reset MFA', /set up TOTP again/i, 'reset-mfa', undefined],
] as const)('%s asks for confirmation and a ticket', async (button, title, consequence, path, newStatus) => {
  const user = aUser({ status: 'ACTIVE' });
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);

  await userEvent.click(await (await loadedActions()).findByRole('button', { name: button }));
  const dialog = screen.getByRole('alertdialog', { name: title });
  expect(dialog).toHaveTextContent(consequence);
  expect(dialog).toHaveTextContent(user.email);

  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-9');
  await userEvent.click(within(dialog).getByRole('button', { name: button }));

  expect(await screen.findByRole('status')).toBeInTheDocument();
  expect(db.writes).toEqual([
    { method: 'POST', path: `/admin/users/${user.sub}/${path}`, body: { ticketRef: 'OPS-9' } },
  ]);
  if (newStatus) expect(await screen.findByText(newStatus)).toBeInTheDocument();
});

test('cancelling a confirmation sends nothing', async () => {
  const user = aUser({ status: 'ACTIVE' });
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);
  await userEvent.click(await (await loadedActions()).findByRole('button', { name: 'Disable' }));
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(db.writes).toEqual([]);
});

test('enabling a disabled user needs a ticket but no confirmation', async () => {
  const user = aUser({ status: 'DISABLED' });
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);
  await userEvent.click(await (await loadedActions()).findByRole('button', { name: 'Enable' }));
  const dialog = screen.getByRole('dialog', { name: 'Enable account' });
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-2');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Enable' }));
  expect(await screen.findByText('ACTIVE')).toBeInTheDocument();
  expect(actions().getByRole('button', { name: 'Disable' })).toBeInTheDocument();
});

test('editing the profile sends the new values with the ticket', async () => {
  const user = aUser({ email: 'ana@corp.example', firstName: 'Ana', lastName: 'Test' });
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);
  await userEvent.click(await (await loadedActions()).findByRole('button', { name: 'Edit profile' }));
  const dialog = screen.getByRole('dialog', { name: 'Edit profile' });
  expect(dialog).toHaveTextContent(/verify a new email/i);
  const last = within(dialog).getByLabelText('Last name');
  await userEvent.clear(last);
  await userEvent.type(last, 'Lind');
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-4');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

  expect(await screen.findByRole('heading', { name: 'Ana Lind' })).toBeInTheDocument();
  expect(db.writes).toEqual([
    {
      method: 'PUT',
      path: `/admin/users/${user.sub}`,
      body: { email: 'ana@corp.example', firstName: 'Ana', lastName: 'Lind', ticketRef: 'OPS-4' },
    },
  ]);
});

test('a UMS conflict is shown in the dialog when the page is out of date', async () => {
  const user = aUser({ status: 'ACTIVE' });
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);
  await screen.findByText('ACTIVE');
  server.use(
    http.post(`${UMS}/admin/users/:sub/disable`, () =>
      problem(409, 'Conflict', 'Cannot change status from DISABLED to DISABLED'),
    ),
  );
  await userEvent.click(actions().getByRole('button', { name: 'Disable' }));
  const dialog = screen.getByRole('alertdialog');
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-9');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Disable' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'Cannot change status from DISABLED to DISABLED',
  );
});

test('an unknown user shows the UMS 404', async () => {
  server.use(...userHandlers(createUmsDb()));
  renderWithProviders(
    <Routes>
      <Route path="/users/:sub" element={<UserDetailPage />} />
    </Routes>,
    { route: '/users/nope' },
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('User not found');
});

test('Unlock is offered when the UMS does not report a lockout state', async () => {
  const user = aUser({ status: 'ACTIVE' });
  delete user.locked;
  renderDetail(createUmsDb({ users: [user] }), user);
  expect(await (await loadedActions()).findByRole('button', { name: 'Unlock' })).toBeInTheDocument();
  expect(screen.queryByText('Locked')).not.toBeInTheDocument();
});

test('editing the profile refuses empty names before sending', async () => {
  const user = aUser();
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);
  await userEvent.click(await (await loadedActions()).findByRole('button', { name: 'Edit profile' }));
  const dialog = screen.getByRole('dialog', { name: 'Edit profile' });
  await userEvent.clear(within(dialog).getByLabelText('First name'));
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-4');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Email, first name and last name are required.',
  );
  expect(db.writes).toEqual([]);
});

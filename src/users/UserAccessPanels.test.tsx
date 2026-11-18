import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { server } from '../test/server';
import { renderWithProviders } from '../test/fakeAuth';
import { aUser, createUmsDb, userHandlers, type UmsDb } from '../test/umsHandlers';
import type { UserResponse } from '../api/ums';
import { UserDetailPage } from './UserDetailPage';

function renderDetail(db: UmsDb, user: UserResponse) {
  server.use(...userHandlers(db));
  return renderWithProviders(
    <Routes>
      <Route path="/users/:sub" element={<UserDetailPage />} />
    </Routes>,
    { route: `/users/${user.sub}` },
  );
}

const rolesPanel = async () => within(await screen.findByRole('region', { name: 'Roles' }));
const teamsPanel = async () => within(await screen.findByRole('region', { name: 'Teams' }));

async function openPicker() {
  await userEvent.click((await rolesPanel()).getByRole('button', { name: 'Assign role' }));
  return screen.getByRole('dialog', { name: 'Assign role' });
}

test("lists the user's roles", async () => {
  const user = aUser();
  const db = createUmsDb({ users: [user], userRoles: { [user.sub]: ['team-member'] } });
  renderDetail(db, user);
  expect(await (await rolesPanel()).findByText('team-member')).toBeInTheDocument();
});

test('the role picker for an EXTERNAL user offers only roles assignable to EXTERNAL users', async () => {
  const user = aUser({ userType: 'EXTERNAL', email: 'bo@client.example' });
  const db = createUmsDb({ users: [user], userRoles: { [user.sub]: ['external-starter'] } });
  renderDetail(db, user);

  const dialog = await openPicker();
  const options = await within(dialog).findAllByRole('option');
  expect(options.map((o) => o.getAttribute('value')).filter(Boolean)).toEqual(['external-standard']);
});

test('the role picker for an INTERNAL user offers only INTERNAL roles the user lacks', async () => {
  const user = aUser({ userType: 'INTERNAL' });
  const db = createUmsDb({ users: [user], userRoles: { [user.sub]: ['team-member'] } });
  renderDetail(db, user);
  const dialog = await openPicker();
  const options = await within(dialog).findAllByRole('option');
  expect(options.map((o) => o.getAttribute('value')).filter(Boolean)).toEqual([
    'super-manager',
    'team-manager',
  ]);
});

test('assigning a role sends the ticket and lists the new role', async () => {
  const user = aUser();
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);
  const dialog = await openPicker();
  await userEvent.selectOptions(await within(dialog).findByLabelText('Role'), 'team-manager');
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-3');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }));

  expect(await (await rolesPanel()).findByText('team-manager')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('team-manager assigned.');
  expect(db.writes).toEqual([
    {
      method: 'POST',
      path: `/admin/users/${user.sub}/roles`,
      body: { role: 'team-manager', ticketRef: 'OPS-3' },
    },
  ]);
});

test('assigning Super Manager shows that the grant is pending a second admin', async () => {
  const user = aUser();
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);
  const dialog = await openPicker();
  await userEvent.selectOptions(await within(dialog).findByLabelText('Role'), 'super-manager');
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-21');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }));

  const status = await screen.findByRole('status');
  expect(status).toHaveTextContent(/super-manager is pending approval by a second admin/i);
  expect(within(status).getByRole('link', { name: 'Approvals' })).toHaveAttribute('href', '/approvals');
  expect((await rolesPanel()).queryByText('super-manager')).not.toBeInTheDocument();
});

test('the role picker requires a role and a ticket', async () => {
  const user = aUser();
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);
  const dialog = await openPicker();
  await within(dialog).findAllByRole('option');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }));
  expect(dialog).toHaveTextContent('Choose a role');
  expect(db.writes).toEqual([]);
});

test('revoking a role asks for confirmation and a ticket', async () => {
  const user = aUser();
  const db = createUmsDb({ users: [user], userRoles: { [user.sub]: ['team-member'] } });
  renderDetail(db, user);
  await userEvent.click(await (await rolesPanel()).findByRole('button', { name: 'Revoke team-member' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Revoke role' });
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-8');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

  expect(await screen.findByRole('status')).toHaveTextContent('team-member revoked.');
  expect((await rolesPanel()).queryByText('team-member')).not.toBeInTheDocument();
  expect(db.writes[0]).toEqual({
    method: 'DELETE',
    path: `/admin/users/${user.sub}/roles/team-member`,
    body: { ticketRef: 'OPS-8' },
  });
});

test("lists the user's teams, marking managed and archived ones", async () => {
  const user = aUser();
  const db = createUmsDb({
    users: [user],
    userTeams: {
      [user.sub]: [
        { teamId: 't1', teamName: 'North Sales', archived: false, manager: true },
        { teamId: 't2', teamName: 'Old Team', archived: true, manager: false },
      ],
    },
  });
  renderDetail(db, user);
  const teams = await teamsPanel();
  expect(await teams.findByRole('link', { name: 'North Sales' })).toHaveAttribute('href', '/teams/t1');
  expect(teams.getByText('Manager')).toBeInTheDocument();
  expect(teams.getByText('Archived')).toBeInTheDocument();
});

test('shows and changes the multi-team flag for internal users', async () => {
  const user = aUser({ userType: 'INTERNAL', multiTeamAllowed: false });
  const db = createUmsDb({ users: [user] });
  renderDetail(db, user);
  const teams = await teamsPanel();
  expect(teams.getByText('Multi-team: not allowed')).toBeInTheDocument();

  await userEvent.click(teams.getByRole('button', { name: 'Allow multiple teams' }));
  const dialog = screen.getByRole('dialog', { name: 'Allow multiple teams' });
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-6');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Allow' }));

  expect(await teams.findByText('Multi-team: allowed')).toBeInTheDocument();
  expect(db.writes[0]).toEqual({
    method: 'PUT',
    path: `/admin/users/${user.sub}/multi-team`,
    body: { allowed: true, ticketRef: 'OPS-6' },
  });
});

test('external users have no teams panel', async () => {
  const user = aUser({ userType: 'EXTERNAL' });
  renderDetail(createUmsDb({ users: [user] }), user);
  await rolesPanel();
  expect(screen.queryByRole('region', { name: 'Teams' })).not.toBeInTheDocument();
});

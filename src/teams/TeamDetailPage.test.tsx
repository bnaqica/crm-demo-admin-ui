import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addMembership, aTeam, aUser, createUmsDb } from '../test/umsHandlers';
import { renderTeams } from './teamsTestUtils';

function setup() {
  const team = aTeam({ name: 'North Sales' });
  const ana = aUser({ email: 'ana@corp.example', firstName: 'Ana', lastName: 'Lind' });
  const bo = aUser({ email: 'bo@corp.example', firstName: 'Bo', lastName: 'Berg' });
  const db = createUmsDb({ users: [ana, bo], teams: [team] });
  addMembership(db, team, ana, true);
  addMembership(db, team, bo, false);
  return { db, team, ana, bo };
}

const memberRow = (email: string) => screen.getByRole('cell', { name: email }).closest('tr')!;

test('opening a team lists its members and marks managers', async () => {
  const { db, team } = setup();
  renderTeams(db, `/teams/${team.id}`);
  expect(await screen.findByRole('heading', { name: 'North Sales' })).toBeInTheDocument();
  await screen.findByRole('cell', { name: 'ana@corp.example' });
  expect(within(memberRow('ana@corp.example')).getByText('Manager')).toBeInTheDocument();
  expect(within(memberRow('bo@corp.example')).queryByText('Manager')).not.toBeInTheDocument();
  expect(within(memberRow('bo@corp.example')).getByText('Bo Berg')).toBeInTheDocument();
});

test('the member picker offers only INTERNAL users who are not DISABLED and not already members', async () => {
  const { db, team } = setup();
  db.users.push(
    aUser({ email: 'cara@corp.example', userType: 'INTERNAL', status: 'ACTIVE' }),
    aUser({ email: 'dan@corp.example', userType: 'INTERNAL', status: 'INVITED' }),
    aUser({ email: 'eve@corp.example', userType: 'INTERNAL', status: 'DISABLED' }),
    aUser({ email: 'finn@client.example', userType: 'EXTERNAL', status: 'ACTIVE' }),
  );
  renderTeams(db, `/teams/${team.id}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Add member' }));
  const dialog = screen.getByRole('dialog', { name: 'Add member' });
  await userEvent.type(within(dialog).getByLabelText('Find user by email'), 'example');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Find' }));

  const options = await within(dialog).findAllByRole('radio');
  expect(options.map((o) => o.getAttribute('aria-label'))).toEqual(['cara@corp.example', 'dan@corp.example']);
});

test('adds a member, optionally as manager, with a ticket', async () => {
  const { db, team } = setup();
  const cara = aUser({ email: 'cara@corp.example' });
  db.users.push(cara);
  renderTeams(db, `/teams/${team.id}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Add member' }));
  const dialog = screen.getByRole('dialog', { name: 'Add member' });
  await userEvent.type(within(dialog).getByLabelText('Find user by email'), 'cara');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Find' }));
  await userEvent.click(await within(dialog).findByRole('radio', { name: 'cara@corp.example' }));
  await userEvent.click(within(dialog).getByLabelText('Make manager'));
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-9');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

  expect(await screen.findByRole('cell', { name: 'cara@corp.example' })).toBeInTheDocument();
  expect(within(memberRow('cara@corp.example')).getByText('Manager')).toBeInTheDocument();
  expect(db.writes).toEqual([
    {
      method: 'POST',
      path: `/admin/teams/${team.id}/members`,
      body: { sub: cara.sub, manager: true, ticketRef: 'OPS-9' },
    },
  ]);
});

test('a multi-team rejection explains the flag and links to the user', async () => {
  const { db, team } = setup();
  const other = aTeam({ name: 'South Sales' });
  const cara = aUser({ email: 'cara@corp.example', multiTeamAllowed: false });
  db.teams.push(other);
  db.users.push(cara);
  addMembership(db, other, cara);
  renderTeams(db, `/teams/${team.id}`);

  await userEvent.click(await screen.findByRole('button', { name: 'Add member' }));
  const dialog = screen.getByRole('dialog', { name: 'Add member' });
  await userEvent.type(within(dialog).getByLabelText('Find user by email'), 'cara');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Find' }));
  await userEvent.click(await within(dialog).findByRole('radio', { name: 'cara@corp.example' }));
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-9');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

  const alert = await within(dialog).findByRole('alert');
  expect(alert).toHaveTextContent(/already in a team/i);
  expect(alert).toHaveTextContent(/multi-team flag must be enabled first/i);
  expect(within(alert).getByRole('link', { name: 'cara@corp.example' })).toHaveAttribute(
    'href',
    `/users/${cara.sub}`,
  );
});

test('removing a member asks for confirmation and a ticket', async () => {
  const { db, team, bo } = setup();
  renderTeams(db, `/teams/${team.id}`);
  await screen.findByRole('cell', { name: 'bo@corp.example' });
  await userEvent.click(within(memberRow('bo@corp.example')).getByRole('button', { name: 'Remove' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Remove member' });
  expect(dialog).toHaveTextContent('bo@corp.example');
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-9');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

  expect(await screen.findByRole('status')).toHaveTextContent('bo@corp.example removed.');
  expect(screen.queryByRole('cell', { name: 'bo@corp.example' })).not.toBeInTheDocument();
  expect(db.writes).toEqual([
    { method: 'DELETE', path: `/admin/teams/${team.id}/members/${bo.sub}`, body: { ticketRef: 'OPS-9' } },
  ]);
});

test('sets and unsets the manager mark with a ticket', async () => {
  const { db, team, ana, bo } = setup();
  renderTeams(db, `/teams/${team.id}`);
  await screen.findByRole('cell', { name: 'bo@corp.example' });

  await userEvent.click(within(memberRow('bo@corp.example')).getByRole('button', { name: 'Make manager' }));
  let dialog = screen.getByRole('dialog', { name: 'Make manager' });
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-10');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Make manager' }));
  expect(await within(memberRow('bo@corp.example')).findByText('Manager')).toBeInTheDocument();

  await userEvent.click(
    within(memberRow('ana@corp.example')).getByRole('button', { name: 'Remove manager' }),
  );
  dialog = screen.getByRole('dialog', { name: 'Remove manager' });
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-11');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Remove manager' }));
  await screen.findByText('ana@corp.example is no longer a manager.');

  expect(db.writes.map((w) => [w.path, w.body])).toEqual([
    [`/admin/teams/${team.id}/members/${bo.sub}`, { manager: true, ticketRef: 'OPS-10' }],
    [`/admin/teams/${team.id}/members/${ana.sub}`, { manager: false, ticketRef: 'OPS-11' }],
  ]);
});

test('archiving asks for confirmation; an archived team offers no adds', async () => {
  const { db, team } = setup();
  renderTeams(db, `/teams/${team.id}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Archive team' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Archive team' });
  expect(dialog).toHaveTextContent(/takes no new members/i);
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-12');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));

  expect(await screen.findByText('Archived')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Archive team' })).not.toBeInTheDocument();
  expect(
    within(memberRow('bo@corp.example')).queryByRole('button', { name: 'Make manager' }),
  ).not.toBeInTheDocument();
  expect(within(memberRow('bo@corp.example')).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
});

test('Enter in the member search runs the search instead of adding the user picked earlier', async () => {
  const { db, team } = setup();
  db.users.push(aUser({ email: 'cara@corp.example' }), aUser({ email: 'dan@corp.example' }));
  renderTeams(db, `/teams/${team.id}`);
  await userEvent.click(await screen.findByRole('button', { name: 'Add member' }));
  const dialog = screen.getByRole('dialog', { name: 'Add member' });
  const search = within(dialog).getByLabelText('Find user by email');
  await userEvent.type(search, 'cara');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Find' }));
  await userEvent.click(await within(dialog).findByRole('radio', { name: 'cara@corp.example' }));
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-9');

  await userEvent.clear(search);
  await userEvent.type(search, 'dan{Enter}');

  expect(await within(dialog).findByRole('radio', { name: 'dan@corp.example' })).not.toBeChecked();
  expect(within(dialog).queryByRole('radio', { name: 'cara@corp.example' })).not.toBeInTheDocument();
  expect(db.writes).toEqual([]);
});

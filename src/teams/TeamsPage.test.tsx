import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { aTeam, createUmsDb } from '../test/umsHandlers';
import { renderTeams } from './teamsTestUtils';

test('lists teams with member and manager counts and archived state', async () => {
  const db = createUmsDb({
    teams: [
      aTeam({ name: 'North Sales', memberCount: 4, managerCount: 1 }),
      aTeam({ name: 'Old Team', archived: true, memberCount: 2, managerCount: 0 }),
    ],
  });
  renderTeams(db, '/teams');

  const north = (await screen.findByRole('link', { name: 'North Sales' })).closest('tr')!;
  expect(
    within(north)
      .getAllByRole('cell')
      .map((c) => c.textContent),
  ).toEqual(['North Sales', '4', '1', 'Active']);
  const old = screen.getByRole('link', { name: 'Old Team' }).closest('tr')!;
  expect(within(old).getAllByRole('cell')[3]).toHaveTextContent('Archived');
  expect(screen.getByRole('link', { name: 'North Sales' })).toHaveAttribute(
    'href',
    `/teams/${db.teams[0]!.id}`,
  );
});

test('creates a team with a ticket reference', async () => {
  const db = createUmsDb();
  renderTeams(db, '/teams');
  await screen.findByText('No teams yet.');
  await userEvent.click(screen.getByRole('button', { name: 'Create team' }));
  const dialog = screen.getByRole('dialog', { name: 'Create team' });
  await userEvent.type(within(dialog).getByLabelText('Name'), 'North Sales');
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-7');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

  expect(await screen.findByRole('heading', { name: 'North Sales' })).toBeInTheDocument();
  expect(db.writes).toEqual([
    { method: 'POST', path: '/admin/teams', body: { name: 'North Sales', ticketRef: 'OPS-7' } },
  ]);
});

test('a team needs a name', async () => {
  const db = createUmsDb();
  renderTeams(db, '/teams');
  await userEvent.click(await screen.findByRole('button', { name: 'Create team' }));
  const dialog = screen.getByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-7');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
  expect(dialog).toHaveTextContent('Enter a team name');
  expect(db.writes).toEqual([]);
});

test('a duplicate name shows the UMS conflict', async () => {
  const db = createUmsDb({ teams: [aTeam({ name: 'North Sales' })] });
  renderTeams(db, '/teams');
  await userEvent.click(await screen.findByRole('button', { name: 'Create team' }));
  const dialog = screen.getByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Name'), 'north sales');
  await userEvent.type(within(dialog).getByLabelText('Ticket reference'), 'OPS-7');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('A team with that name already exists');
});

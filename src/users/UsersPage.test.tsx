import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes, useLocation } from 'react-router';
import { server } from '../test/server';
import { renderWithProviders } from '../test/fakeAuth';
import { aUser, createUmsDb, userHandlers, type UmsDb } from '../test/umsHandlers';
import { UsersPage } from './UsersPage';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="location">{location.pathname + location.search}</output>;
}

function renderUsers(db: UmsDb, route = '/users') {
  server.use(...userHandlers(db));
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:sub" element={<p>detail page</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route },
  );
}

const rows = () => screen.getAllByRole('row').slice(1);
const emails = () => rows().map((r) => within(r).getAllByRole('cell')[0]!.textContent);

test('lists users from both realms with email, name, type and status', async () => {
  const db = createUmsDb({
    users: [
      aUser({
        email: 'ana@corp.example',
        firstName: 'Ana',
        lastName: 'Test',
        userType: 'INTERNAL',
        status: 'ACTIVE',
      }),
      aUser({
        email: 'bo@client.example',
        firstName: 'Bo',
        lastName: 'Ext',
        userType: 'EXTERNAL',
        status: 'INVITED',
      }),
    ],
  });
  renderUsers(db);

  expect(await screen.findByRole('cell', { name: 'ana@corp.example' })).toBeInTheDocument();
  expect(
    within(rows()[1]!)
      .getAllByRole('cell')
      .map((c) => c.textContent),
  ).toEqual(['bo@client.example', 'Bo Ext', 'EXTERNAL', 'INVITED']);
  expect(screen.getByRole('link', { name: 'ana@corp.example' })).toHaveAttribute(
    'href',
    `/users/${db.users[0]!.sub}`,
  );
});

test('filtering by type EXTERNAL and status DISABLED lists only disabled external users', async () => {
  const db = createUmsDb({
    users: [
      aUser({ email: 'int-disabled@corp.example', userType: 'INTERNAL', status: 'DISABLED' }),
      aUser({ email: 'ext-active@client.example', userType: 'EXTERNAL', status: 'ACTIVE' }),
      aUser({ email: 'ext-disabled@client.example', userType: 'EXTERNAL', status: 'DISABLED' }),
    ],
  });
  renderUsers(db);
  await screen.findByRole('cell', { name: 'ext-active@client.example' });

  await userEvent.selectOptions(screen.getByLabelText('Type'), 'EXTERNAL');
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'DISABLED');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));

  expect(await screen.findByText('1 user')).toBeInTheDocument();
  expect(emails()).toEqual(['ext-disabled@client.example']);
  expect(screen.getByLabelText('location')).toHaveTextContent('/users?userType=EXTERNAL&status=DISABLED');
});

test('searches by email or name', async () => {
  const db = createUmsDb({
    users: [
      aUser({ email: 'ana@corp.example', firstName: 'Ana', lastName: 'Lind' }),
      aUser({ email: 'carl@corp.example', firstName: 'Carl', lastName: 'Berg' }),
    ],
  });
  renderUsers(db);
  await screen.findByRole('cell', { name: 'ana@corp.example' });

  await userEvent.type(screen.getByLabelText('Name'), 'berg');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByText('1 user')).toBeInTheDocument();
  expect(emails()).toEqual(['carl@corp.example']);

  await userEvent.clear(screen.getByLabelText('Name'));
  await userEvent.type(screen.getByLabelText('Email'), 'ANA@');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByRole('cell', { name: 'ana@corp.example' });
  expect(emails()).toEqual(['ana@corp.example']);
});

test('filters in the URL are applied on load so views can be shared', async () => {
  const db = createUmsDb({
    users: [
      aUser({ email: 'a@client.example', userType: 'EXTERNAL', status: 'DISABLED' }),
      aUser({ email: 'b@corp.example', userType: 'INTERNAL', status: 'DISABLED' }),
    ],
  });
  renderUsers(db, '/users?userType=EXTERNAL&status=DISABLED');
  await screen.findByRole('cell', { name: 'a@client.example' });
  expect(emails()).toEqual(['a@client.example']);
  expect(screen.getByLabelText('Type')).toHaveValue('EXTERNAL');
  expect(screen.getByLabelText('Status')).toHaveValue('DISABLED');
});

test('pages through results', async () => {
  const db = createUmsDb({
    users: Array.from({ length: 25 }, (_, i) =>
      aUser({ email: `u${String(i).padStart(2, '0')}@corp.example` }),
    ),
  });
  renderUsers(db);
  await screen.findByText('Page 1 of 2');
  expect(rows()).toHaveLength(20);
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Page 2 of 2');
  expect(emails()).toEqual([
    'u20@corp.example',
    'u21@corp.example',
    'u22@corp.example',
    'u23@corp.example',
    'u24@corp.example',
  ]);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByLabelText('location')).toHaveTextContent('page=1');
});

test('a new search starts again at the first page', async () => {
  const db = createUmsDb({ users: Array.from({ length: 25 }, () => aUser({ userType: 'INTERNAL' })) });
  renderUsers(db, '/users?page=1');
  await screen.findByText('Page 2 of 2');
  await userEvent.selectOptions(screen.getByLabelText('Type'), 'INTERNAL');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText('Page 1 of 2');
  expect(screen.getByLabelText('location')).not.toHaveTextContent('page=');
});

test('shows an empty state and links to create and invite', async () => {
  renderUsers(createUmsDb());
  expect(await screen.findByText('No users match these filters.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Create internal user' })).toHaveAttribute(
    'href',
    '/users/new/internal',
  );
  expect(screen.getByRole('link', { name: 'Invite external user' })).toHaveAttribute(
    'href',
    '/users/new/external',
  );
});

test('shows the UMS error when the search fails', async () => {
  server.use(...userHandlers(createUmsDb()));
  const { problem, UMS } = await import('../test/umsHandlers');
  const { http } = await import('msw');
  server.use(http.get(`${UMS}/admin/users`, () => problem(400, 'Bad Request', 'Unknown sort property')));
  renderWithProviders(<UsersPage />, { route: '/users' });
  expect(await screen.findByRole('alert')).toHaveTextContent('Unknown sort property');
});

test('the filter form follows the URL when navigating back to the unfiltered list', async () => {
  const db = createUmsDb({ users: [aUser({ status: 'DISABLED' }), aUser({ status: 'ACTIVE' })] });
  server.use(...userHandlers(db));
  renderWithProviders(
    <>
      <Link to="/users">All users</Link>
      <Routes>
        <Route path="/users" element={<UsersPage />} />
      </Routes>
    </>,
    { route: '/users?status=DISABLED' },
  );
  await screen.findByText('1 user');
  expect(screen.getByLabelText('Status')).toHaveValue('DISABLED');
  await userEvent.click(screen.getByRole('link', { name: 'All users' }));
  expect(await screen.findByText('2 users')).toBeInTheDocument();
  expect(screen.getByLabelText('Status')).toHaveValue('');
});

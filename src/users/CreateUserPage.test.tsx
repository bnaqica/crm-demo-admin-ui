import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useParams } from 'react-router';
import { server } from '../test/server';
import { renderWithProviders } from '../test/fakeAuth';
import { aUser, createUmsDb, userHandlers, type UmsDb } from '../test/umsHandlers';
import { CreateUserPage } from './CreateUserPage';

function DetailProbe() {
  return <p>detail of {useParams().sub}</p>;
}

function renderForm(db: UmsDb, kind: 'internal' | 'external') {
  server.use(...userHandlers(db));
  return renderWithProviders(
    <Routes>
      <Route path="/users/new/:kind" element={<CreateUserPage />} />
      <Route path="/users/:sub" element={<DetailProbe />} />
    </Routes>,
    { route: `/users/new/${kind}` },
  );
}

async function fillProfile(email = 'ana@corp.example') {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('First name'), 'Ana');
  await userEvent.type(screen.getByLabelText('Last name'), 'Test');
}

test('submitting without a ticket reference shows a validation error and sends nothing', async () => {
  const db = createUmsDb();
  renderForm(db, 'internal');
  await fillProfile();

  await userEvent.click(screen.getByRole('button', { name: 'Create user' }));

  expect(screen.getByLabelText('Ticket reference')).toHaveAccessibleDescription(
    'Enter a ticket reference, such as OPS-12',
  );
  expect(db.writes).toEqual([]);
});

test('requires email and names', async () => {
  const db = createUmsDb();
  renderForm(db, 'internal');
  await userEvent.type(screen.getByLabelText('Ticket reference'), 'OPS-1');
  await userEvent.click(screen.getByRole('button', { name: 'Create user' }));

  expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter an email address');
  expect(screen.getByLabelText('First name')).toHaveAccessibleDescription('Enter a first name');
  expect(screen.getByLabelText('Last name')).toHaveAccessibleDescription('Enter a last name');
  expect(db.writes).toEqual([]);
});

test('creating an internal user opens the new user with status INVITED', async () => {
  const db = createUmsDb();
  renderForm(db, 'internal');
  expect(screen.getByRole('heading', { name: 'Create internal user' })).toBeInTheDocument();
  await fillProfile();
  await userEvent.type(screen.getByLabelText('Ticket reference'), 'OPS-12');

  await userEvent.click(screen.getByRole('button', { name: 'Create user' }));

  const created = db.users[0]!;
  expect(await screen.findByText(`detail of ${created.sub}`)).toBeInTheDocument();
  expect(created.status).toBe('INVITED');
  expect(db.writes).toEqual([
    {
      method: 'POST',
      path: '/admin/users/internal',
      body: { email: 'ana@corp.example', firstName: 'Ana', lastName: 'Test', ticketRef: 'OPS-12' },
    },
  ]);
});

test('the invite form requires an initial portal role and sends it', async () => {
  const db = createUmsDb();
  renderForm(db, 'external');
  expect(screen.getByRole('heading', { name: 'Invite external user' })).toBeInTheDocument();
  await fillProfile('bo@client.example');
  await userEvent.type(screen.getByLabelText('Ticket reference'), 'OPS-3');

  await userEvent.click(screen.getByRole('button', { name: 'Send invite' }));
  expect(screen.getByLabelText('Portal role')).toHaveAccessibleDescription('Choose the initial portal role');
  expect(db.writes).toEqual([]);

  expect(
    Array.from((screen.getByLabelText('Portal role') as HTMLSelectElement).options).map((o) => o.value),
  ).toEqual(['', 'external-starter', 'external-standard']);
  await userEvent.selectOptions(screen.getByLabelText('Portal role'), 'external-standard');
  await userEvent.click(screen.getByRole('button', { name: 'Send invite' }));

  expect(await screen.findByText(`detail of ${db.users[0]!.sub}`)).toBeInTheDocument();
  expect(db.writes[0]).toEqual({
    method: 'POST',
    path: '/admin/users/external',
    body: {
      email: 'bo@client.example',
      firstName: 'Ana',
      lastName: 'Test',
      role: 'external-standard',
      ticketRef: 'OPS-3',
    },
  });
});

test('a duplicate email shows the UMS conflict detail on the form', async () => {
  const db = createUmsDb({ users: [aUser({ email: 'ana@corp.example' })] });
  renderForm(db, 'internal');
  await fillProfile();
  await userEvent.type(screen.getByLabelText('Ticket reference'), 'OPS-12');
  await userEvent.click(screen.getByRole('button', { name: 'Create user' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Email already in use');
  expect(screen.getByLabelText('Email')).toHaveValue('ana@corp.example');
});

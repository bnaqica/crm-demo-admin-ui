import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeAuth, fakeJwt, renderWithProviders } from './test/fakeAuth';
import { AppRoutes } from './App';
import { server } from './test/server';
import { allHandlers, createUmsDb } from './test/umsHandlers';

let db: ReturnType<typeof createUmsDb>;
beforeEach(() => {
  db = createUmsDb();
  server.use(...allHandlers(db));
});

test('an admin signing in lands on Users inside the shell', async () => {
  renderWithProviders(<AppRoutes />, { route: '/' });
  expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
});

test('a user without the admin role sees no admin screens', () => {
  const auth = fakeAuth({ accessToken: fakeJwt({ sub: 'u' }) });
  renderWithProviders(<AppRoutes />, { auth, route: '/users' });
  expect(screen.getByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

test('a signed-out deep link goes to login without rendering the shell', () => {
  const auth = fakeAuth({ authenticated: false });
  renderWithProviders(<AppRoutes />, { auth, route: '/users/123' });
  expect(auth.signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/users/123' } });
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

test('an unknown path shows not found inside the shell', () => {
  renderWithProviders(<AppRoutes />, { route: '/nope' });
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
});

test('the real route tree provides the UMS client to admin screens', async () => {
  renderWithProviders(<AppRoutes />, { route: '/users', withApi: false });
  expect(await screen.findByText('No users match these filters.')).toBeInTheDocument();
});

test('a failed sign-in callback offers to sign in again instead of hanging', async () => {
  const auth = fakeAuth({
    authenticated: false,
    overrides: { error: new Error('No matching state found') as never },
  });
  renderWithProviders(<AppRoutes />, { auth, route: '/callback?error=access_denied&state=x' });
  expect(screen.getByRole('heading', { name: 'Sign-in failed' })).toBeInTheDocument();
  screen.getByRole('button', { name: 'Sign in' }).click();
  await vi.waitFor(() => expect(auth.signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/' } }));
});

test('creating an internal user opens its detail page with status INVITED', async () => {
  renderWithProviders(<AppRoutes />, { route: '/users', withApi: false });
  await userEvent.click(await screen.findByRole('link', { name: 'Create internal user' }));
  await userEvent.type(screen.getByLabelText('Email'), 'ana@corp.example');
  await userEvent.type(screen.getByLabelText('First name'), 'Ana');
  await userEvent.type(screen.getByLabelText('Last name'), 'Test');
  await userEvent.type(screen.getByLabelText('Ticket reference'), 'OPS-12');
  await userEvent.click(screen.getByRole('button', { name: 'Create user' }));

  expect(await screen.findByRole('heading', { name: 'Ana Test' })).toBeInTheDocument();
  expect(screen.getByText('INVITED')).toBeInTheDocument();
  expect(db.users).toHaveLength(1);
});

test('an unknown kind of new user is not found, and /users/new opens the internal form', async () => {
  const { unmount } = renderWithProviders(<AppRoutes />, { route: '/users/new/robot', withApi: false });
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  unmount();
  renderWithProviders(<AppRoutes />, { route: '/users/new', withApi: false });
  expect(await screen.findByRole('heading', { name: 'Create internal user' })).toBeInTheDocument();
});

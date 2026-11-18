import { screen } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import { fakeAuth, renderWithProviders } from '../test/fakeAuth';
import { RequireAuth } from './RequireAuth';

test('a signed-out deep link starts the crm-admin login and remembers the page', async () => {
  const auth = fakeAuth({ authenticated: false });
  renderWithProviders(
    <RequireAuth>
      <p>secret admin screen</p>
    </RequireAuth>,
    { auth, route: '/users/123?tab=roles' },
  );

  await waitFor(() =>
    expect(auth.signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/users/123?tab=roles' } }),
  );
  expect(screen.queryByText('secret admin screen')).not.toBeInTheDocument();
});

test('a signed-in admin sees the page', () => {
  renderWithProviders(
    <RequireAuth>
      <p>secret admin screen</p>
    </RequireAuth>,
  );
  expect(screen.getByText('secret admin screen')).toBeInTheDocument();
});

test('a failed sign-in shows a retry instead of looping back to Keycloak', async () => {
  const auth = fakeAuth({ authenticated: false, overrides: { error: new Error('invalid_grant') as never } });
  renderWithProviders(
    <RequireAuth>
      <p>secret admin screen</p>
    </RequireAuth>,
    { auth, route: '/users' },
  );
  expect(screen.getByRole('heading', { name: 'Sign-in failed' })).toBeInTheDocument();
  expect(screen.queryByText(/invalid_grant/)).not.toBeInTheDocument();
  expect(auth.signinRedirect).not.toHaveBeenCalled();
  screen.getByRole('button', { name: 'Sign in' }).click();
  await waitFor(() => expect(auth.signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/users' } }));
});

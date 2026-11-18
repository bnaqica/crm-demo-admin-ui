import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeAuth, fakeJwt, renderWithProviders } from '../test/fakeAuth';
import { RequireAdmin } from './RequireAdmin';

test('a crm-admin user without the admin role gets access denied with sign-out', async () => {
  const auth = fakeAuth({ accessToken: fakeJwt({ sub: 'u', realm_access: { roles: ['offline_access'] } }) });
  renderWithProviders(
    <RequireAdmin>
      <nav>Users</nav>
    </RequireAdmin>,
    { auth },
  );

  expect(screen.getByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  expect(screen.queryByText('Users')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(auth.signoutRedirect).toHaveBeenCalled();
});

test('an admin sees the admin screens', () => {
  renderWithProviders(
    <RequireAdmin>
      <nav>Users</nav>
    </RequireAdmin>,
  );
  expect(screen.getByText('Users')).toBeInTheDocument();
});

import { act, waitFor } from '@testing-library/react';
import { fakeAuth, renderWithProviders } from '../test/fakeAuth';
import { SessionWatcher } from './SessionWatcher';

test('a failed token refresh ends the session and returns the admin to the login page', async () => {
  const auth = fakeAuth();
  renderWithProviders(<SessionWatcher />, { auth, route: '/teams/7' });

  act(() => auth.fireSilentRenewError(new Error('Token is not active')));

  await waitFor(() => expect(auth.signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/teams/7' } }));
  expect(auth.removeUser).toHaveBeenCalled();
  expect(vi.mocked(auth.removeUser).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(auth.signinRedirect).mock.invocationCallOrder[0]!,
  );
});

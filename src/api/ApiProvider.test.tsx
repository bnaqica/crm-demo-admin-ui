import { render, screen, waitFor } from '@testing-library/react';
import { AuthContext } from 'react-oidc-context';
import { MemoryRouter } from 'react-router';
import { useEffect } from 'react';
import { ApiProvider } from './ApiProvider';
import { useQuery } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';
import { fakeAuth, renderWithProviders } from '../test/fakeAuth';
import { config } from '../config';
import { useApi } from './apiContext';

function Probe() {
  const api = useApi();
  const q = useQuery({ queryKey: ['probe'], queryFn: () => api.get<{ ok: boolean }>('/admin/users') });
  return <p>{q.isSuccess ? 'loaded' : q.isError ? 'failed' : 'loading'}</p>;
}

test('a 401 that survives the silent refresh returns the admin to the login page', async () => {
  server.use(http.get(`${config.umsBaseUrl}/admin/users`, () => new HttpResponse(null, { status: 401 })));
  const auth = fakeAuth();
  renderWithProviders(<Probe />, { auth, route: '/users?status=ACTIVE' });

  await waitFor(() =>
    expect(auth.signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/users?status=ACTIVE' } }),
  );
  expect(auth.signinSilent).toHaveBeenCalledTimes(1);
  expect(auth.removeUser).toHaveBeenCalled();
});

test('uses the signed-in admin token against the configured UMS base URL', async () => {
  let authHeader: string | null = null;
  server.use(
    http.get(`${config.umsBaseUrl}/admin/users`, ({ request }) => {
      authHeader = request.headers.get('Authorization');
      return HttpResponse.json({ ok: true });
    }),
  );
  const auth = fakeAuth();
  renderWithProviders(<Probe />, { auth });
  expect(await screen.findByText('loaded')).toBeInTheDocument();
  expect(authHeader).toBe(`Bearer ${auth.user!.access_token}`);
});

test('a silent refresh that resolves no user ends the session without a stale-token retry', async () => {
  let calls = 0;
  server.use(
    http.get(`${config.umsBaseUrl}/admin/users`, () => {
      calls++;
      return new HttpResponse(null, { status: 401 });
    }),
  );
  const auth = fakeAuth({ overrides: { signinSilent: vi.fn(async () => null) } });
  renderWithProviders(<Probe />, { auth, route: '/users' });

  await waitFor(() => expect(auth.signinRedirect).toHaveBeenCalledTimes(1));
  expect(calls).toBe(1);
});

test('keeps one client across auth changes and always sends the current token', async () => {
  const seen: (string | null)[] = [];
  server.use(
    http.get(`${config.umsBaseUrl}/admin/users`, ({ request }) => {
      seen.push(request.headers.get('Authorization'));
      return HttpResponse.json({ ok: true });
    }),
  );
  const clients: unknown[] = [];
  const call = () => (clients.at(-1) as ReturnType<typeof useApi>).get('/admin/users');
  function Capture() {
    const api = useApi();
    useEffect(() => {
      clients.push(api);
    });
    return null;
  }
  const first = fakeAuth({ accessToken: 'token-a' });
  const tree = (auth: ReturnType<typeof fakeAuth>) => (
    <MemoryRouter>
      <AuthContext.Provider value={auth}>
        <ApiProvider>
          <Capture />
        </ApiProvider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
  const { rerender } = render(tree(first));
  await call();
  rerender(tree(fakeAuth({ accessToken: 'token-b' })));
  await call();

  expect(seen).toEqual(['Bearer token-a', 'Bearer token-b']);
  expect(new Set(clients).size).toBe(1);
});

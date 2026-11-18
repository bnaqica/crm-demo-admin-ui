import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { AuthContext, type AuthContextProps } from 'react-oidc-context';
import { MemoryRouter } from 'react-router';
import { ApiProvider } from '../api/ApiProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

/** Builds an unsigned JWT whose payload carries the given claims. Only the payload matters to the UI. */
export function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(claims)}.sig`;
}

export const ADMIN_SUB = '11111111-1111-1111-1111-111111111111';

export function adminToken(extra: Record<string, unknown> = {}): string {
  return fakeJwt({ sub: ADMIN_SUB, realm_access: { roles: ['admin'] }, ...extra });
}

type Listener = (...args: unknown[]) => void;

export interface FakeAuth extends AuthContextProps {
  /** Fires the silent-renew-error event the way oidc-client-ts would. */
  fireSilentRenewError: (error: Error) => void;
}

export interface FakeAuthOptions {
  authenticated?: boolean;
  accessToken?: string;
  name?: string;
  overrides?: Partial<AuthContextProps>;
}

export function fakeAuth({
  authenticated = true,
  accessToken = adminToken(),
  name = 'Local Admin',
  overrides = {},
}: FakeAuthOptions = {}): FakeAuth {
  const silentRenewErrorListeners: Listener[] = [];
  const user = authenticated
    ? {
        access_token: accessToken,
        id_token: 'id-token',
        token_type: 'Bearer',
        profile: { sub: ADMIN_SUB, name, preferred_username: 'admin.local' },
        state: undefined,
        expired: false,
      }
    : null;
  const auth = {
    user,
    isLoading: false,
    isAuthenticated: authenticated,
    activeNavigator: undefined,
    error: undefined,
    settings: {},
    events: {
      addSilentRenewError: (cb: Listener) => {
        silentRenewErrorListeners.push(cb);
        return () => silentRenewErrorListeners.splice(silentRenewErrorListeners.indexOf(cb), 1);
      },
      removeSilentRenewError: (cb: Listener) => {
        const i = silentRenewErrorListeners.indexOf(cb);
        if (i >= 0) silentRenewErrorListeners.splice(i, 1);
      },
    },
    signinRedirect: vi.fn(async () => undefined),
    // react-oidc-context's signinSilent never throws: on failure it resolves null and sets auth.error.
    signinSilent: vi.fn(async () => user),
    signoutRedirect: vi.fn(async () => undefined),
    removeUser: vi.fn(async () => undefined),
    clearStaleState: vi.fn(async () => undefined),
    ...overrides,
    fireSilentRenewError: (error: Error) => silentRenewErrorListeners.forEach((cb) => cb(error)),
  };
  return auth as unknown as FakeAuth;
}

export interface RenderOptions {
  auth?: FakeAuth;
  route?: string;
  /** Wrap in the real ApiProvider (default). Pass false to render a tree that mounts its own. */
  withApi?: boolean;
}

/** Renders inside a memory router, a fresh query client, the fake auth context and the real API provider. */
export function renderWithProviders(
  ui: ReactNode,
  { auth = fakeAuth(), route = '/', withApi = true }: RenderOptions = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider value={auth}>
        <QueryClientProvider client={queryClient}>
          {withApi ? <ApiProvider>{ui}</ApiProvider> : ui}
        </QueryClientProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return { ...result, auth, queryClient };
}

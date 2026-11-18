import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth, type AuthContextProps } from 'react-oidc-context';
import { config } from '../config';
import { useEndSession } from '../auth/useEndSession';
import { ApiContext } from './apiContext';
import { createApiClient, type ApiClient } from './client';

interface Session {
  auth: AuthContextProps;
  endSession: () => Promise<void>;
}

/**
 * Provides one UMS client for the signed-in admin. The client reads the session through a ref at call time, so it
 * always sends the current token and its single-flight refresh covers every request.
 */
export function ApiProvider({
  children,
  baseUrl = config.umsBaseUrl,
}: {
  children: ReactNode;
  baseUrl?: string;
}) {
  const auth = useAuth();
  const endSession = useEndSession();
  const session = useRef<Session>({ auth, endSession });
  const [client, setClient] = useState<ApiClient | null>(null);

  useEffect(() => {
    session.current = { auth, endSession };
  });
  useEffect(() => setClient(clientFor(baseUrl, session)), [baseUrl]);

  if (!client) return null;
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

function clientFor(baseUrl: string, session: { readonly current: Session }): ApiClient {
  return createApiClient({
    baseUrl,
    getAccessToken: () => session.current.auth.user?.access_token,
    refreshAccessToken: async () => {
      // react-oidc-context resolves null instead of throwing when the silent refresh fails.
      const user = await session.current.auth.signinSilent();
      if (!user?.access_token) throw new Error('Silent token refresh failed');
      return user.access_token;
    },
    onSessionExpired: () => void session.current.endSession(),
  });
}

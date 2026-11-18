import { useMemo, type ReactNode } from 'react';
import { AuthProvider } from 'react-oidc-context';
import { useNavigate } from 'react-router';
import { config } from '../config';
import { buildOidcSettings } from './oidcSettings';
import { signinCallbackHandler } from './returnTo';

/** OIDC provider for the crm-admin realm. Must sit inside the router so the callback can navigate. */
export function AppAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const settings = useMemo(
    () =>
      buildOidcSettings({
        authority: config.oidcAuthority,
        clientId: config.oidcClientId,
        origin: window.location.origin,
      }),
    [],
  );
  return (
    <AuthProvider {...settings} onSigninCallback={signinCallbackHandler(navigate)}>
      {children}
    </AuthProvider>
  );
}

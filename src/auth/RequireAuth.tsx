import { useEffect, type ReactNode } from 'react';
import { useAuth } from 'react-oidc-context';
import { useLocation } from 'react-router';
import type { SigninState } from './returnTo';

/** Shows its children only to a signed-in user; anyone else is sent to the crm-admin login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const mustSignIn = !auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator && !auth.error;

  useEffect(() => {
    if (mustSignIn) {
      const state: SigninState = { returnTo };
      void auth.signinRedirect({ state });
    }
  }, [mustSignIn, returnTo, auth]);

  if (auth.error) {
    return (
      <main>
        <h1>Sign-in failed</h1>
        <p>We couldn&apos;t sign you in. Please try again.</p>
        <button type="button" onClick={() => void auth.signinRedirect({ state: { returnTo } })}>
          Sign in
        </button>
      </main>
    );
  }
  if (!auth.isAuthenticated) return <p role="status">Signing in…</p>;
  return <>{children}</>;
}

import { useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import { useLocation } from 'react-router';
import type { SigninState } from './returnTo';

/**
 * Ends the local session after a failed refresh or a 401 that a refresh didn't fix: drops the in-memory
 * tokens and sends the admin back to the crm-admin login, returning to the current page afterwards.
 */
export function useEndSession() {
  const auth = useAuth();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  return useCallback(async () => {
    await auth.removeUser();
    const state: SigninState = { returnTo };
    await auth.signinRedirect({ state });
  }, [auth, returnTo]);
}

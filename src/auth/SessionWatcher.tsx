import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { useEndSession } from './useEndSession';

/** Ends the session when oidc-client-ts reports that the silent token refresh failed. */
export function SessionWatcher() {
  const { events } = useAuth();
  const endSession = useEndSession();
  useEffect(() => events.addSilentRenewError(() => void endSession()), [events, endSession]);
  return null;
}

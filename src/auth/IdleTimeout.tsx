import { useEffect } from 'react';
import { useAuth } from 'react-oidc-context';

/** Same as the crm-admin realm's SSO idle timeout, which silent renew would otherwise keep alive. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/** Signs the admin out, ending the Keycloak session, after a stretch with no keyboard or pointer activity. */
export function IdleTimeout({ timeoutMs = IDLE_TIMEOUT_MS }: { timeoutMs?: number }) {
  const { signoutRedirect } = useAuth();
  useEffect(() => {
    let timer = window.setTimeout(() => void signoutRedirect(), timeoutMs);
    const restart = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void signoutRedirect(), timeoutMs);
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, restart, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, restart));
    };
  }, [signoutRedirect, timeoutMs]);
  return null;
}

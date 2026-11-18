import type { ReactNode } from 'react';
import { useAuth } from 'react-oidc-context';
import { hasAdminRole } from './claims';

/** Shows admin screens only when the access token has the `admin` realm role. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (hasAdminRole(auth.user?.access_token)) return <>{children}</>;
  return (
    <main>
      <h1>Access denied</h1>
      <p>Your account can sign in to the admin realm but doesn&apos;t have the admin role.</p>
      <button type="button" onClick={() => void auth.signoutRedirect()}>
        Sign out
      </button>
    </main>
  );
}

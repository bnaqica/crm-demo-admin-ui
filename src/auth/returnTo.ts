import type { User } from 'oidc-client-ts';

export interface SigninState {
  returnTo: string;
}

/** The in-app path stored when the login started; anything that isn't a same-origin path becomes `/`. */
export function returnToFromState(state: unknown): string {
  if (typeof state !== 'object' || state === null) return '/';
  const returnTo = (state as Partial<SigninState>).returnTo;
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/') || /^\/[/\\]/.test(returnTo)) return '/';
  return returnTo;
}

type Navigate = (to: string, options: { replace: boolean }) => void;

/** `onSigninCallback` for the auth provider: drop the code from the URL and land on the requested page. */
export function signinCallbackHandler(navigate: Navigate) {
  return (user: User | undefined) => navigate(returnToFromState(user?.state), { replace: true });
}

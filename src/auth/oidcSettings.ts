import { InMemoryWebStorage, WebStorageStateStore, type UserManagerSettings } from 'oidc-client-ts';

export interface OidcEnv {
  authority: string;
  clientId: string;
  /** Origin the app is served from, such as `http://localhost:5175`. */
  origin: string;
}

/**
 * Authorization Code + PKCE against the crm-admin realm.
 *
 * Tokens live in an in-memory store only, so a reload drops them and the session comes back through
 * Keycloak's SSO cookie. The short-lived sign-in request state (PKCE verifier, return path) uses
 * sessionStorage so it survives the redirect to Keycloak; oidc-client-ts removes it on callback.
 */
export function buildOidcSettings({ authority, clientId, origin }: OidcEnv): UserManagerSettings {
  return {
    authority,
    client_id: clientId,
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: `${origin}/callback`,
    post_logout_redirect_uri: `${origin}/`,
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  };
}

export interface AccessTokenClaims {
  sub?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  [claim: string]: unknown;
}

/**
 * Reads the payload of an access token without verifying it. The UI only uses it to decide what to show;
 * the UMS verifies every token it receives.
 */
export function accessTokenClaims(token: string | undefined): AccessTokenClaims | undefined {
  const payload = token?.split('.')[1];
  if (!payload) return undefined;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof claims === 'object' && claims !== null ? (claims as AccessTokenClaims) : undefined;
  } catch {
    return undefined;
  }
}

/** True when the access token carries the crm-admin realm role `admin`. */
export function hasAdminRole(token: string | undefined): boolean {
  const roles = accessTokenClaims(token)?.realm_access?.roles;
  return Array.isArray(roles) && roles.includes('admin');
}

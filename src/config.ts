/** Runtime settings from Vite env variables, with defaults matching local-docker. */
export const config = {
  umsBaseUrl: import.meta.env.VITE_UMS_BASE_URL ?? 'http://localhost:8083',
  oidcAuthority: import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8180/realms/crm-admin',
  oidcClientId: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'admin-app',
} as const;

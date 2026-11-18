# CRM Demo — Admin UI

The only tool CRM administrators use. Admins sign in to the `crm-admin` Keycloak realm and manage users, teams,
roles, privileged-grant approvals and audit search through the User Management Service (UMS) admin API.

## Stack

React 19, TypeScript (strict), Vite, React Router, TanStack Query, `react-oidc-context` over `oidc-client-ts`
(Authorization Code + PKCE, tokens in memory only). Tests: Vitest, React Testing Library and MSW; end-to-end
tests with Playwright.

## Running locally

Needs Keycloak (`http://localhost:8180`, realm `crm-admin`, public client `admin-app`) and the UMS
(`http://localhost:8083`) from `local-docker`. The UMS must allow CORS from `http://localhost:5175`, and the
`admin-app` client must allow redirect URI `http://localhost:5175/*` and web origin `http://localhost:5175`.

```bash
cp .env.example .env.local   # optional, defaults match local-docker
npm install
npm run dev                  # http://localhost:5175
```

| Variable              | Default                                  | Meaning      |
| --------------------- | ---------------------------------------- | ------------ |
| `VITE_UMS_BASE_URL`   | `http://localhost:8083`                  | UMS base URL |
| `VITE_OIDC_AUTHORITY` | `http://localhost:8180/realms/crm-admin` | OIDC issuer  |
| `VITE_OIDC_CLIENT_ID` | `admin-app`                              | OIDC client  |

## Scripts

| Script              | Does                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `npm run lint`      | ESLint and Prettier check                                          |
| `npm run typecheck` | TypeScript project build without emit                              |
| `npm test`          | Vitest unit and component tests (MSW mocks the UMS)                |
| `npm run build`     | Typecheck and production build to `dist/`                          |
| `npm run e2e`       | Playwright against the real Keycloak and UMS (see `e2e/README.md`) |

## Security notes

- Access and refresh tokens live in memory only; a reload restores the session through Keycloak's SSO cookie.
- The UI hides what an admin can't do but never authorizes: the UMS checks every request.
- Every write sends a `ticketRef` such as `OPS-12`.

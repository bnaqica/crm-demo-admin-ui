# Tasks

## 1. Scaffold

- [x] 1.1 Create the Vite React TypeScript app with ESLint, Prettier, Vitest and MSW; verify `npm run lint`, `npm test` and `npm run build` pass
- [x] 1.2 Add `.github/workflows/build.yml`, `.env.example`, `README.md` and `CLAUDE.md`; verify the workflow runs the same scripts

## 2. Authentication

- [x] 2.1 Configure OIDC PKCE for `crm-admin` / `admin-app` with in-memory tokens; verify login redirect, deep-link return and no web-storage tokens in tests
- [x] 2.2 Add the admin-role gate and sign-out; verify the access-denied and refresh-failure scenarios

## 3. Shell

- [x] 3.1 Build the layout and navigation; verify the shell scenario
- [x] 3.2 Add the UMS API client with ProblemDetail and 401 handling; verify the conflict and 401 scenarios with MSW
- [ ] 3.3 Add a Playwright smoke test that signs in against local Keycloak

## Workflow follow-up

- Archive the change with `/opsx:archive` after review.

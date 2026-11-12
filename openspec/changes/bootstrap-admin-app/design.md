# Design

## Decisions

- **Stack:** Vite + React 19 + TypeScript (strict), React Router, TanStack Query for server state, `react-oidc-context` over `oidc-client-ts` with `InMemoryWebStorage` for tokens. Alternative: keycloak-js — tied to Keycloak; oidc-client-ts is standard OIDC.
- **API client:** generated types from the UMS OpenAPI (`openapi-typescript`) and a small `fetch` wrapper that adds the bearer token and maps ProblemDetail.
- **Tests:** Vitest + React Testing Library with MSW for API mocks; Playwright end-to-end against Keycloak from `local-docker`.
- **CI:** GitHub Actions running lint, typecheck, test and build.

# Design

## Decisions

- **Stack:** Vite + React 19 + TypeScript (strict), React Router, TanStack Query for server state, `react-oidc-context` over `oidc-client-ts` with `InMemoryWebStorage` for tokens. Alternative: keycloak-js — tied to Keycloak; oidc-client-ts is standard OIDC.
- **API client:** generated types from the UMS OpenAPI (`openapi-typescript`) and a small `fetch` wrapper that adds the bearer token and maps ProblemDetail.
- **Tests:** Vitest + React Testing Library with MSW for API mocks; Playwright end-to-end against Keycloak from `local-docker`.
- **CI:** GitHub Actions running lint, typecheck, test and build.

## Implementation decisions

Recorded while applying the change.

- **Versions.** TypeScript is pinned to 6.0.3, not 7.x, because `typescript-eslint` 8.72 supports `<6.1.0`. MSW 3
  renamed `onUnhandledRequest` to `onUnhandledFrame`; tests fail on any request without a handler.
- **No generated OpenAPI types yet.** The UMS doesn't publish an OpenAPI document the build can read offline, so the
  later changes hand-write the UMS types (`src/api/ums.ts`) from the UMS docs and DTOs. Swap in `openapi-typescript`
  output once the UMS serves `/v3/api-docs` reliably.
- **Token and state storage.** Tokens live in `InMemoryWebStorage`. The sign-in request state (PKCE verifier and the
  return path) uses sessionStorage so it survives the redirect to Keycloak; oidc-client-ts deletes it in the callback.
  It holds no access, refresh or ID token.
- **Deep links.** The requested path goes into the OIDC `state` and is restored in `onSigninCallback`. Only
  same-origin paths are accepted (`/…`, not `//…` or absolute URLs), so it can't be used as an open redirect.
  `redirect_uri` is `/callback`.
- **Admin gate.** The UI reads `realm_access.roles` from the access token payload without verifying it. That only
  decides what to show; the UMS checks every token.
- **Session end.** When the silent refresh fails, or a 401 survives one refresh and retry, the app drops the in-memory
  user and starts the login again (back to the current page). Sign out uses `signoutRedirect`, which ends the
  Keycloak session through `end_session_endpoint`.
- **API client.** One `fetch` wrapper (`src/api/client.ts`). It adds `Authorization`, sends and reads JSON, and maps
  ProblemDetail `title`/`detail` to `ApiError`. Any other failure, including network errors, gets a generic message,
  and response bodies that aren't ProblemDetail are never shown. Concurrent 401s share one refresh.
- **E2E credentials** come from `E2E_ADMIN_USERNAME` / `E2E_ADMIN_PASSWORD`. `admin.local` has a TOTP required
  action, so the e2e run needs a test-only admin with no required actions (see `e2e/README.md`).
- **Idle sign-out.** `automaticSilentRenew` would keep an unattended tab signed in until `ssoSessionMaxLifespan`
  (8 h), which undercuts the realm's 15-minute SSO idle timeout. `IdleTimeout` signs the admin out (ending the Keycloak
  session) after 15 minutes without keyboard or pointer activity.
- **One client per session.** `ApiProvider` builds the client once and reads tokens through a ref, so the
  single-flight refresh covers every request. react-oidc-context's `signinSilent` resolves `null` instead of throwing,
  so the provider turns that into a failed refresh. Several requests failing at once start only one login.
- **Requests stay on the UMS origin.** The client refuses absolute or protocol-relative paths, so the bearer token
  never goes elsewhere, and it keeps a path prefix in `VITE_UMS_BASE_URL`.
- **Callback errors.** `/callback` shows "Sign-in failed" with a retry when the code exchange fails, instead of hanging.

## Review (2026-11-12)

Fixed test-first:
- Critical: `ApiProvider` wasn't mounted in the real route tree.
- Important:
  - a failed callback hung on `/callback`;
  - a failed silent refresh never threw;
  - concurrent 401s each started a login;
  - the client was rebuilt on every auth change;
  - there was no idle timeout;
  - the e2e sign-out check raced.
- Minor:
  - other-origin paths rejected;
  - base-path prefix kept;
  - `/\` return paths rejected;
  - `*.local` git-ignored;
  - `engines` set.

Deferred minors:
- a failed sign-out is shown as "Sign-in failed";
- a JSON parse error on a success body is a plain `SyntaxError`, which is still rendered generically.

# CLAUDE.md

Admin UI for the CRM demo. See `README.md` for the stack and scripts and `openspec/` for the changes.

## Rules

- Never commit, push, branch or archive OpenSpec changes; the developer reviews and commits every change.
- Test first: write a failing Vitest/RTL test (MSW for the UMS API) before any production code.
- Tokens stay in memory (`InMemoryWebStorage`); never write tokens to localStorage, sessionStorage or cookies.
- All UMS calls go through `src/api/client.ts` so the bearer token, 401 retry and ProblemDetail mapping apply.
- Every write carries a `ticketRef`; destructive actions ask for confirmation.
- Render server data as text, never as HTML.
- API shapes come from the UMS (`../crm-demo-user-management-service/docs/` and its OpenSpec changes); record any
  mismatch in the change's `design.md`.
- Pin exact dependency versions; keep `package-lock.json` in sync.

## Check before you say done

`npm run lint`, `npm test`, `npm run build`.

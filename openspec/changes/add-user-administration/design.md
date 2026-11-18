# Design

## Decisions

- Reusable `TicketField` and `ConfirmActionDialog` components so no action can be sent without a ticket.
- Allowed actions derived from status in one function shared by the detail page and its tests, mirroring the UMS transition rules; the UMS remains the authority and its 409 is shown when the UI is out of date.
- Lists use URL query params for filters so views are shareable; TanStack Query invalidates the user after each action.

## UMS contract

The first draft mocked proposed shapes (agreed with the developer on 2026-11-12) because the UMS hadn't built roles,
grant requests or user teams yet. The UMS has since implemented them. The UI now uses the real shapes from
`docs/admin-users-api.md`, `teams-api.md`, `roles-api.md` and the response DTOs. Types and calls live in
`src/api/ums.ts`; the MSW fake is `src/test/umsHandlers.ts`.

| Need (spec) | Real UMS | Changed from the proposal |
|---|---|---|
| Multi-team flag | `UserResponse.multiTeamAllowed`; `PUT /admin/users/{sub}/multi-team` `{allowed, ticketRef}` → `{sub, multiTeamAllowed}` | as proposed |
| User's roles | `GET /admin/users/{sub}/roles` → `{sub, roles: string[]}` (role names) | was `RoleResponse[]` |
| Assign | `POST /admin/users/{sub}/roles` `{role, ticketRef}` → 200 `{sub, roles}` or **202** grant request (`super-manager`) | 200 body was `RoleResponse[]` |
| Revoke | `DELETE /admin/users/{sub}/roles/{role}` body `{ticketRef}` → **200** `{sub, roles}`; 404 if not held | was 204 |
| Role picker | `GET /admin/roles` → `{name, description, owner, assignableTo: "INTERNAL"\|"EXTERNAL", builtIn, permissions, createdAt, updatedAt}`; the picker keeps roles whose `assignableTo` equals the user's type and that the user doesn't hold | `assignableTo` is a single value, not a list; no `id`/`realm` (the name is the id) |
| Pending approval | grant request `{id, type: "SUPER_MANAGER"\|"ADMIN_ACCOUNT", target (sub or email), status, requestedBy (sub), decidedBy, ticketRef, details: {role}, createdAt, decidedAt, expiresAt}` | type names and flat `target`/`requestedBy` strings |
| User's teams | `GET /admin/users/{sub}/teams` → `[{teamId, teamName, archived, manager}]` | adds `archived` |

### Still not met by the UMS

- **Lockout indicator** (Unlock scenario: "the lockout indicator clears"). `UserResponse` has no lock state. The UI
  keeps an optional `locked` field. It shows "Locked" only when `locked === true` and clears it after a successful
  unlock. Unlock is offered unless `locked === false`, which today means always. Exposing Keycloak's brute-force
  status (`GET /attack-detection/brute-force/users/{id}`) as `locked` on `UserResponse` would complete the scenario.

The invite form offers the two portal roles the API doc names (`external-starter`, `external-standard`).

## Implementation decisions

- **Allowed actions** come from `allowedActions(user)` in `src/users/userActions.ts`, which follows the UMS status
  rules: Disable only for ACTIVE, Enable only for DISABLED, Unlock unless the user is known not to be locked.
  Force logout, reset MFA and edit profile are offered for every status except DISABLED (a disabled account has no
  sessions and can't sign in).
  The UMS stays the authority, and its 409 is shown when the UI is out of date.
- **Ticket format** follows the UMS `@TicketReference` pattern `^[A-Z][A-Z0-9]*-\d+$` (for example `OPS-12`), so a
  malformed ticket is caught before any request is sent.
- **Confirmations.** Disable, force logout, reset MFA and role revoke open an `alertdialog` that states the
  consequence. Enable, unlock, edit profile, assign role and the multi-team change open a plain dialog. Every
  dialog asks for the ticket and sends nothing until it is valid (`ActionDialog`).
- **E2E create and disable.** A new user is INVITED, and the UMS disables only ACTIVE users, so the e2e test can't
  disable the user it just created. It checks that the created user is INVITED with no Disable action, then disables
  and re-enables a seeded ACTIVE test user (`E2E_ACTIVE_USER_EMAIL`).

## Review (2026-11-12)

Fixed test-first:
- Important:
  - the e2e status checks were not exact matches (Playwright strict mode);
  - the MSW fake defaulted `locked: false`, which the real UMS never sends, so tests now cover the
    absent-lock case;
  - dialogs now return focus to their opener, handle Escape and native `close`, and describe their consequence
    (`aria-describedby`);
  - the Users filter form now follows the URL on navigation.
- Minor:
  - form-level dialog errors are announced;
  - edit-profile validation is tested;
  - `/users/new/<other>` is not found, and `/users/new` opens the internal form.

Note on `ConfirmActionDialog` (see Decisions): it is implemented as `ActionDialog`. After a write, the UI writes the
UMS response into the query cache and invalidates searches, instead of refetching the user.

Deferred minors:
- focus doesn't move to the first invalid field;
- 200 and 202 on role assign are told apart by body shape (`roles` present), not by status;
- an out-of-range `?page=` shows an empty page;
- no busy indicator while paging;
- the multi-team "forbid" 409 has no dedicated test (the ProblemDetail is shown).

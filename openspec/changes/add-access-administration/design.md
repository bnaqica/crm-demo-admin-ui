# Design

## Decisions

- Reuses `TicketField`, `ConfirmActionDialog` and the user picker from `add-user-administration`; if that change isn't applied yet, these components move into this change's first task.
- Approvals badge polls `/admin/grant-requests?status=PENDING` every 60 seconds through TanStack Query.
- Before/after uses a JSON diff view; values are rendered as text, never as HTML.

## UMS contract

The UMS implemented teams, roles and catalog, grant approval and audit while this change was being applied. The UI
uses its real shapes (`teams-api.md`, `roles-api.md`, `audit.md` and the response DTOs). Types and calls are in
`src/api/ums.ts`; the MSW fake is `src/test/umsHandlers.ts`. The fake follows the documented rules:
- unique names;
- INTERNAL and not-DISABLED members;
- the multi-team 422;
- archived teams take no new members or managers;
- the requester can't approve (403);
- closed requests answer 409;
- audit needs `from`/`to`, at most 90 days apart, otherwise 400.

| Area | Endpoints used |
|---|---|
| Teams | `GET/POST /admin/teams`, `GET /admin/teams/{id}`, `POST /admin/teams/{id}/archive`, `GET/POST /admin/teams/{id}/members`, `PUT/DELETE /admin/teams/{id}/members/{sub}`; member picker `GET /admin/users?userType=INTERNAL&email=` |
| Catalog | `GET /admin/catalog` (all, or `?realm=` for the editor) → `{key, service, realm, description, sensitive, deprecated, deprecatedAt, grantedBy}` |
| Roles | `GET /admin/roles`, `GET/PUT /admin/roles/{name}`, `POST /admin/roles` `{name, description, owner, assignableTo, permissions, ticketRef}`; update sends `{description, owner, permissions, ticketRef}` (name and `assignableTo` never change) |
| Approvals | `GET /admin/grant-requests?status=PENDING` (badge and page), `POST /admin/grant-requests/{id}/approve\|reject` `{ticketRef}` |
| Audit | `GET /admin/audit?from&to&source&realm&actorId&targetId&action&outcome&ticketRef&correlationId&page&size`, `GET /admin/audit/{eventId}` |

### Spec needs the UMS doesn't fully meet

- **Requester name.** The approvals spec lists "requester". `GrantRequestResponse.requestedBy` is the admin's sub,
  and admin accounts can't be looked up through `/admin/users`. The UI shows "You" for the signed-in admin's own
  requests and the raw sub otherwise. A `requestedByUsername` (or an admin lookup) would let it show a name.
- **Multi-team rejection** has no error code. The UMS answers 422 with detail "The user is already in a team and
  isn't allowed in more than one", and the UI recognises it by status 422 plus "more than one" in the detail
  (`src/teams/multiTeam.ts`). A ProblemDetail `type` such as `urn:ums:multi-team-not-allowed` would make this robust.
- **Audit range maximum** only appears in the 400 detail ("The time range can be at most 90 days"). The UI shows
  that detail, which satisfies the scenario. A `maxRangeDays` extension property would let the UI warn before
  sending.

## Implementation decisions

- **Reused components.** `ActionDialog` takes the place of `ConfirmActionDialog`, together with `TicketField`, from
  `add-user-administration`. Every team, role and approval write goes through it or through a form with
  `TicketField`. Destructive actions use an `alertdialog`: archive, remove member, approve. Reject is a plain dialog,
  because it closes without effect.
- **Member picker.** It searches INTERNAL users by email and leaves out DISABLED users and current members on the
  client. The UMS search takes one status, so "not DISABLED" can't be asked for server-side.
- **Role editor.** The catalog is fetched for the realm that `assignableTo` implies. Changing `assignableTo` clears
  the selection. Deprecated permissions are offered only when the role still holds them, so admins can remove them.
  Selecting `x:write` adds `x:read`, and `x:read` stays checked and disabled while `x:write` is selected
  (`src/roles/permissions.ts`).
- **Approvals.** The badge and the page share the query `['grant-requests','PENDING']`, polled every 60 s. Own
  requests show Reject (the UMS lets the requester reject) but no Approve. A SUPER_MANAGER target's sub is looked
  up and shown as the user's email.
- **Audit.** Ranges are presets (24 h by default, 7, 30 and 90 days) or a custom pair of local date-times, sent as
  ISO instants. The search runs on submit, newest first as the UMS returns it. Before/after is a table of
  top-level fields with JSON-encoded values rendered as text.
- **E2E 4.2** needs two admins without required actions (`E2E_ADMIN_*`, `E2E_ADMIN2_*`) and an ACTIVE internal
  target (`E2E_SUPER_MANAGER_TARGET_EMAIL`); see `e2e/README.md`.

## Review (2026-11-12)

Fixed test-first:
- Important:
  - Enter in the member search ran the dialog submit and could add a user picked earlier; it now searches and clears
    the pick;
  - the e2e Approvals link was ambiguous (strict mode);
  - the e2e spec had no precondition or cleanup; it now checks the target lacks `super-manager`, matches the ticket
    cell exactly and revokes the role at the end;
  - the audit search now lives in the URL, so "Back to audit" returns to the same results;
  - a running search now shows "Searching…" with `aria-busy`.
- Minor:
  - a failed approve or reject refreshes the list;
  - the multi-team message names the user the failed request was for;
  - the picker says when results were cut off;
  - loading states for members and the edited role;
  - `new` and `catalog` are refused as role names (they clash with routes);
  - before/after uses own keys only and indented JSON;
  - re-submitting an identical audit search refetches;
  - the fake refuses `from == to`.

Deferred minors:
- times show without an explicit zone (custom inputs are hinted as local time);
- repeated row button names (Remove, Approve) have no row context in their accessible names;
- role checkboxes' Sensitive/Deprecated badges aren't part of the accessible name;
- the fake doesn't re-check eligibility on a manager change or hide expired PENDING requests.

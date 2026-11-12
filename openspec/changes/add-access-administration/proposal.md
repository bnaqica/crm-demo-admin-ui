# Proposal

## Why

Admins also own teams, roles, privileged-grant approvals and audit search. These are the remaining Admin UI screens over the UMS.

## What Changes

- Teams: create, archive, members and managers, with ticket references and multi-team errors explained.
- Roles: create and edit roles from the read-only permission catalog; view the catalog including deprecated and sensitive permissions.
- Approvals: list and approve or reject pending privileged grants (not your own).
- Audit: search with filters and a bounded time range; view a record's before/after.

## Capabilities

### New Capabilities
- `team-administration`: team screens.
- `role-administration`: roles and catalog screens.
- `grant-approvals`: approval screens.
- `audit-viewer`: audit search screens.

## Impact

- Uses UMS `/admin/teams`, `/admin/roles`, `/admin/catalog`, `/admin/grant-requests`, `/admin/audit`. Depends on `bootstrap-admin-app`.

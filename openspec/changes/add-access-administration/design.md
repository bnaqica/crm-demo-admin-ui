# Design

## Decisions

- Reuses `TicketField`, `ConfirmActionDialog` and the user picker from `add-user-administration`; if that change isn't applied yet, these components move into this change's first task.
- Approvals badge polls `/admin/grant-requests?status=PENDING` every 60 seconds through TanStack Query.
- Before/after uses a JSON diff view; values are rendered as text, never as HTML.

# Design

## Decisions

- Reusable `TicketField` and `ConfirmActionDialog` components so no action can be sent without a ticket.
- Allowed actions derived from status in one function shared by the detail page and its tests, mirroring the UMS transition rules; the UMS remains the authority and its 409 is shown when the UI is out of date.
- Lists use URL query params for filters so views are shareable; TanStack Query invalidates the user after each action.

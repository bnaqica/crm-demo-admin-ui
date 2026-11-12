# Proposal

## Why

Admins create, invite and support internal and external users through the UMS admin API; they need screens for it that always capture a ticket reference.

## What Changes

- Users list with search and filters across both realms.
- Create internal user and invite external user forms.
- User detail with actions: edit profile, enable/disable, unlock, force logout, reset MFA, set multi-team flag, assign/revoke roles.
- Every action asks for a ticket reference and confirms destructive actions.

## Capabilities

### New Capabilities
- `user-administration`: admin screens for user accounts.

## Impact

- Uses UMS `/admin/users/**` and role assignment endpoints. Depends on `bootstrap-admin-app`.

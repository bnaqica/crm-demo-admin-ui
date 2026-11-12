# Proposal

## Why

Admins manage users, roles, teams, approvals and audit only through the Admin UI, signing in to the dedicated `crm-admin` realm with strict MFA and short sessions. The repo is empty, so the app, its login and its shell come first.

## What Changes

- New React + TypeScript + Vite app with lint, test and build scripts and a CI workflow.
- OIDC Authorization Code + PKCE login to realm `crm-admin`, client `admin-app`; tokens kept in memory; silent refresh; logout.
- App shell with navigation (Users, Teams, Roles, Approvals, Audit), a typed API client for the UMS that attaches the token and renders ProblemDetail errors.

## Capabilities

### New Capabilities
- `admin-authentication`: signing in and out of the Admin UI.
- `admin-shell`: the app frame, navigation and API error handling.

## Impact

- New repo contents; dev server on port 5175; UMS base URL by `VITE_UMS_BASE_URL` (default `http://localhost:8083`).
- UMS must allow CORS from the Admin UI origin.

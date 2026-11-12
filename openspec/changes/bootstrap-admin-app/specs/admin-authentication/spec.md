# Spec Delta

## Purpose

Signs admins in to the Admin UI through the `crm-admin` realm only, and keeps their session short and safe.

## ADDED Requirements

### Requirement: Login required
Every page SHALL require a signed-in user; an unauthenticated visit SHALL redirect to the `crm-admin` login using Authorization Code with PKCE and return to the requested page afterwards.

#### Scenario: Deep link while signed out
- **WHEN** a signed-out user opens `/users/123`
- **THEN** they are sent to the `crm-admin` login and land on `/users/123` after signing in

### Requirement: Admin role required
After login the app SHALL show an access-denied page, and no admin screens, to a user whose token lacks the `admin` role.

#### Scenario: Token without admin role
- **WHEN** a `crm-admin` user without the `admin` role signs in
- **THEN** an access-denied page with a sign-out button is shown

### Requirement: Tokens not persisted
Access and refresh tokens SHALL be held in memory only, never in localStorage, sessionStorage or cookies set by the app.

#### Scenario: Reload
- **WHEN** the admin reloads the page
- **THEN** no token is found in web storage and the session is restored through the realm's SSO session

### Requirement: Session end
The app SHALL sign the admin out when token refresh fails or the user clicks Sign out, ending the Keycloak session.

#### Scenario: Refresh fails
- **WHEN** the refresh token has expired
- **THEN** the admin is returned to the login page

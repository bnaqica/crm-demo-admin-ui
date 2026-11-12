# Spec Delta

## Purpose

Gives the Admin UI a consistent frame, navigation and handling of API errors.

## ADDED Requirements

### Requirement: Navigation
The shell SHALL show the signed-in admin's name, Sign out, and navigation to Users, Teams, Roles, Approvals and Audit.

#### Scenario: Shell shown
- **WHEN** an admin signs in
- **THEN** the navigation lists Users, Teams, Roles, Approvals and Audit

### Requirement: API errors shown
The app SHALL show the `title` and `detail` of ProblemDetail errors returned by the UMS, and a generic message for other failures, without exposing stack traces.

#### Scenario: Conflict
- **WHEN** the UMS returns 409 with detail "Email already in use"
- **THEN** the form shows "Email already in use"

### Requirement: Expired session on 401
A 401 from the UMS SHALL trigger one silent token refresh and retry, and sign the admin out if it fails again.

#### Scenario: 401 after refresh
- **WHEN** a retried request still returns 401
- **THEN** the admin is returned to the login page

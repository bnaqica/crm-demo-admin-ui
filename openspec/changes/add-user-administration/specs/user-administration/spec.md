# Spec Delta

## Purpose

Lets admins find users and carry out every supported account action from one place, always with a ticket reference.

## ADDED Requirements

### Requirement: Find users
The Users page SHALL list users from both realms with email, name, user type and status, searchable by email or name and filterable by type and status, with pagination.

#### Scenario: Filter disabled externals
- **WHEN** an admin filters by type EXTERNAL and status DISABLED
- **THEN** only disabled external users are listed

### Requirement: Create and invite
The app SHALL provide a create-internal-user form and an invite-external-user form, each requiring email, names and a ticket reference, the external form also requiring an initial portal role.

#### Scenario: Missing ticket
- **WHEN** an admin submits the form without a ticket reference
- **THEN** the form shows a validation error and no request is sent

#### Scenario: Created
- **WHEN** the UMS accepts the request
- **THEN** the new user's detail page opens with status INVITED

### Requirement: Account actions
The user detail page SHALL offer the actions valid for the user's status: disable or enable, unlock, force logout, reset MFA and edit profile. Each SHALL ask for a ticket reference, and disable, force logout and reset MFA SHALL ask for confirmation.

#### Scenario: Invited user
- **WHEN** an admin views an INVITED user
- **THEN** Disable is not offered

#### Scenario: Unlock
- **WHEN** an admin unlocks a user with ticket `OPS-5`
- **THEN** a success message is shown and the lockout indicator clears

### Requirement: Roles and teams on the user
The user detail page SHALL list the user's roles and teams, allow assigning only roles assignable to the user's type, and show the multi-team flag for internal users.

#### Scenario: External user role picker
- **WHEN** an admin opens the role picker for an EXTERNAL user
- **THEN** only roles assignable to EXTERNAL users are offered

#### Scenario: Super Manager requested
- **WHEN** an admin assigns Super Manager
- **THEN** the app shows that the grant is pending a second admin's approval

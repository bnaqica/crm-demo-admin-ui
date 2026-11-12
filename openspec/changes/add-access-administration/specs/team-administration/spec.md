# Spec Delta

## Purpose

Lets admins maintain teams, members and managers in the Admin UI.

## ADDED Requirements

### Requirement: Team list and detail
The Teams page SHALL list teams with member and manager counts and archived state; a team page SHALL list members, marking managers.

#### Scenario: Team opened
- **WHEN** an admin opens a team
- **THEN** its members are listed and managers are marked

### Requirement: Team changes
Admins SHALL create and archive teams, add and remove members, and set or unset managers, each with a ticket reference. Only internal, non-disabled users SHALL be offered when adding members.

#### Scenario: Member picker
- **WHEN** an admin adds a member
- **THEN** only INTERNAL users who are not DISABLED are offered

#### Scenario: Multi-team rejection
- **WHEN** the UMS rejects an add because the user already has a team and multi-team isn't allowed
- **THEN** the app explains that the user's multi-team flag must be enabled first and links to the user

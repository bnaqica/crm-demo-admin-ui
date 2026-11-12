# Spec Delta

## Purpose

Lets admins build roles from the permissions services actually enforce.

## ADDED Requirements

### Requirement: Catalog view
The app SHALL show the permission catalog grouped by service and resource, marking sensitive and deprecated permissions, with no controls to create or delete permissions.

#### Scenario: Sensitive permission
- **WHEN** an admin views the catalog
- **THEN** sensitive permissions are marked as sensitive

### Requirement: Role editor
Admins SHALL create and edit roles by choosing permissions from one realm's catalog and setting assignableTo, description and owner; choosing a `:write` permission SHALL also select its `:read`.

#### Scenario: Write selects read
- **WHEN** an admin selects `submissions:write`
- **THEN** `submissions:read` is selected and can't be deselected while write is selected

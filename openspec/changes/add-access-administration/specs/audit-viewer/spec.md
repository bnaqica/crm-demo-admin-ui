# Spec Delta

## Purpose

Lets admins investigate audit history through the read-only UMS audit endpoint.

## ADDED Requirements

### Requirement: Audit search
The Audit page SHALL search by time range (required, default last 24 hours), source, realm, actor, target, action, outcome, ticket and correlation id, showing newest first with pagination.

#### Scenario: Search by ticket
- **WHEN** an admin searches ticket `OPS-12` in the last 7 days
- **THEN** matching records are listed newest first

### Requirement: Record detail
Selecting a record SHALL show all its fields and a side-by-side before/after view.

#### Scenario: Before/after
- **WHEN** an admin opens a `USER_DISABLED` record
- **THEN** status ACTIVE is shown before and DISABLED after

### Requirement: Range limit explained
When the UMS rejects a range as too wide, the app SHALL tell the admin the maximum range.

#### Scenario: Too wide
- **WHEN** the UMS returns 400 for the range
- **THEN** the message states the allowed maximum

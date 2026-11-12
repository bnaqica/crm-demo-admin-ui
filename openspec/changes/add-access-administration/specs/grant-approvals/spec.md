# Spec Delta

## Purpose

Lets a second admin review and decide privileged grant requests.

## ADDED Requirements

### Requirement: Pending approvals
The Approvals page SHALL list pending grant requests with requester, target, grant and expiry, and show a count badge in the navigation.

#### Scenario: Badge
- **WHEN** two requests are pending
- **THEN** the Approvals navigation item shows 2

### Requirement: Decide requests
An admin SHALL approve or reject a request created by another admin; for their own requests the app SHALL show no approve control.

#### Scenario: Own request
- **WHEN** an admin views a request they created
- **THEN** no Approve button is shown

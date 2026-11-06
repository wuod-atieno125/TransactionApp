


# PATUMAS API Inventory

## 1. Purpose

This document records the existing backend API endpoints and maps them to their responsible modules. Routes are registered by `server/src/modules/index.js`.

## 2. Known Route Files

The existing backend contains these route files:

- `authRoutes.js`
- `dashboardRoutes.js`
- `technicalAdminRoutes.js`
- `reportRoutes.js`
- `settingsRoutes.js`
- `memberRoutes.js`
- `groupMembershipRoutes.js`
- `adminRoutes.js`
- `auditRoutes.js`
- `healthRoutes.js`
- `meetingRoutes.js`
- `groupRulesRoutes.js`
- `paymentDestinationRoutes.js`
- `meetingMinutesRoutes.js`
- `notificationRoutes.js`
- `transactionRoutes.js`
- `index.js`

## 3. Planned Module Mapping

| Route area | Planned module |
|---|---|
| Authentication | Authentication |
| Dashboard | Dashboard |
| Members | Members |
| Group membership | Group Management |
| Admin and approvals | Approvals / Technical Administration, after inspection |
| Transactions | Transactions |
| Reports | Reports |
| Notifications | Notifications |
| Meetings | Meetings |
| Meeting minutes | Meetings |
| Group rules | Group Rules |
| Audit | Audit |
| Settings and payment destinations | To be confirmed after inspection |
| Health | Shared application infrastructure |
| Technical administration | Technical Administration |

## 4. Endpoint Inventory Format

Each endpoint must be documented with:

- HTTP method and URL
- Purpose
- Responsible module
- Authentication requirement
- Required role or permission
- Request fields
- Response format
- Validation rules
- Current tests

## 5. Migration Rules

- Preserve existing endpoint behaviour.
- Preserve authentication and permission checks.
- Update route registration carefully.
- Test every affected endpoint.
- Document approved API changes.

## 6. Current Status

**API inventory: Pending endpoint-level inspection.**

The route filenames are known, but the actual URLs, methods, permissions and request/response formats must be extracted from the source code.

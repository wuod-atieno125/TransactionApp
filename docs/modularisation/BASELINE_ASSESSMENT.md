

# PATUMAS Baseline Assessment

## 1. Purpose

This document records the state of the application before modularisation.

## 2. Confirmed Project Information

| Area | Current information |
|---|---|
| Frontend | React 19 + Vite |
| Backend | Node.js + Express 5 |
| Database | PostgreSQL |
| Frontend entry files | `App.jsx`, `main.jsx` |
| Backend entry files | `app.js`, `server.js` |
| Backend organisation | Existing routes, controllers, services, middleware, validators and repositories |
| Database changes | Migration directory exists at `server/db/migrations/` |

## 3. Existing Functional Areas

The existing source structure identifies functionality for:

- Authentication
- Members and group membership
- Transactions
- Reports and dashboard
- Notifications
- Meetings and minutes
- Group rules
- Payment destinations
- Audit
- Technical administration

## 4. Assessment Status

The source directory structure has been identified. A complete review of source code, database migrations, API behaviour and automated tests is still required.

## 5. Required Baseline Checks

Before restructuring:

- Confirm the application starts.
- Confirm frontend and backend dependencies install.
- Run available tests.
- Check database connectivity and migrations.
- Record existing API routes and response formats.
- Check existing role permissions.
- Verify important financial workflows.
- Create a restorable backup.

## 6. Current Status

**Baseline assessment: Incomplete — source-level verification pending.**

No restructuring should begin until the baseline checks are recorded.




# PATUMAS Database Inventory

## 1. Purpose

This document records the existing PostgreSQL structure before modularisation.

## 2. Known Database Information

- Database: PostgreSQL
- Migration directory: `server/db/migrations/`
- Database access is managed by the backend.

## 3. Areas to Inspect

The database review must identify existing tables and relationships for:

- Users and roles
- Member records
- Transactions
- Audit logs
- Notifications
- Group rules
- Meetings and minutes
- Sessions
- Password recovery
- Role transfers
- Other existing application records

These are areas to inspect, not a confirmed list of existing database tables.

## 4. Inventory Format

| Field | Description |
|---|---|
| Table | Existing database table |
| Purpose | What it stores |
| Columns | Column names and data types |
| Primary key | Main record identifier |
| Foreign keys | Relationships with other tables |
| Constraints | Required database rules |
| Indexes | Existing indexes |
| Module owner | Responsible module |

## 5. Database Migration Rules

1. Preserve existing records.
2. Do not remove columns or tables without approval.
3. Review foreign keys before changing relationships.
4. Preserve transaction reference uniqueness.
5. Use migrations for structural changes.
6. Back up the database before risky changes.
7. Test migrations and rollback procedures.

## 6. Current Status

**Database inventory: Pending migration and schema inspection.**

No database structure changes are approved by this document.


# PATUMAS Modularisation Plan

## 1. Objective

Restructure PATUMAS into a modular application that is easier to maintain, expand and update.

The existing functionality must continue working throughout the process.

## 2. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend | Node.js + Express 5 |
| Database | PostgreSQL |

The existing technology stack will be retained.

## 3. Approved Architecture

**Hybrid Feature-Based Modular Architecture**

The application will be divided into business modules. Each module will manage its own functionality, while common components and infrastructure will be shared.

### Frontend Structure

```text
client/src/
├── app/
├── modules/
│   ├── authentication/
│   ├── dashboard/
│   ├── members/
│   ├── transactions/
│   ├── approvals/
│   ├── notifications/
│   ├── reports/
│   ├── meetings/
│   ├── group-rules/
│   ├── group-management/
│   ├── audit/
│   └── technical-administration/
├── shared/
├── assets/
├── main.jsx
└── index.css
```

### Backend Structure

```text
server/src/
├── modules/
│   ├── authentication/
│   ├── dashboard/
│   ├── members/
│   ├── transactions/
│   ├── approvals/
│   ├── notifications/
│   ├── reports/
│   ├── meetings/
│   ├── group-rules/
│   ├── group-management/
│   ├── audit/
│   └── technical-administration/
├── shared/
├── config/
├── scripts/
├── app.js
└── server.js
```

## 4. Module Responsibilities

| Module | Responsibility |
|---|---|
| Authentication | Registration, login and password recovery |
| Dashboard | Role-based summaries |
| Members | Member accounts and profiles |
| Transactions | Contribution recording, editing and reversals |
| Approvals | Registration and other approval workflows |
| Notifications | Member notifications |
| Reports | Financial reports and exports |
| Meetings | Meetings and minutes |
| Group Rules | Group rules |
| Group Management | Membership and group settings |
| Audit | System activity records |
| Technical Administration | Technical administration functions |

### Future Modules

These will be integrated after modularisation:

- Welfare Management
- Shares Management
- Emergency Contributions

## 5. Integration Rules

1. Each module owns its functionality.
2. Modules communicate through defined interfaces and services.
3. Avoid direct access to another module's private implementation.
4. Avoid circular dependencies.
5. Shared functionality belongs in `shared/`.
6. Backend authorization must enforce all permissions.
7. Keep one PostgreSQL database with central connection management.
8. Financial changes must preserve transaction integrity and audit records.
9. Preserve existing API behaviour unless an approved change requires otherwise.

## 6. Implementation Stages

| Stage | Work |
|---|---|
| 0 | Inspect and document the existing application; establish backups and baseline checks |
| 1 | Establish shared infrastructure and application structure |
| 2 | Modularise authentication, members and approvals |
| 3 | Modularise transactions and reversals |
| 4 | Modularise notifications, audit, reports and dashboard |
| 5 | Modularise group management, rules, meetings and minutes |
| 6 | Modularise technical administration and finalise application structure |
| 7 | Perform regression testing and final verification |

## 7. Testing

Verify that existing functionality continues working, including:

- Registration and approval.
- Login, logout and password recovery.
- Member management.
- Role permissions.
- Contribution recording and editing.
- Duplicate M-Pesa reference prevention.
- Transaction reversals.
- Notifications and audit records.
- Reports and exports.
- Meetings and minutes.
- Group rules.
- Role transfers and account deletion.
- Technical administration.

## 8. Completion Requirements

Modularisation is complete when:

- The approved folder structure is implemented.
- Existing features still work.
- Module responsibilities are clearly defined.
- Module integration follows the agreed rules.
- Database integrity and security are maintained.
- Relevant tests pass.
- Documentation reflects the actual code.
- The project owner approves completion.

## 9. Approval

**Architecture:** Approved — Hybrid Feature-Based Modular Architecture.

**Approach:** Approved — Incremental Restructuring.

**Implementation status:** Not yet started.
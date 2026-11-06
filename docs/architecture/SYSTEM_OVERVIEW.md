

# PATUMAS System Overview

## 1. Purpose

PATUMAS (Pamoja Tuinuane Management System) is a web application for managing group contributions, members and group activities.

## 2. Technology

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend | Node.js + Express 5 |
| Database | PostgreSQL |

## 3. How the System Works

1. Users access PATUMAS through a web browser.
2. The React frontend displays the appropriate pages.
3. The frontend sends requests to the Express API.
4. The backend authenticates users, checks permissions and applies business rules.
5. PostgreSQL stores the application data.
6. The backend returns results to the frontend.

## 4. Main Modules

- Authentication
- Dashboard
- Members
- Transactions
- Approvals
- Notifications
- Reports
- Meetings
- Group Rules
- Group Management
- Audit
- Technical Administration

## 5. Future Modules

- Welfare Management
- Shares Management
- Emergency Contributions

These modules will be added after the existing application has been modularised.

## 6. Core Principles

- Protect members' personal and financial information.
- Enforce permissions on the backend.
- Keep financial records accurate and traceable.
- Preserve existing functionality during restructuring.
- Keep modules independent and easy to maintain.
- Test changes before marking them complete.


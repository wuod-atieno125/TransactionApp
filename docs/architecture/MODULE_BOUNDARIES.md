

# PATUMAS Module Boundaries

## 1. Purpose

This document defines what each module is responsible for and prevents different modules from taking ownership of the same functionality.

## 2. Module Responsibilities

| Module | Responsibility |
|---|---|
| Authentication | Registration, login, logout, sessions and password recovery |
| Dashboard | Role-based summaries and overview information |
| Members | Member profiles and account information |
| Transactions | Contribution recording, editing and reversals |
| Approvals | Registration approval and related decisions |
| Notifications | Member notification records and read status |
| Reports | Financial reports, summaries and exports |
| Meetings | Meeting scheduling and meeting information |
| Group Rules | Creation, updating and display of group rules |
| Group Management | Membership administration and group settings |
| Audit | Recording and retrieving authorised activity history |
| Technical Administration | Technical configuration and administrative functions |

## 3. Future Module Boundaries

| Module | Responsibility |
|---|---|
| Welfare | Welfare contributions, balances, eligibility and authorised welfare payments |
| Shares | Share deposits, balances, ownership and authorised withdrawals |
| Fines and Penalties | Fine definitions, member penalties, waivers, payments and status |
| Emergency Contributions | Emergency contribution campaigns, payments and closing dates |

These future modules must be developed separately from the existing contribution module.

## 4. Ownership Rules

- A module manages its own business rules and data access.
- Other modules must use its approved services or interfaces.
- Shared utilities must not contain module-specific business rules.
- Financial operations must preserve audit and transaction records.
- Permissions must be checked by the backend.

## 5. Changes to Boundaries

Any change that moves responsibility between modules must be documented before implementation.


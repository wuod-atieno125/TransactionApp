# PATUMAS — Project Documentation

This folder contains the technical records for PATUMAS (Pamoja Tuinuane Management System), including architecture, API, database, modularisation, decisions, and change history.

## Documentation Structure

```text
docs/
├── README.md
├── architecture/
│   ├── SYSTEM_OVERVIEW.md
│   ├── MODULAR_ARCHITECTURE.md
│   ├── MODULE_BOUNDARIES.md
│   └── MODULE_INTEGRATION_RULES.md
├── api/
│   └── API_INVENTORY.md
├── database/
│   └── DATABASE_INVENTORY.md
├── modularisation/
│   ├── MODULARISATION_PLAN.md
│   ├── BASELINE_ASSESSMENT.md
│   ├── FILE_INVENTORY.md
│   ├── FRONTEND_INVENTORY.md
│   ├── BACKEND_INVENTORY.md
│   ├── TESTING_BASELINE.md
│   └── MIGRATION_PROGRESS.md
├── decisions/
│   └── ARCHITECTURE_DECISIONS.md
└── changelog/
    ├── CHANGELOG.md
    └── CHANGELOG_TEMPLATE.md
```

The frontend follows `client/src/app`, `client/src/modules/*`, and `client/src/shared`. The backend follows `server/src/modules`, `server/src/shared`, and `server/src/config`. Start with the [system overview](./architecture/SYSTEM_OVERVIEW.md), then consult the [API inventory](./api/API_INVENTORY.md), [database inventory](./database/DATABASE_INVENTORY.md), and [modularisation plan](./modularisation/MODULARISATION_PLAN.md).

## Documentation Rules

1. Use Markdown (`.md`) for all project documentation.
2. Document important decisions and code changes.
3. Record the actual files affected.
4. Record tests performed and their results.
5. Never report an untested change as verified.
6. Keep documentation consistent with the actual application.
7. Update the changelog whenever changes are made.

## Development Principle

Understand the existing implementation before modifying it. Make changes incrementally, test them and document the results.

**Documentation is part of the development process.**
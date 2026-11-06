# PATUMAS

Pamoja Tuinuane Management System is organised as a modular full-stack application.

## Repository layout

```text
PATUMAS/
├── client/                 # React/Vite frontend application
│   └── src/
│       ├── app/            # Composition, routing, navigation and providers
│       ├── modules/        # Feature modules and their UI
│       └── shared/         # Business-agnostic UI, hooks and utilities
├── server/                 # Node/Express backend application
│   ├── db/migrations/      # Ordered database migrations
│   └── src/
│       ├── config/         # Runtime and database configuration
│       ├── modules/        # Feature modules and their APIs
│       ├── scripts/        # Database and maintenance scripts
│       └── shared/         # Business-agnostic backend infrastructure
├── docs/                   # Architecture, API, database and delivery records
└── scripts/                # Repository-level developer tooling
```

## Development

Install dependencies in both applications, then run from the repository root:

```bash
npm run dev
```

The root command starts the client and server together. Individual commands are available when only one application is needed:

```bash
npm run client:dev
npm run server:dev
npm run client:build
npm run client:lint
npm run db:migrate
```

## Adding a module

Add a feature with the same business name in both application module trees when it has frontend and backend behavior:

```text
client/src/modules/<feature>/
server/src/modules/<feature>/
```

A backend module may contain `routes/`, `controllers/`, `services/`, `repositories/`, `validators/`, and `tests/`. A frontend module may contain `pages/`, `components/`, `services/`, `hooks/`, and `tests/`. Create only the folders the feature needs.

Initial planned feature modules include `welfare`, `shares`, and `fines-penalties`. Each module owns its business rules and data access. Cross-module behavior must use an approved service or interface; shared code must remain business-agnostic.

See [Modular Architecture](docs/architecture/MODULAR_ARCHITECTURE.md), [Module Boundaries](docs/architecture/MODULE_BOUNDARIES.md), and [Module Integration Rules](docs/architecture/MODULE_INTEGRATION_RULES.md) for the governing conventions.



# PATUMAS Modular Architecture

## 0. Repository Layout

The repository root is an orchestration boundary. It does not contain business
logic. The applications and their business modules remain isolated under
`client/` and `server/`:

```text
PATUMAS/
├── client/                 # React/Vite application
├── server/                 # Node/Express application and migrations
├── docs/                   # Architecture and project records
└── scripts/                # Repository-level developer tooling
```

The root `package.json` provides workspace commands only. It delegates to the
existing `client` and `server` packages, so adding a module does not require
moving application files.

## 1. Architecture

PATUMAS will use a **Hybrid Feature-Based Modular Architecture**.

The application will be organised around business features. Each module will contain the files needed for its functionality, while common tools and infrastructure will remain in shared directories.

## 2. Frontend Structure

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
│   ├── technical-administration/
│   ├── welfare/
│   ├── shares/
│   └── fines-penalties/
├── shared/
├── assets/
├── main.jsx
└── index.css
```

## 3. Backend Structure

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
│   ├── technical-administration/
│   ├── welfare/
│   ├── shares/
│   └── fines-penalties/
├── shared/
├── config/
├── scripts/
├── app.js
└── server.js
```

## 4. Module Organisation

A module may contain:

- Routes
- Controllers
- Services
- Repositories
- Validators
- Components or pages on the frontend
- Tests

New modules should be created under both `client/src/modules/<feature>` and
`server/src/modules/<feature>` when they have both UI and API behavior. Use
lowercase kebab-case names, and add only the layers required by the feature.

Only the files required by that module should be included.

## 5. Shared Infrastructure

The `shared/` directories will contain reusable functionality such as common validation, error handling, API utilities and shared components.

Database connection and application configuration will remain centrally managed.

## 6. Architecture Rules

1. Each module owns its business functionality.
2. Modules communicate through defined interfaces.
3. Avoid circular dependencies.
4. Do not access another module's private repository directly.
5. Keep shared functionality outside individual modules.
6. Enforce security on the backend.
7. Preserve existing API behaviour unless a change is approved.


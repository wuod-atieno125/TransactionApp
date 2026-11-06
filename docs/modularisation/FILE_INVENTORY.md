

# PATUMAS File Inventory

## 1. Purpose

This document tracks the existing source files and their planned destinations in the modular architecture.

## 2. Known Existing Backend Structure

```text
server/src/
├── modules/
│   ├── authentication/
│   ├── members/
│   ├── approvals/
│   ├── transactions/
│   ├── notifications/
│   └── ...
├── shared/
│   ├── middleware/
│   ├── utilities/
│   ├── validators/
│   ├── errors/
│   └── adapters/
├── config/
├── scripts/
├── app.js
└── server.js
```

Each feature module owns its files directly. For example, the authentication
module contains `authRoutes.js`, `authController.js`, `authService.js`, and
its other feature files without nested `routes/`, `controllers/`, `services/`,
or `validators/` folders.

## 3. Known Existing Frontend Structure

```text
client/src/
├── components/
├── pages/
├── assets/
├── data/
├── hooks/
├── utils/
├── services/
├── layouts/
├── constants/
├── App.jsx
├── main.jsx
└── index.css
```

## 4. Inventory Requirements

For every source file, record:

| Field | Description |
|---|---|
| Current path | Existing file location |
| File name | Name of the file |
| Responsibility | What the file does |
| Dependencies | Other files or modules it uses |
| New path | Planned destination |
| Migration status | Pending, moved, tested or verified |

## 5. Migration Rules

- Do not move files based on their names alone.
- Inspect imports and dependencies before moving files.
- Update all affected imports.
- Preserve existing functionality.
- Avoid unnecessary file renaming.
- Test each migration stage.

## 6. Current Status

**File inventory: Partial.**

The directory structure is known, but a complete file-by-file review and destination mapping remain pending.


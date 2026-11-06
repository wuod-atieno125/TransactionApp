# Backend Inventory

The backend is an Express application backed by PostgreSQL.

| Layer | Location | Responsibility |
|---|---|---|
| Application | `server/src/app.js`, `server/src/server.js` | Express setup and process startup |
| Module routes/services | `server/src/modules/` | Capability-owned routes, handlers, validators, and repositories |
| Shared middleware | `server/src/shared/middleware/` | Authentication, role authorization, validation, activity tracking, and errors |
| Shared validators | `server/src/shared/validators/` | Request validation and normalization |
| Shared adapters | `server/src/shared/adapters/` | Reusable integrations such as email delivery |
| Database configuration | `server/src/config/database.js` | PostgreSQL pool and query helpers |
| Shared utilities/errors | `server/src/shared/utilities/`, `server/src/shared/errors/` | Audit, password, phone, profile-picture, and application errors |
| Scripts | `server/src/scripts/` | Migration, schema checks, and admin seeding |
| Module loader | `server/src/modules/index.js` | Capability route composition under `/api` |

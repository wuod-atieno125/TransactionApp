# Frontend Inventory

The frontend is a React 19/Vite application.

| Layer | Location | Examples |
|---|---|---|
| Entry and composition | `client/src/main.jsx`, `client/src/app/` | Application bootstrap, providers, navigation, and module registry |
| Feature modules | `client/src/modules/` | Authentication, dashboard, members, transactions, reports, meetings, and administration |
| Module pages | `client/src/modules/*/pages/` | Feature-specific screens |
| Module services | `client/src/modules/*/services/` | Feature-specific API calls |
| Module components | `client/src/modules/*/components/` | Feature-specific UI such as transaction tables and member profile controls |
| Shared components | `client/src/shared/components/` | Session lifecycle, headers, feature layout, password input, and common UI |
| Shared layouts | `client/src/shared/layouts/` | App shell, sidebar, topbar |
| API services | `client/src/shared/services/` | Auth, dashboard, members, transactions, notifications, administration |
| Hooks | `client/src/shared/hooks/` | Toasts and auto-dismiss behavior |
| Utilities | `client/src/shared/utils/` | Currency and phone formatting |
| Styling/assets | `client/src/shared/styles/`, `client/src/shared/assets/` | Application themes, shared styles, and shared images |

## Boundary note

Pages should call service modules rather than constructing resource-specific HTTP requests inline. Reusable visual behavior belongs in components; resource workflows belong in services or the server.

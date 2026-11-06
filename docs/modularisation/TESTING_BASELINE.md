# Testing Baseline

## Available verification commands

### Client

```bash
cd client
npm run lint
npm run build
```

### Server

```bash
cd server
npm run db:migrate
npm start
```

The server migration command requires a configured PostgreSQL environment. Do not run it against production without the deployment migration procedure.

## Current coverage position

No dedicated unit or integration test suite is currently represented in the source tree baseline. Until one is added, every change should receive lint/build validation where applicable and a focused manual or API smoke check for behavior.

## Target baseline

Introduce tests in capability slices, beginning with authentication, transactions, authorization, and migration verification. Keep tests close to the module they protect and add an end-to-end check for the browser → API → database path.

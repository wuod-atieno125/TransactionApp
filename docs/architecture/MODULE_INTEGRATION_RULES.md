

# PATUMAS Module Integration Rules

## 1. Purpose

These rules ensure that modules work together without becoming tightly dependent on one another.

## 2. Communication

1. Modules must communicate through defined service interfaces.
2. A module must not directly use another module's private repository.
3. Shared functionality belongs in the appropriate `shared/` directory.
4. Avoid circular dependencies.
5. Keep module responsibilities clear.

## 3. Backend Rules

- Routes receive and forward HTTP requests.
- Controllers handle request and response processing.
- Services contain business rules.
- Repositories handle database operations.
- Validators check incoming data.
- Middleware handles authentication, authorization and other shared request checks.

## 4. Frontend Rules

- Each module owns its pages and feature-specific components.
- Common components belong in `shared/`.
- API communication should follow the established frontend service pattern.
- Components must not be treated as the security boundary.

## 5. Database Rules

- PATUMAS will retain one PostgreSQL database.
- Database connections must use central configuration.
- Use parameterized queries.
- Use database transactions for operations that require multiple related writes.
- Preserve existing financial records and relationships.

## 6. Security Rules

- The backend is responsible for enforcing permissions.
- Users must only access information allowed by their roles.
- Do not expose passwords, secrets or unnecessary personal information.
- Record important financial and administrative changes in the audit log.

## 7. Change Management

Before integrating a new module:

1. Define its responsibility.
2. Identify the services and data it needs.
3. Define its permissions.
4. Define how it communicates with existing modules.
5. Test the integration.
6. Update the documentation.


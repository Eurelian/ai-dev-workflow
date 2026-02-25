---
name: backend-dev
description: >
  Backend development agent for APIs, business logic, database operations,
  services, and server-side infrastructure. Use this skill when your assigned
  task involves building or modifying backend code — REST/GraphQL endpoints,
  database models/migrations, authentication, business logic, background jobs,
  or server-side integrations. Trigger for any task in a Backend track.
---

# Backend Development Agent

You build server-side logic. You implement API endpoints, database models,
business logic, authentication, and service integrations — always defining
contracts before or alongside implementation.

## Session Start Protocol

```
1. Read CLAUDE.md (global rules)
2. Read TASK_BOARD.md (find your task)
3. Read CONTRACTS.md (API shapes you must implement, shared types)
4. Read plan.md (understand where your task fits)
5. Claim your task in TASK_BOARD.md
6. Begin implementation
```

## Implementation Standards

### Project Structure

```
src/
├── api/                 # Route handlers / controllers
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.validation.ts
│   │   └── users.test.ts
│   └── ...
├── models/              # Database models / entities
│   ├── user.model.ts
│   └── ...
├── migrations/          # Database migrations (ordered)
├── middleware/           # Auth, validation, error handling, logging
├── services/            # Business logic, external integrations
├── shared/
│   ├── types/           # Shared TypeScript interfaces (from CONTRACTS.md)
│   ├── utils/           # Shared utility functions
│   ├── config/          # Environment, constants, feature flags
│   └── errors/          # Custom error classes
├── jobs/                # Background jobs, cron tasks
└── index.ts             # App entry point
```

### API Design

- **Implement exactly what CONTRACTS.md specifies.** If a contract exists for your
  endpoint, match it precisely — request shapes, response shapes, status codes.
- **If no contract exists**, define one in CONTRACTS.md BEFORE implementing. Frontend
  agents depend on stable contracts.
- **RESTful conventions**: proper HTTP methods, meaningful status codes, consistent
  error response format.

```typescript
// Standard error response (from CONTRACTS.md)
interface ErrorResponse {
  error: string;       // Human-readable message
  code: string;        // Machine-readable error code
  details?: Record<string, string>;  // Field-level errors
}
```

**Status code usage:**
| Code | When                                              |
|------|---------------------------------------------------|
| 200  | Successful GET, PUT, PATCH                        |
| 201  | Successful POST that creates a resource           |
| 204  | Successful DELETE                                 |
| 400  | Validation error, malformed request               |
| 401  | Missing or invalid authentication                 |
| 403  | Authenticated but not authorized                  |
| 404  | Resource not found                                |
| 409  | Conflict (duplicate, version mismatch)            |
| 500  | Unexpected server error (never expose internals)  |

### Database

- **Migrations are mandatory.** Never modify the database schema without a migration.
- **Name migrations with timestamps**: `20250225_001_create_users_table.ts`
- **Migrations must be reversible.** Include both `up()` and `down()`.
- **Validate at the boundary.** Validate all input at the API layer before it reaches
  the database. Use the validation rules defined in CONTRACTS.md.
- **Indexes for query patterns.** Add indexes for fields used in WHERE, ORDER BY, JOIN.

### Authentication & Authorization

- **Follow the auth contract** in CONTRACTS.md.
- **Middleware-based auth.** Validate tokens/sessions in middleware, not in every handler.
- **Role-based access** where applicable. Check permissions in service layer, not controller.
- **Never log sensitive data.** No passwords, tokens, or PII in logs.

### Input Validation

- **Validate everything.** Never trust client input.
- **Validation at the controller layer**, before passing to services.
- **Return field-level errors** in the standard error format.
- **Sanitize for injection.** Use parameterized queries, escape HTML.

### Error Handling

- **Custom error classes** for business logic errors.
- **Global error handler** catches unhandled errors and returns standard format.
- **Never expose stack traces** in production responses.
- **Log errors with context** — request ID, user ID, operation.

```typescript
// src/shared/errors/app-error.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, string>
  ) {
    super(message);
  }
}
```

### External Integrations

- **Wrap external calls in service classes** with retry logic and timeout handling.
- **Never hardcode API keys.** Use environment variables.
- **Circuit breaker pattern** for unreliable external services.
- **Mock external services in tests.**

## Testing Requirements

For every endpoint you create:

- **Unit test** the service/business logic (isolated from HTTP/DB).
- **Integration test** the full request→response cycle (with test DB).
- **Test validation** — verify that bad input returns correct error codes.
- **Test auth** — verify unauthorized access is rejected.
- **Test edge cases** — empty results, duplicate creation, not-found.

## Contract Responsibilities

As a backend agent, you are often the **contract producer**:

1. If your task involves a new API endpoint, check CONTRACTS.md first.
2. If no contract exists, **define it** before implementing. Include:
   - Request/response types
   - Status codes and error cases
   - Authentication requirements
3. Update the CONTRACTS.md change log.
4. If you need to modify an existing contract, mark it `⚠️ BREAKING` and list affected tasks.

## Completion Checklist

Before marking your task as `review` or `completed`:

- [ ] All todos in the task are implemented
- [ ] API endpoints match CONTRACTS.md exactly
- [ ] Database migrations created and reversible
- [ ] Input validation on all endpoints
- [ ] Error handling returns standard format
- [ ] Auth middleware applied where required
- [ ] Unit and integration tests pass
- [ ] No hardcoded secrets or API keys
- [ ] No TypeScript errors
- [ ] Files listed in AGENT_LOG.md entry
- [ ] TASK_BOARD.md updated
- [ ] CONTRACTS.md updated if new/changed contracts
- [ ] Downstream tasks checked for unblocking

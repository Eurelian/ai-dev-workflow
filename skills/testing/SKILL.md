---
name: testing
description: >
  Testing agent responsible for writing unit tests, integration tests, and
  end-to-end tests. Use this skill when your task involves creating test
  suites, improving test coverage, writing E2E tests, setting up test
  infrastructure, or verifying cross-track integration through tests.
  Trigger for "write tests", "add test coverage", "E2E tests", "integration
  testing", or any task in a Testing track.
---

# Testing Agent

You write and maintain tests at all levels — unit, integration, and end-to-end.
You verify that implementations work correctly, handle edge cases, and integrate
properly across tracks.

## Session Start Protocol

```
1. Read CLAUDE.md (global rules)
2. Read TASK_BOARD.md (find your task)
3. Read CONTRACTS.md (verify API shapes and shared types)
4. Read the source files your tests will cover
5. Claim your task in TASK_BOARD.md
6. Write tests
```

## Testing Pyramid

```
        ╱  E2E Tests  ╲          Few, slow, high confidence
       ╱───────────────╲
      ╱ Integration Tests╲       Medium count, test boundaries
     ╱─────────────────────╲
    ╱     Unit Tests         ╲   Many, fast, isolated
   ╱───────────────────────────╲
```

### Unit Tests

**What to test**: Individual functions, classes, and components in isolation.

**Rules:**
- Test one behavior per test case
- Name tests descriptively: `should return 404 when user not found`
- Mock external dependencies (DB, API calls, file system)
- DO NOT mock the unit under test
- Cover: happy path, edge cases, error cases, boundary values
- Keep tests fast (<100ms each)

**File placement**: Co-located with source files.
```
src/services/users.service.ts
src/services/users.service.test.ts
```

**Structure each test:**
```typescript
describe('UsersService', () => {
  describe('createUser', () => {
    it('should create user with valid data', async () => {
      // Arrange — set up test data and mocks
      // Act — call the function under test
      // Assert — verify the result
    });

    it('should throw validation error for invalid email', async () => {
      // ...
    });

    it('should throw conflict error for duplicate email', async () => {
      // ...
    });
  });
});
```

### Integration Tests

**What to test**: Interactions between components — API endpoints with real
DB, service chains, middleware pipelines.

**Rules:**
- Use a test database (not mocks)
- Set up and tear down test data for each test
- Test the full request → response cycle for API endpoints
- Verify database state changes
- Test auth middleware integration
- Test error propagation through the stack

**File placement**: Dedicated test directory.
```
tests/
├── integration/
│   ├── api/
│   │   ├── users.integration.test.ts
│   │   └── auth.integration.test.ts
│   └── setup.ts          # DB setup/teardown helpers
```

### End-to-End Tests

**What to test**: Complete user flows from UI to database and back.

**Rules:**
- Test critical user journeys (signup → login → use feature → logout)
- Test cross-track integration (frontend calling backend calling DB)
- Use realistic test data
- Handle async operations properly (wait for UI updates, API responses)
- Test on multiple viewport sizes if responsive design is required

**File placement**:
```
tests/
├── e2e/
│   ├── flows/
│   │   ├── user-signup.e2e.test.ts
│   │   └── dashboard.e2e.test.ts
│   └── helpers/           # Page objects, test utilities
```

## Contract Verification Tests

A critical responsibility: verify that implementations match CONTRACTS.md.

For every API contract, write tests that verify:

```typescript
describe('API Contract: POST /api/users', () => {
  it('should accept the documented request shape', async () => {
    const validRequest: CreateUserRequest = {
      email: 'test@example.com',
      name: 'Test User',
      role: 'member',
    };
    const response = await request(app).post('/api/users').send(validRequest);
    expect(response.status).toBe(201);
  });

  it('should return the documented response shape', async () => {
    // ... create user ...
    expect(response.body).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      name: expect.any(String),
      role: expect.any(String),
      createdAt: expect.any(String),
    });
  });

  it('should reject requests missing required fields', async () => {
    const response = await request(app).post('/api/users').send({});
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: expect.any(String),
      code: expect.any(String),
    });
  });
});
```

## Test Data Management

- **Factories/builders** for creating test data:
  ```typescript
  // tests/factories/user.factory.ts
  export function buildUser(overrides?: Partial<User>): User {
    return {
      id: randomUUID(),
      email: `test-${randomUUID()}@example.com`,
      name: 'Test User',
      role: 'member',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }
  ```
- **Unique data per test** — never share mutable test data between tests
- **Clean up after yourself** — reset DB state in afterEach/afterAll

## Coverage Requirements

Aim for these minimums:
- **Unit tests**: 80%+ line coverage on business logic
- **Integration tests**: Every API endpoint has at least happy path + error case
- **E2E tests**: Every critical user journey

Do NOT chase 100% coverage at the expense of test quality. A meaningful test
of an edge case is worth more than a trivial test of a getter.

## Completion Checklist

- [ ] All todos in the task are implemented
- [ ] Tests pass consistently (no flaky tests)
- [ ] Test names clearly describe the behavior being verified
- [ ] Contract verification tests match CONTRACTS.md
- [ ] Test data is isolated and cleaned up
- [ ] No hardcoded values that could cause environment-specific failures
- [ ] Files listed in AGENT_LOG.md entry
- [ ] TASK_BOARD.md updated

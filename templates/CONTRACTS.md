# CONTRACTS.md — Shared Interfaces & Type Definitions

> This file defines all shared interfaces between parallel tracks.
> **Every agent MUST read this file before implementing any task** that
> produces or consumes shared data.
>
> Rules:
> - Define contracts BEFORE implementing against them.
> - Never deviate from a published contract without updating this file.
> - Mark breaking changes with `⚠️ BREAKING` and note affected tasks.

---

## API Contracts

> Define request/response shapes for all API endpoints.

### Example: `POST /api/users`

```typescript
// Request
interface CreateUserRequest {
  email: string;
  name: string;
  role: 'admin' | 'member';
}

// Response — 201
interface CreateUserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string; // ISO-8601
}

// Error — 400/409
interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, string>;
}
```

---

## Shared Types

> Types used across multiple tracks (frontend + backend + tests).

```typescript
// Define shared types here
```

---

## Event Contracts

> Event shapes for pub/sub, WebSocket, or SSE communication.

```typescript
// Define event types here
```

---

## Configuration Constants

> Shared constants, feature flags, tier limits.

```typescript
// Define shared constants here
```

---

## Change Log

| Date | Contract | Change | Breaking? | Affected Tasks | Changed By |
|------|----------|--------|-----------|----------------|------------|
|      |          |        |           |                |            |

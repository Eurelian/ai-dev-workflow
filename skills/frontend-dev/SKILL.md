---
name: frontend-dev
description: >
  Frontend development agent for UI components, pages, state management,
  routing, and styling. Use this skill when your assigned task involves
  building or modifying frontend code — React/Angular/Vue components, pages,
  layouts, forms, client-side state, CSS/styling, or browser-side logic.
  Trigger for any task in a Frontend track.
---

# Frontend Development Agent

You build user-facing interfaces. You implement UI components, pages, routing,
state management, forms, and styling — working from contracts and designs.

## Session Start Protocol

```
1. Read CLAUDE.md (global rules)
2. Read TASK_BOARD.md (find your task)
3. Read CONTRACTS.md (API shapes, shared types, auth context)
4. Read plan.md (understand where your task fits)
5. Claim your task in TASK_BOARD.md
6. Check if design specs or mockups exist in docs/
7. Begin implementation
```

## Implementation Standards

### Component Architecture

- **One component per file.** Name the file after the component.
- **Props interfaces first.** Define the props type/interface before the component.
- **Composition over inheritance.** Prefer small, composable components.
- **Smart vs. dumb components.** Containers handle data/state; presentational
  components receive props and render UI.

```
src/
├── components/          # Reusable UI components
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   └── Button.styles.ts   (or .css/.module.css)
│   └── ...
├── pages/               # Route-level page components
│   ├── Dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── Dashboard.test.tsx
│   │   └── components/        # Page-specific sub-components
│   └── ...
├── hooks/               # Custom React hooks
├── services/            # API client functions
├── shared/
│   ├── types/           # Shared TypeScript interfaces (from CONTRACTS.md)
│   ├── utils/           # Shared utility functions
│   └── config/          # Constants, feature flags
└── store/               # State management (Redux/Zustand/Context)
```

### API Integration

- **Never invent API shapes.** Always consume from CONTRACTS.md.
- **Create typed API client functions** in `src/services/`.
- **Handle loading, error, and empty states** for every data-fetching component.
- **Use the error response format** defined in CONTRACTS.md.

```typescript
// src/services/users.ts — example
import type { CreateUserRequest, CreateUserResponse, ErrorResponse } from '@/shared/types';

export async function createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error: ErrorResponse = await response.json();
    throw new ApiError(error);
  }
  return response.json();
}
```

### State Management

- **Local state first.** Use component state for UI-only concerns.
- **Lift state minimally.** Only lift to the nearest common ancestor.
- **Global state for shared data.** Use the project's chosen state solution
  for data needed across unrelated component trees.
- **Server state is not client state.** Use appropriate data-fetching
  patterns (React Query, SWR, or equivalent) rather than manually syncing
  server data into global state.

### Styling

- Follow the project's chosen styling approach (CSS Modules, Tailwind, styled-components, etc.).
- **Design tokens first.** Use CSS variables or theme tokens for colors, spacing, typography.
- **Responsive by default.** Every component should work on mobile and desktop.
- **Accessibility required.** Semantic HTML, ARIA labels, keyboard navigation, focus management.

### Forms & Validation

- **Client-side validation mirrors server validation.** Use the same rules defined in CONTRACTS.md.
- **Show inline errors** next to the relevant field, not just at the top.
- **Disable submit during loading.** Show a loading indicator.
- **Handle server errors gracefully.** Map error codes to user-friendly messages.

## Testing Requirements

For every component you create:

- **Unit test** the component renders without crashing.
- **Test interactive behavior** (clicks, form submissions, state changes).
- **Test error states** (API failure, validation errors, empty data).
- **Test accessibility** (keyboard navigation, screen reader compatibility).

Place tests co-located with components: `Component.test.tsx` next to `Component.tsx`.

## Contract Compliance

Before committing any API integration:

1. Re-read the relevant section of CONTRACTS.md.
2. Verify your request shapes match exactly.
3. Verify you handle all documented response codes.
4. If you need an API endpoint that doesn't exist in CONTRACTS.md, do NOT invent one.
   Instead, log it in AGENT_LOG.md as a missing contract and set your task to `failed`
   or create a sub-task for the backend track.

## Completion Checklist

Before marking your task as `review` or `completed`:

- [ ] All todos in the task are implemented
- [ ] Components render correctly with real data shapes (from CONTRACTS.md)
- [ ] Loading, error, and empty states handled
- [ ] Unit tests pass
- [ ] No TypeScript errors
- [ ] No hardcoded API URLs (use config/environment variables)
- [ ] Accessibility basics: semantic HTML, alt text, keyboard nav
- [ ] Files listed in AGENT_LOG.md entry
- [ ] TASK_BOARD.md updated
- [ ] Downstream tasks checked for unblocking

# TASK_BOARD.md — Task Status Tracker

> **Last updated:** {timestamp}
> **Updated by:** {session-id}
>
> This file is the source of truth for all task statuses. Every agent reads this
> at session start and updates it when claiming, completing, or failing tasks.

---

## Status Legend

| Icon | Status        | Meaning                                     |
|------|---------------|---------------------------------------------|
| ⬜   | `pending`     | Ready to pick up. No blockers.              |
| 🚧   | `in_progress` | Claimed by an agent. Hands off.             |
| 🔒   | `blocked`     | Waiting on dependencies. Do NOT pick up.    |
| 👀   | `review`      | Done, awaiting review.                      |
| ✅   | `completed`   | Verified complete. Dependents may unblock.  |
| ❌   | `failed`      | Blocked by issue. Needs triage.             |

---

## Phase 1 — {Phase Name}

**Goal:** {What this phase achieves}
**Gate:** {Specific criteria for phase completion}

### Track 1A: {Track Name}

| ID     | Task                          | Status        | Depends On  | Assigned To   | Complexity | Notes |
|--------|-------------------------------|---------------|-------------|---------------|------------|-------|
| 1A.1   | {Task name}                   | ⬜ pending     | —           |               | medium     |       |
| 1A.2   | {Task name}                   | 🔒 blocked     | 1A.1        |               | high       |       |
| 1A.3   | {Task name}                   | 🔒 blocked     | 1A.1, 1A.2  |               | low        |       |

### Track 1B: {Track Name}

| ID     | Task                          | Status        | Depends On  | Assigned To   | Complexity | Notes |
|--------|-------------------------------|---------------|-------------|---------------|------------|-------|
| 1B.1   | {Task name}                   | ⬜ pending     | —           |               | medium     |       |
| 1B.2   | {Task name}                   | 🔒 blocked     | 1B.1        |               | low        |       |

---

## Phase 2 — {Phase Name}

**Goal:** {What this phase achieves}
**Gate:** {Specific criteria for phase completion}
**Depends on:** Phase 1 gate met

### Track 2A: {Track Name}

| ID     | Task                          | Status        | Depends On     | Assigned To   | Complexity | Notes |
|--------|-------------------------------|---------------|----------------|---------------|------------|-------|
| 2A.1   | {Task name}                   | 🔒 blocked     | Phase 1 gate   |               | medium     |       |

---

## Summary

| Phase   | Total Tasks | Pending | In Progress | Blocked | Review | Completed | Failed |
|---------|-------------|---------|-------------|---------|--------|-----------|--------|
| Phase 1 | 0           | 0       | 0           | 0       | 0      | 0         | 0      |
| Phase 2 | 0           | 0       | 0           | 0       | 0      | 0         | 0      |
| **Total** | **0**     | **0**   | **0**       | **0**   | **0**  | **0**     | **0**  |

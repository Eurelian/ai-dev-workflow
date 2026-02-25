# CLAUDE.md — Multi-Agent Development Orchestration

## Project Overview

This project uses AI agents (Claude sessions) to develop software collaboratively.
Multiple agents work in parallel on independent tasks, coordinated through a shared
task board and strict conventions. No single agent has global state — coordination
happens through files.

---

## Agent Identity & Session Protocol

Every agent session MUST begin by:

1. **Reading this file** (`CLAUDE.md`) to understand the rules.
2. **Reading `TASK_BOARD.md`** to understand what work exists, what's in progress, and what's available.
3. **Claiming a task** before writing any code (see Task Claiming below).
4. **Reading the relevant SKILL.md** for the type of work being done.

**Never start coding without a claimed task.** If no tasks are available, report this
and stop.

---

## Directory Structure

```
project-root/
├── CLAUDE.md                  ← You are here. Global rules for all agents.
├── TASK_BOARD.md              ← Human-readable task status (source of truth)
├── task-board.json            ← Machine-readable mirror (agents update both)
├── AGENT_LOG.md               ← Append-only log of all agent sessions
├── CONTRACTS.md               ← Shared interfaces, types, API schemas
├── prd.md                     ← Product Requirements Document (input)
├── plan.md                    ← Decomposed implementation plan
├── skills/                    ← SKILL.md files for each agent role
│   ├── orchestrator/
│   ├── task-manager/
│   ├── prd-to-tasks/
│   ├── frontend-dev/
│   ├── backend-dev/
│   ├── code-review/
│   ├── testing/
│   ├── devops/
│   └── integration/
├── src/                       ← Source code (created by agents)
├── tests/                     ← Test files (created by agents)
└── docs/                      ← Documentation (created by agents)
```

---

## Task Board Protocol

The `TASK_BOARD.md` file is the single source of truth for task state. Every agent
reads it at session start and updates it during work.

### Task Statuses

| Status         | Meaning                                              |
|----------------|------------------------------------------------------|
| `pending`      | Ready to be picked up. No dependencies blocking it.  |
| `blocked`      | Has unmet dependencies. Do NOT pick up.              |
| `in_progress`  | Claimed by an agent. Do NOT pick up.                 |
| `review`       | Implementation done, awaiting code review.           |
| `completed`    | Done and verified. Dependents can now unblock.       |
| `failed`       | Agent encountered a blocking issue. Needs triage.    |

### Task Claiming Rules

1. Read `TASK_BOARD.md` completely.
2. Find a task with status `pending`.
3. Prefer tasks that:
   - Unblock the most downstream work
   - Match your assigned role/skill
   - Have lower complexity first (build momentum)
4. Update the task status to `in_progress` with your session identifier.
5. **Only then** begin implementation.

### Conflict Avoidance

Since agents run in parallel, two agents could attempt to claim the same task.
To minimize conflicts:
- Each agent adds a **session ID** (timestamp + random suffix) when claiming.
- If you read `TASK_BOARD.md` and a task you wanted is already `in_progress`, pick another.
- Never force-claim a task that's `in_progress` unless it's been stale for >2 hours
  (check the timestamp in AGENT_LOG.md).

### Completing a Task

When your task is done:
1. Update `TASK_BOARD.md`: set status to `review` (or `completed` if no review needed).
2. Update `task-board.json` to mirror the change.
3. Append a session summary to `AGENT_LOG.md` (see format below).
4. Check if completing your task **unblocks** other tasks — if so, change their status
   from `blocked` → `pending`.
5. List all files you created or modified in your log entry.

---

## Agent Session Log Format

Every agent appends to `AGENT_LOG.md` when finishing:

```markdown
## Session: {session-id}
- **Timestamp:** {ISO-8601}
- **Task:** {task-id} — {task-name}
- **Role:** {frontend-dev | backend-dev | devops | testing | review | orchestrator}
- **Status:** {completed | review | failed}
- **Summary:** {1-3 sentence description of what was done}
- **Files Changed:**
  - `src/components/Header.tsx` — Created
  - `src/api/users.ts` — Modified (added validation)
  - `tests/api/users.test.ts` — Created
- **Unblocked Tasks:** {list of task IDs now unblocked, or "none"}
- **Issues/Notes:** {any blockers, questions, or decisions made}
```

---

## Contracts & Shared Interfaces

The `CONTRACTS.md` file defines all shared interfaces between parallel workstreams.
**Agents MUST read CONTRACTS.md before implementing any task** that produces or consumes
shared data structures, API endpoints, event formats, or configuration.

Rules:
- Backend agents define API contracts before frontend agents consume them.
- If a contract doesn't exist yet for your task, **define it in CONTRACTS.md first**,
  then implement against it.
- Never deviate from a published contract without updating CONTRACTS.md and noting
  the change in AGENT_LOG.md.
- Contract changes that affect in-progress tasks require flagging the affected task
  in TASK_BOARD.md with a `⚠️ contract-changed` note.

---

## Code Conventions

All agents follow these conventions to ensure code from parallel sessions integrates
cleanly:

### General
- Use the tech stack defined in `plan.md` or `prd.md`. Do not introduce new dependencies
  without documenting the reason in your agent log.
- Write self-documenting code. Add JSDoc/docstrings for all public APIs.
- Every new feature must include at minimum unit tests for core logic.

### File Organization
- Follow the directory structure established by the first agent session. If none exists,
  follow the convention in the relevant SKILL.md.
- Shared types go in `src/shared/types/`.
- Shared utilities go in `src/shared/utils/`.
- Constants and configuration go in `src/shared/config/`.

### Git Conventions (if applicable)
- Branch naming: `task/{task-id}-{short-description}`
- Commit messages: `[{task-id}] {description}`
- One task per branch. Do not bundle unrelated changes.

---

## Dependency & Gating Rules

Tasks may have explicit dependencies listed in `TASK_BOARD.md`. The rules:

1. A task with `depends_on: [X, Y]` stays `blocked` until BOTH X and Y are `completed`.
2. When you complete a task, scan the board for tasks that depend on yours. Update
   their status from `blocked` → `pending` if all their dependencies are now met.
3. Phase gates work the same way: Phase N+1 tasks stay `blocked` until all Phase N
   gate criteria (listed in `plan.md`) are satisfied.
4. **Partial dependencies**: Some tasks depend on specific tasks, not entire phases.
   Always check the specific `depends_on` field, not just the phase number.

---

## Error Handling & Escalation

If you encounter a blocking issue:
1. Set your task status to `failed` in TASK_BOARD.md.
2. Document the issue clearly in your AGENT_LOG.md entry.
3. Do NOT attempt to fix tasks outside your assigned scope.
4. If the issue affects a shared contract, add a `⚠️` warning to CONTRACTS.md.

If you find a bug in another agent's completed work:
1. Add a note to TASK_BOARD.md under the relevant task.
2. Do NOT modify their code unless you have a dedicated fix task.
3. Log it in AGENT_LOG.md so the next session can address it.

---

## Role Assignment

Each agent session operates under a specific role. The role determines which SKILL.md
to read and what scope of work is appropriate:

| Role             | Skill File                        | Scope                                  |
|------------------|-----------------------------------|----------------------------------------|
| Orchestrator     | `skills/orchestrator/SKILL.md`    | Decompose PRD, manage plan, triage     |
| Task Manager     | `skills/task-manager/SKILL.md`    | Maintain board, unblock, prioritize    |
| Frontend Dev     | `skills/frontend-dev/SKILL.md`    | UI components, pages, state, styling   |
| Backend Dev      | `skills/backend-dev/SKILL.md`     | APIs, business logic, DB, services     |
| Code Reviewer    | `skills/code-review/SKILL.md`     | Review PRs, verify contracts, quality  |
| Tester           | `skills/testing/SKILL.md`         | Unit, integration, E2E tests           |
| DevOps           | `skills/devops/SKILL.md`          | CI/CD, infra, deployment, monitoring   |
| Integrator       | `skills/integration/SKILL.md`     | Cross-track integration, merge, verify |

Agents should stay within their role's scope. If you discover work needed outside your
role, log it as a new task suggestion in AGENT_LOG.md — don't do it yourself.

---

## Quick Start for a New Agent Session

```
1. Read CLAUDE.md (this file)
2. Read TASK_BOARD.md
3. Read CONTRACTS.md
4. Pick a pending task matching your role
5. Read the SKILL.md for your role
6. Claim the task (update TASK_BOARD.md)
7. Implement
8. Update TASK_BOARD.md + task-board.json
9. Append to AGENT_LOG.md
10. Unblock downstream tasks if applicable
```

---

## Bootstrapping a New Project

If this is a fresh project with only a PRD:

1. Run the **Orchestrator** role first with `skills/prd-to-tasks/SKILL.md`.
2. This produces `plan.md`, `TASK_BOARD.md`, `task-board.json`, and `CONTRACTS.md`.
3. Then spin up parallel agent sessions for each available track.
4. Each agent follows the Quick Start above.

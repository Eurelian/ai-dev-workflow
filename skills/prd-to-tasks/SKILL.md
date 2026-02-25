---
name: prd-to-tasks
description: >
  Break down a Product Requirements Document into agent-ready tasks using the
  Phase → Tracks → Tasks → Todos hierarchy. Produces a plan, task board, and
  contract definitions. Use when someone says "decompose this PRD", "break this
  into tasks", "create an implementation plan", "make this agent-ready", or
  provides a PRD file and wants to start building.
---

# PRD to Tasks Decomposition

Transform a PRD into a structured, parallelizable implementation plan that
multiple AI agents can execute independently.

## Core Hierarchy

```
Phase (dependency gate)
 └── Track (parallelizable workstream)
      └── Task (assignable unit, one agent)
           └── Todo (feature-chunk, one focused session)
```

**Plus Contracts** — shared interfaces defined before parallel tracks diverge.

## Step-by-Step Process

### Step 1 — Ingest the PRD

Read the entire PRD. Extract and categorize:

| Category               | Look For                                              |
|------------------------|-------------------------------------------------------|
| Features               | Discrete features, acceptance criteria, user stories   |
| Data Model             | Entities, relationships, field types                   |
| API Surface            | Endpoints, request/response shapes                     |
| Integrations           | External services, SDKs, webhooks                      |
| Non-Functional Reqs    | Performance, security, accessibility targets           |
| Architecture Decisions | Tech stack, deployment targets, offline strategy       |
| MVP Scope              | What's in v1 vs. deferred                              |

Flag missing information as `[ASSUMPTION: ...]`.

### Step 2 — Identify Phase Boundaries

Phases are **dependency gates**. Test each boundary: "Can ANY work in Phase N+1
begin before Phase N is fully complete?" If yes, the boundary is wrong.

Common patterns (adapt to the PRD):

| Phase       | Purpose                        | Gate Criteria                        |
|-------------|--------------------------------|--------------------------------------|
| Foundation  | Setup, auth, DB, app shell     | App boots, auth works, DB migrated   |
| Core        | Primary differentiating feature| Core value prop works end-to-end     |
| Features    | Secondary features on core     | Each feature functional              |
| Integration | Multi-user / external services | Cross-service flows work             |
| Polish      | Testing, performance, launch   | QA passed, deployable                |

**Produce a dependency map:**

```
Phase 1 ─── Foundation ──────────── gate: app boots, auth, DB ready
   │
Phase 2 ─┬─ Track 2A: Backend ──── gate: API endpoints functional
   │      └─ Track 2B: Frontend ─── gate: UI screens functional
   │
Phase 3 ─── Integration ─────────── gate: end-to-end flows work
```

### Step 3 — Define Tracks per Phase

Split by system boundary or feature domain — whichever maximizes parallelism:

- **By system**: Backend, Frontend, Infrastructure, AI/ML
- **By domain**: User Management, Billing, Content, Analytics

Test: "Would two agents on these tracks need to coordinate mid-task?" If yes,
they're not truly parallel — merge them or define contracts.

**State partial dependencies explicitly.** "Track 3B depends only on Track 2A,
not all of Phase 2."

### Step 4 — Break into Tasks and Todos

Each **task** gets:
- A clear name describing its deliverable
- 3–8 todos at feature-chunk granularity
- A complexity estimate (low / medium / high)
- Explicit dependencies

**Todo sizing guide:**

| Signal      | Too Big                                        | Right Size                         | Too Small                       |
|-------------|------------------------------------------------|------------------------------------|---------------------------------|
| Scope       | Combines unrelated concerns                    | One coherent piece of functionality| Sub-step of another todo        |
| Session     | Would need context switches                    | ~1 focused session                 | Single line of code             |
| Branching   | Requires mid-execution decisions               | Clear path from start to finish    | No independent value            |

**Assign complexity:**
- `low` — Single file, boilerplate, configuration
- `medium` — Component + wiring, endpoint + validation
- `high` — Multi-file coordination, complex logic, integration

### Step 5 — Extract Contracts

For every pair of parallel tracks, identify shared interfaces:

| Type              | Example                           | Artifact                  |
|-------------------|-----------------------------------|---------------------------|
| API schemas       | Frontend calls backend endpoints  | TypeScript interfaces     |
| Data shapes       | Shared entities across tracks     | Shared type definitions   |
| Auth context      | All frontend tracks need user     | Context provider interface|
| Event formats     | Backend emits, frontend subscribes| Event type definitions    |
| Config/constants  | Feature flags, tier limits        | Shared constants file     |

### Step 6 — Verify

Run five checks before finalizing:

1. **Dependency correctness** — Every gate truly requires all preceding tracks
2. **No hidden cross-deps** — Parallel tracks don't share mutable state
3. **Todo sizing** — No todo combines multiple concerns
4. **Coverage** — Every PRD feature maps to at least one todo
5. **Contract completeness** — Every parallel track pair has defined contracts

### Step 7 — Generate Outputs

Produce four files:

1. **`plan.md`** — Full implementation plan with dependency map, phases, tracks,
   tasks, todos, contracts, verification notes
2. **`TASK_BOARD.md`** — Populated task board with initial statuses
3. **`task-board.json`** — Machine-readable mirror
4. **`CONTRACTS.md`** — All shared interface definitions

Use task ID convention: `{Phase#}{Track Letter}.{Task#}` → `2A.3`
Todo IDs: `{Phase#}{Track Letter}.{Task#}.{Todo#}` → `2A.3.4`

## Output Format for plan.md

```markdown
# {Project Name} — Implementation Plan

**Source:** {PRD filename}
**Generated:** {date}
**Granularity:** Feature-chunk (each todo ≈ one focused agent session)

## Dependency Map

{ASCII diagram}

## Phase 1 — {Name}

**Goal:** {what this phase achieves}
**Gate:** {testable criteria}

### Track 1A: {Name}

#### Task 1A.1 — {Deliverable Name} [complexity: medium]

- [ ] `1A.1.1` {Todo description} [low]
- [ ] `1A.1.2` {Todo description} [medium]

---

## Contracts

| Contract | Between Tracks | Artifact | Resolve Before |
|----------|---------------|----------|----------------|

## Verification Notes

{Findings from Step 6}
```

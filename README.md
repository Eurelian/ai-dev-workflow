# AI Multi-Agent Development Workflow

A complete framework for orchestrating multiple AI agents (Claude sessions) to
develop software in parallel. Agents coordinate through shared files — no runtime
communication needed.

## How It Works

```
┌─────────────┐     ┌──────────────────────────────────┐
│   You have   │────▶│  Orchestrator Agent (Session 1)   │
│   a PRD      │     │  Reads PRD → produces plan,       │
│              │     │  task board, contracts             │
└─────────────┘     └──────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │ Agent 2      │ │ Agent 3      │ │ Agent 4      │
            │ (Backend)    │ │ (Frontend)   │ │ (DevOps)     │
            │              │ │              │ │              │
            │ Reads board  │ │ Reads board  │ │ Reads board  │
            │ Claims task  │ │ Claims task  │ │ Claims task  │
            │ Implements   │ │ Implements   │ │ Implements   │
            │ Updates board│ │ Updates board│ │ Updates board│
            └──────────────┘ └──────────────┘ └──────────────┘
                    │               │               │
                    ▼               ▼               ▼
            ┌──────────────────────────────────────────────┐
            │         Review / Integration Agents           │
            │    Verify quality, contracts, cross-track     │
            └──────────────────────────────────────────────┘
```

## Quick Start

### 1. Copy into your project

Copy the entire framework into your project root:

```bash
cp -r ai-dev-workflow/* your-project/
```

### 2. Add your PRD

Place your Product Requirements Document as `prd.md` in the project root.

### 3. Run the Orchestrator

Start a new Claude session with this prompt:

```
Read CLAUDE.md, then read skills/orchestrator/SKILL.md.
I have a PRD at prd.md. Bootstrap this project:
decompose the PRD into an implementation plan, create the
task board, and define contracts.
```

This produces: `plan.md`, `TASK_BOARD.md`, `task-board.json`, `CONTRACTS.md`.

### 4. Spin Up Dev Agents

Open parallel Claude sessions, one per available track. Each agent gets:

```
Read CLAUDE.md, then read TASK_BOARD.md.
You are a {role} agent. Read skills/{role}/SKILL.md.
Pick up a pending task and implement it.
```

Replace `{role}` with: `frontend-dev`, `backend-dev`, `devops`, or `testing`.

### 5. Review & Integrate

After agents complete tasks (status: `review`), run review agents:

```
Read CLAUDE.md, then read skills/code-review/SKILL.md.
Review tasks in "review" status on the task board.
```

At phase boundaries, run the integration agent:

```
Read CLAUDE.md, then read skills/integration/SKILL.md.
Verify that all completed tracks in Phase {N} integrate correctly.
```

### 6. Repeat

Check `TASK_BOARD.md` for remaining work. Run the Task Manager to reconcile
statuses and identify what's available next:

```
Read CLAUDE.md, then read skills/task-manager/SKILL.md.
Reconcile the board and report what's available.
```

## File Reference

| File                | Purpose                                         | Who Updates It       |
|---------------------|-------------------------------------------------|----------------------|
| `CLAUDE.md`         | Global rules for all agents                     | You (rarely)         |
| `TASK_BOARD.md`     | Task statuses (source of truth)                 | All agents           |
| `task-board.json`   | Machine-readable task board                     | All agents           |
| `AGENT_LOG.md`      | Append-only session history                     | All agents           |
| `CONTRACTS.md`      | Shared interfaces between tracks                | Orchestrator, Backend|
| `plan.md`           | Implementation plan with phases/tracks/tasks    | Orchestrator         |
| `prd.md`            | Your Product Requirements Document              | You                  |

## Skills Reference

| Skill                              | Role           | When to Use                        |
|------------------------------------|----------------|------------------------------------|
| `skills/orchestrator/SKILL.md`     | Orchestrator   | Bootstrap, replan, triage          |
| `skills/prd-to-tasks/SKILL.md`    | Orchestrator   | Decompose PRD into tasks           |
| `skills/task-manager/SKILL.md`    | Task Manager   | Board maintenance, status checks   |
| `skills/frontend-dev/SKILL.md`    | Frontend Dev   | UI, components, client-side logic  |
| `skills/backend-dev/SKILL.md`     | Backend Dev    | APIs, DB, business logic           |
| `skills/code-review/SKILL.md`     | Code Reviewer  | Quality verification               |
| `skills/testing/SKILL.md`         | Tester         | Unit, integration, E2E tests       |
| `skills/devops/SKILL.md`          | DevOps         | CI/CD, Docker, deployment          |
| `skills/integration/SKILL.md`     | Integrator     | Cross-track verification           |

## Agent Prompt Templates

### Orchestrator (Bootstrap)
```
Read CLAUDE.md and skills/orchestrator/SKILL.md.
Bootstrap this project from prd.md. Produce plan.md,
TASK_BOARD.md, task-board.json, and CONTRACTS.md.
```

### Dev Agent (General)
```
Read CLAUDE.md and TASK_BOARD.md.
You are a {backend-dev|frontend-dev} agent.
Read skills/{role}/SKILL.md and CONTRACTS.md.
Pick a pending task, claim it, and implement it.
When done, update TASK_BOARD.md and AGENT_LOG.md.
```

### Review Agent
```
Read CLAUDE.md, TASK_BOARD.md, and skills/code-review/SKILL.md.
Review all tasks currently in "review" status.
Approve, request changes, or escalate each one.
```

### Task Manager (Status Check)
```
Read CLAUDE.md and skills/task-manager/SKILL.md.
Reconcile TASK_BOARD.md with AGENT_LOG.md.
Report current board status and recommend next tasks.
```

### Integration Agent (Phase Boundary)
```
Read CLAUDE.md and skills/integration/SKILL.md.
All Phase {N} tracks are complete. Verify integration:
contract conformance, data flows, build status.
Produce an integration report.
```

## Customization

### Adding a New Role

1. Create `skills/{role-name}/SKILL.md` following the pattern in existing skills.
2. Add the role to the table in CLAUDE.md.
3. Define what tasks this role can claim and what scope it covers.

### Adjusting Granularity

- **Coarser** (for experienced teams): Collapse todos into tasks, use fewer phases.
- **Finer** (for deterministic agents): Expand todos to function-level, specify exact files.

### Tech Stack Customization

The skills are stack-agnostic. Customize by:
- Updating file structure examples in SKILL.md files to match your stack.
- Adding stack-specific conventions to CLAUDE.md.
- Creating `references/` files with framework-specific patterns.

## Principles

1. **Files are the coordination layer.** No agent needs to talk to another.
2. **Contracts before code.** Define interfaces, then implement against them.
3. **Claim before you build.** Never start work without updating the board.
4. **Log everything.** The agent log is the project's memory.
5. **Stay in your lane.** Agents work within their role's scope.
6. **Small tasks over large ones.** Easier to parallelize, easier to review.

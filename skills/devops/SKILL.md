---
name: devops
description: >
  DevOps and infrastructure agent for CI/CD pipelines, deployment configuration,
  containerization, monitoring, and environment setup. Use this skill when your
  task involves setting up build pipelines, Docker/container configuration,
  Kubernetes manifests, cloud infrastructure, environment variables, monitoring,
  or deployment automation. Trigger for any task in an Infrastructure track.
---

# DevOps Agent

You set up and maintain the infrastructure layer — build pipelines, deployment
configs, containers, environments, and monitoring. You enable other agents to
ship their code reliably.

## Session Start Protocol

```
1. Read CLAUDE.md (global rules)
2. Read TASK_BOARD.md (find your task)
3. Read plan.md (understand tech stack and deployment targets)
4. Claim your task in TASK_BOARD.md
5. Implement infrastructure
```

## Infrastructure Standards

### Project Configuration

```
project-root/
├── .github/workflows/    # GitHub Actions CI/CD (or equivalent)
│   ├── ci.yml            # Build + test on every PR
│   ├── deploy-staging.yml
│   └── deploy-prod.yml
├── docker/
│   ├── Dockerfile        # Production image
│   ├── Dockerfile.dev    # Development image with hot reload
│   └── docker-compose.yml
├── k8s/                  # Kubernetes manifests (if applicable)
│   ├── base/
│   └── overlays/
│       ├── staging/
│       └── production/
├── infra/                # IaC (Terraform, Pulumi, CloudFormation)
├── .env.example          # Template for environment variables
├── .env.test             # Test environment variables (no secrets)
└── scripts/
    ├── setup.sh          # Local dev setup
    ├── seed.sh           # Database seeding
    └── healthcheck.sh    # Health check script
```

### CI Pipeline (ci.yml)

Every PR should trigger:
1. **Install dependencies** (with lockfile caching)
2. **Lint** (code style, type checking)
3. **Unit tests** (fast, isolated)
4. **Integration tests** (with test database)
5. **Build** (verify compilation)
6. **Security scan** (dependency vulnerabilities)

```yaml
# Principles:
# - Fast feedback: fail fast on lint/type errors before slow tests
# - Caching: cache node_modules/pip packages between runs
# - Parallelism: run independent jobs concurrently
# - Artifacts: save test reports and coverage for review
```

### Docker

- **Multi-stage builds** to minimize production image size
- **Non-root user** in production containers
- **Health checks** defined in Dockerfile
- **.dockerignore** to exclude node_modules, tests, docs
- **Pin base image versions** (no `latest` tags)

### Environment Management

- **Never commit secrets.** Use `.env.example` as a template.
- **Environment-specific config** via environment variables, not code branches.
- **Three environments minimum**: development, staging, production.
- **Feature flags** for gradual rollouts, not long-lived branches.

### Database Migrations

- **Run migrations in CI** against a test database.
- **Run migrations before deployment** as a separate step (not at app startup).
- **Rollback strategy** documented for every migration.

### Monitoring & Observability

- **Health check endpoint**: `GET /health` returning service status.
- **Structured logging**: JSON format, correlation IDs, log levels.
- **Error tracking**: Integration with error reporting service.
- **Metrics**: Response time, error rate, throughput at minimum.

## Deployment Standards

### Staging
- Automatic deployment on merge to main branch
- Same infrastructure as production (scaled down)
- Seed data for testing

### Production
- Manual approval gate (or tag-based trigger)
- Blue-green or rolling deployment (zero downtime)
- Automated rollback on health check failure
- Post-deployment smoke tests

## Security

- **Dependency scanning** in CI (npm audit, pip audit, etc.)
- **Secret management** via environment variables or secret manager (never in code)
- **HTTPS only** in all environments
- **CORS configuration** matches only expected origins
- **Rate limiting** on public endpoints

## Completion Checklist

- [ ] All todos in the task are implemented
- [ ] CI pipeline runs successfully
- [ ] Docker builds and runs locally
- [ ] Environment variables documented in `.env.example`
- [ ] No secrets committed to repository
- [ ] Health check endpoint responds correctly
- [ ] Deployment scripts tested
- [ ] Files listed in AGENT_LOG.md entry
- [ ] TASK_BOARD.md updated

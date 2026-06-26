---
name: apicraft-devops
description: >
  Production DevOps for NestJS APIs: multi-stage Dockerfile (node:20-alpine,
  non-root user), Docker Compose for local dev, the CI/CD pipeline stage order,
  graceful shutdown with enableShutdownHooks() (the PID 1 Docker gotcha and Tini fix),
  zero-downtime deploy pattern with readiness probes, and DB migration strategy
  (prisma migrate deploy as a discrete step, never migrate dev in CI/CD). Requires
  apicraft-context to be loaded first.
  Triggers on: "Docker", "CI/CD", "deployment", "graceful shutdown", "migrations in
  production", "GitHub Actions", "pipeline", "zero downtime", "Dockerfile",
  "SIGTERM", "Tini", "PID 1", "enableShutdownHooks", "health probe".
  Not for application-level observability — use apicraft-observability.
version: 1.0.0
---

## Core Philosophy

Production readiness in DevOps comes down to three guarantees: the container starts deterministically (multi-stage build, non-root user, pinned base images), the process handles SIGTERM correctly (PID 1 problem, Tini, graceful shutdown hooks), and the database is migrated before the app starts (discrete migration step, never `migrate dev`). Miss any of these and you get flaky deployments, data loss risks, or zombie processes.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ Writing the Dockerfile → load references/dockerfile.md
  ├─ Graceful shutdown / SIGTERM not working → load references/graceful-shutdown.md
  ├─ Setting up CI/CD pipeline → load references/ci-pipeline.md
  ├─ Running DB migrations in CI → load references/graceful-shutdown.md §DB migrations
  └─ Zero-downtime deploys → load references/ci-pipeline.md §Zero-downtime
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| Multi-stage Dockerfile, Docker Compose, non-root user | `references/dockerfile.md` |
| CI/CD pipeline stages, zero-downtime deploy pattern | `references/ci-pipeline.md` |
| `enableShutdownHooks()`, PID 1/Tini, `nestjs-graceful-shutdown`, migration strategy | `references/graceful-shutdown.md` |

## Step 3 — Execute

### The PID 1 problem

> ⚠️ **Gotcha — the most common Docker deployment bug:** When Node.js runs as PID 1 in a container, the operating system's default signal handlers are not registered. This means SIGTERM is ignored — `docker stop` / Kubernetes pod termination sends SIGTERM, Node ignores it, Docker waits 30 seconds, then sends SIGKILL. The app is force-killed instead of gracefully shutting down.

```bash
# Two solutions:

# Option A: docker run --init (uses kernel's init process)
docker run --init my-api

# Option B: Tini in Dockerfile (preferred for Docker images)
FROM node:20-alpine
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]
```

→ See `references/dockerfile.md` for the complete multi-stage Dockerfile with Tini.
→ See `references/graceful-shutdown.md` for `enableShutdownHooks()` and DB migration strategy.
→ See `apicraft-observability` for health check endpoints used by Kubernetes probes.

## Step 4 — Validate

- [ ] Multi-stage Dockerfile: separate builder and runner stages
- [ ] Base image is `node:20-alpine` (not `node:latest` or `node:20`)
- [ ] Non-root user created with `adduser` / `USER nestjs`
- [ ] Tini installed: `ENTRYPOINT ["/sbin/tini", "--"]`
- [ ] `enableShutdownHooks()` called in `main.ts`
- [ ] DB migration runs as a discrete CI step before the app starts
- [ ] CI pipeline runs: `biome check` → `tsc --noEmit` → unit tests → integration → E2E → build → scan → deploy
- [ ] Readiness probe configured in Kubernetes deployment

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/dockerfile.md` | Multi-stage Dockerfile, Docker Compose | Container setup |
| `references/ci-pipeline.md` | CI/CD stage order, zero-downtime | Pipeline setup |
| `references/graceful-shutdown.md` | `enableShutdownHooks`, PID 1, migrations | Shutdown or migration setup |

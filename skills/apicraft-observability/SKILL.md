---
name: apicraft-observability
description: >
  Structured logging with Pino (nestjs-pino), correlation ID propagation via
  AsyncLocalStorage, PII redaction, health checks with @nestjs/terminus (liveness
  vs readiness), Prometheus metrics, and OpenTelemetry distributed tracing with
  sampling strategy. Covers what NOT to log. Requires apicraft-context to be loaded first.
  Triggers on: "logging", "Pino", "health check", "terminus", "metrics", "Prometheus",
  "OpenTelemetry", "tracing", "correlation ID", "observability", "nestjs-pino",
  "structured logging", "liveness", "readiness", "503", "PII redaction".
  Not for error response format — use apicraft-error-handling.
version: 1.0.0
---

## Core Philosophy

Observability is the difference between knowing something is wrong and knowing why. The Pino logger with `nestjs-pino` provides structured JSON logs with correlation IDs automatically propagated through every log line — without threading context through function arguments. The liveness/readiness distinction in health checks is what allows Kubernetes and load balancers to route around failures rather than serving 500s. Both are non-negotiable for production.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ Setting up structured logging → load references/logging.md
  ├─ Correlation IDs not appearing in logs → load references/logging.md §Correlation IDs
  ├─ PII/secrets appearing in logs → load references/logging.md §Redaction
  ├─ Health check setup → load references/health-checks.md
  ├─ Liveness vs readiness distinction → load references/health-checks.md §Liveness vs readiness
  ├─ Prometheus metrics → load references/tracing.md §Metrics
  └─ OpenTelemetry tracing → load references/tracing.md
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| Pino setup, correlation IDs, redaction, log levels | `references/logging.md` |
| @nestjs/terminus liveness/readiness endpoints | `references/health-checks.md` |
| OpenTelemetry setup, sampling, Prometheus metrics | `references/tracing.md` |

## Step 3 — Execute

### Pino vs Winston

| Factor | Pino (`nestjs-pino`) | Winston |
|--------|---------------------|---------|
| Write model | Non-blocking async (worker thread) | Synchronous by default |
| Serialization | Deferred — only serializes if log level passes | Eager |
| Built-in redaction | Yes (`redact` option) | Manual transform required |
| Performance | Best for high-throughput APIs | Adequate for moderate throughput |
| When to use | Default for production APIs | When you need many custom transports |

> 💡 **Senior insight:** Pino's async writes via worker thread mean logging doesn't block the event loop under high load. For a typical 1000 req/s API, this is measurable. Winston's synchronous transports can become a bottleneck.

### What NOT to log

Never log the following — configure Pino's `redact` option to enforce this automatically:

```
passwords, passwordHash
tokens, accessToken, refreshToken, apiKey
authorization headers
cookies
credit card numbers, CVV
SSN, government IDs
```

→ See `references/logging.md` for the complete Pino setup with redaction config.
→ See `references/health-checks.md` for terminus liveness/readiness setup.
→ See `apicraft-devops` for `enableShutdownHooks()` which health checks depend on.

## Step 4 — Validate

- [ ] `nestjs-pino` installed and registered in AppModule
- [ ] Custom NestJS logger replaced with Pino logger in `main.ts`
- [ ] Correlation ID set and propagated through all log lines per request
- [ ] PII fields configured in `redact` array
- [ ] Health module has `/health/live` (liveness) and `/health/ready` (readiness) endpoints
- [ ] Readiness endpoint returns `503` when DB is unavailable
- [ ] `enableShutdownHooks()` called in `main.ts` (terminus depends on it)

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/logging.md` | Pino setup, correlation IDs, redaction | Logging configuration |
| `references/health-checks.md` | @nestjs/terminus liveness/readiness | Health check setup |
| `references/tracing.md` | OpenTelemetry, sampling, Prometheus | Distributed tracing or metrics |

---
name: mcp-observability
description: >
  Configures and audits observability for NestJS MCP servers: structured JSON logging with
  field redaction (nestjs-pino), OpenTelemetry tracing with first-import initialisation,
  tool-call audit interceptor, Terminus health endpoints (/healthz liveness + /readyz
  readiness), and graceful shutdown hooks. Use when the user asks about "MCP logging",
  "OpenTelemetry MCP", "OTel NestJS MCP", "audit tool calls", "Pino MCP", "health checks
  MCP", "liveness readiness probe NestJS", "graceful shutdown NestJS", "redact sensitive
  fields", or "structured logging MCP". Do NOT use for rate-limit metrics (→ mcp-rate-limiter)
  or deployment packaging (→ mcp-deployment-packager).
---

# MCP Observability

Configures production-grade observability for NestJS MCP servers: logging, tracing, auditing,
health checks, and graceful shutdown.

---

## Mode: GENERATE

Use when the user wants to add observability to a server.

### GENERATE Checklist

- [ ] Step 1 — Configure structured logging with Pino and field redaction
- [ ] Step 2 — Initialise OpenTelemetry BEFORE the NestJS bootstrap
- [ ] Step 3 — Add tool-call audit interceptor
- [ ] Step 4 — Add Terminus health endpoints (/healthz + /readyz)
- [ ] Step 5 — Enable graceful shutdown
- [ ] Step 6 — Emit templates from `assets/`

---

### Step 1 — Structured logging

**Use `nestjs-pino`** — it integrates pino with NestJS's logger interface and adds request-ID correlation automatically.

```ts
// In LoggerModule config
{
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }      // human-readable in dev
      : undefined,                      // raw JSON in production (orchestrator ships logs)
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.token',
        '*.secret',
        '*.access_token',
        '*.refresh_token',
        '*.api_key',
      ],
      remove: true,
    },
  },
}
```

**Replace the NestJS default logger** in `main.ts`:
```ts
app.useLogger(app.get(Logger));  // must be called after NestFactory.create
```

> Load `references/pino-redaction.md` for the full redactPaths list and transport switching.

---

### Step 2 — OpenTelemetry initialisation

OTel patches Node.js internals (`http`, `net`, `dns`) at import time. Any module imported before `tracing.ts` will not be instrumented.

```ts
// main.ts — FIRST LINE, before any other imports
import './observability/tracing';

// Then all other imports
import { NestFactory } from '@nestjs/core';
// ...
```

Copy `assets/tracing.template.ts` to `src/observability/tracing.ts`.

> Load `references/otel-setup.md` for SDK configuration, auto-instrumentation packages, and OTLP exporter.

---

### Step 3 — Tool-call audit interceptor

Every tool invocation should produce a structured audit log entry:

```json
{
  "event": "tool_call",
  "user_sub": "user123",
  "tool_name": "orders_create",
  "scopes": ["orders:write"],
  "duration_ms": 142,
  "is_error": false,
  "args_hash": "sha256:abc123",
  "result_hash": "sha256:def456"
}
```

- Hash args and result — never log raw values (may contain PII or secrets).
- Log `user_sub`, not `email` or full user object.
- `is_error` enables SLO alerting on tool error rate.

Copy `assets/audit.interceptor.template.ts` and register as `APP_INTERCEPTOR`.

> Load `references/audit-interceptor.md` for the full schema and hashing implementation.

---

### Step 4 — Health endpoints

```ts
// /healthz — liveness probe: is the process alive?
@SkipThrottle()   // never rate-limit infrastructure endpoints
@Get('healthz')
@HealthCheck()
async liveness() {
  // No dependency checks — if this method runs, the process is alive
  return { status: 'ok' };
}

// /readyz — readiness probe: is the server ready to serve traffic?
@Get('readyz')
@HealthCheck()
async readiness() {
  return this.health.check([
    () => this.redisIndicator.checkHealth('redis'),
    () => this.http.pingCheck('auth-server', process.env.JWT_ISSUER + '/.well-known/openid-configuration'),
  ]);
}
```

Both endpoints MUST be excluded from JWT auth and rate-limiting guards.

> Load `references/health-endpoints.md` for Terminus indicator setup and K8s probe config.

---

### Step 5 — Graceful shutdown

```ts
// main.ts
app.enableShutdownHooks();  // listen for SIGTERM, SIGINT

// What this does on shutdown signal:
// 1. Stop accepting new connections
// 2. Drain in-flight requests (default: 15s timeout)
// 3. Close database pools, Redis connections
// 4. Exit with code 0
```

For custom shutdown logic (e.g., flushing OTel spans):
```ts
// In any provider
@Injectable()
export class AppService implements OnApplicationShutdown {
  async onApplicationShutdown(signal?: string) {
    await flushOpenTelemetrySpans();
  }
}
```

---

### GENERATE Examples

**Example 1 — Add full observability stack**
User: "Add logging, tracing, and health checks to my MCP server."
1. Add `LoggerModule.forRoot` to AppModule with pino-pretty in dev, JSON in prod.
2. Add `import './observability/tracing'` as first line in main.ts.
3. Register `AuditInterceptor` as `APP_INTERCEPTOR`.
4. Add `TerminusModule` and `HealthController` with `/healthz` and `/readyz`.
5. Add `app.enableShutdownHooks()`.
6. Emit all four template files.

**Example 2 — Add redaction only**
User: "I'm logging Authorization headers. How do I redact them?"
1. Add `redact.paths` to pino config: `req.headers.authorization`.
2. Set `remove: true` to delete the field entirely (not replace with `[Redacted]`).
3. Verify: make a request and confirm `authorization` absent from log output.

---

## Mode: AUDIT

Use when reviewing the observability of an existing server.

### AUDIT Checklist

- [ ] Step 1 — Run `scripts/audit-observability.ts` against the source directory
- [ ] Step 2 — Map each JSON finding to severity
- [ ] Step 3 — Produce Markdown report with file:line citations
- [ ] Step 4 — Verify health endpoints are excluded from auth and throttling

### AUDIT Findings Table

| Code | Severity | Description |
|------|----------|-------------|
| O001 | HIGH | `tracing.ts` is not the first import in `main.ts` — spans lost on bootstrap |
| O002 | HIGH | Sensitive field not in pino `redactPaths` (`authorization`, `password`, etc.) |
| O003 | HIGH | No audit interceptor registered — tool calls are not logged with user identity |
| O004 | MEDIUM | `/healthz` or `/readyz` not excluded from JWT auth guard |
| O005 | MEDIUM | `app.enableShutdownHooks()` not called — in-flight requests not drained on SIGTERM |
| O006 | LOW | `OTEL_SERVICE_NAME` or `OTEL_EXPORTER_OTLP_ENDPOINT` not in Zod env schema |

### AUDIT Examples

**Example 3 — Observability audit**
User: "Audit the observability setup in my MCP server."
1. Run: `npx ts-node scripts/audit-observability.ts src/`
2. O001 is the most impactful — check first.
3. For each finding, cite file:line and provide fix.

**Example 4 — Check for PII in logs**
User: "Is my server logging any sensitive data?"
1. Check `redactPaths` in LoggerModule config.
2. Flag O002 for each standard sensitive field that is missing.
3. Recommend adding `*.email` if users' email addresses are logged.

---

## References

- `references/pino-redaction.md` — nestjs-pino setup, redactPaths, pretty vs JSON transport
- `references/otel-setup.md` — OTel NodeSDK first-import, auto-instrumentation, OTLP exporter
- `references/audit-interceptor.md` — tool audit log schema, hashing, interceptor registration
- `references/health-endpoints.md` — Terminus liveness vs readiness, guard exclusion, K8s probes

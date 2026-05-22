---
name: mcp-server-architect
description: >
  Designs and audits the top-level architecture of a production NestJS MCP (Model Context Protocol)
  server using @rekog/mcp-nest. Covers transport selection (stdio vs Streamable HTTP), stateless vs
  stateful mode, NestJS module layout, dependency selection, and MCP capability negotiation. Use when
  the user asks to design, scaffold, or review an MCP server — including "design an MCP server",
  "scaffold NestJS MCP", "which transport should I use", "stateful or stateless MCP", "MCP module
  layout", or "what dependencies do I need for MCP". Do NOT use for individual tool definitions
  (→ mcp-tool-designer), auth flows (→ mcp-auth-guardian), or deployment packaging (→ mcp-deployment-packager).
---

# MCP Server Architect

Designs production-grade NestJS MCP servers: transport, statefulness, module structure, and
dependency selection. Targets MCP spec 2025-11-25 and `@rekog/mcp-nest` ^1.0.0.

---

## Mode: GENERATE

Use when the user wants to scaffold a new MCP server or choose its architecture.

### GENERATE Checklist

- [ ] Step 1 — Determine deployment context (single local client, remote multi-client, corp internal)
- [ ] Step 2 — Select transport (stdio or Streamable HTTP)
- [ ] Step 3 — Select statefulness (stateless or stateful)
- [ ] Step 4 — Define capability set (tools only, or tools + resources + prompts + sampling)
- [ ] Step 5 — Select dependency stack
- [ ] Step 6 — Emit module layout from `assets/app.module.template.ts` and `assets/main.template.ts`
- [ ] Step 7 — List required environment variables

---

### Step 1 — Deployment context

```
Single local client (Claude Desktop, Cursor, VS Code extension)?
  └─ LOCAL

Remote, multi-client, or load-balanced?
  └─ REMOTE

Corporate internal, single-tenant, behind corp IdP?
  └─ CORP
```

---

### Step 2 — Transport selection

| Context | Transport | Reasoning |
|---------|-----------|-----------|
| LOCAL | **stdio** | No network, no auth handshake; credentials from environment variables |
| REMOTE | **Streamable HTTP** | Single `POST /mcp` endpoint; gateway-friendly; stateless or stateful |
| CORP | **Streamable HTTP** | Same as REMOTE; JWT from corp IdP validates on the MCP server |

**Rules:**
- Never implement HTTP+SSE (legacy two-endpoint pattern) for new servers — deprecated 2025-03-26.
- Streamable HTTP: server responds with `application/json` (stateless) or `text/event-stream` (streaming).
- stdio: all logs MUST go to stderr — any non-MCP output to stdout corrupts the protocol.

> Load `references/transport-decision.md` for the full decision table and gateway notes.

---

### Step 3 — Statefulness

| Need | Mode |
|------|------|
| Tool-only server, horizontal scale, no sticky sessions | **Stateless** (`statelessMode: true`, `enableJsonResponse: true`) |
| Sampling, elicitation, `resources/subscribe`, resumable SSE | **Stateful** (`statelessMode: false`, `sessionIdGenerator: () => randomUUID()`) |

**Stateful session security rules:**
- Session IDs MUST be cryptographically random.
- SHOULD be bound to user identity: `<user_sub>:<randomUUID()>` to prevent cross-session injection.
- Client echoes `Mcp-Session-Id` on every request after `initialize`.

> Load `references/stateful-vs-stateless.md` for JSON response implications and replica constraints.

---

### Step 4 — Capability set

Declare only what you implement. Undeclared capabilities must not emit notifications.

```ts
// Tool-only stateless server (most common)
capabilities: {
  tools: { listChanged: false },
}

// Full-featured stateful server
capabilities: {
  tools:     { listChanged: true },
  resources: { listChanged: true, subscribe: true },
  prompts:   { listChanged: true },
  logging:   {},
}
```

Client capabilities to check for before using: `sampling`, `elicitation`, `roots`.

> Load `references/capability-negotiation.md` for the full capability exchange flow.

---

### Step 5 — Dependency stack

**Always required:**
```
@rekog/mcp-nest        @modelcontextprotocol/sdk    @nestjs/common @nestjs/core
@nestjs/config         zod
```

**Add for Streamable HTTP + auth:**
```
@nestjs/passport       passport-jwt                 @nestjs/jwt
jwks-rsa
```

**Add for rate limiting (multi-instance):**
```
@nestjs/throttler      @nest-lab/throttler-storage-redis    ioredis
```

**Add for observability:**
```
nestjs-pino            pino-http                    pino-pretty (devDependency)
@opentelemetry/sdk-node  @opentelemetry/auto-instrumentations-node
@opentelemetry/exporter-otlp-http
```

**Add for health checks:**
```
@nestjs/terminus
```

---

### Step 6 — Emit module layout

Copy `assets/app.module.template.ts` and `assets/main.template.ts`. Fill in placeholders.

> Load `references/module-layout.md` for the full src/ directory tree.

Key rules:
- `tracing.ts` MUST be the first import in `main.ts` — before NestFactory and any instrumented modules.
- `app.enableShutdownHooks()` MUST be called for graceful drain.
- `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` on all non-tool DTOs.

---

### Step 7 — Required environment variables

Minimum set for a Streamable HTTP server:

```
MCP_SERVER_URL          # public base URL (used in PRM metadata)
MCP_RESOURCE_URI        # OAuth resource identifier (RFC 8707)
JWT_SECRET              # ≥32 chars
CORS_ALLOWED_ORIGINS    # comma-separated allowlist
REDIS_URL               # required if multi-instance throttler
OTEL_EXPORTER_OTLP_ENDPOINT
```

stdio servers: credentials via env vars only — no OAuth flow.

---

### GENERATE Examples

**Example 1 — Local tool-only server**
User: "I need an MCP server that runs inside Claude Desktop."
1. Context: LOCAL → stdio transport.
2. No auth, no rate limiting, no CORS needed.
3. Stateless (each stdio call is independent).
4. Capabilities: `tools: {}`.
5. Emit a minimal `main.ts` with `StdioServerTransport`.

**Example 2 — Remote public API**
User: "Design an MCP server for our orders API, accessed by multiple Claude clients."
1. Context: REMOTE → Streamable HTTP.
2. Stateless + `enableJsonResponse: true` (WAF-friendly, no sticky sessions).
3. Auth: load `mcp-auth-guardian`. Rate limiting: load `mcp-rate-limiter`.
4. Capabilities: `tools: { listChanged: false }`.
5. Emit `app.module.template.ts` and `main.template.ts`; list env vars.

---

## Mode: AUDIT

Use when the user wants to review an existing MCP server's architecture.

### AUDIT Checklist

- [ ] Step 1 — Identify transport in use; flag if HTTP+SSE (legacy)
- [ ] Step 2 — Check statefulness config; flag stateful servers missing crypto session IDs
- [ ] Step 3 — Verify capabilities declared match capabilities implemented
- [ ] Step 4 — Check bootstrap order (`tracing.ts` first, shutdown hooks present)
- [ ] Step 5 — Verify environment schema validated at startup (Zod + ConfigModule)
- [ ] Step 6 — Map each finding to severity; produce Markdown report with file:line citations

### AUDIT Findings Table

| Code | Severity | Description |
|------|----------|-------------|
| AR01 | HIGH | HTTP+SSE transport in use (deprecated 2025-03-26) — migrate to Streamable HTTP |
| AR02 | HIGH | Stateful server uses non-cryptographic session ID generator |
| AR03 | MEDIUM | Capability declared in `initialize` but no handler registered |
| AR04 | HIGH | `tracing.ts` imported after `NestFactory.create` — spans lost on bootstrap |
| AR05 | HIGH | `app.enableShutdownHooks()` absent — in-flight requests not drained on SIGTERM |
| AR06 | MEDIUM | `ConfigModule` present but no Zod `validate` callback — missing env vars fail silently |
| AR07 | LOW | `notifications/*/list_changed` emitted but `listChanged: true` not declared in capabilities |

### AUDIT Examples

**Example 3 — Audit existing server**
User: "Review the architecture of `src/` in my MCP server."
1. Check `main.ts` import order → AR04 if tracing is not first.
2. Check `McpModule.forRoot` config → transport type, stateless flag, session generator.
3. Check declared capabilities vs registered `@Tool`/`@Resource`/`@Prompt` providers.
4. Produce report: `src/main.ts:3 [AR04] HIGH — tracing.ts imported after NestFactory`.

**Example 4 — Quick transport audit**
User: "Is my MCP server using the right transport?"
1. Grep for `SseServerTransport` or `/sse` route → flag AR01 if found.
2. Confirm `STREAMABLE_HTTP` in `McpModule.forRoot` transport array.
3. Report finding with fix: migrate to `{ transport: [STREAMABLE_HTTP] }`.

---

## References

- `references/transport-decision.md` — stdio vs Streamable HTTP decision rules, deprecation timeline
- `references/stateful-vs-stateless.md` — stateless/stateful trade-offs, session ID rules, JSON response mode
- `references/module-layout.md` — NestJS src/ tree, bootstrap import order, DI wiring guide
- `references/capability-negotiation.md` — protocol version exchange, capability declarations, spec 2025-11-25

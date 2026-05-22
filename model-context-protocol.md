# MCP + NestJS + Claude Skills — Structured Research Analysis

**TL;DR**
- The current MCP spec (revision **2025-11-25**) standardises two transports — **stdio** (local) and **Streamable HTTP** (remote, single endpoint, optional SSE upgrade) — and the **2025-06-18** revision *mandates* that the MCP server act only as an OAuth 2.1 *resource server* (per Descope: "The June 2025 spec revision formalized the separation: now MCP servers are officially classified as OAuth Resource Servers, and the authorization function belongs to a dedicated authorization server").
- Production NestJS MCP servers can be built on top of `@rekog/mcp-nest` (the upstream of `JosephSearle/mcp-nestjs-template`), composing decorator-based tools/resources/prompts with NestJS Guards (JWT/OAuth), `@nestjs/throttler` with `@nest-lab/throttler-storage-redis` for multi-instance rate limiting, `nestjs-pino` with field redaction, OpenTelemetry initialised *before* Nest bootstraps, `@nestjs/terminus` for `/healthz` + `/readyz`, and a non-root multi-stage container.
- A family of **eight** focused, independently loadable Claude Skills (`mcp-server-architect`, `mcp-tool-designer`, `mcp-resource-prompt-designer`, `mcp-auth-guardian`, `mcp-security-hardener`, `mcp-rate-limiter`, `mcp-observability`, `mcp-deployment-packager`), each with **GENERATE** and **AUDIT** modes, covers create / audit / improve workflows; SKILL.md files follow Anthropic's required YAML-frontmatter + Markdown body format with the body capped at exactly **500 lines** (per Anthropic's official best-practices guide: *"Keep SKILL.md body under 500 lines for optimal performance"*).

---

## Key Findings

1. **Transport**: Streamable HTTP is the only network transport for new servers; HTTP+SSE was deprecated in 2025-03-26 and retained only for backwards compatibility in 2025-11-25.
2. **Statefulness**: stateless servers scale horizontally but cannot support sampling, elicitation, or unsolicited notifications; stateful servers require cryptographically random `Mcp-Session-Id`, bound to user identity.
3. **Authorization**: PRM (RFC 9728) at `/.well-known/oauth-protected-resource` + OAuth 2.1 with mandatory PKCE, optional DCR (RFC 7591), audience-restricted tokens (RFC 8707). MCP servers MUST NOT pass through client tokens to upstream APIs.
4. **Tool annotations** (introduced in spec 2025-03-26: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`, `title`) are *hints* — used by clients for UX (e.g. Claude Code parallelises read-only tools, ChatGPT dev mode tags WRITE vs READ), never for enforcement.
5. **Errors have two channels**: JSON-RPC `error` objects (invisible to the LLM) for protocol/schema failures; `{isError: true}` in the tool result (visible to the LLM) for business failures the model should self-correct on. Mixing these up is the most common mistake.
6. **Threat landscape** is real and ongoing: DNS rebinding (e.g. CVE-2026-35577 / GHSA-wqrj-vp8w-f8vh in Apollo MCP Server pre-1.7.0, where *"the Apollo MCP Server did not validate the Host header on incoming HTTP requests when using StreamableHTTP transport… [allowing] a malicious website…to use DNS rebinding techniques to bypass same-origin policy restrictions"*), command injection (CVE-2025-53967 / GHSA-gxw4-4fc5-9gr5 in `figma-developer-mcp` ≤ 0.6.2, CVSS 7.5, where *"the server constructs and executes shell commands using unvalidated user input directly within command-line strings… [introducing] shell metacharacter injection (|, >, &&, etc.)"*, patched in v0.6.3 on 29 September 2025), SSRF via OAuth metadata pointing at `169.254.169.254`, prompt-injection / tool-poisoning where third-party tool descriptions carry hidden instructions.
7. **The hardened template (`JosephSearle/mcp-nestjs-template`)** advertises Redis-backed dual throttler (100 req/min per IP, 1 000 req/min per token), Pino with redaction, OTel auto-instrumentation, structured tool audit log, `/healthz` + `/readyz`, multi-stage UBI 10 Dockerfile, Trivy CI gate, OAuth 2.1 with GitHub/Google/Azure AD providers. The hardening source files (`src/throttler/*`, `src/health/*`, `src/logging/*`, `src/audit/*`, `docker/Dockerfile`) were **not directly verifiable** during this research — `CLAUDE.md` documents only the upstream `src/mcp/` and `src/authz/` directories, so treat the README's hardening section as a *specification* the skill family should generate and audit *to*, rather than a verified reference.
8. **Skills** are folders containing `SKILL.md` (required, exact case), optional `references/`, `scripts/`, `assets/`. The `description` frontmatter is the single most important field — it is the only thing Claude sees at startup, and it must include *both what the skill does and when to use it*, with trigger phrases.

---

## Details

### A. MCP Best Practices Distillation

#### A.1 Transport selection (stdio vs Streamable HTTP)
- **stdio** — Local/embedded clients (Claude Desktop, Cursor, VS Code spawning a subprocess). No network, no auth handshake. Credentials come from environment variables (the MCP spec is explicit that stdio implementations should pull credentials from the environment, not from an OAuth flow). The server reads newline-delimited JSON-RPC from stdin / writes to stdout; **all logs MUST go to stderr** — writing anything non-MCP to stdout corrupts the protocol.
- **Streamable HTTP** — Single endpoint (`POST /mcp` + optional `GET /mcp` for SSE upgrade and `DELETE /mcp` for session termination). Introduced in 2025-03-26, refined in 2025-11-25. Servers MAY respond with `application/json` for non-streaming responses or `text/event-stream` to open an SSE stream for progress + final response. Supports stateless and stateful modes; SSE streams MAY use `id` fields so clients can reconnect with `Last-Event-ID` for replay.
- **HTTP+SSE (legacy)** — Two endpoints (`GET /sse` for the stream + `POST /messages` for requests). Deprecated 2025-03-26; do not implement for new servers.
- **Decision rules**: single local client → stdio; remote / multi-client / load-balanced → Streamable HTTP; gateway/WAF in front → Streamable HTTP (the MCP spec is gateway-friendly because everything is HTTP POST with header semantics).

#### A.2 Stateless vs stateful design
- **Stateless** (`statelessMode: true`, no `sessionIdGenerator`, typically `enableJsonResponse: true`): each `POST /mcp` is independent; horizontally scalable behind any load balancer; no sticky sessions; cannot serve server-initiated requests (sampling, elicitation), `resources/subscribe`, or unsolicited `GET /mcp` SSE streams. This is the right default for tool-only servers.
- **Stateful** (`statelessMode: false`, `sessionIdGenerator: () => randomUUID()`): server issues `Mcp-Session-Id` on initialize; the client echoes it on every subsequent request. Required for sampling, elicitation, subscriptions, and resumable SSE.
- **JSON response implications**: `enableJsonResponse: true` returns one `application/json` body for non-streaming requests — simpler for WAFs, proxies, gateways — but precludes mid-call progress notifications on that response. Pair with stateless for the cleanest deployment story.
- **Session security**: session IDs MUST be cryptographically random; SHOULD be bound to user identity (e.g. `<user_sub>:<random>`) to prevent session-hijack-prompt-injection across replicas.

#### A.3 Tool design
- **Naming**: unique, namespaced (`calculator_add` not `add`), lowercase-hyphen-or-underscore.
- **Input schemas**: JSON Schema (or Zod auto-converted). Every property has `description`. Closed sets use `enum`. Strings flowing into shells/SQL/URLs have `regex`/`url` constraints. Numeric fields have bounds.
- **Tool annotations** (spec 2025-03-26 onwards) — `title`, `readOnlyHint` (default `false`), `destructiveHint` (default `true`), `idempotentHint` (default `false`), `openWorldHint` (default `true`). They are hints, not contracts. Set them accurately because clients depend on them for UX: Claude Code parallelises tools with `readOnlyHint: true`; ChatGPT dev mode shows a WRITE badge unless `readOnlyHint: true` is set.
- **Idempotency**: write tools whose repeated execution with the same arguments has no additional effect (`PUT`-style) should set `idempotentHint: true` so retries are safe.
- **Two error channels**:
  - *Protocol error* (JSON-RPC `error` object) — **invisible to the LLM**, handled by the host. Use for schema/parse/method-not-found. The SDK creates `-32602` automatically when Zod rejects input.
  - *Tool execution error* (`{content: [...], isError: true}` in `result`) — **visible to the LLM**, so it can self-correct. Use for business failures ("city not found", "quota exceeded").

#### A.4 Resource design
- **URI schemes** must be consistent (`mcp://*`, `file:///*`, `https://*`).
- **MIME types** always set (`application/json`, `text/plain`, `text/markdown`, etc.).
- **Direct vs templated**: `@Resource` with fixed `uri` for static; `@ResourceTemplate` with `uriTemplate: 'mcp://users/{userId}'` (RFC 6570) for dynamic. Parameter completion via `completion/complete`.
- **Subscriptions** (`resources/subscribe`) only in stateful mode.

#### A.5 Prompt design
- Each prompt declares `arguments: [{name, description, required}]` so hosts can render slash-command UI.
- Returns `{description, messages: [{role, content: {type, text}}]}`. Inline user-supplied arguments with clear delimiters; never let arg values close a code fence or system block.
- Prompts are *user-controlled* — never write a prompt the model would invoke autonomously (that's a tool).

#### A.6 Security
- **Authentication** (Streamable HTTP, 2025-06-18 onwards): the spec mandates separation of the MCP server (resource server) from the authorization server (per Auth0's analysis of the 2025-06-18 changelog: *"The latest changelog, released on June 18, 2025, introduces updates that clarify how authorization should be handled for MCP Servers"*). The MCP server publishes RFC 9728 PRM at `/.well-known/oauth-protected-resource` listing trusted authorization servers, supported scopes, and resource identifier. On unauthenticated requests it returns `401` with `WWW-Authenticate: Bearer realm="mcp", resource_metadata="<url>"`.
- **OAuth 2.1 baseline**: Authorization Code + **PKCE mandatory**, optional **Dynamic Client Registration (RFC 7591)** if you accept unknown clients (Claude.ai, ChatGPT), audience-restricted tokens via **Resource Indicators (RFC 8707)**.
- **Token rules**: MUST NOT accept tokens not issued for this server (`aud` claim check); MUST NOT pass through tokens to upstream APIs (confused-deputy / token-passthrough is explicitly forbidden).
- **Input validation**: strict Zod schema on every tool argument; reject extra properties; strip control chars from strings entering shells / SQL / URLs / LLM context.
- **Injection prevention**:
  - *Command injection*: never `child_process.exec(userInput)` — use `execFile` with array argv (this is exactly the flaw in CVE-2025-53967 / GHSA-gxw4-4fc5-9gr5, CVSS 7.5, where `figma-developer-mcp` ≤ 0.6.2 *"constructs and executes shell commands using unvalidated user input directly within command-line strings… [introducing] shell metacharacter injection (|, >, &&, etc.)"*, patched 29 September 2025 in v0.6.3).
  - *Prompt / tool-poisoning*: treat all upstream-API responses and third-party MCP tool descriptions as untrusted; strip zero-width / control / `<` / `>` before passing to the LLM.
  - *SSRF via OAuth metadata or tool args*: block private IPv4 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local `169.254.0.0/16` (cloud metadata endpoint), `127.0.0.0/8` except where explicitly allowed for development.
- **Transport hardening**:
  - Bind local Streamable HTTP to `127.0.0.1`; `0.0.0.0` exposes you to LAN attackers.
  - **Validate `Host` and `Origin` headers** against an allowlist — the failure mode of skipping this is CVE-2026-35577 / GHSA-wqrj-vp8w-f8vh in Apollo MCP Server pre-1.7.0, where *"the Apollo MCP Server did not validate the Host header on incoming HTTP requests when using StreamableHTTP transport… [allowing] a malicious website…to use DNS rebinding techniques to bypass same-origin policy restrictions and issue requests to the local MCP server"*.
  - HTTPS everywhere except loopback redirects (OAuth 2.1 §1.5).
  - CORS: explicit `allowed_origins` allowlist, no wildcards, `expose: ['Mcp-Session-Id']`, `Vary: Origin`.

#### A.7 Rate limiting
- **Strategy**: dual fixed-window — coarse per-IP (against unauthenticated abuse) + fine per-token (against authenticated abuse).
- **Storage**: Redis-backed in any multi-instance deployment. The in-memory default for `@nestjs/throttler` does not work behind a load balancer. Use `@nest-lab/throttler-storage-redis` with an `ioredis` client.
- **Reference settings** (per the template README): per-IP 100 req/min, per-token 1 000 req/min. Tune to traffic.
- **Headers**: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (IETF draft), respond `429` with `Retry-After`.
- **Excluded paths**: `/healthz`, `/readyz`, `/.well-known/*` — never rate-limit infrastructure paths.

#### A.8 Capability negotiation and versioning
- Version string format `YYYY-MM-DD`; bumped only on backwards-incompatible change. Current: **2025-11-25**.
- `initialize` exchanges `protocolVersion`, `capabilities`, `clientInfo`/`serverInfo`. If no mutually compatible version exists, terminate.
- Server capabilities: `tools: {listChanged}`, `resources: {listChanged, subscribe}`, `prompts: {listChanged}`, `logging: {}`, `completions: {}`, `experimental: {}`. Client capabilities: `roots: {listChanged}`, `sampling: {}`, `elicitation: {}`.
- Only emit `notifications/*/list_changed` if you declared `listChanged: true`.

#### A.9 Error handling
- **Standard JSON-RPC codes** (reserved range -32768 to -32000): `-32700` parse error, `-32600` invalid request, `-32601` method not found, `-32602` invalid params, `-32603` internal error, `-32000` to `-32099` server-error reserved.
- **MCP additions**: `-32002` resource not found, `-32800` request cancelled, `-32801` content too large.
- **Custom application codes** sit outside the reserved range; group by category (e.g. `-31xxx` auth, `-30xxx` resource). The LLM never sees these.
- **Graceful degradation**: when a tool's backend is unhealthy, prefer `isError: true` with a textual hint over a JSON-RPC error so the model can fall back.

#### A.10 Progress, cancellation, logging
- **Progress**: client attaches `_meta.progressToken` on the request; server emits `notifications/progress` with `{progressToken, progress, total?, message?}`. Stop after terminal state.
- **Cancellation**: either side sends `notifications/cancelled` with `{requestId, reason?}`. MUST NOT target `initialize`. The sender ignores any late response.
- **Logging**: server emits `notifications/message` with `{level, logger, data}`; level is RFC 5424 syslog (`debug`…`emergency`). Client sets minimum via `logging/setLevel`.
- **Pings** detect dead connections; both sides MAY send.

#### A.11 Production-readiness checklist
- [ ] `/healthz` liveness — 200 immediately, no dependencies
- [ ] `/readyz` readiness — checks Redis, DB, downstream auth; both endpoints excluded from rate limiting and auth
- [ ] Structured JSON logs with request-ID correlation
- [ ] Sensitive-field redaction (`Authorization`, `Cookie`, `password`, `token`, `secret`, `access_token`, `refresh_token`, `api_key`)
- [ ] OpenTelemetry tracing started *before* the framework bootstraps
- [ ] Tool audit log (`user_sub`, `scopes`, `tool_name`, `duration_ms`, result hash)
- [ ] Graceful shutdown via `app.enableShutdownHooks()` — drain in-flight, close pools, exit
- [ ] Container runs as non-root (`USER mcp` uid 1001), `readOnlyRootFilesystem: true`
- [ ] Image scanned with Trivy/Grype; CI fails on HIGH/CRITICAL unfixed CVEs
- [ ] Env vars validated at startup with Zod; fail-fast on missing required
- [ ] CORS allowlist, HTTPS-only, HSTS, Host/Origin validation

### B. NestJS-Specific Implementation Patterns

The hardened template `JosephSearle/mcp-nestjs-template` is a fork of `rekog-labs/MCP-Nest` (npm `@rekog/mcp-nest`) that inherits the upstream's OAuth 2.1 IdP, decorator-based registry, and dynamic transport controllers. The README documents a production hardening layer (Redis throttler, Pino redaction, OTel-first, audit log, health endpoints, UBI 10 Dockerfile, Trivy gate). Implementation details below correspond to the upstream library and to widely adopted NestJS patterns; the template's specific hardening source files (`src/throttler/*`, `src/health/*`, `src/logging/*`, `src/audit/*`, `docker/Dockerfile`) could not be directly verified — `CLAUDE.md` only documents `src/mcp/` and `src/authz/`.

#### B.1 Tools as services
A tool is a method on an `@Injectable()` class:
```ts
@Injectable()
export class FileSearchTool {
  constructor(private readonly index: IndexService) {} // standard DI
  @Tool({
    name: 'files_search',
    description: 'Full-text search across the file index.',
    parameters: z.object({
      query: z.string().min(1).describe('The search query'),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  })
  async search({ query, limit }, ctx: Context) {
    await ctx.reportProgress({ progress: 0, total: limit });
    const hits = await this.index.search(query, limit);
    return { content: [{ type: 'text', text: JSON.stringify(hits) }] };
  }
}
```
Auto-discovered at bootstrap by `McpRegistryDiscoveryService`. Output-schema validation throws `McpError(ErrorCode.InternalError, ...)` on mismatch.

#### B.2 Resources and prompts
`@Resource({name, description, mimeType, uri})` for static, `@ResourceTemplate({uriTemplate: 'mcp://users/{userId}'})` for parameterised (parsed via `path-to-regexp`), `@Prompt({name, description, parameters})` for prompts. All three inject existing services via the DI container.

#### B.3 Authentication guards
- **Pattern**: a `CanActivate` guard passed to `McpModule.forRoot({guards: [MyGuard]})` runs on every MCP endpoint.
- **JWT bearer**: `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`. Validate against JWKS, populate `request.user`.
- **API key**: simpler guard reading `X-API-Key`, looking up in Redis/DB.
- **OAuth 2.1 built-in IdP**: `McpAuthModule.forRoot({provider: GitHubOAuthProvider, clientId, clientSecret, jwtSecret, serverUrl, apiPrefix})` + `McpModule.forRoot({guards: [McpAuthJwtGuard]})`. Exposes `/.well-known/oauth-authorization-server` (RFC 8414), `/.well-known/oauth-protected-resource` (RFC 9728), `/register`, `/authorize`, `/callback`, `/token`, `/revoke`. JWT secret ≥32 chars. Storage: in-memory (dev), TypeORM (prod), or custom `IOAuthStore`.
- **External OAuth**: Keycloak/Auth0/Okta/Azure AD/Cognito. MCP server validates JWTs only.
- **Per-tool authorization**: `@PublicTool()`, `@ToolScopes(['admin','write'])`, `@ToolRoles(['admin'])` (canonical upstream decorator names; the template README example uses `@RequireScopes`/`@RequireRoles` which may be a renamed variant — verify in source).

#### B.4 Rate limiting
```ts
ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => ({
    throttlers: [
      { name: 'ip',    ttl: 60_000, limit: 100  },
      { name: 'token', ttl: 60_000, limit: 1000 },
    ],
    storage: new ThrottlerStorageRedisService(new Redis(cfg.get('REDIS_URL'))),
  }),
})
// providers: [{ provide: APP_GUARD, useClass: PerTokenThrottlerGuard }]
```
Subclass `ThrottlerGuard` and override `getTracker(req)` to return `req.user?.sub ?? req.ip`. `@SkipThrottle()` on `/healthz`, `/readyz`.

#### B.5 SSE / Streamable HTTP in NestJS
`@rekog/mcp-nest` generates controllers dynamically from `transport: [STREAMABLE_HTTP]` (or `[SSE]`, `[STDIO]`). Stateful: `streamableHttp: {sessionIdGenerator: () => randomUUID(), statelessMode: false, enableJsonResponse: false}`. Stateless: `streamableHttp: {statelessMode: true, enableJsonResponse: true}`. For Fastify, swap to `@nestjs/platform-fastify`; `HttpAdapterFactory` normalises request/response. For custom routing, inject `McpStreamableHttpService` into a hand-written `@Controller()`.

#### B.6 Input validation
- **Zod** is canonical for tool args because `@modelcontextprotocol/sdk` consumes Zod and serialises to JSON Schema on the wire.
- **class-validator** + `ValidationPipe({whitelist: true, forbidNonWhitelisted: true, transform: true})` for non-tool DTOs (OAuth callbacks, admin endpoints).

#### B.7 Error mapping
- Throw `new McpError(ErrorCode.InvalidParams, msg)` for protocol errors.
- Return `{content: [...], isError: true}` for business errors the LLM should self-correct on.
- Global `ExceptionFilter` maps `BadRequestException → -32602`, `NotFoundException → -32002`, `UnauthorizedException → 401 + WWW-Authenticate`, anything else → `-32603`.

#### B.8 Module structure
```
src/
  main.ts                 # tracing.ts imported FIRST, then NestFactory.create
  app.module.ts           # wires McpModule + McpAuthModule + Throttler + Health + Logger + Config
  config/env.schema.ts    # Zod schema for ConfigModule.forRoot({validate})
  mcp/
    tools/ resources/ prompts/
    guards/ interceptors/ filters/
  health/health.controller.ts   # @nestjs/terminus
  logging/logger.module.ts      # nestjs-pino with redact
  observability/tracing.ts      # OpenTelemetry NodeSDK
```

#### B.9 Environment configuration and secrets
- `@nestjs/config` with a Zod `validate` callback; fail-fast on missing required vars.
- Required (per the template's `.env.example`): `MCP_SERVER_URL`, `MCP_RESOURCE_URI`, `JWT_SECRET` (≥32 chars), `CORS_ALLOWED_ORIGINS`, `REDIS_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT`. Optional: `OTEL_SERVICE_NAME`, `PORT`, `NODE_ENV`, `LOG_LEVEL`, OAuth provider IDs/secrets, sampling LLM endpoint/key.
- Production secrets via Kubernetes Secrets / AWS Secrets Manager CSI / Vault Agent — never commit `.env`; `.env.example` documents shape only.

### C. Skill Family Design

Eight focused, independently loadable skills. Each has GENERATE and AUDIT modes. The architect skill coordinates; the others can be loaded alone or composed.

| # | Skill | Trigger phrases | Scope (in / out) |
|---|---|---|---|
| 1 | `mcp-server-architect` | "design an MCP server", "scaffold NestJS MCP", "transport choice", "stateful or stateless" | IN: top-level architecture, transport, statefulness, module layout, dep selection. OUT: tool internals, auth flows, rate limits (delegate). |
| 2 | `mcp-tool-designer` | "create an MCP tool", "review my tools", "tool annotations", "destructive tool", "tool input schema" | IN: `@Tool` naming, Zod schemas, annotations, error-channel choice, progress. OUT: auth scopes, rate limits. |
| 3 | `mcp-resource-prompt-designer` | "resource template", "expose a resource", "add a prompt", "URI template" | IN: `@Resource`, `@ResourceTemplate`, `@Prompt`, URI schemes, MIME, completion. OUT: tools. |
| 4 | `mcp-auth-guardian` | "add OAuth", "JWT guard", "PRM metadata", "per-tool authorization", "scopes" | IN: PRM, OAuth 2.1, PKCE, DCR, JWT, scopes/roles, confused-deputy. OUT: injection prevention (→ hardener). |
| 5 | `mcp-security-hardener` | "harden MCP", "DNS rebinding", "CORS for MCP", "prompt injection", "tool poisoning" | IN: Host/Origin validation, localhost binding, HTTPS/CORS, SSRF guard, command-injection prevention, tool-description sanitisation. OUT: auth flows. |
| 6 | `mcp-rate-limiter` | "rate limit MCP", "per-token rate limit", "429", "Redis throttler" | IN: dual limiter, Redis storage, custom tracker, headers, exclusions. OUT: auth. |
| 7 | `mcp-observability` | "MCP logging", "OTel MCP", "audit tool calls", "Pino MCP", "healthchecks" | IN: Pino + redaction, OTel-first init, audit interceptor, Terminus health, graceful shutdown. OUT: rate-limit metrics. |
| 8 | `mcp-deployment-packager` | "Dockerfile for MCP", "deploy MCP", "Kubernetes MCP", "Trivy scan", "non-root user" | IN: multi-stage Dockerfile, base-image choice (UBI 10 / distroless), non-root, HEALTHCHECK, Trivy, K8s manifests, probes, signals. OUT: app code. |

#### Heuristics per skill (selected)
- **architect**: single local client → stdio, no auth; remote public → Streamable HTTP stateless + OAuth + Redis throttler; corp internal → Streamable HTTP + JWT from corp IdP + mTLS where possible.
- **tool-designer**: read → `readOnlyHint: true, openWorldHint: false`; write-idempotent → `idempotentHint: true`; delete/overwrite → `destructiveHint: true`; outbound internet → `openWorldHint: true` and treat output as tainted; default to safe (`destructiveHint: true`) when uncertain.
- **auth-guardian**: unknown public clients → require DCR; enterprise → external IdP (resource-server-only); destructive tools → require scope at decorator.
- **security-hardener**: assume LLM is adversarial; assume third-party MCP tool descriptions are poisoned; never echo user input into a shell/SQL without parameterisation.
- **observability**: `development` → `pino-pretty`; `production` → raw JSON to stdout (orchestrator ships logs).
- **deployment-packager**: prefer distroless unless you need shell access for debug; UBI 10 for RHEL/FIPS compliance.

#### Load order
1. `mcp-server-architect` (always first when scaffolding).
2. `mcp-auth-guardian` + `mcp-security-hardener` (load together — auth without hardening is incomplete).
3. `mcp-tool-designer`, `mcp-resource-prompt-designer` (as features demand).
4. `mcp-rate-limiter`, `mcp-observability` (production readiness).
5. `mcp-deployment-packager` (last, when shipping).

When auditing, load all eight in parallel and run each AUDIT checklist; the architect skill aggregates findings into a single report with severities.

### D. Skill File Structure

Per Anthropic's Skill Authoring Best Practices, every skill is a folder named in `kebab-case` containing exactly one `SKILL.md` plus optional `references/`, `scripts/`, `assets/`. **No `README.md` inside the skill folder** (a repo-root README for human distribution is fine).

#### D.1 Mandatory layout
```
mcp-tool-designer/
├── SKILL.md              # required, exact case
├── references/           # optional, loaded on demand
│   ├── annotations.md
│   ├── error-channels.md
│   └── zod-patterns.md
├── scripts/              # optional, executable checks
│   ├── audit-tools.ts
│   └── lint-zod-schema.ts
└── assets/               # optional, code templates
    └── tool.template.ts
```

#### D.2 SKILL.md template (annotated)

```markdown
---
name: mcp-tool-designer
description: Designs and audits MCP tool definitions in NestJS using @rekog/mcp-nest. Generates @Tool-decorated providers with Zod schemas, correct tool annotations (readOnlyHint, destructiveHint, idempotentHint, openWorldHint), and proper error-channel selection. Audits existing tool code for missing descriptions, unsafe annotations, schema gaps, and incorrect error handling. Use when the user asks to create, add, review, or audit MCP tools, mentions tool annotations, "destructive tool", "idempotent", a Zod schema for an MCP tool, or help with tools/call error handling in NestJS.
license: MIT
metadata:
  version: 1.0.0
  category: development
  tags: [mcp, nestjs, tools, zod, audit]
---

# MCP Tool Designer

## When to use this skill
- Creating a new @Tool-decorated method in a NestJS MCP server.
- Reviewing an existing repo's tool definitions for production readiness.
- Deciding between throwing a JSON-RPC error vs returning {isError: true}.
- Setting readOnlyHint, destructiveHint, idempotentHint, openWorldHint correctly.

## Modes

This skill has two operating modes. Pick one based on the user's intent.

### Mode: GENERATE
Use when the user wants new tool code.

Workflow checklist (copy into your response and tick as you go):
- [ ] Step 1: Confirm tool intent (read vs write, idempotent vs not, internal vs open-world)
- [ ] Step 2: Draft Zod schema with descriptions on every field
- [ ] Step 3: Choose annotations (see references/annotations.md)
- [ ] Step 4: Pick error channel (see references/error-channels.md)
- [ ] Step 5: Generate the @Tool provider from assets/tool.template.ts
- [ ] Step 6: Generate a Jest unit test

Step 1 — Confirm tool intent
- Does it modify state? → controls readOnlyHint
- If yes, is repeat safe? → controls idempotentHint
- Does it call the open internet? → controls openWorldHint
- Can it delete or overwrite? → controls destructiveHint

Step 2 — Zod schema
Every property MUST have .describe(...). Closed sets MUST use z.enum(...). Strings flowing into shells/SQL/URLs MUST have .regex(...) or .url() constraints.

Step 3 — Annotations
Apply the decision table in references/annotations.md. Default to safe (destructiveHint: true) when uncertain.

Step 4 — Error channel
Schema/parse failures → SDK returns -32602 automatically.
Business failures → return {content: [...], isError: true}.
Internal failures → throw McpError(ErrorCode.InternalError, ...).

Step 5 — Generate code
Copy assets/tool.template.ts; fill in.

Step 6 — Unit test
Cover: valid input, schema-rejected input, business-error path, internal-error path.

### Mode: AUDIT
Use when the user wants a review.

Workflow checklist:
- [ ] Step 1: Run scripts/audit-tools.ts (greps @Tool decorators, emits JSON)
- [ ] Step 2: Map each finding to severity (CRITICAL / HIGH / MEDIUM / LOW)
- [ ] Step 3: Produce a Markdown report with file:line citations and fixes
- [ ] Step 4: If asked, generate patches for HIGH and CRITICAL findings

The audit script flags:
| Code | Severity | Description |
|------|----------|-------------|
| T001 | HIGH     | Tool missing description |
| T002 | HIGH     | Schema field missing .describe() |
| T003 | CRITICAL | Write tool missing destructiveHint/idempotentHint |
| T004 | HIGH     | Tool throws for business errors instead of isError: true |
| T005 | MEDIUM   | Tool with openWorldHint: false makes outbound HTTP |
| T006 | LOW      | Tool name not namespaced |
| T007 | HIGH     | Tool args concatenated into shell/SQL without parameterisation |

## Examples

Example 1 — Generate a write tool
User: "Add a tool that creates a customer in our DB."
1. Intent: write, non-idempotent, internal.
2. Schema: email (z.string().email()), name (z.string().min(1)), tier (z.enum(['free','pro'])).
3. Annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false}.
4. Errors: duplicate email → isError: true; DB down → throw.

Example 2 — Audit
User: "Audit the tools in src/mcp/tools/."
1. Run audit-tools.ts.
2. Report each finding with file:line, severity, fix.

## Troubleshooting

Issue: Annotations set but a client still shows the tool as WRITE.
Cause: Some clients default unannotated tools to destructive. Make sure readOnlyHint: true is explicitly set on every read tool.

Issue: Zod validation passes but the LLM keeps sending the wrong type.
Cause: A .describe() is missing or unclear. Rewrite descriptions in plain English with one concrete example each.

## References
- references/annotations.md — full decision table for the five annotation hints.
- references/error-channels.md — when to throw vs isError.
- references/zod-patterns.md — Zod recipes for common MCP input shapes.
```

#### D.3 Field requirements
- `name` (required): max 64 chars, lowercase letters/digits/hyphens only, no XML tags, must not contain "anthropic" or "claude". Should match folder name.
- `description` (required): max 1024 chars, non-empty, no XML tags. Must include both *what the skill does* and *when to use it* with trigger phrases. Third-person voice.
- `license` (optional). `compatibility` (optional, 1–500 chars). `metadata` (optional free-form). `allowed-tools` (optional, restricts which Claude tools the skill may call).

#### D.4 Body constraints
- SKILL.md body **under 500 lines** for optimal performance, per Anthropic's official Skill Authoring Best Practices: *"Keep SKILL.md body under 500 lines for optimal performance. If your content exceeds this, split it into separate files using the progressive disclosure patterns described earlier."*
- Reference files >100 lines start with a TOC so partial-reads still surface structure.
- Forward slashes in all paths. Consistent terminology.
- Avoid time-sensitive content; put deprecated material under `<details><summary>Old patterns</summary>…</details>`.

#### D.5 GENERATE vs AUDIT mode pattern
- Both modes in the same SKILL.md under `## Modes`. Each starts with a copy-pasteable checklist.
- The `description` explicitly routes phrases to modes ("AUDIT when the user says 'review', 'check', 'audit'; GENERATE when they say 'create', 'add', 'scaffold'").
- Push deterministic checks into `scripts/` — Anthropic's own document skills (docx, pdf, pptx, xlsx) follow this pattern: instructions tell Claude *what* to build; scripts verify that what was built meets the standard.

#### D.6 Distribution
- Same folder works in claude.ai (zip upload via Settings → Capabilities → Skills), Claude Code (`~/.claude/skills/` user, `.claude/skills/` project), and the Claude API (`/v1/skills` + `container.skills` in Messages API).
- Internal: private Git repo with a repo-root README (humans only — not inside the skill folder).
- External: publish under the open Agent Skills standard.

---

## Recommendations

**Stage 1 — Foundation (week 1)**: Build `mcp-server-architect` and `mcp-tool-designer` first. They unblock all greenfield work and give Claude the vocabulary it needs to reason about every other skill. Validate each on a single hard task (e.g. "design an MCP server for our orders DB" / "create a delete-customer tool") and iterate the description field until the skill triggers at ≥90% on relevant prompts and does not trigger on unrelated ones.

**Stage 2 — Production readiness (week 2)**: Add `mcp-auth-guardian`, `mcp-security-hardener`, `mcp-rate-limiter`, `mcp-observability`. These four cover everything an audit of an existing server would need; load them together when you receive a real repo to review.

**Stage 3 — Edge skills (week 3)**: Add `mcp-resource-prompt-designer` and `mcp-deployment-packager`. These cover the long tail (resources/prompts are less commonly needed than tools; deployment varies per shop).

**Stage 4 — Validation**: For each skill, build at least three evaluations (per Anthropic's "build evaluations first" recommendation): one trigger test, one functional test (does GENERATE produce code that compiles + passes the audit), one performance comparison (baseline vs skill-loaded on a real task — count tool calls and tokens).

**Stage 5 — Distribution**: Host the eight skills in a private repo under `/skills/<skill-name>/` with a top-level README pointing to each. When the JosephSearle template's source becomes available, lock the AUDIT checklists to its actual implementation rather than the README spec.

**Benchmarks that should change the recommendation**:
- If trigger hit rate is **<70%** after iterating the description: split the skill (it's covering too much).
- If trigger over-fires on **>10%** of unrelated prompts: add explicit *Do NOT use for…* lines.
- If a single SKILL.md body exceeds **500 lines** consistently: split into multiple skills (e.g. `mcp-auth-guardian` could split into `mcp-oauth-server` and `mcp-oauth-resource-server`).
- If the same script is duplicated across skills: extract it to a shared `references/` pattern instead.
- If the MCP spec issues a new revision (next dated string): re-audit the protocol-version handling in `mcp-server-architect` and the auth flows in `mcp-auth-guardian`.

---

## Caveats

1. **Template source not fully verifiable**: `JosephSearle/mcp-nestjs-template` README documents a hardening layer (Redis dual throttler, Pino redaction, OTel-first, audit log, `/healthz`+`/readyz`, UBI 10 multi-stage Dockerfile, Trivy gate), but the individual source files (`src/throttler/*`, `src/health/*`, `src/logging/*`, `src/audit/*`, `docker/Dockerfile`) were not directly fetchable during this research. The repository's `CLAUDE.md` describes only the upstream `src/mcp/` and `src/authz/` layout from `rekog-labs/MCP-Nest`. The skill family above is designed against the README's *specification* and against widely adopted NestJS production patterns; when the real source is available, lock the AUDIT mode of each skill to the actual implementation.
2. **Decorator naming inconsistency**: the template README's per-tool authorization example uses `@RequireScopes`/`@RequireRoles`, while the canonical `@rekog/mcp-nest` docs use `@PublicTool`/`@ToolScopes`/`@ToolRoles`. Skills should accept both and emit warnings.
3. **MCP spec is moving**: revisions land every few months (2024-11-05 → 2025-03-26 → 2025-06-18 → 2025-11-25). Tool annotations, authorization, and transport semantics have all changed in the last year. The skill family should pin to a specific revision and bump explicitly.
4. **Annotations are hints, not contracts**: a malicious server can lie. Skills must remind authors that runtime safety enforcement belongs in the host's authorization layer, not in annotations.
5. **Claude Skills features are evolving**: cross-surface sync between Claude API, Claude Code, and claude.ai is not yet provided — each surface needs its own upload. Plan for separate distribution channels.
6. **Sources for security incidents are public advisories**: the CVE-2025-53967 (`figma-developer-mcp`, command injection, CVSS 7.5, patched in v0.6.3 on 2025-09-29) and CVE-2026-35577 / GHSA-wqrj-vp8w-f8vh (Apollo MCP Server, DNS rebinding via missing Host validation, patched in 1.7.0 on 2026-04-09) referenced above are illustrative of the threat model; the skill `mcp-security-hardener` should be updated as new advisories emerge.
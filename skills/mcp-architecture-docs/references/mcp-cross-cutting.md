# MCP Cross-Cutting Concerns Reference

Content library for `06-cross-cutting-concerns.md`. Each section provides the standard content to generate for that concern when the corresponding technology is detected. If a concern is not detected, include the heading with "Not yet implemented — see 09-risks-and-debt.md."

---

## Authentication & Authorisation

### When: AUTH = "jwt" detected

**Document in 06:**

OAuth 2.1 is mandatory for remote MCP servers (MCP spec 2025-11-25). This server is an OAuth Resource Server.

| Aspect | Implementation |
|--------|---------------|
| Token format | Bearer JWT (RS256 / HS256) |
| Validation | JWKS endpoint or shared secret (`JWT_SECRET`) |
| Audience binding | `aud` claim must equal `MCP_RESOURCE_URI` (RFC 8707) |
| Guard | `<AUTH_GUARD_NAME>` applied to all MCP tool/resource/prompt routes |
| Token passthrough | **Forbidden** — the server validates `aud` before forwarding any downstream call |
| Protected Resource Metadata | Served at `/.well-known/oauth-protected-resource` (RFC 9728) |

**Audience binding rule (document verbatim):**
> Every tool handler that calls a downstream service MUST NOT forward the incoming JWT as-is. The server validates the token's `aud` claim equals `MCP_RESOURCE_URI` before using any claims. If a downstream service requires authentication, the server uses its own service credentials — not the user's token.

**stdio servers:** credentials are injected via environment variables only. No OAuth flow. Document the required env vars and their source.

### When: AUTH not detected

> Not yet implemented. This MCP server has no authentication guard. For remote/production deployment, OAuth 2.1 is mandatory per MCP spec 2025-11-25. Add using `mcp-auth-guardian` skill. Risk documented in 09-risks-and-debt.md.

---

## Tool Schema Enforcement

### Always document (MCP_CONFIRMED = true)

Tool input validation is a critical security control for MCP servers. Hidden or unexpected fields in tool inputs can be used to manipulate tool behaviour (tool poisoning vector).

| Aspect | Implementation |
|--------|---------------|
| Schema library | Zod (strict mode) |
| Enforcement | `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` on all tool inputs |
| Schema mutability | Immutable at runtime — schemas are defined at build time and cannot be changed by callers |
| Breaking changes | Any change to a tool's input schema is a breaking change — requires version bump |

**Tool schema rule (document verbatim):**
> Tool input schemas are strict and immutable. The server rejects any request containing fields not defined in the schema (`forbidNonWhitelisted: true`). This prevents callers from injecting unexpected control fields into tool inputs.

**Schema versioning note:** if a tool's input contract must change, deprecate the old tool and register a new tool with a new name — do not silently change an existing tool's schema.

---

## Audit Logging

### When: PINO = true OR any logging detected

State-changing tool calls must be logged with sufficient detail to reconstruct the sequence of events in a security incident.

| Aspect | Implementation |
|--------|---------------|
| Library | pino / nestjs-pino (structured JSON) |
| Minimum log fields | `tool_name`, `caller_identity` (JWT `sub` claim), `timestamp` (ISO 8601), `result_status` (success/error), `duration_ms` |
| State-changing tools | All tools that create, update, or delete data — logged at `info` level |
| Read-only tools | Optional; log at `debug` level to avoid noise |
| Error logging | All tool errors logged at `error` level with `error_code` and sanitised message |
| Sensitive data | Never log tool input field values that may contain PII or secrets — log field names only |

**Logging policy (document verbatim):**
> All state-changing tool calls are logged with caller identity, tool name, and outcome. Log entries do not contain tool input values — only field names — to prevent credential leakage. Logs are emitted to stdout in structured JSON format and collected by the cluster logging pipeline.

### When: logging not detected

> Audit logging is not implemented. State-changing tool calls are not logged. This is a gap for security incident response. Risk documented in 09-risks-and-debt.md.

---

## Rate Limiting

### When: THROTTLER = true

| Aspect | Implementation |
|--------|---------------|
| Library | `@nestjs/throttler` |
| Granularity | Per-client (keyed on JWT `sub` claim or IP if unauthenticated) |
| Limit | `<TODO: N requests per M seconds>` |
| Storage | <In-memory (single instance) | Redis via `@nest-lab/throttler-storage-redis` (multi-instance)> |
| Exceeded response | HTTP 429 Too Many Requests; MCP error code returned to AI Host |
| Headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |

**Multi-instance note:** if the server runs as multiple replicas, in-memory storage allows each replica to enforce limits independently — a client could exceed the intended limit by factor N (replica count). Use Redis storage for accurate multi-instance limiting.

### When: THROTTLER = false

> Rate limiting is not implemented. High-frequency tool calls from a single client are not throttled. For tools that call paid downstream APIs, this is a cost amplification risk. Risk documented in 09-risks-and-debt.md. Implement using `mcp-rate-limiter` skill.

---

## Observability

### When: OTEL = true

| Aspect | Implementation |
|--------|---------------|
| Library | `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node` |
| Spans | One span per tool call; includes `tool.name`, `mcp.session_id` (if stateful), `caller.sub` |
| Exporter | `@opentelemetry/exporter-otlp-http` → `OTEL_EXPORTER_OTLP_ENDPOINT` |
| Tracing init | `tracing.ts` bootstrapped BEFORE NestFactory.create (first import in main.ts) |
| Metrics | HTTP request duration, tool call duration, error rate |

### When: PINO = true (without OTEL)

| Aspect | Implementation |
|--------|---------------|
| Library | nestjs-pino + pino-http |
| Format | Structured JSON (production) / pino-pretty (development) |
| Request logging | `POST /mcp` requests logged with duration and status |

### When: HEALTH = true

Health check endpoint at `/health` (or `/healthz`) provided by `@nestjs/terminus`. Include liveness and readiness probes.

### When: none detected

> Observability is not implemented. No distributed tracing or structured logging configured. Risk documented in 09-risks-and-debt.md.

---

## Error Handling

### Always document (MCP_CONFIRMED = true)

MCP has its own error code vocabulary separate from HTTP status codes. The server must map NestJS exceptions to appropriate MCP error codes.

| NestJS Exception | MCP Error Code | Description |
|-----------------|---------------|-------------|
| `UnauthorizedException` | `-32001` or custom | Auth failure |
| `BadRequestException` | `-32602` | Invalid params (Zod validation failure) |
| `NotFoundException` | `-32601` | Method not found |
| `InternalServerErrorException` | `-32603` | Internal error |
| `HttpException` (429) | Rate limit error | Too many requests |

An `ExceptionFilter` or global exception handler translates NestJS exceptions into MCP-formatted error responses before they reach the transport layer.

**Error response rule:** never expose internal error detail (stack traces, file paths, SQL query fragments) in MCP error responses. Log internally; return a generic message to the AI Host.

---

## Security Documentation Cross-Reference

Architecture docs document what security controls exist and where they are applied. The detailed threat model, STRIDE analysis, and vulnerability disclosure process belong in `docs/security/`.

```
docs/security/                      ← generate with mcp-security-docs skill
  SECURITY.md                       (P0 — OSPS VM-02.01; L1+)
  security-insights.yml             (P1 — OSPS SA-03.01; L2+)
  threat-model.md                   (L2+: STRIDE analysis, tool poisoning, prompt injection)
  vulnerability-disclosure.md       (L2+: ISO 29147/30111 CVD lifecycle)
  incident-response.md              (L3+: CIS Control 17 IR plan)
  attack-surface.md                 (L3+: entry points, trust boundaries)
```

Add to `06-cross-cutting-concerns.md`:
> Security documentation (threat model, STRIDE analysis, vulnerability disclosure process, OSPS Baseline compliance) is maintained in `docs/security/`. Generate with `mcp-security-docs` if not present. The architecture satisfies OSPS Baseline SA-01.01 (design documentation) and SA-02.01 (external interface descriptions) through this docs/architecture/ tree.

---

## MCP Risk Pre-Population (for 09-risks-and-debt.md)

Pre-populate `09-risks-and-debt.md` with these MCP-specific risks. Likelihood and Impact are starter estimates — replace with team-assessed values.

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|-----------|--------|---------------------|
| **Tool poisoning** — hidden instructions in tool descriptions or responses manipulate AI behaviour to exfiltrate data or execute unintended actions | Medium | High | Strict immutable Zod schemas on all tool inputs; egress allowlists in tool handlers; audit logging of all tool calls; human approval for state-changing actions |
| **Prompt injection via tool response** — malicious content in data returned by a tool's external API call is interpreted as instructions by the AI Host | Medium | High | Sanitise and validate tool response content before returning to AI Host; document trust boundary between server response and external API response |
| **Confused-deputy / token passthrough** — server forwards a user's JWT to a downstream API without validating audience, granting unintended downstream access | Low | Critical | Enforce `aud` claim validation before any downstream call; never forward user tokens; use server-to-server credentials for downstream calls; document in mcp-auth-guardian |
| **Supply chain compromise via MCP SDK** — a malicious update to `@modelcontextprotocol/sdk` or `@rekog/mcp-nest` introduces backdoor code | Low | Critical | Pin dependency versions; enable Dependabot security alerts; audit SDK changelog on each update; consider SBOM generation |
| **Session fixation (stateful servers)** — predictable or non-random session IDs allow an attacker to hijack another client's session | Low | High | Session IDs MUST be cryptographically random UUIDs; bind to user `sub` claim: `<sub>:<randomUUID()>`; short TTL |
| **Broken object-level authorisation** — a tool returns data belonging to another user because handler does not check caller identity | Medium | High | Every tool handler checks JWT `sub` claim against the requested resource owner; never derive access from session alone |
| **Missing rate limiting — DoS / cost amplification** | Medium (if THROTTLER = false) | Medium | Implement `@nestjs/throttler`; use Redis backend for multi-instance; per-tool limits for expensive API calls |
| **Dev tooling without auth (ref: CVE-2025-49596)** — MCP Inspector before v0.14.1 had RCE when no auth was required | High (dev only) | High | Require auth on all endpoints including /mcp in development; keep MCP Inspector ≥ v0.14.1 |

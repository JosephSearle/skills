# ITZ MCP Template — Security Layers Reference

This document is the authoritative description of all seven security layers built into the
ITZ NestJS MCP server template. Every agent working on a server built from this template must
understand these layers and must not write code that bypasses or weakens any of them.

---

## Layer 1 — Network & Transport Hardening

**What it does:**
- `helmet()` sets 13 HTTP security headers on every response: Content-Security-Policy,
  X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options, and others.
- CORS is configured from `ALLOWED_ORIGINS` env var — only listed origins may connect.
  `origin: '*'` is never used on an authenticated endpoint.
- `trust proxy 1` is set so Express reads the real client IP from `X-Forwarded-For` — required
  for the rate limiter to key correctly behind a reverse proxy.
- `compression()` is applied to all responses.
- Helmet is skipped for `stdio` transport (no HTTP headers in that mode).

**What it rejects:** Requests from unlisted origins (CORS block), cross-site framing attempts
(X-Frame-Options), protocol downgrade attempts (HSTS).

**What agents must not do:**
- Do not call `app.enableCors({ origin: '*' })` — this disables the origin allowlist.
- Do not remove or reorder `app.use(helmet())` in `main.ts`.
- Do not add new HTTP routes outside of NestJS controllers — they will miss the middleware chain.

---

## Layer 2 — Authentication — TechzoneAuthGuard

**What it does:**
- Reads the `techzone-token` request header on every incoming MCP request.
- Verifies the JWT locally using `TECHZONE_JWT_SECRET` (HS256, no outbound call).
- Enforces `issuer: 'mcpgateway'` — tokens issued by any other issuer are rejected.
- On success, populates `req.user` with the full identity payload:
  `{ id, sub, userid, email, displayName, roles, persona, token, ability }`.
- Throws `401 Unauthorized` for: missing header, wrong issuer, bad signature, expired token,
  server misconfiguration (`TECHZONE_JWT_SECRET` absent).

**Key implementation details:**
```ts
// Guard is registered globally in app.module.ts:
McpModule.forRoot({
  guards: [TechzoneAuthGuard, ThrottlerBehindProxyGuard],
  allowUnauthenticatedAccess: false,
})

// JWT verification in TechzoneAuthGuard:
jwt.verify(rawToken, secret, { issuer: 'mcpgateway', algorithms: ['HS256'] })
```

**What agents must not do:**
- Do not add `allowUnauthenticatedAccess: true` to `McpModule.forRoot` — this disables auth globally.
- Do not forward `req.headers['techzone-token']` or `req.user.token` to upstream services.
  The token is scoped to this MCP server only. Use a separate service-account credential for
  any upstream API that requires authentication.
- Do not replace `TechzoneAuthGuard` with a weaker guard without updating this document and
  the env validation schema.

**Required env var:** `TECHZONE_JWT_SECRET` — must be present. Validated by `env.validation.ts`
at startup; the server will not start without it.

---

## Layer 3 — Rate Limiting — ThrottlerBehindProxyGuard

**What it does:**
- Limits requests per authenticated user using `ThrottlerBehindProxyGuard`, which extends
  NestJS `ThrottlerGuard`.
- Rate limit key is the authenticated user's `userid` or `sub` from `req.user` — not the
  client IP. This means one user behind a shared corporate proxy cannot be affected by another
  user's request rate.
- Falls back to client IP if `userid` and `sub` are both absent (e.g. unauthenticated paths).
- Defaults: 60 requests per 60,000 ms window. Configurable via `RATE_LIMIT_MAX` and
  `RATE_LIMIT_TTL` env vars.
- Uses Redis for distributed storage when `REDIS_URL` is set — required for multi-replica
  deployments. Falls back to in-memory storage in local dev (not safe for production replicas).
- Returns `429 Too Many Requests` when the limit is exceeded.

**Key implementation detail:**
```ts
// ThrottlerBehindProxyGuard — tracker key:
protected override getTracker(req): Promise<string> {
  const user = req.user as User | undefined;
  const ip   = req.ip as string | undefined;
  return Promise.resolve(user?.userid ?? user?.sub ?? ip ?? 'unknown');
}
```

**What agents must not do:**
- Do not remove `ThrottlerBehindProxyGuard` from the `McpModule.forRoot({ guards: [...] })` list.
- Do not omit `REDIS_URL` in production multi-replica deployments — in-memory throttling is
  per-pod and will not enforce limits correctly across replicas.

---

## Layer 4 — Input Validation — Zod + ValidationPipe

**What it does:**
- `ValidationPipe` is configured globally in `main.ts` with:
  - `whitelist: true` — strips any property not declared in the DTO/schema
  - `forbidNonWhitelisted: true` — throws `400 Bad Request` if unknown properties are present
  - `transform: true` — transforms plain objects to typed instances
  - `enableImplicitConversion: false` — no silent type coercion
- Each `@Tool()` declares a Zod schema in its `parameters` field. The schema is validated
  before the handler is called.
- Returns `400 Bad Request` for schema violations.

**What agents must not do:**
- Do not use `z.any()` or `z.unknown()` in tool schemas — these bypass the whitelist entirely.
- Do not rely on implicit type coercion — `enableImplicitConversion` is off. Declare types
  explicitly in the Zod schema.
- Do not skip `.describe()` on schema fields — this is both a validation and documentation
  requirement.

---

## Layer 5 — Authorisation — @ToolRoles + CASL AbilityService

**What it does:**
Two checks, both must pass:

1. **Role gate (`@ToolRoles`)** — evaluated by the MCP guard pipeline before the handler runs.
   Rejects with `403 Forbidden` if the authenticated user's roles do not include any of the
   listed roles.

2. **CASL ability check (`AbilityService.can`)** — evaluated inside the handler. Checks that
   the user has the specific action (e.g. `'read'`, `'write'`, `'delete'`) on the specific
   subject type. Abilities are embedded in the JWT payload by the gateway — no extra network
   call is needed.

```ts
// Role gate — declarative, evaluated before handler:
@ToolRoles(['user'])

// CASL check — imperative, evaluated inside handler:
if (request && !this.abilityService.can(request.user, 'read', 'MyResource')) {
  throw new ForbiddenException('Insufficient permissions.');
}
```

**`if (request && ...)` is mandatory** — `request` is `undefined` in STDIO transport. Omitting
the guard causes a runtime crash in STDIO mode.

**What agents must not do:**
- Do not omit `@ToolRoles` from a tool that is not explicitly public (`@PublicTool()`).
- Do not omit the CASL check from tools that access sensitive or user-specific data.
- Do not hardcode roles in logic — roles come from `req.user.roles` via the JWT payload.

---

## Layer 6 — Tool Execution

**What it does:**
- Tool handler receives validated params and the full `req.user` identity.
- Business failures are surfaced to the LLM via `ToolBusinessError` — these set
  `result.isError: true` in the MCP response, allowing the LLM to self-correct.
- Progress can be reported via `context.reportProgress({ progress, total })` in stateful mode.
  In stateless mode (the template default), `reportProgress` is a no-op.
- The template's default `streamableHttp.statelessMode: true` means each request is
  self-contained — no server-side session state.

**Error channel summary:**

| Scenario | What to throw | What LLM sees |
|---|---|---|
| LLM-correctable failure (not found, invalid state) | `ToolBusinessError` | `result.isError: true` with message |
| Unexpected internal error | `InternalServerErrorException` | JSON-RPC -32603, hidden from LLM |
| Auth/permission failure | `ForbiddenException` / `UnauthorizedException` | JSON-RPC -32600, hidden from LLM |
| Schema violation | Zod rejects automatically | JSON-RPC -32602, hidden from LLM |

---

## Layer 7 — Structured Logging & Error Handling

**What it does:**
- `McpExceptionFilter` (`@Catch()`) catches every unhandled exception:
  - Maps `BadRequestException`, `UnauthorizedException`, `ForbiddenException` → JSON-RPC `-32600`
  - Maps `NotFoundException` → JSON-RPC `-32601`
  - Maps `UnprocessableEntityException` → JSON-RPC `-32602`
  - Maps `InternalServerErrorException` → JSON-RPC `-32603`
  - Maps `SyntaxError` → JSON-RPC `-32700`
  - Maps `ThrottlerException` → HTTP `429` (returned before JSON-RPC wrapper)
  - Never exposes raw stack traces or internal error messages to the caller.
- Pino structured logger:
  - Development: pretty-print with colours (`pino-pretty`)
  - Production: CloudEvents 1.0 format via custom transport (`cloudevents-transport.ts`)
- Request/response serialisers in the Pino config scrub sensitive fields before logging.
- `app.enableShutdownHooks()` ensures in-flight requests complete cleanly on SIGTERM.

**What agents must not do:**
- Do not add a second `@Catch()` filter that returns raw error details — it will expose
  internals and shadow `McpExceptionFilter`.
- Do not log `req.user.token` or `req.headers['techzone-token']` — these are bearer credentials.
- Do not remove `{ provide: APP_FILTER, useClass: McpExceptionFilter }` from `AppModule.providers`.

---

## Environment Variables — Validation Contract

All required env vars are validated by `src/config/env.validation.ts` using a Zod schema.
The server refuses to start if any required variable is missing or malformed.

| Variable | Required | Purpose |
|---|---|---|
| `TECHZONE_JWT_SECRET` | **Yes** | HS256 secret for verifying `techzone-token` JWTs from the gateway |
| `CORE_AUTH_URL` | No | Deprecated. Retained for tools that still call core-auth directly |
| `PORT` | No (default 3000) | HTTP listen port |
| `MCP_TRANSPORT` | No (default `streamable`) | `streamable` or `stdio` |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origin allowlist |
| `RATE_LIMIT_TTL` | No (default 60000) | Rate limit window in ms |
| `RATE_LIMIT_MAX` | No (default 60) | Max requests per window per user |
| `REDIS_URL` | No (required in production) | Redis URL for distributed rate limiting |

**Rule:** If a new tool needs a new env var, add it to the Zod schema in `env.validation.ts`
and mark it required or optional. Never read `process.env.MY_VAR` directly in a tool handler —
inject it via `ConfigService` instead.

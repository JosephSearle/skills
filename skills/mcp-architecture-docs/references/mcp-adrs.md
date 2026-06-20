# MCP-Specific ADR Templates

Six Architecture Decision Record templates covering the decisions that are architecturally significant for every NestJS MCP server. Use these as pre-fill content when generating inferred ADR stubs (status: `Proposed`).

---

## ADR Template 1 — Transport Selection

**File name:** `000N-transport-selection.md`
**Trigger:** TRANSPORT detected in Phase D OR MCP_CONFIRMED = true (always infer)

```markdown
# ADR <N>: Transport Selection

**Date:** <YYYY-MM-DD>
**Status:** Proposed
**Deciders:** <Engineering team>

> ⚠️ INFERRED: This ADR was inferred from the codebase. Verify Context and Consequences before changing status to Accepted.

## Context

MCP servers must choose between two supported transports (MCP spec 2025-11-25):
- **stdio** — server runs as a child process of the AI Host; communication over stdin/stdout; no network exposure; credentials via environment variables only.
- **Streamable HTTP** — server exposes a single `POST /mcp` endpoint; supports both JSON responses (stateless) and SSE responses (streaming/stateful); requires TLS and auth for remote deployment.

The legacy HTTP+SSE pattern (two-endpoint: `/sse` + `/messages`) was deprecated in MCP spec 2025-03-26 and must not be used for new servers.

Key forces:
- Client type: local single-client (Claude Desktop) vs remote multi-client (claude.ai, multiple users)
- Auth requirements: stdio uses environment variable credentials; Streamable HTTP requires OAuth 2.1 for remote servers
- Operational complexity: stdio is zero-network, no TLS, no load balancer; Streamable HTTP requires production infrastructure

Detected: <TRANSPORT_EVIDENCE — e.g. "StdioServerTransport found in src/main.ts">

## Decision

We decided to use <stdio | Streamable HTTP> transport.

## Rationale

<TODO: document why this was chosen. Consider:
- For stdio: "This server runs locally inside Claude Desktop; no network exposure is needed; OAuth complexity is unnecessary"
- For Streamable HTTP: "This server is accessed by multiple remote clients; OAuth 2.1 is required; stateless mode enables horizontal scaling"
- Why the other option was not chosen>

## Consequences

### Positive
- <stdio: Zero network attack surface; no TLS management; simple credential injection via env vars>
- <Streamable HTTP: Accessible by remote and web-based AI Hosts; horizontally scalable; observable via standard HTTP tooling>

### Negative
- <stdio: Only one client at a time; no centralized access control; no rate limiting; difficult to monitor>
- <Streamable HTTP: Requires TLS termination, OAuth 2.1 implementation, load balancer; increased operational complexity>

### Neutral / Risks
- <stdio: If the server is later promoted to remote access, the transport must change — this is a breaking change>
- <Streamable HTTP: Auth misconfiguration risk (token passthrough, missing audience binding) — see mcp-auth-guardian>

## Related Decisions
- Supersedes: (none)
- Related: ADR — Statefulness Mode, ADR — OAuth Strategy
```

---

## ADR Template 2 — Statefulness Mode

**File name:** `000N-statefulness-mode.md`
**Trigger:** STATEFUL != "unknown"

```markdown
# ADR <N>: Statefulness Mode

**Date:** <YYYY-MM-DD>
**Status:** Proposed
**Deciders:** <Engineering team>

> ⚠️ INFERRED: This ADR was inferred from the codebase. Verify Context and Consequences before changing status to Accepted.

## Context

MCP servers using Streamable HTTP can operate in two modes:

**Stateless** (`statelessMode: true`, `enableJsonResponse: true`):
- No per-session state stored server-side
- Any replica can handle any request — horizontally scalable without sticky routing
- Responds with `application/json`
- Does not support: `resources/subscribe`, resumable SSE streams, `sampling`, `elicitation`

**Stateful** (`statelessMode: false`, `sessionIdGenerator: () => randomUUID()`):
- Server maintains per-session context identified by `Mcp-Session-Id` header
- Enables: `resources/subscribe`, resumable SSE, `sampling`, `elicitation`
- Requires sticky session routing OR an external session store (Redis)
- Session IDs MUST be cryptographically random; SHOULD be bound to user identity: `<user_sub>:<randomUUID()>`

Key forces:
- Whether the server needs to push resource change notifications (`resources/subscribe`)
- Whether the server needs LLM sampling or human-in-the-loop elicitation
- Operational requirement for horizontal scaling (stateless is simpler)

Detected: <STATEFULNESS_EVIDENCE — e.g. "statelessMode: true found in McpModule.forRoot config">

## Decision

We decided to use <stateless | stateful> mode.

## Rationale

<TODO: document why this was chosen. Consider:
- For stateless: "No capability requires per-session context; stateless mode simplifies horizontal scaling and eliminates session store dependency"
- For stateful: "The server uses resources/subscribe to push real-time updates; stateful mode is required for SSE streams">

## Consequences

### Positive
- <Stateless: Horizontally scalable without sticky routing; simpler deployment; no session store dependency>
- <Stateful: Enables sampling, elicitation, and resource subscriptions; richer AI interaction patterns>

### Negative
- <Stateless: Cannot support resources/subscribe, sampling, or elicitation>
- <Stateful: Requires sticky session routing or Redis session store; session store becomes a reliability dependency; session ID security requires careful implementation>

### Neutral / Risks
- <Stateful: Session fixation risk if session IDs are not cryptographically random or not bound to user identity>
- <Stateful: Cross-session injection if session ID = randomUUID() only (not scoped to user sub)>

## Related Decisions
- Supersedes: (none)
- Related: ADR — Transport Selection, ADR — Deployment Model
```

---

## ADR Template 3 — OAuth / JWT Strategy

**File name:** `000N-oauth-jwt-strategy.md`
**Trigger:** AUTH = "jwt"

```markdown
# ADR <N>: OAuth 2.1 / JWT Strategy

**Date:** <YYYY-MM-DD>
**Status:** Proposed
**Deciders:** <Engineering team>

> ⚠️ INFERRED: This ADR was inferred from the codebase. Verify Context and Consequences before changing status to Accepted.

## Context

MCP spec 2025-11-25 mandates OAuth 2.1 for remote MCP servers. Key requirements:
- The MCP server is an **OAuth Resource Server** and MUST implement Protected Resource Metadata (RFC 9728) at `/.well-known/oauth-protected-resource`
- Clients MUST use **Resource Indicators (RFC 8707)** — the `resource` parameter on token requests — to bind tokens to this server's audience
- **Token passthrough is explicitly forbidden**: the server must validate the token's `aud` claim matches its own `MCP_RESOURCE_URI` before forwarding any calls to downstream services
- Confused-deputy attacks are possible on proxy servers — mitigate with per-client consent, exact redirect-URI matching, and `state` parameter validation

Supported IdP strategies:
1. **Public IdP (e.g., Entra ID / Cognito / Auth0)** — JWKS endpoint for RS256 token validation; no client secret on the server
2. **Corp internal IdP** — JWKS from internal discovery document; may use custom `aud` claim format
3. **Shared secret (HS256)** — only for local/development use; never for production

Detected: <AUTH_EVIDENCE — e.g. "jwks-rsa and passport-jwt found in package.json; TechzoneAuthGuard found in src/auth/">

## Decision

We decided to use <PUBLIC_IDP | CORP_IDP | SHARED_SECRET> with <RS256 | HS256> tokens.

## Rationale

<TODO: document why this was chosen. Consider:
- Why this IdP over alternatives
- How the MCP_RESOURCE_URI audience binding is enforced
- How the JWKS endpoint URL is configured
- Why HS256 shared secret is acceptable (only if local/dev)>

## Consequences

### Positive
- RS256 + JWKS: Private key never leaves the IdP; key rotation without server restart; standard OAuth 2.1 compliance
- Corp IdP: Integrates with existing enterprise identity; no new user management

### Negative
- JWKS endpoint dependency: server cannot validate tokens if IdP is unreachable (mitigate with short-lived caching)
- Token passthrough discipline required: every tool that calls a downstream service must validate `aud` before forwarding — see mcp-auth-guardian

### Neutral / Risks
- Audience (`aud`) claim format must match `MCP_RESOURCE_URI` exactly — misconfiguration is a silent security gap
- CVE-2025-49596: MCP Inspector (< v0.14.1) had RCE when no auth was required on the dev tooling endpoint; require auth on all endpoints including /mcp in development

## Related Decisions
- Supersedes: (none)
- Related: ADR — Transport Selection
- Implementation: use mcp-auth-guardian skill for guard and JWKS configuration
```

---

## ADR Template 4 — Capability Set

**File name:** `000N-capability-set.md`
**Trigger:** NOTE_TOOLS > 0 OR NOTE_RESOURCES > 0 OR NOTE_PROMPTS > 0

```markdown
# ADR <N>: MCP Capability Set

**Date:** <YYYY-MM-DD>
**Status:** Proposed
**Deciders:** <Engineering team>

> ⚠️ INFERRED: This ADR was inferred from the codebase. Verify Context and Consequences before changing status to Accepted.

## Context

MCP capabilities are declared during the `initialize` handshake and govern what the client may request. Declaring a capability the server does not implement, or failing to declare one it does, leads to protocol errors.

Available capabilities:
- `tools` — AI-invocable functions; `listChanged: true` emits `notifications/tools/list_changed`
- `resources` — URI-addressed data sources; `subscribe: true` enables push notifications
- `prompts` — parameterised prompt templates
- `logging` — server sends log messages to the client
- `sampling` — server can request LLM completions (requires client capability)
- `elicitation` — server can request user input (requires client capability, stateful mode)

Detected: <CAPABILITY_EVIDENCE — e.g. "@Tool decorator found in 12 files, no @Resource or @Prompt decorators found">

## Decision

We declare the following capabilities:

```ts
capabilities: {
  tools: { listChanged: <true | false> },
  // resources: { listChanged: <true | false>, subscribe: <true | false> },
  // prompts: { listChanged: <true | false> },
}
```

## Rationale

<TODO: document why only these capabilities are declared. Consider:
- Why resources/prompts are excluded (or included)
- Whether listChanged notifications are needed (implies a dynamic tool list)
- Whether sampling/elicitation are needed (implies stateful mode)>

## Consequences

### Positive
- Minimal capability surface reduces protocol complexity and attack surface
- Tool-only mode is the simplest and most widely supported capability profile

### Negative
- Resources and prompts require explicit future ADR to add
- `listChanged: true` requires the server to track tool list changes and emit notifications reliably

### Neutral / Risks
- Adding a capability later is non-breaking for clients that already handle unknown capabilities, but requires a server version bump

## Related Decisions
- Supersedes: (none)
- Related: ADR — Statefulness Mode (sampling/elicitation require stateful mode)
```

---

## ADR Template 5 — Deployment Model

**File name:** `000N-deployment-model.md`
**Trigger:** DEPLOY_CONTAINER = true OR DEPLOY_K8S = true

```markdown
# ADR <N>: Deployment Model

**Date:** <YYYY-MM-DD>
**Status:** Proposed
**Deciders:** <Engineering team>

> ⚠️ INFERRED: This ADR was inferred from the codebase. Verify Context and Consequences before changing status to Accepted.

## Context

The MCP server must be deployed in a manner consistent with its transport and statefulness choices:
- **stdio** servers run as child processes — no infrastructure needed beyond the developer machine
- **Stateless Streamable HTTP** servers have no per-replica state — any container orchestrator works; horizontal scaling is straightforward
- **Stateful Streamable HTTP** servers require either sticky session routing (connection affinity) or an external session store (Redis); sticky sessions constrain load balancing options

Detected: <DEPLOY_EVIDENCE — e.g. "Dockerfile present; k8s/ directory with Deployment and Service manifests found">

## Decision

We deploy using <CONTAINER | KUBERNETES | SERVERLESS | PROCESS> on <CLOUD_PROVIDER>.

## Rationale

<TODO: document why this deployment model. Consider:
- Why Kubernetes over container / serverless
- How session affinity is handled (if stateful)
- How the TLS endpoint is exposed
- How secrets are injected (env vars, Kubernetes Secrets, Vault)>

## Consequences

### Positive
- <Kubernetes: Rolling deploys, auto-healing, horizontal pod autoscaling>
- <Container: Simple deployment pipeline; reproducible environments>

### Negative
- <Kubernetes: Operational complexity; requires cluster management>
- <Stateful on K8s: Sticky sessions (NginxIngress `nginx.ingress.kubernetes.io/affinity: cookie`) add complexity>

### Neutral / Risks
- Environment variable injection must cover: MCP_SERVER_URL, MCP_RESOURCE_URI, JWT_SECRET or JWKS_URI, CORS_ALLOWED_ORIGINS, REDIS_URL (if rate limiting or session store)

## Related Decisions
- Supersedes: (none)
- Related: ADR — Transport Selection, ADR — Statefulness Mode
```

---

## ADR Template 6 — Rate Limiting Strategy

**File name:** `000N-rate-limiting-strategy.md`
**Trigger:** THROTTLER = true

```markdown
# ADR <N>: Rate Limiting Strategy

**Date:** <YYYY-MM-DD>
**Status:** Proposed
**Deciders:** <Engineering team>

> ⚠️ INFERRED: This ADR was inferred from the codebase. Verify Context and Consequences before changing status to Accepted.

## Context

Remote MCP servers exposed over Streamable HTTP are susceptible to:
- Denial-of-service via high-frequency tool calls from a single AI Host or client
- Cost amplification if tools call paid downstream APIs (OpenAI, Stripe, cloud storage)
- Abusive tool invocation patterns that are difficult to detect without per-client limits

`@nestjs/throttler` provides per-endpoint rate limiting. For single-instance deployments, in-memory TTL is sufficient. For multi-instance/Kubernetes deployments, limits must be shared across replicas via a Redis backend (`@nest-lab/throttler-storage-redis`).

Detected: <THROTTLER_EVIDENCE — e.g. "@nestjs/throttler found in package.json; Redis (ioredis) also present">

## Decision

We use `@nestjs/throttler` with <IN-MEMORY | REDIS> storage for per-client rate limiting.

Limit: <TODO: define requests/window — e.g. 60 tool calls per minute per client>

## Rationale

<TODO: document why this limit. Consider:
- Expected normal usage rate for an AI client
- Downstream API cost constraints
- Whether Redis is justified (only needed for multi-instance)>

## Consequences

### Positive
- Prevents cost amplification attacks on expensive tool handlers
- Provides visibility into high-frequency clients
- Redis backend ensures consistent limits across all replicas

### Negative
- Redis becomes a reliability dependency for multi-instance deployments
- Rate limit tuning requires observation of real traffic patterns; wrong limits break legitimate AI workflows

### Neutral / Risks
- Rate limit headers (X-RateLimit-*) should be exposed so AI Hosts can back off gracefully
- Per-tool limits (stricter for expensive tools) may be preferable to a single global limit

## Related Decisions
- Supersedes: (none)
- Related: ADR — Deployment Model
- Implementation: use mcp-rate-limiter skill for throttler configuration
```

# ITZ MCP Template — Stateful vs Stateless Mode Reference

This document defines how to detect which transport mode a server is running in, what each
mode permits, and what agents must enforce differently depending on the mode. All rules are
derived from the ITZ template's `app.module.ts` configuration, the MCP 2025-03-26 spec, and
CIO mandatory standard #12.

## CIO Standard #12 — Session State

> MCP servers are **strongly recommended** to be deployed in stateless mode.
> MCP servers **must** use a shared session store if deployed in stateful mode in a
> clustered environment.

This is a hard CIO requirement, not a recommendation. In-memory stateful mode in a
multi-replica deployment is non-compliant and will cause tool call failures when requests
are routed to pods that did not initialise the session.

---

## How to Detect the Mode

Read `src/app.module.ts`. The mode is determined by `streamableHttp.statelessMode`:

```ts
// STATELESS (template default):
streamableHttp: {
  statelessMode: true,
  enableJsonResponse: true,
}

// STATEFUL:
streamableHttp: {
  statelessMode: false,
  sessionIdGenerator: () => randomUUID(),
  enableJsonResponse: false,
}
```

If `statelessMode` is absent, treat it as `true` (the MCP-Nest default).

If the transport is `stdio` (`MCP_TRANSPORT=stdio`), all stateful/stateless concerns are
irrelevant — stdio is inherently single-client and session-free.

---

## Mode Comparison

| Dimension | Stateless | Stateful |
|---|---|---|
| `statelessMode` | `true` | `false` |
| `sessionIdGenerator` | not set | `() => randomUUID()` — **mandatory** |
| `enableJsonResponse` | `true` | `false` (SSE for notifications) |
| `context.reportProgress()` | **no-op — silent** | Works — sends mid-call notification |
| `resources/subscribe` | **not supported** | Supported |
| Sampling / elicitation | **not supported** | Supported |
| Server-initiated messages | **not supported** | Supported via `GET /mcp` SSE |
| `Mcp-Session-Id` header | Not issued or expected | Issued on `initialize`, required on all subsequent requests |
| Horizontal scale | Drop-in — any load balancer | Sticky sessions OR externalised session state required |

---

## Stateless Mode — Enforcement Rules

The template runs in stateless mode by default. These rules apply when
`statelessMode: true`.

### What agents must enforce

1. **`context.reportProgress()` is a no-op.** Do not write tool code that depends on
   progress notifications reaching the client. The call will not error, but the client
   will never receive the notification.

   ```ts
   // In stateless mode this line silently does nothing:
   await context.reportProgress({ progress: 50, total: 100 });
   ```

   If a tool genuinely needs to report progress, the server must be switched to stateful
   mode (see below). Do not leave phantom `reportProgress` calls in stateless tool code —
   they mislead future developers.

2. **Do not implement `resources/subscribe`** — subscriptions require a persistent SSE
   connection, which stateless mode does not provide.

3. **Do not implement sampling or elicitation** — both require server-initiated messages
   over an open SSE channel.

4. **`enableJsonResponse: true` must remain set** alongside `statelessMode: true`. This
   ensures responses are returned as `application/json`, which is compatible with WAFs and
   API Gateways. Do not switch to `enableJsonResponse: false` while keeping `statelessMode: true`.

5. **No `sessionIdGenerator`** — do not add one while in stateless mode. It has no effect
   and misleads readers about the mode.

### Audit findings — stateless mode

| Code | Severity | Description |
|---|---|---|
| S001 | HIGH | `context.reportProgress()` called in stateless mode — call is a no-op and misleads readers |
| S002 | HIGH | `resources/subscribe` implemented on a stateless server — will never fire |
| S003 | MEDIUM | `sessionIdGenerator` set alongside `statelessMode: true` — has no effect |
| S004 | MEDIUM | `enableJsonResponse` absent or `false` in stateless mode — use `true` for WAF compatibility |

---

## Stateful Mode — Enforcement Rules

These rules apply when `statelessMode: false`. Switching to stateful mode introduces
security and operational requirements that are **not present in the template default**.

### What agents must enforce

1. **`sessionIdGenerator` is mandatory.** The server will not issue session IDs without it.
   It must use a CSPRNG — never `Math.random()`.

   ```ts
   import { randomUUID } from 'node:crypto';

   // Minimum acceptable:
   sessionIdGenerator: () => randomUUID()

   // Recommended — binds session to user identity to prevent cross-session injection:
   sessionIdGenerator: (req) => `${(req as any).user?.sub ?? 'anon'}:${randomUUID()}`
   ```

2. **Session IDs are secrets.** Do not log them. Do not include them in error messages.
   Do not expose them in tool responses. Treat them the same as bearer tokens.

3. **`enableJsonResponse` must be `false` in stateful mode.** SSE is required for
   server-initiated messages. `enableJsonResponse: true` in stateful mode disables SSE
   and makes `context.reportProgress()` a no-op again — defeating the purpose of going stateful.

4. **Replica deployments need sticky sessions or externalised state.** A second replica will
   reject any `Mcp-Session-Id` it did not issue. Enforce one of:
   - Sticky sessions at the load balancer (nginx `ip_hash`, AWS ALB target group stickiness)
   - Externalised session state (Redis) shared across all replicas

   This must be noted in the tool's PR or in a deployment note — it is an infrastructure
   requirement, not just a code requirement.

5. **`context.reportProgress()` now works.** Tools on a stateful server may and should
   use progress reporting for long-running operations. The signature is:

   ```ts
   await context.reportProgress({ progress: 25, total: 100 }); // 25%
   await context.reportProgress({ progress: 100, total: 100 }); // done
   ```

   Report at meaningful checkpoints — not on every iteration of a loop.

6. **The `GET /mcp` SSE endpoint is active at the server level**, but note that the
   Enterprise MCP Gateway **blocks the `GET` method** on `/mcp`. This means stateful SSE
   features (progress notifications, sampling, elicitation) are unavailable to agents
   connecting through the enterprise gateway, even when the server is configured as stateful.
   Only use stateful mode when the server is accessed directly (e.g. local development, or
   a deployment path that bypasses the gateway). See `references/governance.md` → **GET /mcp
   is Blocked** for full details.

### Audit findings — stateful mode

| Code | Severity | Description |
|---|---|---|
| S005 | CRITICAL | `statelessMode: false` set but `sessionIdGenerator` is absent — server cannot issue session IDs |
| S006 | CRITICAL | `sessionIdGenerator` uses `Math.random()` or another non-CSPRNG source |
| S007 | HIGH | Session ID is logged anywhere in the codebase |
| S008 | HIGH | `enableJsonResponse: true` set alongside `statelessMode: false` — SSE is disabled, progress notifications will not fire |
| S009 | CRITICAL | Multi-replica deployment with `statelessMode: false` and no shared session store (e.g. Redis) — violates CIO mandatory standard #12; tool calls will fail when routed to a different pod |
| S010 | MEDIUM | Long-running tool (>2 s estimated) has no `context.reportProgress()` calls — missed opportunity for client feedback |

---

## Switching from Stateless to Stateful

When a user asks to enable progress reporting, sampling, elicitation, or `resources/subscribe`,
the server must be switched to stateful mode. Make all of these changes together — partial
changes leave the server in an inconsistent state.

**Changes to `src/app.module.ts`:**

```ts
import { randomUUID } from 'node:crypto';

// Before (stateless default):
streamableHttp: {
  statelessMode: true,
  enableJsonResponse: true,
}

// After (stateful):
streamableHttp: {
  statelessMode: false,
  sessionIdGenerator: (req) => `${(req as any).user?.sub ?? 'anon'}:${randomUUID()}`,
  enableJsonResponse: false,
}
```

**What to check after switching:**
- [ ] Confirm load balancer sticky sessions are configured, or Redis session store is wired
- [ ] Verify no tools still have phantom `reportProgress` calls that were written as no-ops
- [ ] Update `README.md` to document the mode change and any infrastructure requirements
- [ ] Add or update the `GET /mcp` route in any API Gateway / WAF rules (SSE traffic uses it)

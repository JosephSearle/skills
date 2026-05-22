---
name: mcp-auth-guardian
description: >
  Configures and audits authentication and authorization for NestJS MCP servers following
  the OAuth 2.1 resource-server pattern mandated by MCP spec 2025-06-18. Generates OAuth
  Protected Resource Metadata (PRM) endpoints, JWT guards, PKCE-compliant auth flows,
  per-tool scope decorators, and validates token handling rules. Use when the user asks to
  "add OAuth to MCP", "set up JWT guard", "PRM metadata", "per-tool authorization",
  "add scopes to tools", "PKCE for MCP", "confused deputy", or any auth/authorization
  configuration for a NestJS MCP server. Do NOT use for transport hardening (→ mcp-security-hardener),
  rate limiting (→ mcp-rate-limiter), or tool definitions (→ mcp-tool-designer).
---

# MCP Auth Guardian

Configures OAuth 2.1 resource-server authorization for NestJS MCP servers. Targets
MCP auth spec 2025-06-18 and `@rekog/mcp-nest` ^1.0.0.

---

## Mode: GENERATE

Use when the user wants to add or configure authentication.

### GENERATE Checklist

- [ ] Step 1 — Determine auth topology (built-in IdP vs external IdP vs API key)
- [ ] Step 2 — Configure OAuth Protected Resource Metadata (PRM) endpoint
- [ ] Step 3 — Implement or configure JWT guard
- [ ] Step 4 — Apply per-tool scope decorators to sensitive tools
- [ ] Step 5 — Verify token rules (aud claim, no pass-through)
- [ ] Step 6 — Emit template files from `assets/`

---

### Step 1 — Auth topology

```
Are clients unknown public tools (Claude.ai, ChatGPT, third-party)?
  └─ External OAuth + Dynamic Client Registration (DCR, RFC 7591)
     → McpAuthModule with DCR enabled, or external auth server (Auth0, Okta, Keycloak)

Are clients all corporate tools using the same corp IdP?
  └─ External IdP only (MCP server is resource-server-only)
     → JWT guard validating against corp IdP JWKS
     → No built-in IdP needed

Is this a private internal tool with controlled clients?
  └─ Static OAuth clients + JWT guard
     → McpAuthModule without DCR, known client IDs only

Is API key auth acceptable (simple, non-OAuth)?
  └─ API key guard (X-API-Key header → Redis/DB lookup)
     → Suitable for server-to-server, not for public clients
```

---

### Step 2 — OAuth Protected Resource Metadata (PRM)

The MCP auth spec 2025-06-18 mandates that the MCP server act as an OAuth 2.1 **resource server only** — not an authorization server. The server publishes PRM at `/.well-known/oauth-protected-resource` per RFC 9728.

Required PRM fields:
- `resource` — the resource server's URI (matches `MCP_RESOURCE_URI` env var)
- `authorization_servers` — array of trusted authorization server base URLs
- `bearer_methods_supported` — `["header"]`
- `scopes_supported` — list of scopes your tools require

On unauthenticated requests, return `401` with:
```
WWW-Authenticate: Bearer realm="mcp", resource_metadata="<prm-url>"
```

> Load `references/oauth-flow.md` for PRM JSON example and RFC 9728 compliance details.

---

### Step 3 — JWT guard

**Using `@rekog/mcp-nest` built-in:**
```ts
// McpAuthModule handles JWKS, token validation, and PRM automatically
McpAuthModule.forRoot({
  provider: GitHubOAuthProvider,   // or GoogleOAuthProvider, AzureADProvider
  clientId:     process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  jwtSecret:    process.env.JWT_SECRET,  // ≥32 chars
  serverUrl:    process.env.MCP_SERVER_URL,
})
McpModule.forRoot({ guards: [McpAuthJwtGuard] })
```

**External IdP (Keycloak / Auth0 / Azure AD):**
Copy `assets/jwt-guard.template.ts` — validates JWT against JWKS, checks `aud` claim, populates `request.user`.

> Load `references/jwt-guard.md` for full guard implementation with JWKS rotation handling.

---

### Step 4 — Per-tool authorization

```ts
// Public tool — no token required
@PublicTool()
@Tool({ name: 'health_ping', ... })

// Scope-restricted tool
@ToolScopes(['orders:read'])
@Tool({ name: 'orders_list', ... })

// Role-restricted tool
@ToolRoles(['admin'])
@Tool({ name: 'customers_delete', ... })

// Multiple scopes (all required)
@ToolScopes(['orders:write', 'customers:read'])
@Tool({ name: 'orders_create', ... })
```

**Note on naming:** The template README uses `@RequireScopes`/`@RequireRoles` in some examples, while the canonical `@rekog/mcp-nest` docs use `@ToolScopes`/`@ToolRoles`. Accept both in existing code; emit `@ToolScopes`/`@ToolRoles` in new code.

> Load `references/per-tool-scopes.md` for guard composition and scope hierarchy patterns.

---

### Step 5 — Token rules

Two absolute rules from MCP auth spec 2025-06-18:

1. **`aud` claim check** — MUST reject tokens where `aud` does not include this server's resource URI. Prevents confused-deputy attacks where a token issued for service A is replayed against service B.

2. **No token pass-through** — MUST NOT forward the client's bearer token to upstream APIs. If an upstream API needs auth, obtain a separate token via client-credentials flow. The MCP server must be the token's intended audience.

> Load `references/token-rules.md` for attack scenarios and implementation patterns.

---

### Step 6 — Emit templates

- `assets/jwt-guard.template.ts` — JWT `CanActivate` guard with JWKS, aud check, typed user
- `assets/prm-metadata.template.ts` — PRM controller at `/.well-known/oauth-protected-resource`

---

### GENERATE Examples

**Example 1 — Corporate MCP server with Azure AD**
User: "Our MCP server needs to use Azure AD for auth."
1. Topology: external IdP, resource-server-only.
2. PRM: emit `prm-metadata.template.ts`; set `authorization_servers` to Azure AD tenant URL.
3. JWT guard: `assets/jwt-guard.template.ts` with JWKS from Azure AD (`login.microsoftonline.com/<tenant>/discovery/v2.0/keys`); aud = `MCP_RESOURCE_URI`.
4. Per-tool: `@ToolScopes(['mcp.tools.execute'])` on all non-public tools.
5. No `McpAuthModule` — external IdP only.

**Example 2 — Public MCP server with built-in IdP**
User: "I want public Claude.ai clients to be able to connect."
1. Topology: public clients → need DCR.
2. Use `McpAuthModule.forRoot` with DCR enabled and `McpAuthJwtGuard`.
3. PRM published automatically by `McpAuthModule`.
4. Apply `@ToolScopes` based on data sensitivity.

---

## Mode: AUDIT

Use when reviewing the auth configuration of an existing MCP server.

### AUDIT Checklist

- [ ] Step 1 — Run `scripts/audit-auth.ts` against the source directory
- [ ] Step 2 — Map each JSON finding to severity
- [ ] Step 3 — Produce Markdown report with file:line citations
- [ ] Step 4 — Generate patches for CRITICAL findings

### AUDIT Findings Table

| Code | Severity | Description |
|------|----------|-------------|
| A001 | CRITICAL | `McpModule.forRoot` has no `guards` — all MCP endpoints are unauthenticated |
| A002 | HIGH | Write/destructive tool has no `@ToolScopes` or `@ToolRoles` decorator |
| A003 | HIGH | No `/.well-known/oauth-protected-resource` endpoint published |
| A004 | CRITICAL | Client bearer token forwarded to upstream API via `Authorization` header |
| A005 | HIGH | `JWT_SECRET` is fewer than 32 characters |
| A006 | HIGH | JWT validation does not check `aud` claim against `MCP_RESOURCE_URI` |

### AUDIT Examples

**Example 3 — Full auth audit**
User: "Audit the auth setup in my MCP server."
1. Run: `npx ts-node scripts/audit-auth.ts src/`
2. A001 is most critical — check first.
3. Report each finding with file:line and fix.

**Example 4 — Token pass-through check**
User: "Am I accidentally forwarding tokens?"
1. Grep for patterns that copy `Authorization` header to outgoing HTTP calls.
2. Flag any `axios.defaults.headers.Authorization = req.headers.authorization` or similar.
3. Fix: obtain separate downstream token via client-credentials, never reuse the client's token.

---

## References

- `references/oauth-flow.md` — PRM setup, PKCE flow, DCR, RFC 8707 audience restriction
- `references/jwt-guard.md` — passport-jwt guard implementation, JWKS rotation, aud validation
- `references/per-tool-scopes.md` — @ToolScopes, @ToolRoles, @PublicTool, guard composition
- `references/token-rules.md` — aud claim check, token pass-through prohibition, confused-deputy attack

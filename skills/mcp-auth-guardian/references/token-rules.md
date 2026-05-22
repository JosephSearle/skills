# Token Rules Reference

Two absolute rules from MCP auth spec 2025-06-18 that MUST NOT be violated.

---

## Rule 1: Check the aud Claim

**The rule:** The MCP server MUST reject any access token where `aud` does not include this server's resource URI (`MCP_RESOURCE_URI`).

**Why it matters:** Without `aud` validation, a token issued for service A can be replayed against service B. This is the confused-deputy vulnerability.

```
Client → Auth Server: "I want to access api.example.com/mcp"
Auth Server issues: { aud: "api.example.com/mcp", sub: "user123", scope: "orders:read" }

Attacker captures this token and tries:
Attacker → evil-service.example.com: "Here's my MCP token"

If evil-service doesn't check aud, it accepts a token it wasn't issued for.
```

**Correct implementation:**

```ts
// passport-jwt strategy — aud checked automatically
super({
  audience: process.env.MCP_RESOURCE_URI,  // exact match required
  // ...
});

// Manual check (if not using passport)
if (!Array.isArray(payload.aud)
    ? payload.aud !== resourceUri
    : !payload.aud.includes(resourceUri)) {
  throw new UnauthorizedException('Token audience mismatch');
}
```

---

## Rule 2: No Token Pass-Through

**The rule:** The MCP server MUST NOT forward the client's bearer token to upstream APIs.

**Why it matters:** If the MCP server forwards the client's token to an upstream service, the upstream service receives a token it wasn't the intended audience for. This is a confused-deputy attack vector and violates the principle of least privilege.

```
BAD — do not do this:
async callUpstreamApi(args, ctx: Context) {
  const clientToken = ctx.request.headers.authorization;  // client's token
  const data = await axios.get('https://upstream.api/data', {
    headers: { Authorization: clientToken },  // forwarding client token — FORBIDDEN
  });
}

GOOD — obtain a separate token:
async callUpstreamApi(args) {
  // Client-credentials flow to get a token for the upstream service
  const upstreamToken = await this.tokenService.getUpstreamToken({
    audience: 'https://upstream.api',
    scope: 'data:read',
  });
  const data = await axios.get('https://upstream.api/data', {
    headers: { Authorization: `Bearer ${upstreamToken}` },
  });
}
```

---

## Patterns That Indicate Token Pass-Through (Audit Targets)

Flag any code that copies the client's `Authorization` header to an outgoing request:

```ts
// Pattern 1: direct header copy
axios.defaults.headers.Authorization = req.headers.authorization;

// Pattern 2: spread incoming headers
fetch(url, { headers: { ...req.headers } });

// Pattern 3: passing context to HTTP client
httpClient.request({ auth: ctx.request?.headers?.authorization });
```

---

## Token Lifecycle

| Stage | Who acts | What happens |
|-------|---------|-------------|
| Token request | Client → Auth Server | Client presents PKCE verifier; auth server issues short-lived access token |
| Token use | Client → MCP Server | Client includes token in Authorization header |
| Token validation | MCP Server | Verifies signature, expiry, aud, issuer, scopes |
| Upstream call | MCP Server → Upstream | MCP server obtains its OWN token via client-credentials; presents to upstream |
| Token revocation | Client → Auth Server `/revoke` | Client or server revokes token; MCP server checks revocation via introspection or short TTL |

---

## Storing JWT Secret

- MUST be ≥32 characters.
- Use a random value: `openssl rand -base64 32`
- Store in Kubernetes Secret or Vault, not in `.env` committed to source control.
- Rotate by updating the secret and restarting — no code change needed if read from env var.

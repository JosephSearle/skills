# OAuth 2.1 Resource Server Flow Reference

## MCP Auth Architecture (2025-06-18)

The MCP server is an OAuth 2.1 **resource server only**. It validates tokens but does not issue them. Token issuance belongs to a dedicated authorization server.

```
Client (Claude.ai)
    │
    │ 1. Discover auth server
    │  GET /.well-known/oauth-protected-resource
    ▼
MCP Server (resource server)
    │ Returns: { resource, authorization_servers, scopes_supported }
    │
    │ 2. Client authenticates with auth server
    │  POST /token (authorization_server)
    │  Required: PKCE (code_challenge + code_verifier)
    │
    │ 3. Client presents bearer token
    │  POST /mcp
    │  Authorization: Bearer <access_token>
    ▼
MCP Server validates:
    - Signature (against auth server JWKS)
    - Expiry
    - aud claim == MCP_RESOURCE_URI
    - Required scopes
```

---

## OAuth Protected Resource Metadata (PRM) — RFC 9728

Endpoint: `GET /.well-known/oauth-protected-resource`

```json
{
  "resource": "https://api.example.com/mcp",
  "authorization_servers": ["https://auth.example.com"],
  "bearer_methods_supported": ["header"],
  "scopes_supported": ["tools:read", "tools:write", "admin"],
  "resource_signing_alg_values_supported": ["RS256", "ES256"]
}
```

On unauthenticated requests (missing or invalid token):
```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="mcp", resource_metadata="https://api.example.com/.well-known/oauth-protected-resource"
```

---

## PKCE (Mandatory)

OAuth 2.1 mandates PKCE for all authorization code flows.

```
Client generates:
  code_verifier = crypto.randomBytes(32).toString('base64url')  // 43-128 chars
  code_challenge = base64url(sha256(code_verifier))

Authorization request:
  GET /authorize?code_challenge=<hash>&code_challenge_method=S256&...

Token exchange:
  POST /token
  code_verifier=<original>
```

PKCE prevents authorization code interception attacks in public clients.

---

## Dynamic Client Registration (DCR) — RFC 7591

Enable DCR when accepting unknown public clients (Claude.ai, ChatGPT, third-party tools).

```
POST /register
Content-Type: application/json

{
  "client_name": "Claude.ai",
  "redirect_uris": ["https://claude.ai/callback"],
  "token_endpoint_auth_method": "none",
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

Response provides `client_id` (and optionally `client_secret` for confidential clients).

DCR is optional for controlled enterprise deployments with known clients.

---

## Resource Indicators (RFC 8707)

Audience-restricted tokens prevent token replay across services.

Authorization request must include `resource` parameter:
```
GET /authorize?resource=https://api.example.com/mcp&scope=tools:read&...
```

The issued access token will have:
```json
{ "aud": "https://api.example.com/mcp", ... }
```

The MCP server MUST reject tokens where `aud` does not include its resource URI.

---

## @rekog/mcp-nest Built-In IdP

For servers that issue their own tokens (non-enterprise use):

```ts
McpAuthModule.forRoot({
  provider: GitHubOAuthProvider,
  clientId:     process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  jwtSecret:    process.env.JWT_SECRET,   // ≥32 chars; rotate via env without redeploy
  serverUrl:    process.env.MCP_SERVER_URL,
  apiPrefix:    '/api',                   // optional prefix for auth endpoints
  // storage: new TypeOrmOAuthStore(dataSource),  // for production persistence
})
```

Exposes automatically:
- `GET /.well-known/oauth-authorization-server` (RFC 8414)
- `GET /.well-known/oauth-protected-resource` (RFC 9728)
- `POST /register`, `GET /authorize`, `GET /callback`, `POST /token`, `POST /revoke`

---

## External IdP Integration (Keycloak / Auth0 / Azure AD)

No `McpAuthModule` needed. The MCP server validates JWTs only:

1. Publish PRM manually (see `assets/prm-metadata.template.ts`).
2. Configure JWT guard with JWKS URL from the external IdP.
3. Check `aud` claim against `MCP_RESOURCE_URI`.
4. Map scopes from the token to `@ToolScopes` checks.

JWKS URLs by provider:
- Keycloak: `https://<host>/realms/<realm>/protocol/openid-connect/certs`
- Auth0: `https://<tenant>.auth0.com/.well-known/jwks.json`
- Azure AD: `https://login.microsoftonline.com/<tenant>/discovery/v2.0/keys`
- Google: `https://www.googleapis.com/oauth2/v3/certs`

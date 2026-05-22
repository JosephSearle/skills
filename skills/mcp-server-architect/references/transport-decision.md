# Transport Decision Reference

## Transport Summary

| Transport | Use When | Notes |
|-----------|----------|-------|
| **stdio** | Single local client (Claude Desktop, Cursor, VS Code extension spawns subprocess) | No network, no auth. Credentials from env vars only. Logs to stderr. |
| **Streamable HTTP** | Remote, multi-client, load-balanced, or gateway-fronted | Single `POST /mcp` endpoint. Optional `GET /mcp` SSE upgrade. `DELETE /mcp` for session close. |
| HTTP+SSE (legacy) | **Do not use for new servers** | Two endpoints (`GET /sse` + `POST /messages`). Deprecated 2025-03-26. Retain only for backwards compatibility. |

---

## stdio Rules

- Credentials come from environment variables — the MCP spec explicitly states stdio implementations must NOT initiate OAuth flows.
- Server reads newline-delimited JSON-RPC from stdin, writes to stdout.
- **All logs MUST go to stderr.** Any non-MCP output to stdout corrupts the protocol.
- No CORS, no rate limiting, no TLS needed — process isolation provides the security boundary.
- One client per process; restart to reconnect.

---

## Streamable HTTP Rules

Introduced 2025-03-26, refined 2025-11-25.

**Endpoints:**
- `POST /mcp` — all client requests. Required.
- `GET /mcp` — optional SSE stream upgrade for server-initiated messages (progress, notifications).
- `DELETE /mcp` — optional session termination (stateful mode).

**Response content types:**
- `application/json` — single JSON-RPC response (stateless preferred).
- `text/event-stream` — SSE stream for progress notifications + final response.

**Reconnection:** SSE streams MAY include `id` fields; clients reconnect with `Last-Event-ID` for replay.

**Gateway compatibility:** All operations are HTTP POST with header semantics — works behind any WAF, API Gateway, or load balancer without special configuration.

---

## Decision Rules

```
Is this server invoked by a single local client as a subprocess?
  └─ YES → stdio
  └─ NO ↓

Is this a remote server accessed by multiple clients or behind a load balancer?
  └─ YES → Streamable HTTP

Is there a WAF / API Gateway in front?
  └─ YES → Streamable HTTP (gateway-friendly by design)

Is this a corporate server behind a corp IdP with JWT auth?
  └─ YES → Streamable HTTP + JWT guard (no built-in IdP needed)
```

---

## HTTP+SSE Migration Path

If auditing a server using HTTP+SSE:

1. Replace `SseServerTransport` with `STREAMABLE_HTTP` in `McpModule.forRoot`.
2. Remove `GET /sse` and `POST /messages` routes.
3. Add `POST /mcp` (handled automatically by `@rekog/mcp-nest`).
4. Update client connection strings from `/sse` to `/mcp`.
5. Test stateful upgrade by verifying `Mcp-Session-Id` header round-trip.

---

## @rekog/mcp-nest Transport Config

```ts
// Streamable HTTP — stateless (recommended for most servers)
McpModule.forRoot({
  name: 'my-server',
  version: '1.0.0',
  transport: [STREAMABLE_HTTP],
  streamableHttp: {
    statelessMode: true,
    enableJsonResponse: true,
  },
  guards: [JwtGuard],
})

// stdio — local client
McpModule.forRoot({
  name: 'my-server',
  version: '1.0.0',
  transport: [STDIO],
})
```

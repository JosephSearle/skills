# MCP Reference — langchain-mcp-adapters, Transports, Interceptors, Output Normalization

## MCP Wire Protocol

MCP encodes all messages as **JSON-RPC 2.0** (UTF-8). The current spec version is 2025-11-25.
A release candidate for version 2026-07-28 was published May 21, 2026 — track it for transport
refinements. The spec defines two standard transports:

| Transport | Description | Use when |
|---|---|---|
| **stdio** | Client launches server as a subprocess; JSON-RPC over stdin/stdout (newline-delimited, no embedded newlines); stderr for logging | Local tools, dev environment, CLI agents |
| **Streamable HTTP** | Single endpoint (e.g. `/mcp`) accepting POST + GET; replies with `application/json` or upgrades to `text/event-stream`; session state via `Mcp-Session-Id` header | Remote/production servers |
| ~~HTTP+SSE~~ | ~~Two-endpoint transport (spec 2024-11-05)~~ | **Deprecated — do not use for new servers** |

### CRITICAL: SSE Transport Deprecated

> **The HTTP+SSE transport was deprecated in the MCP spec on 2025-03-26.** It is retained
> only for backward compatibility. Use Streamable HTTP for all new remote servers.

Real-world deadline example: Atlassian Rovo announced that after 30 June 2026,
`https://mcp.atlassian.com/v1/sse` will no longer be accepted. Other providers are following
the same timeline. If your server currently uses the SSE endpoint (`/sse` + `/messages`),
migrate to the Streamable HTTP endpoint (`/mcp`).

### MCP Primitives

| Primitive | Description | LangChain representation |
|---|---|---|
| **Tools** | Executable functions LLMs invoke | `BaseTool` via `get_tools()` |
| **Resources** | Readable data (files, DB records, API responses) | `Blob` via `get_resources()` |
| **Prompts** | Reusable templated message sequences | List of LangChain messages via `get_prompt()` |

---

## The Two Distinct MCP Stories

> **This is the most important architectural distinction.** Using the wrong mental model causes
> broken designs.

| Dimension | `langchain-mcp-adapters` (client) | LangGraph Agent Server (server) | Anthropic MCP connector (`mcp_toolset`) |
|---|---|---|---|
| Role | **Consume** external MCP tools inside your agent | **Expose** your agent as an MCP tool | **Consume** remote MCP tools, executed server-side by Anthropic |
| Who runs the MCP client | Your process | N/A (you are the server) | Anthropic's infrastructure |
| Transports | stdio, http (streamable), sse (deprecated), ws | Streamable HTTP (`/mcp`) | Remote HTTP/SSE only — no local stdio |
| MCP features | Tools + resources + prompts + elicitation | Tools (stateless per request) | Tool calls only |
| Output to LangChain | `BaseTool` / `Blob` / messages; artifacts + content_blocks | Standard MCP responses | `server_tool_use`/result blocks in `AIMessage` |
| Model/provider requirement | Any | Any | Anthropic only; not Bedrock/Vertex; not ZDR |
| Use when | You need to call many external tool servers | You want other clients to call your agent as a tool | You want zero client infrastructure and Anthropic-managed execution |

---

## `langchain-mcp-adapters` — Package Facts

| Fact | Value |
|---|---|
| Latest version | **0.2.2** (released Mar 16, 2026) |
| Python requirement | ≥ 3.10 |
| Package author | Vadym Barda (LangChain) |
| 0.2.0 primary contributor | Sydney Runkle |
| Install | `uv add langchain-mcp-adapters` |

### New in 0.2.0 (Dec 9, 2025)

- Structured output support via LangChain standard content blocks
- `get_resources()` across all servers
- Basic elicitation callbacks
- **Tool interceptors** with retry support and ability to return `Command`
- Accept both `"streamable-http"` and `"http"` as transport aliases

---

## `MultiServerMCPClient` Constructor

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient(
    connections={                  # dict[str, Connection] — server name → connection config
        "server_name": {
            "transport": "stdio",  # or "http" / "streamable-http" / "sse" / "websocket"
            ...                    # transport-specific fields
        },
    },
    callbacks=None,                # LangChain Callbacks | None
    tool_interceptors=None,        # list[ToolCallInterceptor] | None — see Interceptors section
    tool_name_prefix=False,        # True → "server_search" instead of "search" (prevents collisions)
)
```

### CRITICAL: No Async Context Manager

> **As of `langchain-mcp-adapters` 0.1.0+, `async with MultiServerMCPClient(...)` raises
> `NotImplementedError`.** The client is stateless by default — one ephemeral `ClientSession`
> per tool call. Do not attempt to use it as an async context manager.

For persistent sessions, use `client.session("server_name")` explicitly.

---

## Connection Type Schemas

### `StdioConnection`

```python
{
    "transport": "stdio",
    "command": "python",            # executable to launch
    "args": ["/abs/path/server.py"], # command arguments — use absolute paths
    "env": {"API_KEY": "..."},       # optional environment overrides
}
```

> **Note:** The MCP spec states stdio "was designed primarily to support applications running
> on a user's machine." Avoid stdio in web-server contexts — spawn overhead per call adds up;
> consider a simple `@tool` instead.

### `StreamableHttpConnection`

```python
import httpx

{
    "transport": "http",            # alias for "streamable-http" / "streamable_http"
    "url": "https://mcp.example.com/mcp",
    "headers": {
        "Authorization": "Bearer YOUR_TOKEN",   # Bearer auth
        "X-Custom-Header": "value",
    },
    "auth": None,                   # optional httpx.Auth subclass for OAuth
    # "httpx_client_factory": ...,  # optional Protocol for custom AsyncClient creation
}
```

Bearer tokens via `headers` dict are the simplest auth mechanism. For OAuth, supply a custom
`httpx.Auth` subclass via the `auth` field — the library uses the MCP SDK which supports the
`httpx.Auth` protocol and a built-in OAuth2 flow.

### `SSEConnection` (deprecated — migrate away)

```python
{
    "transport": "sse",
    "url": "https://legacy-server.example.com/sse",
    "headers": {"Authorization": "Bearer ..."},  # token in header (not URL query string)
}
```

> **SSE security note:** Older SSE implementations put tokens in the URL query string, which
> gets logged everywhere. Streamable HTTP puts auth in request headers only.

---

## Loading Primitives

```python
import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient

async def main() -> None:
    client = MultiServerMCPClient(
        {
            "math": {
                "transport": "stdio",
                "command": "python",
                "args": ["/abs/path/math_server.py"],
            },
            "weather": {
                "transport": "http",
                "url": "https://weather-mcp.example.com/mcp",
                "headers": {"Authorization": "Bearer TOKEN"},
            },
        },
        tool_name_prefix=True,    # tools become "math_add", "weather_get_forecast", etc.
    )

    # Tools — list[BaseTool], usable identically to @tool / BaseTool tools
    tools = await client.get_tools()

    # Resources (0.2.0+) — list[Blob]
    blobs = await client.get_resources("weather", uris=["res://weather/forecast/today"])
    content = blobs[0].as_string()
    uri = blobs[0].metadata["uri"]

    # Prompts — list of LangChain messages
    messages = await client.get_prompt(
        "math",
        "explain_calculation",
        arguments={"expression": "3 + 5 * 12"},
    )

asyncio.run(main())
```

### Persistent Session (for low-latency stateful servers)

```python
async def main_persistent() -> None:
    client = MultiServerMCPClient({"math": {"transport": "stdio", "command": "python",
                                            "args": ["/abs/path/math_server.py"]}})
    async with client.session("math") as session:
        from langchain_mcp_adapters.tools import load_mcp_tools
        tools = await load_mcp_tools(session)
        # session stays alive for the duration of the `async with` block
```

**Long-lived vs per-request tradeoff:**

| Approach | Latency | Complexity | Self-healing |
|---|---|---|---|
| Stateless default (new session per call) | Per-call connection overhead | None | Yes — transient disconnects self-heal |
| Persistent `client.session(...)` | Low — no per-call setup | Manual lifecycle management | No — you must handle reconnection |

---

## Complete Multi-Server Setup with Agent

```python
import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain.agents import create_agent

async def run_agent() -> None:
    client = MultiServerMCPClient(
        {
            "math": {
                "transport": "stdio",
                "command": "python",
                "args": ["/abs/path/to/math_server.py"],
            },
            "weather": {
                "transport": "http",
                "url": "http://localhost:8000/mcp",
                "headers": {"Authorization": "Bearer YOUR_TOKEN"},
            },
        },
        tool_name_prefix=True,
    )

    # Cache tools at startup — tool lists rarely change at runtime
    tools = await client.get_tools()

    agent = create_agent("claude-sonnet-4-6", tools)
    result = await agent.ainvoke({"messages": "What is (3 + 5) * 12, and what is tomorrow's weather?"})
    print(result)

asyncio.run(run_agent())
```

> **Production tip:** Call `get_tools()` once at startup and cache the result. Tool definitions
> rarely change; re-fetching per request adds unnecessary latency.

---

## Output Normalization — MCP → LangChain Primitives

| MCP response type | LangChain representation | Access path |
|---|---|---|
| Text content | `ToolMessage.content` (string) | `message.content` |
| `structuredContent` | `MCPToolArtifact` stored on `ToolMessage.artifact` | `message.artifact["structured_content"]` |
| Multimodal (text + images) | Standard content blocks on `ToolMessage.content_blocks` | `message.content_blocks[i]` (typed `text`/`image`) |
| Error | `ToolException` propagated | Caught by `handle_tool_error` |

To make `structuredContent` visible to the model, add an interceptor that appends the
structured content to `result.content`:

```python
from langchain_mcp_adapters.interceptors import MCPToolCallRequest

async def expose_structured_content(
    request: MCPToolCallRequest,
    handler: object,
) -> object:
    result = await handler(request)          # type: ignore[operator]
    if result.artifact and "structured_content" in result.artifact:
        import json
        result = result.copy(update={
            "content": result.content + "\n" + json.dumps(result.artifact["structured_content"])
        })
    return result
```

---

## Tool Interceptors (0.2.0+)

Interceptors are async middleware around tool execution, following an "onion" order (first
interceptor is outermost). They receive an `MCPToolCallRequest` and a `handler` callable.

### Retry Interceptor

```python
import asyncio
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.interceptors import MCPToolCallRequest

async def retry_interceptor(
    request: MCPToolCallRequest,
    handler: object,
    max_retries: int = 3,
) -> object:
    """Retry with exponential backoff on transient failures."""
    for attempt in range(max_retries):
        try:
            return await handler(request)    # type: ignore[operator]
        except Exception:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2.0 ** attempt)
    raise RuntimeError("unreachable")

client = MultiServerMCPClient(
    {"my_server": {"transport": "http", "url": "https://api.example.com/mcp"}},
    tool_interceptors=[retry_interceptor],
)
```

### Context Injection Interceptor

MCP servers run out-of-process and cannot see LangGraph state directly. Interceptors bridge
this gap by injecting context from the runtime into the request args or headers.

```python
from langchain_mcp_adapters.interceptors import MCPToolCallRequest

async def inject_user_context(
    request: MCPToolCallRequest,
    handler: object,
) -> object:
    """Inject user_id from LangGraph state into every MCP tool call."""
    user_id = request.runtime.state.get("user_id") if request.runtime else None
    if user_id:
        # Immutable override — returns a new request object
        modified = request.override(args={**request.args, "user_id": user_id})
        return await handler(modified)      # type: ignore[operator]
    return await handler(request)           # type: ignore[operator]
```

### Dynamic Auth Interceptor

```python
from langchain_mcp_adapters.interceptors import MCPToolCallRequest
from myapp.auth import get_fresh_token

async def dynamic_auth_interceptor(
    request: MCPToolCallRequest,
    handler: object,
) -> object:
    """Refresh Bearer token per call (for short-lived tokens)."""
    token = await get_fresh_token()
    modified = request.override(headers={"Authorization": f"Bearer {token}"})
    return await handler(modified)          # type: ignore[operator]
```

**Interceptor patterns summary:**

| Pattern | Use case |
|---|---|
| Retry with backoff | Transient MCP server failures |
| Context/state injection | Pass LangGraph state to out-of-process servers |
| Dynamic auth headers | Short-lived tokens, OAuth refresh |
| Rate limiting | Cap calls to expensive external MCP servers |
| Returning `Command` | Update LangGraph state or jump to `__end__` from tool execution |
| Fallback values | Return a cached/default result when the server is down |

---

## LangGraph Agent Server — Exposing Your Agent as MCP

The **server** side of MCP: LangGraph/Agent Server implements MCP using Streamable HTTP and
exposes deployed agents as MCP tools at the `/mcp` endpoint.

| Fact | Value |
|---|---|
| Required packages | `langgraph-api>=0.2.3`, `langgraph-sdk>=0.1.61` |
| Endpoint | `/mcp` (auto-enabled on deploy) |
| Transport | Streamable HTTP only |
| Disable | `"http": {"disable_mcp": true}` in `langgraph.json` |
| Session model | Stateless — each `/mcp` request is independent |

Every agent deployed on LangSmith Deployment (renamed from LangGraph Platform, Oct 2025)
exposes its own MCP endpoint automatically — no custom code required. Add custom auth
middleware to expose user-scoped tools.

---

## Production Security Patterns

| Risk | Mitigation |
|---|---|
| MCP server prompt injection | Treat tool output as **data**, not instructions — never relay raw MCP output directly into the system prompt |
| Subprocess privilege escalation | Sandbox stdio MCP subprocesses; run with minimal filesystem/network permissions |
| DNS rebinding against local servers | Validate `Origin` header on Streamable HTTP endpoints; bind to `127.0.0.1` only |
| SSE token exposure | SSE put tokens in URL query strings (logged by proxies/servers) — move to Streamable HTTP |
| Tool name collisions | Set `tool_name_prefix=True` when connecting to multiple servers |
| Stale tool list | Cache `get_tools()` at startup; refresh only on redeploy/version bump |

---

## Version Caveats

> **`langchain-mcp-adapters` 0.2.2 (Mar 16, 2026)** — current baseline for this reference.

> **`ToolRuntime`, `ProviderStrategy(strict=...)`, and interceptors are version-sensitive.**
> Pin `langchain-mcp-adapters>=0.2.0` for interceptors; `langchain>=1.2` for `strict=` on
> `ProviderStrategy`.

> **MCP spec churn:** Three transports shipped in under a year. HTTP+SSE deprecated 2025-03-26
> with mid-2026 removal deadlines. Current published spec: 2025-11-25. RC for 2026-07-28
> published May 21, 2026.

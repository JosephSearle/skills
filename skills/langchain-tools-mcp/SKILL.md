---
name: langchain-tools-mcp
description: >
  Implement production-grade LangChain tools, MCP client integrations, server-side tools,
  and structured output in Python 3.11+ agent systems. Triggers on: @tool decorator usage,
  BaseTool subclassing, StructuredTool.from_function wrapping, InjectedToolCallId threading,
  InjectedToolArg injection, ToolRuntime state access, content_and_artifact return pattern,
  return_direct terminal tools, handle_tool_error and handle_validation_error on tool objects,
  MultiServerMCPClient setup, langchain-mcp-adapters configuration, StdioConnection subprocess
  tools, StreamableHttpConnection remote MCP, MCPToolArtifact structured MCP output,
  server-side tools via provider APIs, web_search tool binding, code_interpreter sandboxed
  execution, computer_use action dispatch, web_fetch tool grounding, text_editor tool loop,
  with_structured_output strategy selection, ProviderStrategy native JSON schema, ToolStrategy
  forced tool call, strict=True OpenAI schema constraints, and OutputFixingParser parse repair.
---

## Core Philosophy

Tools are the primary unit of agent capability — their descriptions and schemas are more
important than prompt engineering; a well-typed, well-described tool with `Field(description=...)`
on every argument outperforms a vague one paired with a long system prompt. MCP in 2025/2026
means two distinct stories that are complementary: `langchain-mcp-adapters` consumes external
MCP servers inside your agent, while LangGraph Agent Server exposes your agent as an MCP tool
— using the wrong mental model for either direction causes architecture mistakes. SSE transport
is deprecated by the MCP spec (2025-03-26); all new remote servers must use Streamable HTTP.
Structured output strategy selection is automatic and correct 90% of the time — only reach for
explicit `ProviderStrategy` or `ToolStrategy` when you hit the documented failure modes.

---

## Step 1 — Determine Context

Classify the request before loading any reference:

| Intent signal | Mode |
|---|---|
| `@tool`, `BaseTool`, `StructuredTool.from_function`, tool schema, `bind_tools`, `ToolException`, `return_direct`, `content_and_artifact`, `InjectedToolArg`, `ToolRuntime`, parallel tool calls | **TOOL-CREATION** |
| `MultiServerMCPClient`, `langchain-mcp-adapters`, `StdioConnection`, `StreamableHttpConnection`, MCP server, `get_tools()`, `tool_interceptors`, `MCPToolArtifact`, MCP transport, `/mcp endpoint` | **MCP-CLIENT** |
| `web_search`, `file_search`, `code_interpreter`, `computer_use`, `web_fetch`, `text_editor`, Anthropic server tools, OpenAI built-in tools, `mcp_toolset`, provider-side execution | **SERVER-TOOLS** |
| `with_structured_output`, `response_format`, `ProviderStrategy`, `ToolStrategy`, `strict=True`, `OutputFixingParser`, Pydantic schema for agent output, `include_raw`, `JsonOutputParser` streaming | **STRUCTURED-OUTPUT** |

A single request may span multiple modes — load all relevant references.

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/tool-creation.md` | `@tool`, `BaseTool`, `StructuredTool`, schema inference, error handling, artifacts, parallel calls | Mode is TOOL-CREATION, or any question about defining tools |
| `references/mcp.md` | `MultiServerMCPClient`, transports, interceptors, output normalization, MCP wire protocol | Mode is MCP-CLIENT, or any question about consuming MCP servers |
| `references/server-side-tools.md` | OpenAI/Anthropic provider-executed tools, web search, code interpreter, computer use, web fetch, text editor | Mode is SERVER-TOOLS, or any question about built-in provider tools |
| `references/structured-output.md` | `with_structured_output`, strategy selection, strict mode, Pydantic integration, streaming, retry | Mode is STRUCTURED-OUTPUT, or any question about agent response format |

---

## Step 3 — Implement

### Tool type decision gate

From `references/tool-creation.md`:

| Situation | Use |
|---|---|
| New tool you author, no external state | `@tool` with type hints + `Field(description=...)` on `args_schema` |
| Tool needs a DB session, HTTP client, cache, or custom `_arun` | `BaseTool` subclass |
| Wrapping a third-party function you cannot edit | `StructuredTool.from_function` |
| Large/binary output (image, DataFrame, embeddings) | `@tool(response_format="content_and_artifact")` |
| Terminal tool where output IS the final answer | Set `return_direct=True` |

**Critical**: `handle_tool_error` and `handle_validation_error` are fields on the tool object
(or `BaseTool` subclass), NOT decorator kwargs on `@tool`. Set them after decoration or in the
subclass body. Argument names `config` and `runtime` are reserved — using them causes runtime
errors; use `InjectedToolArg` / `ToolRuntime` patterns instead.

### MCP transport decision gate

From `references/mcp.md`:

| Server location | Transport |
|---|---|
| Local subprocess (dev, CLI tools) | `StdioConnection` (`transport: "stdio"`) |
| Remote HTTP server | `StreamableHttpConnection` (`transport: "http"`) — NOT SSE |
| Legacy SSE endpoint (migration target) | `SSEConnection` — deprecated; plan migration |

### Structured output strategy gate

From `references/structured-output.md`:

| Situation | Strategy |
|---|---|
| OpenAI / Anthropic / Gemini / xAI model, simple schema | Pass bare `type[T]` — auto-selects `ProviderStrategy` |
| Need hard guarantees on OpenAI, schema is strict-compatible | `ProviderStrategy(schema, strict=True)` |
| Anthropic with extended thinking enabled | `ToolStrategy` conflicts → use manual `model_validate` retry loop |
| Schema too complex for grammar compilation (400 error) | Simplify schema or switch to `ToolStrategy` |
| Model without native structured output support | `ToolStrategy` (auto-selected) |

---

## Step 4 — Output & Verification

After implementation, verify with:

```bash
# Install deps
uv add langchain langchain-core langchain-openai langchain-anthropic langchain-mcp-adapters

# Type check (Pyright — see developer-experience skill)
uv run pyright src/

# Run tests
uv run pytest tests/ -x -q

# Confirm MCP adapter version
uv run python -c "import langchain_mcp_adapters; print(langchain_mcp_adapters.__version__)"

# Confirm tool schema export (substitute your tool)
uv run python -c "
from langchain_core.utils.function_calling import convert_to_openai_tool
from mymodule import my_tool
import json
print(json.dumps(convert_to_openai_tool(my_tool), indent=2))
"
```

What gets produced:
- Tools that pass `convert_to_openai_tool` / `convert_to_anthropic_tool` without error
- MCP client that starts, fetches tools, and invokes them without session lifecycle leaks
- Structured output that validates cleanly against the Pydantic schema on `result["structured_response"]`

---

## Reference Files

| File | Domain | Primary source section |
|---|---|---|
| `references/tool-creation.md` | Tool definition idioms, schema inference, error handling, artifacts | Research §1 (Tool Creation) |
| `references/mcp.md` | MCP wire protocol, `langchain-mcp-adapters` 0.2.2, transports, interceptors | Research §3 (MCP) |
| `references/server-side-tools.md` | OpenAI + Anthropic provider-executed built-in tools | Research §2 (Server-Side Tools) |
| `references/structured-output.md` | Strategy selection, strict mode, Pydantic v2 integration, streaming | Research §4 (Structured Output) |

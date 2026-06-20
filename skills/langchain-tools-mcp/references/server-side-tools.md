# Server-Side Tools Reference — OpenAI and Anthropic Provider-Executed Built-ins

## What Server-Side Tools Are

Server-side tools run on the provider's infrastructure. You bind them by name; the provider
executes the logic and returns result blocks in the response. You do not host the logic, manage
compute, or write the tool's internals.

| Provider | Package | Tools |
|---|---|---|
| OpenAI | `langchain-openai` | `web_search`, `file_search`, `code_interpreter`, `computer_use` |
| Anthropic | `langchain-anthropic` | `web_search`, `web_fetch`, `code_execution`, `text_editor`, `computer_use`, `mcp_toolset` |

All calls appear in LangSmith traces alongside agent reasoning steps — MCP tool calls and
built-in tool calls are traceable end-to-end.

---

## OpenAI Server-Side Tools (via `langchain-openai`)

Bound through the OpenAI Responses API. Pass as dicts or typed params to `bind_tools`.

### `web_search`

```python
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4o")
bound = model.bind_tools([
    {
        "type": "web_search_preview",      # or "web_search_preview_2025_03_11"
        "search_context_size": "medium",   # "low" | "medium" | "high" — default "medium"
        # Optional user location for geo-relevant results:
        # "user_location": {"type": "approximate", "country": "US", "city": "New York"},
    }
])
resp = bound.invoke("What are the latest developments in quantum computing this week?")
```

**Three web search modes:**

| Mode | Use when |
|---|---|
| Non-reasoning quick lookup | Standard models, quick factual queries |
| Agentic search with reasoning | Reasoning models (o-series), complex research |
| Deep research | `o3-deep-research` — multi-step, hour-scale research tasks |

### `file_search`

Vector store semantic + keyword retrieval over uploaded files. Requires pre-setup:

```python
from openai import OpenAI
from langchain_openai import ChatOpenAI

# Pre-setup: upload files and create vector store (do once)
openai_client = OpenAI()
file_obj = openai_client.files.create(
    file=open("product_docs.pdf", "rb"),
    purpose="assistants",
)
vs = openai_client.beta.vector_stores.create(name="ProductDocs")
openai_client.beta.vector_stores.files.create(
    vector_store_id=vs.id,
    file_id=file_obj.id,
)

# Bind the tool
model = ChatOpenAI(model="gpt-4o")
bound = model.bind_tools([
    {
        "type": "file_search",
        "vector_store_ids": [vs.id],
        "max_num_results": 5,                  # default varies by model
        # "filters": {"type": "eq", "key": "category", "value": "returns"},  # metadata filter
        # "ranking_options": {"score_threshold": 0.7},
    }
])
resp = bound.invoke("What is the return policy for electronics?")
```

**Metadata filter operators:** `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, plus compound `and`/`or`.

### `code_interpreter`

Writes and runs Python in a sandboxed container on OpenAI's infrastructure.

```python
from openai import OpenAI
from langchain_openai import ChatOpenAI

openai_client = OpenAI()

# Upload a data file for the interpreter to process
data_file = openai_client.files.create(
    file=open("sales_data.csv", "rb"),
    purpose="assistants",
)

model = ChatOpenAI(model="gpt-4o")
bound = model.bind_tools([
    {
        "type": "code_interpreter",
        "file_ids": [data_file.id],                # files available in sandbox
        "container": {
            "expires_after": {                     # inactivity timeout
                "anchor": "last_active_at",
                "minutes": 20,                     # default; container recycled after 20min idle
            },
            # "memory": "4g",                      # "1g" (default) | "4g" | "16g" | "64g"
        },
    }
])
resp = bound.invoke("Analyze the sales data and plot a monthly trend chart.")
# Result types: text, images (charts), files
```

> **Container lifecycle:** A container expires after 20 minutes of inactivity
> (`anchor: "last_active_at", minutes: 20`). For long-running sessions, ping the container
> or increase the timeout.

### `computer_use` (OpenAI)

```python
from langchain_openai import ChatOpenAI

# computer_use options and action types are re-exported from the OpenAI SDK
model = ChatOpenAI(model="gpt-4o")
bound = model.bind_tools([
    {
        "type": "computer_use",
        "display_width": 1024,
        "display_height": 768,
        # Additional options from OpenAI computer_use spec
    }
])
```

---

## Anthropic Server-Side Tools (via `langchain-anthropic`)

LangChain auto-adds required beta headers per tool type via an internal
`_TOOL_TYPE_TO_BETA` map in `langchain_anthropic/chat_models.py`. You do not set headers
manually.

**Anthropic tool classification:**

| Tool | Execution | You must provide |
|---|---|---|
| `web_search` | Anthropic infrastructure | Nothing |
| `web_fetch` | Anthropic infrastructure | URLs (user-provided or from prior search) |
| `code_execution` | Anthropic infrastructure (sandboxed) | Nothing |
| `tool_search` | Anthropic infrastructure | Nothing |
| `text_editor` | **You** — client-side | Editor state + loop to execute commands |
| `computer` | **You** — client-side | VM/container + Xvfb + action executor |
| `bash` | **You** — client-side | Shell environment + execution |

### `web_search` (Anthropic)

```python
from langchain_anthropic import ChatAnthropic

model = ChatAnthropic(model="claude-sonnet-4-6")
bound = model.bind_tools([
    {
        "type": "web_search_20250305",
        "name": "web_search",
        # Optional configuration:
        # "max_uses": 5,
        # "allowed_domains": ["reuters.com", "bbc.com"],
        # "blocked_domains": ["spam.example.com"],
        # "user_location": {"type": "approximate", "country": "GB"},
    }
])
resp = bound.invoke("Search for recent AI safety research papers from 2026.")
# Response includes server_tool_use and web_search_tool_result content blocks
```

### `web_fetch` (Anthropic)

Retrieves full content from web pages and PDFs, grounding responses with citations.

```python
from anthropic.types.beta import BetaWebFetchTool20250910Param
from langchain_anthropic import ChatAnthropic

fetch_tool = BetaWebFetchTool20250910Param(
    name="web_fetch",
    type="web_fetch_20250910",    # beta header: "web-fetch-2025-09-10" (auto-added)
    max_uses=3,
    # "allowed_domains": ["docs.python.org"],
    # "max_content_tokens": 20000,
)

model = ChatAnthropic(model="claude-haiku-4-5-20251001")
bound = model.bind_tools([fetch_tool])
resp = bound.invoke("Fetch https://docs.python.org/3/library/asyncio.html and summarize the key APIs.")
# Returns web_fetch_tool_result blocks with url, retrieved_at, and document content
```

> **Security constraint:** Claude can only fetch URLs explicitly provided by the user or
> returned by prior web search/fetch — it cannot invent URLs. This prevents SSRF-style attacks
> where prompt injection leads to arbitrary URL fetching.

> **Data-exfiltration risk:** web_fetch should only be used in trusted contexts where the
> fetched content is from a controlled domain. In mixed-trust environments, fetched content
> could carry prompt injection payloads.

### `code_execution` (Anthropic)

```python
from langchain_anthropic import ChatAnthropic

model = ChatAnthropic(
    model="claude-sonnet-4-6",
    # reuse_last_container=True,  # optional: reuse prior container for persistent state
)
bound = model.bind_tools([
    {
        "type": "code_execution_20250825",   # recommended; requires langchain-anthropic>=1.0.3
        "name": "code_execution",
        # legacy: "type": "code_execution_20250522"
    }
])
# Sandboxed Python — no internet access, no persistent filesystem between calls
resp = bound.invoke("Calculate the first 20 Fibonacci numbers and plot them.")
```

**Beta headers:** `code-execution-2025-08-25` (recommended) or `code-execution-2025-05-22`
(legacy). LangChain adds these automatically from the tool type.

### `text_editor` (Anthropic)

The text editor runs on the **client side** — Claude emits edit commands; you execute them
and return results. LangChain provides middleware to automate this loop.

**Tool type and command set:**

| Tool type | For model | Commands available |
|---|---|---|
| `text_editor_20250728` | Claude 4, name: `str_replace_based_edit_tool` | `view`, `create`, `str_replace`, `insert` |
| `text_editor_20250124` | Sonnet 3.7 (deprecated), name: `str_replace_editor` | `view`, `create`, `str_replace`, `insert`, `undo_edit` |

> **`undo_edit` is only available on the deprecated `text_editor_20250124` (Sonnet 3.7).**
> It is NOT supported on Claude 4 (`text_editor_20250728`).

> **Known bug:** The model emits `insert_text` for the insert command's content field, though
> the docs say `new_str`. Handle both field names in your executor.

**Using middleware (recommended):**

```python
from langchain.agents import create_agent
# Note: middleware export names vary across versions — verify in your installed langchain
# Known as both StateClaudeTextEditorMiddleware and StateTextEditorToolMiddleware
from langchain.agents.middleware import StateClaudeTextEditorMiddleware

agent = create_agent(
    model="claude-sonnet-4-6",
    tools=[],
    middleware=[StateClaudeTextEditorMiddleware()],
    # or: FilesystemClaudeTextEditorMiddleware(root_path="/workspace", allowed_prefixes=["/workspace"])
)
resp = await agent.ainvoke({"messages": "Create a Python file that computes prime numbers."})
```

> **Export name inconsistency:** `StateClaudeTextEditorMiddleware` and
> `StateTextEditorToolMiddleware` both appear in different versions of the docs. Check the
> actual exports in your installed `langchain` package version before using.

**Manual editor loop (no middleware):**

```python
from langchain_anthropic import ChatAnthropic

model = ChatAnthropic(model="claude-sonnet-4-6")
editor_tool = {
    "type": "text_editor_20250728",
    "name": "str_replace_based_edit_tool",
}
bound = model.bind_tools([editor_tool])
messages = [{"role": "user", "content": "Create file hello.py that prints 'Hello, World!'"}]

while True:
    resp = bound.invoke(messages)
    messages.append(resp)
    if not resp.tool_calls:
        break
    for call in resp.tool_calls:
        cmd = call["args"]["command"]
        if cmd == "create":
            path = call["args"]["path"]
            text = call["args"]["file_text"]
            with open(path, "w") as f:
                f.write(text)
            result = f"Created {path}"
        elif cmd == "str_replace":
            path = call["args"]["path"]
            old = call["args"]["old_str"]
            new = call["args"]["new_str"]
            with open(path) as f:
                content = f.read()
            with open(path, "w") as f:
                f.write(content.replace(old, new, 1))
            result = f"Replaced in {path}"
        elif cmd == "view":
            path = call["args"]["path"]
            view_range = call["args"].get("view_range")
            with open(path) as f:
                lines = f.readlines()
            if view_range:
                lines = lines[view_range[0] - 1:view_range[1]]
            result = "".join(lines)
        elif cmd == "insert":
            path = call["args"]["path"]
            line_num = call["args"]["insert_line"]
            # Handle both "insert_text" (actual model output) and "new_str" (docs)
            text = call["args"].get("insert_text") or call["args"].get("new_str", "")
            with open(path) as f:
                lines = f.readlines()
            lines.insert(line_num, text + "\n")
            with open(path, "w") as f:
                f.writelines(lines)
            result = f"Inserted at line {line_num} in {path}"
        else:
            result = f"Unknown command: {cmd}"

        from langchain_core.messages import ToolMessage
        messages.append(ToolMessage(content=result, tool_call_id=call["id"]))
```

### `computer_use` (Anthropic)

Computer use is a **client-side** tool — you must provide the VM/container, virtual display
(Xvfb), and action executor. Claude emits action commands; you execute and return screenshots.

```python
from typing import Literal
from anthropic.types.beta import BetaToolComputerUse20250124Param
from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool

spec = BetaToolComputerUse20250124Param(
    name="computer",
    type="computer_20250124",              # beta: "computer-use-2025-01-24"
    # type="computer_20251124"             # newer: beta "computer-use-2025-11-24"
    display_width_px=1024,
    display_height_px=768,
    display_number=1,
)

@tool(extras={"provider_tool_definition": spec})
def computer(
    *,
    action: Literal[
        "screenshot", "left_click", "right_click", "middle_click",
        "double_click", "left_click_drag", "mouse_move",
        "type", "key", "scroll", "cursor_position",
    ],
    coordinate: list[int] | None = None,
    text: str | None = None,
    **kw: object,
) -> object:
    """Control the computer display."""
    if action == "screenshot":
        screenshot_b64 = capture_screenshot()   # your Xvfb/VNC capture
        return {"type": "image", "data": screenshot_b64}
    if action == "left_click" and coordinate:
        click_at(coordinate[0], coordinate[1])
        return f"Clicked at {coordinate}"
    if action == "type" and text:
        type_text(text)
        return f"Typed: {text[:50]}"
    if action == "key" and text:
        press_key(text)
        return f"Pressed: {text}"
    return f"Executed {action}"

model = ChatAnthropic(model="claude-sonnet-4-6")
bound = model.bind_tools([computer])
```

**Supported models for computer use:** Claude Opus 4.5, Claude 4, Sonnet 3.7.

> **Security:** Use a dedicated VM/container with minimal privileges. Never expose computer
> use to untrusted input. Avoid having sensitive data visible on screen during sessions.

### Anthropic MCP Toolset (`mcp_toolset`) — Anthropic-Managed MCP

This is **server-side MCP** — Anthropic's servers connect out to your remote MCP server.
No local MCP client process. Available on Claude API, AWS Claude Platform, and Microsoft
Foundry — **not** Bedrock/Vertex, **not** ZDR-eligible.

```python
from langchain_anthropic import ChatAnthropic

model = ChatAnthropic(
    model="claude-sonnet-4-6",
    mcp_servers=[
        {
            "type": "url",
            "url": "https://mcp.example.com/mcp",
            "name": "example-mcp",
            # "authorization_token": "Bearer ..."   # OAuth token
        }
    ],
)
# beta header: "mcp-client-2025-11-20" (auto-added by langchain-anthropic)
# previous: "mcp-client-2025-04-04" (deprecated)
resp = model.invoke("Use the example-mcp tools to get the current server status.")
```

**Constraints vs `langchain-mcp-adapters`:**

| Dimension | Anthropic `mcp_toolset` | `langchain-mcp-adapters` |
|---|---|---|
| MCP features | Tool calls only | Tools + resources + prompts + elicitation |
| Server location | Must be public HTTP/SSE endpoint | Local stdio or any HTTP |
| Client process | None (Anthropic runs it) | Your process |
| Provider lock-in | Anthropic only | Any model |
| Zero-infra setup | Yes | No (you manage the client) |
| Resources/prompts | Not supported | Supported (0.2.0+) |

---

## LangSmith Tracing

All server-side tool calls appear in LangSmith traces. The trace structure shows:
- The agent reasoning step (LLM call)
- Each tool invocation with its input arguments
- Each tool result (content blocks, artifacts)
- Total latency breakdown across tools

Server-side tools like `web_search`, `code_execution`, and `file_search` show up as
distinct spans in the trace, making it straightforward to identify which tool call added
latency or returned unexpected results.

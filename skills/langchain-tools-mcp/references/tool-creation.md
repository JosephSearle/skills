# Tool Creation Reference — @tool, BaseTool, StructuredTool, Schemas, Errors, Artifacts

## Tool Idiom Selection

| Dimension | `@tool` | `BaseTool` subclass | `StructuredTool.from_function` |
|---|---|---|---|
| Best for | Most tools; quick definition | Stateful tools (DB session, HTTP client, cache, custom `_arun`) | Wrapping existing/third-party functions you cannot edit |
| Schema source | Inferred from type hints + docstring; or explicit `args_schema=` | Explicit `args_schema` (Pydantic `BaseModel`) | Inferred or explicit `args_schema=` |
| Sync + async | `async def` → async tool; sync auto-wraps in thread executor | Implement `_run`; optionally `_arun` (defaults to thread executor) | Pass `func=` and/or `coroutine=` |
| State/lifecycle | Via `ToolRuntime` injection | Constructor `__init__` holds state | Closure over external objects |
| Custom error handling | Set `handle_tool_error` on resulting tool object | Override `handle_tool_error` / `_handle_tool_error` in class body | Set on resulting tool object |
| Verbosity | Lowest | Highest | Low |

---

## `@tool` Decorator — Full Signature

```python
from langchain_core.tools import tool

@tool(
    name_or_callable=None,          # str override for tool name, or the callable itself
    *,
    description=None,               # overrides docstring; if None, docstring is used
    return_direct=False,            # True → agent returns tool output without another LLM call
    args_schema=None,               # Pydantic BaseModel | TypedDict | JSON schema dict
    infer_schema=True,              # True → produces StructuredTool; False → simple Tool
    response_format="content",      # "content" | "content_and_artifact"
    parse_docstring=False,          # True → parse Google-style Args: blocks as arg descriptions
    error_on_invalid_docstring=False,
)
def my_tool(arg: str) -> str:
    """Tool description used as schema description."""
    ...
```

### Description Precedence

1. Explicit `description=` kwarg on `@tool`
2. Function docstring (default)
3. `args_schema` model description (lowest priority)

---

## CRITICAL: `handle_tool_error` is NOT a `@tool` decorator kwarg

> **This is the most common mistake when using `@tool`.**

`handle_tool_error` and `handle_validation_error` are fields on `BaseTool` / `StructuredTool`.
They are **not** accepted as kwargs by the `@tool` decorator. Setting them there causes a
`TypeError` or is silently ignored depending on the version.

**Wrong:**
```python
# WRONG — handle_tool_error is not a @tool kwarg
@tool(handle_tool_error=True)
def my_tool(x: int) -> str:
    ...
```

**Correct — set after decoration:**
```python
from langchain_core.tools import tool

@tool
def my_tool(x: int) -> str:
    """Does something."""
    if x < 0:
        from langchain_core.tools import ToolException
        raise ToolException("x must be non-negative")
    return str(x)

my_tool.handle_tool_error = True          # set on the resulting StructuredTool object
my_tool.handle_validation_error = True    # same for validation errors
```

**Correct — via `BaseTool` subclass (preferred for full control):**
```python
from langchain_core.tools import BaseTool, ToolException

class MyTool(BaseTool):
    name: str = "my_tool"
    description: str = "Does something."
    handle_tool_error: bool = True           # class-level field, any supported value
    handle_validation_error: bool = True

    def _run(self, x: int) -> str:
        if x < 0:
            raise ToolException("x must be non-negative")
        return str(x)
```

### `handle_tool_error` values

| Value | Behaviour |
|---|---|
| `True` | Returns a default error string as `ToolMessage.content` |
| `"fixed message"` | Returns that string for any `ToolException` |
| `lambda e: f"Error: {e}"` | Calls the callable with the exception; returns its string |
| `False` (default) | Re-raises the exception, crashing the run |

`handle_validation_error` has identical semantics but fires on Pydantic `ValidationError`
when the LLM supplies invalid arguments.

---

## CRITICAL: Reserved Argument Names

> **`config` and `runtime` cannot be used as tool argument names.**

`config` is reserved for `RunnableConfig` and `runtime` is reserved for `ToolRuntime`. If
you define a tool with either as a parameter name, the framework intercepts it and you get
confusing runtime errors or silent argument shadowing.

**Wrong:**
```python
@tool
def fetch_data(config: str, runtime: str) -> str:  # WRONG — both names are reserved
    ...
```

**Correct — use InjectedToolArg for context/store access:**
```python
from typing import Annotated
from langchain_core.tools import tool, InjectedToolArg
from langchain_core.runnables import RunnableConfig

@tool
def fetch_data(
    query: str,
    user_id: Annotated[str, InjectedToolArg],   # injected; not in LLM-visible schema
) -> str:
    """Fetch data for a query."""
    return f"Results for {query} (user={user_id})"
```

**Correct — use ToolRuntime for state/stream_writer:**
```python
from typing import Annotated
from langchain_core.tools import tool
from langchain_core.tools.base import ToolRuntime

@tool
def stream_results(
    query: str,
    runtime: Annotated[ToolRuntime, InjectedToolArg],   # ToolRuntime under InjectedToolArg
) -> str:
    """Stream results for a query."""
    runtime.stream_writer({"status": "searching", "query": query})
    results = do_search(query)
    return results
```

`ToolRuntime` exposes: `.stream_writer` (emit incremental updates), `.config` (runnable
config), `.store` (LangGraph store), `.state` (graph state read-only snapshot).

---

## Schema Inference

`@tool` with `infer_schema=True` calls `create_schema_from_function` which:
1. Builds a Pydantic model from the function's type-annotated parameters
2. Strips `run_manager`, `callbacks`, and `InjectedToolArg`-annotated params from the schema
3. Strips `ToolRuntime`-annotated params from the schema
4. Uses the docstring as the tool description; with `parse_docstring=True`, `Args:` sections
   become per-argument descriptions in the JSON schema

Type hints are **mandatory** — without them, schema inference fails or produces `Any` fields
that confuse models and break strict-mode validation.

### Pydantic BaseModel vs TypedDict for `args_schema`

| Dimension | `Pydantic BaseModel` | `TypedDict` |
|---|---|---|
| Runtime validation | Yes — `ValidationError` on bad input | No — annotation only |
| `Field(description=...)` | Yes — flows into JSON schema | No |
| Constraints (`ge`, `le`, `pattern`) | Yes | No |
| Defaults | Yes | No (`Required`/`NotRequired` only) |
| Use when | Production tools, complex schemas, provider strict mode | Lightweight annotation-only schemas |

Always prefer `Pydantic BaseModel` with `Field(description=...)` on every argument. Better
descriptions measurably improve LLM call accuracy.

---

## Async Tool Pattern

```python
import asyncio
from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool
from langchain_core.tools import InjectedToolArg

class SearchInput(BaseModel):
    query: str = Field(description="The search query string")
    max_results: int = Field(default=10, ge=1, le=100, description="Maximum results to return")

@tool(args_schema=SearchInput)
async def search_documents(query: str, max_results: int = 10) -> str:
    """Search the document store for relevant content.

    Returns a newline-separated list of matching document excerpts.
    """
    async with get_db_client() as client:
        results = await client.search(query, limit=max_results)
    return "\n".join(r.text for r in results)

# Verify the schema is correct
from langchain_core.utils.function_calling import convert_to_openai_tool
import json
print(json.dumps(convert_to_openai_tool(search_documents), indent=2))
```

Defining an `async def` tool gives the agent loop `tool.coroutine`; it calls `ainvoke`
without thread-pool overhead. If you only define a sync tool, `_arun` defaults to
`asyncio.to_thread(_run)` — fine for low-concurrency, but adds a thread-pool hop per call.

---

## `return_direct` Use Case

```python
from langchain_core.tools import tool

@tool
def submit_support_ticket(summary: str, priority: str) -> str:
    """Submit a support ticket. Once submitted, the workflow is complete."""
    ticket_id = create_ticket(summary, priority)
    return f"Ticket #{ticket_id} created with {priority} priority."

submit_support_ticket.return_direct = True
# When the agent calls this tool, it stops looping and returns the output
# directly as the final response — no additional LLM call to paraphrase.
```

Use `return_direct=True` for terminal actions where the tool's output IS the final answer
and a paraphrase LLM call would waste tokens and latency.

---

## `content_and_artifact` Pattern

```python
import asyncio
from typing import Any
from langchain_core.tools import tool

@tool(response_format="content_and_artifact")
async def render_chart(metric: str, days: int = 30) -> tuple[str, dict[str, Any]]:
    """Render a time-series chart for a metric.

    Args:
        metric: Name of the metric to plot (e.g. 'cpu_usage', 'request_rate').
        days: Lookback window in days.

    Returns:
        Tuple of (human-readable summary for LLM, artifact dict for downstream nodes).
    """
    series = await fetch_metric_series(metric, days)
    png_bytes = render_to_png(series)
    summary = (
        f"Chart for '{metric}' over {days} days: "
        f"{len(series)} data points, latest={series[-1]['value']:.2f}"
    )
    artifact: dict[str, Any] = {
        "format": "png",
        "base64": png_bytes,
        "metric": metric,
        "points": series,
    }
    return summary, artifact
    # model sees `summary` in ToolMessage.content
    # downstream nodes access msg.artifact["base64"] for the PNG
```

Use `content_and_artifact` for: images, DataFrames, embeddings, large JSON blobs, binary
data the model shouldn't consume. Only `content` goes to the LLM; `artifact` sits on
`ToolMessage.artifact` for downstream graph nodes.

> **Note:** `ToolNode`'s artifact propagation into graph state has had open feature requests
> for full downstream handling — verify `ToolMessage.artifact` flows as expected in your
> installed LangGraph version.

---

## `BaseTool` Subclass — Full Pattern

```python
from typing import Optional, Type
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool, ToolException
from langchain_core.callbacks import (
    CallbackManagerForToolRun,
    AsyncCallbackManagerForToolRun,
)

class QueryInput(BaseModel):
    sql: str = Field(description="A read-only SELECT SQL query")

class DBQueryTool(BaseTool):
    name: str = "db_query"
    description: str = "Run a read-only SQL query against the analytics database."
    args_schema: Type[BaseModel] = QueryInput
    return_direct: bool = False
    handle_tool_error: bool = True       # ToolException → error string observation
    handle_validation_error: bool = True # ValidationError → error string observation

    # Pydantic v2: use model_config to allow arbitrary types like a DB session
    model_config = {"arbitrary_types_allowed": True}

    _session: object  # private; not a Pydantic field

    def __init__(self, session: object, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._session = session           # stateful: injected DB session

    def _run(
        self,
        sql: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        if not sql.strip().lower().startswith("select"):
            raise ToolException("Only SELECT queries are permitted.")
        rows = self._session.execute(sql).fetchall()  # type: ignore[attr-defined]
        return str(rows)

    async def _arun(
        self,
        sql: str,
        run_manager: Optional[AsyncCallbackManagerForToolRun] = None,
    ) -> str:
        if not sql.strip().lower().startswith("select"):
            raise ToolException("Only SELECT queries are permitted.")
        rows = await self._session.execute(sql)       # type: ignore[attr-defined]
        return str(rows.fetchall())
```

---

## `StructuredTool.from_function`

Wraps an existing function without modifying it. Useful for third-party library functions.

```python
import httpx
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

class PostInput(BaseModel):
    url: str = Field(description="Target URL for the POST request")
    body: dict = Field(description="JSON body to send")
    timeout: float = Field(default=10.0, description="Request timeout in seconds")

def post_to_webhook(url: str, body: dict, timeout: float = 10.0) -> str:
    """Dispatch a POST request to the given URL with the provided JSON body."""
    resp = httpx.post(url, json=body, timeout=timeout)
    resp.raise_for_status()
    return f"HTTP {resp.status_code}: {resp.text[:500]}"

async def apost_to_webhook(url: str, body: dict, timeout: float = 10.0) -> str:
    """Async variant for use in async agent loops."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=body, timeout=timeout)
        resp.raise_for_status()
        return f"HTTP {resp.status_code}: {resp.text[:500]}"

post_tool = StructuredTool.from_function(
    func=post_to_webhook,
    coroutine=apost_to_webhook,      # optional async impl for the same tool
    name="post_to_webhook",
    description="POST JSON to a webhook URL.",
    args_schema=PostInput,
    return_direct=False,
)
post_tool.handle_tool_error = True   # set after construction
```

---

## Tool Schema → Provider Format Translation

| Provider | Schema field | LangChain conversion helper |
|---|---|---|
| OpenAI | `{"name", "description", "parameters"}` | `convert_to_openai_tool(tool)` |
| Anthropic | `{"name", "description", "input_schema"}` | `convert_to_anthropic_tool(tool)` |
| Gemini | Function declaration (auto-converted) | Handled by `langchain_google_genai` |

```python
from langchain_core.utils.function_calling import (
    convert_to_openai_tool,
    convert_to_anthropic_tool,
)

openai_schema = convert_to_openai_tool(search_documents)
anthropic_schema = convert_to_anthropic_tool(search_documents)
```

Use these when debugging schema serialization issues or when passing tool dicts directly to
provider SDKs.

---

## `bind_tools` and `tool_choice`

```python
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

llm = ChatOpenAI(model="gpt-4o")
tools = [search_documents, render_chart, submit_support_ticket]

# Auto (model decides) — default
bound = llm.bind_tools(tools)

# Force at least one tool call
bound_any = llm.bind_tools(tools, tool_choice="any")        # cross-provider
bound_req = llm.bind_tools(tools, tool_choice="required")   # OpenAI spelling

# Force a specific tool
bound_search = llm.bind_tools(tools, tool_choice="search_documents")

# Disable tool calls
bound_none = llm.bind_tools(tools, tool_choice="none")

# Disable parallel tool calls (OpenAI only)
bound_serial = llm.bind_tools(tools, parallel_tool_calls=False)
```

> **Provider quirk:** Some integrations (e.g., `langchain_groq`) require exactly one tool
> when `tool_choice` is set and reject `"required"` — validate against your provider.

---

## OpenAI Strict Mode Schema Requirements

When using `strict=True` (OpenAI only), your Pydantic schema must satisfy:

| Requirement | Compliant form | Non-compliant form |
|---|---|---|
| All fields required | `x: str \| None` listed in `required` | `x: str = "default"` (defaults unsupported) |
| Optional fields | `x: str \| None = None` | `x: Optional[str]` without null type |
| No extra properties | Automatic with Pydantic `model_config = {"extra": "forbid"}` | Open schemas |
| No root `oneOf` | Use `Union` in nested fields only | `Union[ModelA, ModelB]` at root |
| Nesting depth | Up to ~5 levels (historically) — OpenAI raised limits Jul 2025 | Deep nesting may fail |

```python
from pydantic import BaseModel, Field

class StrictOutput(BaseModel):
    model_config = {"extra": "forbid"}   # additionalProperties: false

    title: str | None = Field(description="Document title, or null if not found")
    confidence: float | None = Field(ge=0.0, le=1.0, description="0-1 confidence score")
    tags: list[str] = Field(default_factory=list, description="Extracted topic tags")
```

---

## Parallel Tool Call Handling

```python
import asyncio
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import BaseTool

async def execute_parallel_tool_calls(
    ai_message: AIMessage,
    tools_by_name: dict[str, BaseTool],
) -> list[ToolMessage]:
    """Execute all tool calls in an AIMessage concurrently."""

    async def invoke_one(call: dict) -> ToolMessage:
        tool = tools_by_name[call["name"]]
        try:
            result = await tool.ainvoke(call["args"])
            return ToolMessage(content=str(result), tool_call_id=call["id"])
        except Exception as exc:
            return ToolMessage(
                content=f"Error: {exc}",
                tool_call_id=call["id"],
            )

    return await asyncio.gather(*[invoke_one(c) for c in ai_message.tool_calls])
    # Preserve tool_call_id ordering — each ToolMessage carries its own id
```

`ToolNode` (from `langgraph.prebuilt`) handles this loop automatically including error
catching and state injection. In custom loops, use `asyncio.gather` over tool calls and
preserve `tool_call_id` threading — a mismatch breaks Anthropic `tool_result` correlation
and OpenAI tool-role messages.

---

## ToolException and InvalidToolCall Handling

```python
from langchain_core.tools import ToolException
from langchain_core.messages import InvalidToolCall

# Raising ToolException in _run — handled by handle_tool_error
def _run(self, value: int) -> str:
    if value > 100:
        raise ToolException(
            f"Value {value} exceeds maximum 100. Reduce and retry."
        )
    return process(value)

# InvalidToolCall — when LLM invents a tool name or sends malformed JSON args
# ToolNode catches these automatically and returns an error ToolMessage
# In custom loops, check ai_message.invalid_tool_calls
for bad_call in ai_message.invalid_tool_calls:
    tool_messages.append(ToolMessage(
        content=f"Unknown tool '{bad_call['name']}'. Available: {list(tools_by_name)}",
        tool_call_id=bad_call["id"],
    ))
```

---

## Production Gotchas

| Gotcha | Detail |
|---|---|
| `handle_tool_error` not a `@tool` kwarg | Set on the resulting object or in `BaseTool` class body — never as a decorator argument |
| `config` reserved | Causes silent shadowing of `RunnableConfig`; use a different name |
| `runtime` reserved | Causes silent shadowing of `ToolRuntime`; use `InjectedToolArg` pattern |
| `infer_schema=False` | Produces a simple `Tool` (not `StructuredTool`) — loses type-safe schema |
| Missing type hints | `create_schema_from_function` produces `Any` fields → weaker model accuracy |
| `return_direct=True` on non-terminal tool | Agent stops at first call — only use for genuinely terminal actions |
| `content_and_artifact` returns non-tuple | Raises `ValueError` at runtime — must return exactly `(str, Any)` |
| Async tool called from sync context | `invoke()` on an async tool blocks; prefer `ainvoke()` from async callers |
| `ToolRuntime.stream_writer` outside LangGraph | Raises `RuntimeError` — only valid inside a LangGraph execution context |
| Parallel write conflicts | If two concurrent tools write the same state field, define a LangGraph reducer for that field |

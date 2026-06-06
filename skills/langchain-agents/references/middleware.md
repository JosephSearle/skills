# Middleware Reference — LangChain v1 AgentMiddleware

## AgentMiddleware Base Class

```python
from langchain.agents.middleware import AgentMiddleware, AgentState, ModelRequest, ModelResponse
```

`AgentMiddleware` is `Generic[StateT, ContextT]`. All hook methods have `async a*` variants.
Override only the hooks you need — the base class provides no-op defaults.

---

## Hook Surface — All 6 Methods

| Hook | Style | Runs when | Signature |
|---|---|---|---|
| `before_agent` / `abefore_agent` | node | Once per agent invocation, before the loop starts | `(self, state: StateT, runtime: Runtime) -> dict[str, Any] \| None` |
| `before_model` / `abefore_model` | node | Before each model call within the loop | `(self, state: StateT, runtime: Runtime) -> dict[str, Any] \| None` |
| `wrap_model_call` / `awrap_model_call` | wrap | Around each model call; receives and returns ModelRequest/Response | `(self, request: ModelRequest, handler: Callable[[ModelRequest], ModelResponse]) -> ModelResponse \| AIMessage \| ExtendedModelResponse` |
| `after_model` / `aafter_model` | node | After each model response, before routing decision | `(self, state: StateT, runtime: Runtime) -> dict[str, Any] \| None` |
| `wrap_tool_call` / `awrap_tool_call` | wrap | Around each tool call | `(self, request: ToolCallRequest, handler: Callable[[ToolCallRequest], ToolMessage]) -> ToolMessage \| Command` |
| `after_agent` / `aafter_agent` | node | Once per agent invocation, after the loop ends | `(self, state: StateT, runtime: Runtime) -> dict[str, Any] \| None` |

### Node-style hooks: return values

- Return `None` to pass through without modifying state.
- Return `dict` to merge into state via reducers (e.g. `{"messages": [AIMessage(...)]}` appends via `add_messages`).
- Return `{"jump_to": "end" | "tools" | "model"}` to short-circuit the loop — **must declare `can_jump_to`** via `@hook_config` or the `can_jump_to=` decorator argument.

### Wrap-style hooks: return values

- Return `ModelResponse` to replace the model's response normally.
- Return `ExtendedModelResponse(model_response=..., command=Command(update={...}))` to inject state updates alongside the response. `command.goto`, `command.resume`, and `command.graph` raise `NotImplementedError`.
- For `wrap_tool_call`: return `ToolMessage` normally, or `Command` to inject state updates.

---

## Execution Order

For `middleware=[m1, m2, m3]`:

| Hook family | Order |
|---|---|
| `before_agent`, `before_model` | Forward: m1 → m2 → m3 |
| `after_model`, `after_agent` | Reverse: m3 → m2 → m1 |
| `wrap_model_call`, `wrap_tool_call` | Onion (m1 outermost): m1 wraps m2 wraps m3 wraps actual call |

The onion model means m1's `wrap_model_call` receives a `handler` that, when called, runs m2's
`wrap_model_call`, which runs m3's, which runs the actual model. Each layer can modify the
`ModelRequest` before calling `handler`, and post-process the `ModelResponse` after.

**Practical implication:** place guardrails and limits at position 0 (outermost = first in list)
so they fire first on the way in and last on the way out.

---

## `ModelRequest` — Full Field Reference

```python
from langchain.agents.middleware import ModelRequest

# All fields (dataclass, immutable — use .override() for mutations)
request.model           # BaseChatModel
request.messages        # list[AnyMessage]   — excludes the system message
request.system_message  # SystemMessage | None
request.tool_choice     # Any | None
request.tools           # list[BaseTool | dict[str, Any]]
request.response_format # ResponseFormat[Any] | None
request.state           # AgentState[Any]
request.runtime         # Runtime[ContextT]  — NOT overridable
request.model_settings  # dict[str, Any]
```

`request.system_prompt` is a deprecated read-only property returning `system_message.text`.
Do not assign to it. Use `.override(system_message=SystemMessage(content=...))` instead.

`.override(**kwargs)` returns a NEW `ModelRequest` via `dataclasses.replace`. Overridable keys:
`model`, `system_message`, `messages`, `tool_choice`, `tools`, `response_format`,
`model_settings`, `state`.

---

## `ModelResponse` and `ExtendedModelResponse`

```python
from langchain.agents.middleware import ModelResponse, ExtendedModelResponse
from langgraph.types import Command

# ModelResponse
response.result              # list[BaseMessage]
response.structured_response # ResponseT | None

# ExtendedModelResponse
ext = ExtendedModelResponse(
    model_response=response,
    command=Command(update={"my_custom_field": 42}),
)
# command.goto / command.resume / command.graph → NotImplementedError
```

---

## Adding State Fields and Tools

### State extension

```python
from __future__ import annotations
from typing import NotRequired, Annotated
from typing_extensions import TypedDict
from langchain.agents.middleware import AgentMiddleware, AgentState


class MetricsState(AgentState):
    model_call_count: NotRequired[int]
    tool_call_count: NotRequired[int]
    total_latency_ms: NotRequired[float]


class MetricsMiddleware(AgentMiddleware[MetricsState]):
    state_schema = MetricsState   # registers the extra channels with the graph

    def before_agent(self, state: MetricsState, runtime) -> dict:
        return {"model_call_count": 0, "tool_call_count": 0, "total_latency_ms": 0.0}
```

### Tool injection

```python
from langchain_core.tools import tool
from langchain.agents.middleware import AgentMiddleware, AgentState, ModelRequest, ModelResponse


@tool
def internal_audit_log(event: str) -> str:
    """Record an internal audit event (not exposed to users)."""
    return f"audited:{event}"


class AuditMiddleware(AgentMiddleware[AgentState]):
    tools = [internal_audit_log]   # injected into the agent's tool list at construction time

    def wrap_model_call(self, request: ModelRequest, handler) -> ModelResponse:
        # Tools are already present in request.tools; override if you need dynamic injection
        return handler(request)
```

For runtime-dynamic tool injection (e.g. MCP-discovered tools per request):
1. Override in `wrap_model_call` via `request.override(tools=request.tools + new_tools)`.
2. Override in `wrap_tool_call` to handle execution of the dynamically injected tools.

---

## Decorator API

```python
from langchain.agents.middleware import (
    before_agent, before_model, after_model, after_agent,
    wrap_model_call, wrap_tool_call,
    dynamic_prompt, hook_config,
)

# Function-style middleware (no class needed)
@before_model
def inject_date(state, runtime):
    from datetime import date
    return {"messages": []}  # modifies system prompt via wrap_model_call instead


@hook_config(can_jump_to=["end"])
def limit_turns(state, runtime):
    if len(state["messages"]) > 20:
        return {"jump_to": "end"}
    return None
```

---

## Built-in Middleware

All from `langchain.agents.middleware` unless noted.

---

### PIIMiddleware

**Import:** `from langchain.agents.middleware import PIIMiddleware`

**Constructor:**
```python
PIIMiddleware(
    pii_type: Literal["email", "credit_card", "ip", "mac_address", "url"] | str,
    *,
    strategy: Literal["redact", "block", "mask", "hash"] = "redact",
    detector: str | re.Pattern | Callable[[str], list[dict]] | None = None,
    apply_to_input: bool = True,
    apply_to_output: bool = False,
    apply_to_tool_results: bool = False,
)
```

| Strategy | Behaviour |
|---|---|
| `"redact"` | Replaces match with `[REDACTED_{TYPE}]` |
| `"block"` | Raises `PIIDetectedError` on detection |
| `"mask"` | Partial masking e.g. `****-****-****-1234` for credit cards |
| `"hash"` | Deterministic pseudonymous hash — stable across calls |

**Production notes:**
- Built-in detectors are **regex-based only** — no NLP, no ML. Fast but limited.
- One `PIIMiddleware` instance per PII type (e.g. separate instances for email and credit card).
- `apply_to_output=True` requires `langchain>=1.3.2` for in-flight streamed output redaction.
- Custom detector: regex string, compiled `re.Pattern`, or `Callable[[str], list[{"text", "start", "end"}]]`.

> **⚠️ Bug #35647 (langchain 1.0.x):** Custom detector functions raise `KeyError: 'value'` when
> `strategy="hash"` or `strategy="mask"`. Use built-in types or `strategy="redact"` with custom detectors.

```python
from __future__ import annotations
import asyncio
import re
from langchain.agents import create_agent
from langchain.agents.middleware import PIIMiddleware
from langchain_core.tools import tool


@tool
def process_user_data(data: str) -> str:
    """Process user-provided data."""
    return f"Processed: {data}"


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[process_user_data],
        middleware=[
            PIIMiddleware("email", strategy="redact", apply_to_input=True, apply_to_output=True),
            PIIMiddleware("credit_card", strategy="block"),
            PIIMiddleware(
                "ssn",
                strategy="mask",
                detector=re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
            ),
        ],
    )
    result = await agent.ainvoke({
        "messages": [{"role": "user", "content": "My email is alice@example.com"}]
    })
    print(result["messages"][-1].content)


asyncio.run(main())
```

---

### SummarizationMiddleware

**Import:** `from langchain.agents.middleware import SummarizationMiddleware`

**Constructor:**
```python
SummarizationMiddleware(
    model: str | BaseChatModel,
    *,
    trigger: ContextSize | list[ContextSize] | None = None,
    keep: ContextSize = ("messages", 20),
    token_counter: Callable = count_tokens_approximately,
    summary_prompt: str = DEFAULT_SUMMARY_PROMPT,
    trim_tokens_to_summarize: int = 4000,
)
# ContextSize = tuple[Literal["fraction", "tokens", "messages"], float | int]
```

Implements `before_model` (not `wrap_model_call`). When triggered, replaces message history with a
summary `HumanMessage` + recent messages — **NOT a `SystemMessage`**.

| Option | Behaviour | Example |
|---|---|---|
| `trigger=None` | Summarization never runs (default) | Must always be set explicitly |
| `trigger=("tokens", 8000)` | Trigger when context exceeds 8 000 tokens | Absolute threshold |
| `trigger=("messages", 30)` | Trigger when history exceeds 30 messages | Message count |
| `trigger=("fraction", 0.8)` | Trigger at 80% of model's context window | Requires model profile data |
| `keep=("messages", 10)` | Keep the 10 most recent messages after summarisation | |

> **⚠️ v1.0:** With `trigger=None` (the default), summarisation **never runs**. You must set
> `trigger` explicitly. The `fraction` trigger type requires model profile data from `models.dev`
> (available via `langchain>=1.1`); for unknown models, use `"tokens"` or `"messages"`.

**Tool-call continuity:** The internal `_find_safe_cutoff_point` ensures the cutoff never splits
an `AIMessage` containing `tool_calls` from its corresponding `ToolMessage`s.

```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langchain_core.tools import tool


@tool
def search(query: str) -> str:
    """Search the web for information."""
    return f"Results for: {query}"


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[search],
        middleware=[
            SummarizationMiddleware(
                model="claude-sonnet-4-5-20250929",
                trigger=("tokens", 6000),
                keep=("messages", 8),
                trim_tokens_to_summarize=3000,
            )
        ],
        checkpointer=None,  # Add InMemorySaver() for multi-turn use
    )
    result = await agent.ainvoke({
        "messages": [{"role": "user", "content": "Tell me about climate change"}]
    })
    print(result["messages"][-1].content)


asyncio.run(main())
```

---

### HumanInTheLoopMiddleware

**Import:** `from langchain.agents.middleware import HumanInTheLoopMiddleware`

**Constructor:**
```python
HumanInTheLoopMiddleware(
    interrupt_on: dict[
        str,
        bool | dict[Literal["allowed_decisions", "description"], Any]
    ]
)
# key: tool name; value: True (approve/reject), or config dict
```

**Requires a checkpointer.** Bridges to LangGraph's `interrupt()` — pauses before tool
execution and saves state. Resume via `Command(resume={"decisions": [...]})`.

| Decision type | Behaviour |
|---|---|
| `"approve"` | Proceed with tool call as-is |
| `"edit"` | Modify tool arguments before execution |
| `"reject"` | Cancel tool call, inject rejection message |
| `"respond"` | For ask-user tools; inject user response as tool result |

```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command


@tool
def delete_records(table: str, condition: str) -> str:
    """Delete records from a database table matching a condition."""
    return f"Deleted records from {table} where {condition}"


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email to a recipient."""
    return f"Email sent to {to}"


async def main() -> None:
    checkpointer = InMemorySaver()
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[delete_records, send_email],
        middleware=[
            HumanInTheLoopMiddleware(
                interrupt_on={
                    "delete_records": {
                        "allowed_decisions": ["approve", "reject"],
                        "description": "Confirm destructive database operation",
                    },
                    "send_email": True,  # Simple approve/reject
                }
            )
        ],
        checkpointer=checkpointer,
    )

    thread_cfg = {"configurable": {"thread_id": "ops-session-1"}}

    # First invocation — will interrupt before delete_records
    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": "Delete all test users and email the team"}]},
        config=thread_cfg,
    )

    # Check if interrupted
    if hasattr(result, "interrupts") and result.interrupts:
        print("Interrupted for approval:", result.interrupts)

        # Resume with approval decision
        resumed = await agent.ainvoke(
            Command(resume={"decisions": [{"type": "approve"}, {"type": "reject"}]}),
            config=thread_cfg,
        )
        print(resumed["messages"][-1].content)


asyncio.run(main())
```

> **⚠️ Bug #33787 (langchain 1.0.x):** After an `"edit"` decision, the agent may re-attempt the
> original unedited tool call. Verify `"edit"` decision behavior with your version before relying on it.

---

### TodoListMiddleware

**Import:** `from langchain.agents.middleware import TodoListMiddleware`

**Constructor:**
```python
TodoListMiddleware(
    *,
    system_prompt: str = WRITE_TODOS_SYSTEM_PROMPT,
    tool_description: str = WRITE_TODOS_TOOL_DESCRIPTION,
)
```

Injects a `write_todos` tool and adds a `todos` field (via `PlanningState` schema) to agent state.
Each `Todo` is `{"content": str, "status": "pending" | "in_progress" | "completed"}`.
The `write_todos` tool replaces the entire list — at most one call per model turn is enforced.

Result is available at `result["todos"]`. Used by default in LangChain Deep Agents.

> **⚠️ Conflict:** If you also pass a `state_schema` that defines a `todos` channel with a
> different type, you'll get `"Channel 'todos' already exists with a different type"`. Subclass
> `PlanningState` instead of `AgentState` when combining with `TodoListMiddleware`.

```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain_core.tools import tool


@tool
def research_topic(topic: str) -> str:
    """Research a topic and return key findings."""
    return f"Key findings on {topic}: [finding1, finding2, finding3]"


@tool
def write_document(title: str, content: str) -> str:
    """Write a document with given title and content."""
    return f"Document '{title}' written successfully"


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[research_topic, write_document],
        middleware=[TodoListMiddleware()],
        system_prompt="You are a research assistant. Plan your work before executing.",
    )

    result = await agent.ainvoke({
        "messages": [{"role": "user", "content": "Write a report on renewable energy trends"}]
    })

    # Access the todo list
    todos = result.get("todos", [])
    for todo in todos:
        print(f"[{todo['status']}] {todo['content']}")


asyncio.run(main())
```

---

### ModelCallLimitMiddleware

**Import:** `from langchain.agents.middleware import ModelCallLimitMiddleware`

**Constructor:**
```python
ModelCallLimitMiddleware(
    thread_limit: int | None = None,   # max calls across entire thread (all invocations)
    run_limit: int | None = None,      # max calls per single invocation
    exit_behavior: Literal["end", "error"] = "end",
)
```

Adds `thread_model_call_count` to agent state (via its own `state_schema` — NOT part of base `AgentState`).

| Parameter | Behaviour |
|---|---|
| `thread_limit` | Total model calls across all turns on the same `thread_id` |
| `run_limit` | Model calls per single `invoke`/`ainvoke` call |
| `exit_behavior="end"` | Gracefully ends the loop when limit is hit |
| `exit_behavior="error"` | Raises `ModelCallLimitError` |

```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


@tool
def calculate(expression: str) -> str:
    """Evaluate a mathematical expression."""
    return str(eval(expression, {"__builtins__": {}}, {}))


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[calculate],
        middleware=[
            ModelCallLimitMiddleware(
                run_limit=5,         # max 5 model calls per single invocation
                thread_limit=100,    # max 100 model calls total on this thread
                exit_behavior="end",
            )
        ],
        checkpointer=InMemorySaver(),
    )

    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": "Calculate 2^10 then 3^8 then 4^6"}]},
        config={"configurable": {"thread_id": "math-session"}},
    )
    print(result["messages"][-1].content)


asyncio.run(main())
```

---

### ToolCallLimitMiddleware

**Import:** `from langchain.agents.middleware import ToolCallLimitMiddleware`

**Constructor:**
```python
ToolCallLimitMiddleware(
    tool_name: str | None = None,        # None = limit applies to all tools
    thread_limit: int | None = None,
    run_limit: int | None = None,
    exit_behavior: Literal["continue", "end", "error"] = "continue",
)
```

`exit_behavior="continue"` removes the rate-limited tool from available tools and continues the
loop (unlike `ModelCallLimitMiddleware` which ends the loop).

---

### ModelFallbackMiddleware

**Import:** `from langchain.agents.middleware import ModelFallbackMiddleware`

**Constructor:**
```python
ModelFallbackMiddleware(*models: str | BaseChatModel)
```

Tries each model in order on failure (rate limits, API errors). Uses `wrap_model_call`.

> **⚠️ Bug #33709 (langchain-anthropic 1.0.0):** Combining `AnthropicPromptCachingMiddleware`
> with `ModelFallbackMiddleware` crashes when the fallback is a non-Anthropic model. The
> `cache_control` param leaks onto the fallback model's messages. `unsupported_model_behavior="ignore"`
> does not strip it. Avoid this combination until the bug is resolved, or ensure all fallback
> models are also Anthropic models.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelFallbackMiddleware

agent = create_agent(
    "claude-sonnet-4-5-20250929",
    tools=[],
    middleware=[
        ModelFallbackMiddleware(
            "claude-sonnet-4-5-20250929",  # primary
            "claude-haiku-3-5-20251001",   # first fallback (cheaper/faster)
        )
    ],
)
```

---

### ModelRetryMiddleware

**Import:** `from langchain.agents.middleware import ModelRetryMiddleware`

**Constructor:**
```python
ModelRetryMiddleware(
    max_retries: int = 3,
    retry_on: tuple[type[Exception], ...] = (RateLimitError, APIConnectionError),
    on_failure: Literal["raise", "end"] = "raise",
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
)
```

Exponential backoff with ±25% jitter. Implements `wrap_model_call`.

---

### ToolRetryMiddleware

**Import:** `from langchain.agents.middleware import ToolRetryMiddleware`

**Constructor:**
```python
ToolRetryMiddleware(
    max_retries: int = 3,
    retry_on: tuple[type[Exception], ...] = (Exception,),
    on_failure: Literal["raise", "return_error"] = "return_error",
    initial_delay: float = 0.5,
    max_delay: float = 30.0,
)
```

`on_failure="return_error"` returns the exception message as a `ToolMessage` so the model can
self-correct. Implements `wrap_tool_call`.

```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRetryMiddleware, ToolRetryMiddleware
from langchain_core.tools import tool


@tool
def flaky_api(endpoint: str) -> str:
    """Call an external API endpoint."""
    import random
    if random.random() < 0.5:
        raise ConnectionError(f"Timeout connecting to {endpoint}")
    return f"Success from {endpoint}"


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[flaky_api],
        middleware=[
            ModelRetryMiddleware(max_retries=2, initial_delay=0.5),
            ToolRetryMiddleware(
                max_retries=3,
                retry_on=(ConnectionError, TimeoutError),
                on_failure="return_error",
            ),
        ],
    )

    result = await agent.ainvoke({
        "messages": [{"role": "user", "content": "Call the /status endpoint"}]
    })
    print(result["messages"][-1].content)


asyncio.run(main())
```

---

### LLMToolSelectorMiddleware

**Import:** `from langchain.agents.middleware import LLMToolSelectorMiddleware`

**Constructor:**
```python
LLMToolSelectorMiddleware(
    model: str | BaseChatModel,
    max_tools: int = 10,
    always_include: list[str] = (),
)
```

When the agent has many tools, uses an LLM to select the most relevant subset for each model call,
reducing context size and improving tool selection accuracy. Implements `wrap_model_call`.

---

### LLMToolEmulator

**Import:** `from langchain.agents.middleware import LLMToolEmulator`

**Constructor:**
```python
LLMToolEmulator(
    tools: list[BaseTool] | None = None,
    model: str | BaseChatModel | None = None,
)
```

Routes tool calls to an LLM instead of executing them directly — useful for testing, sandboxing,
or emulating tools that haven't been built yet.

---

### ContextEditingMiddleware

**Import:** `from langchain.agents.middleware import ContextEditingMiddleware`

**Constructor:**
```python
ContextEditingMiddleware(
    edits: list[ContextEdit],
)
# Common edit: ClearToolUsesEdit(trigger: int, keep: int, tool_names: list[str] | None)
```

Modifies the message context before each model call. `ClearToolUsesEdit` removes tool call
sequences (AIMessage + ToolMessages) older than `trigger` tokens, keeping `keep` most recent.
Useful for reducing context bloat in long-running agents without full summarisation.

```python
from langchain.agents.middleware import ContextEditingMiddleware, ClearToolUsesEdit

middleware = ContextEditingMiddleware(
    edits=[ClearToolUsesEdit(trigger=100_000, keep=3, tool_names=["search", "browse"])]
)
```

---

### ShellToolMiddleware

**Import:** `from langchain.agents.middleware import ShellToolMiddleware`

**Constructor:**
```python
ShellToolMiddleware(
    execution_policy: Literal["host", "docker", "codex"] = "host",
    allowed_commands: list[str] | None = None,
    working_directory: str | None = None,
)
```

Provides sandboxed shell execution for agents that need to run system commands. The `"docker"`
and `"codex"` policies isolate execution from the host.

> **⚠️ v1.0:** Persistent shell-tool sessions do not currently work with `HumanInTheLoopMiddleware`
> interrupts. If you need both, run HITL checks before the shell step via `interrupt_before=["tools"]`.

---

### FilesystemFileSearchMiddleware

**Import:** `from langchain.agents.middleware import FilesystemFileSearchMiddleware`

**Constructor:**
```python
FilesystemFileSearchMiddleware(
    search_mode: Literal["glob", "grep"] = "glob",
    root_directory: str = ".",
    max_results: int = 50,
)
```

Injects file-search tools (`glob_search` / `grep_search`) into the agent. Restricts filesystem
access to `root_directory` and below.

---

### AnthropicPromptCachingMiddleware

**Import:** `from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware`

**Requires:** Both `langchain` and `langchain-anthropic` installed.

**Constructor:**
```python
AnthropicPromptCachingMiddleware(
    type: Literal["ephemeral"] = "ephemeral",
    ttl: Literal["5m", "1h"] = "5m",
    min_messages_to_cache: int = 0,
    unsupported_model_behavior: Literal["warn", "ignore", "error"] = "warn",
)
```

Adds Anthropic `cache_control` breakpoints to:
1. The last content block of the system message.
2. All tool definitions (tool schemas cached across turns).
3. The last cacheable block of the message sequence.

| TTL | Cache write cost | Cache read cost | Break-even |
|---|---|---|---|
| `"5m"` | 1.25x base input token price | 0.1x base (90% discount) | 1 read |
| `"1h"` | 2.0x base input token price | 0.1x base (90% discount) | ~1–2 reads |

```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


@tool
def search_knowledge_base(query: str) -> str:
    """Search the company knowledge base."""
    return f"Knowledge base results for: {query}"


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[search_knowledge_base],
        middleware=[
            ModelCallLimitMiddleware(run_limit=10),
            AnthropicPromptCachingMiddleware(ttl="5m"),
        ],
        system_prompt=(
            "You are an expert assistant with deep knowledge of our product. "
            "Always search the knowledge base before answering. "
            # Long system prompt benefits most from caching
        ),
        checkpointer=InMemorySaver(),
    )

    thread_cfg = {"configurable": {"thread_id": "support-123"}}
    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": "How do I reset my password?"}]},
        config=thread_cfg,
    )
    print(result["messages"][-1].content)


asyncio.run(main())
```

> **⚠️ Bug #33709:** Do NOT combine `AnthropicPromptCachingMiddleware` with
> `ModelFallbackMiddleware` when any fallback is a non-Anthropic model. The `cache_control`
> parameter leaks onto fallback model messages, causing `TypeError: unexpected keyword argument
> 'cache_control'`. `unsupported_model_behavior="ignore"` does not strip it.

---

## Full Custom Middleware Example

```python
from __future__ import annotations
import asyncio
import time
from typing import Any, Callable
from typing_extensions import NotRequired
from typing_extensions import TypedDict
from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware,
    AgentState,
    ModelRequest,
    ModelResponse,
    ExtendedModelResponse,
    hook_config,
)
from langchain_core.messages import AIMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.runtime import Runtime
from langgraph.types import Command


@tool
def fetch_data(source: str) -> str:
    """Fetch data from a named source."""
    return f"Data from {source}: [record1, record2, record3]"


class ObservabilityState(AgentState):
    model_calls: NotRequired[int]
    tool_calls: NotRequired[int]
    start_time_ms: NotRequired[float]
    total_latency_ms: NotRequired[float]


class ObservabilityMiddleware(AgentMiddleware[ObservabilityState]):
    """Track model/tool call counts and end-to-end latency per invocation."""

    state_schema = ObservabilityState

    def before_agent(
        self, state: ObservabilityState, runtime: Runtime
    ) -> dict[str, Any]:
        return {
            "model_calls": 0,
            "tool_calls": 0,
            "start_time_ms": time.monotonic() * 1000,
            "total_latency_ms": 0.0,
        }

    @hook_config(can_jump_to=["end"])
    def before_model(
        self, state: ObservabilityState, runtime: Runtime
    ) -> dict[str, Any] | None:
        # Hard limit: never let the agent exceed 20 model calls
        if state.get("model_calls", 0) >= 20:
            return {
                "messages": [AIMessage(content="Call budget exhausted. Stopping.")],
                "jump_to": "end",
            }
        return None

    def wrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
    ) -> ExtendedModelResponse:
        """Inject a governance note into the system prompt and count the call."""
        # Build an updated system message
        base_blocks = (
            list(request.system_message.content)
            if request.system_message
            else []
        )
        base_blocks.append({
            "type": "text",
            "text": "\n[GOVERNANCE] All actions are logged for compliance.",
        })
        updated_request = request.override(
            system_message=SystemMessage(content=base_blocks)
        )
        response = handler(updated_request)
        new_count = request.state.get("model_calls", 0) + 1
        return ExtendedModelResponse(
            model_response=response,
            command=Command(update={"model_calls": new_count}),
        )

    async def awrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
    ) -> ExtendedModelResponse:
        """Async parity — identical logic."""
        return self.wrap_model_call(request, handler)

    def wrap_tool_call(self, request, handler):
        """Count tool calls via state update."""
        result = handler(request)
        # Return Command to increment tool_calls
        new_count = request.state.get("tool_calls", 0) + 1
        return Command(
            update={"tool_calls": new_count},
            # result will be applied through the normal tool message path
        )

    def after_agent(
        self, state: ObservabilityState, runtime: Runtime
    ) -> dict[str, Any]:
        start = state.get("start_time_ms", time.monotonic() * 1000)
        latency = time.monotonic() * 1000 - start
        return {"total_latency_ms": latency}


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[fetch_data],
        middleware=[ObservabilityMiddleware()],
    )

    result = await agent.ainvoke({
        "messages": [{"role": "user", "content": "Fetch data from source A and source B"}]
    })

    print(f"Model calls: {result.get('model_calls')}")
    print(f"Tool calls: {result.get('tool_calls')}")
    print(f"Total latency: {result.get('total_latency_ms', 0):.1f}ms")
    print(result["messages"][-1].content)


asyncio.run(main())
```

---

## Middleware Composition Patterns

| Pattern | Implementation | Use case |
|---|---|---|
| Guard + augment | `[ModelCallLimitMiddleware, PIIMiddleware, SummarizationMiddleware]` | Safety-first: limits and redaction before context management |
| Observability wrapper | Custom middleware at position 0 (outermost) | Capture full latency including all inner middleware |
| Caching + retry | `[AnthropicPromptCachingMiddleware, ModelRetryMiddleware]` | Cache first; retry if the cached path fails |
| HITL + todo planning | `[TodoListMiddleware, HumanInTheLoopMiddleware]` | TodoList plans work; HITL approves before execution |
| Fallback + selection | `[LLMToolSelectorMiddleware, ModelFallbackMiddleware]` | Select tools with primary model; fall back on failure |

---

## Testing Custom Middleware

```python
from __future__ import annotations
from unittest.mock import MagicMock
import pytest
from langchain_core.messages import AIMessage, HumanMessage
from langchain.agents.middleware import AgentState, ModelRequest, ModelResponse


def make_state(messages=None, **extra) -> ObservabilityState:
    """Build a minimal AgentState dict for unit tests."""
    return ObservabilityState(
        messages=messages or [HumanMessage(content="test")],
        **extra,
    )


def make_model_response(content: str) -> ModelResponse:
    """Build a minimal ModelResponse for unit tests."""
    return ModelResponse(result=[AIMessage(content=content)])


def test_before_agent_initialises_counters():
    mw = ObservabilityMiddleware()
    state = make_state()
    result = mw.before_agent(state, runtime=MagicMock())
    assert result["model_calls"] == 0
    assert result["tool_calls"] == 0


def test_before_model_allows_normal_calls():
    mw = ObservabilityMiddleware()
    state = make_state(model_calls=3)
    result = mw.before_model(state, runtime=MagicMock())
    assert result is None


def test_before_model_blocks_over_limit():
    mw = ObservabilityMiddleware()
    state = make_state(model_calls=20)
    result = mw.before_model(state, runtime=MagicMock())
    assert result is not None
    assert result["jump_to"] == "end"


def test_wrap_model_call_increments_count():
    mw = ObservabilityMiddleware()
    fake_model_request = MagicMock()
    fake_model_request.system_message = None
    fake_model_request.state = make_state(model_calls=2)
    handler = MagicMock(return_value=make_model_response("hello"))

    result = mw.wrap_model_call(fake_model_request, handler)
    assert result.command.update["model_calls"] == 3
```

# create_agent Reference — LangChain v1

## Package versions

| Package | Minimum | Recommended | Notes |
|---|---|---|---|
| `langchain` | 1.0.0 | >=1.2.13 | GA released 2025-10-22; `create_agent` stable since v1.0 |
| `langgraph` | 0.2.0 | >=0.2.x | Provides `CompiledStateGraph`, checkpointers |
| `langchain-anthropic` | 1.0.0 | >=1.0.0 | Required for `AnthropicPromptCachingMiddleware` |
| Python | 3.10 | >=3.11 | 3.11 gives `TaskGroup`, `ExceptionGroup`, `tomllib` |

---

## Full `create_agent` Signature

```python
from langchain.agents import create_agent
from langchain_core.language_models import BaseChatModel
from langchain_core.tools import BaseTool
from langchain_core.caches import BaseCache
from langgraph.checkpoint.base import BaseCheckpointSaver as Checkpointer
from langgraph.store.base import BaseStore
from langchain.agents.middleware import AgentMiddleware, AgentState
from langchain.agents.structured_output import ResponseFormat
from typing import Any, Callable, Sequence

CompiledGraph = create_agent(
    model,            # str | BaseChatModel
    tools,            # Sequence[BaseTool | Callable[..., Any] | dict[str, Any]] | None = None
    *,
    system_prompt=None,      # str | SystemMessage | None
    middleware=(),           # Sequence[AgentMiddleware] = ()
    response_format=None,    # ResponseFormat | type[ResponseT] | dict[str, Any] | None
    state_schema=None,       # type[AgentState[ResponseT]] | None
    context_schema=None,     # type[ContextT] | None
    checkpointer=None,       # Checkpointer | None
    store=None,              # BaseStore | None
    interrupt_before=None,   # list[str] | None
    interrupt_after=None,    # list[str] | None
    debug=False,             # bool
    name=None,               # str | None
    cache=None,              # BaseCache[Any] | None
)
```

Return type: `CompiledStateGraph[AgentState[ResponseT], ContextT, _InputAgentState, _OutputAgentState[ResponseT]]`

The returned object IS a LangGraph compiled graph: supports `invoke`, `ainvoke`, `stream`,
`astream`, `get_state`, `update_state`, and direct use as a subgraph node.

---

## Parameter Reference

### `model` — string shorthand vs instance vs configurable

| Form | Example | When to use | Constraint |
|---|---|---|---|
| String shorthand | `"openai:gpt-4o"`, `"claude-sonnet-4-5-20250929"` | Simplest; provider inferred from prefix or model-ID registry via `init_chat_model` | Cannot set per-instance config (temp, timeouts) |
| `BaseChatModel` instance | `ChatAnthropic(model="claude-sonnet-4-5-20250929", max_tokens=4096)` | Full config control | **Do NOT call `.bind_tools(...)` before passing when `response_format` is also set** |
| Configurable | `init_chat_model("gpt-4o", configurable_fields=["model", "temperature"])` | A/B testing, per-user model selection via `config` at invoke time | Requires `from langchain.chat_models import init_chat_model` |

> **⚠️ v1.0:** Pre-bound models (`.bind_tools(...)`) are NOT supported when `response_format` is
> also passed to `create_agent`. LangChain will raise at agent construction time. A `wrap_model_call`
> middleware that dynamically swaps the model is the correct pattern when you need both structured
> output and dynamic model selection.

### `tools` — what is and is not accepted

| Accepted | Example | Notes |
|---|---|---|
| `@tool`-decorated function | `@tool\ndef search(q: str) -> str: ...` | Docstring becomes tool description |
| Plain callable with type hints + docstring | `def add(x: int, y: int) -> int:\n    "Add two numbers."\n    return x + y` | Auto-wrapped as a `StructuredTool` |
| `BaseTool` instance | `TavilySearchResults(max_results=3)` | Any LangChain tool |
| Provider `dict` (MCP / server-side tool) | `{"type": "computer_20250124", ...}` | Passed directly to the model API |

| NOT accepted | Why |
|---|---|
| `ToolNode` instance | v0 artifact; v1 builds the tools node internally |
| Raw `Runnable` without tool interface | No `.name`/`.description`/`.args_schema` |
| Pre-bound model as a tool | Confuses model and tool namespaces |

Empty list (`tools=[]`) or `tools=None` → model-only agent (no tool loop; model responds directly).

---

## `AgentState` — the base state TypedDict

```python
from __future__ import annotations
from typing import Generic, Required, NotRequired, Annotated
from typing_extensions import TypedDict
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from langgraph.types import Command
from langchain.agents.middleware.types import EphemeralValue, PrivateStateAttr, OmitFromInput

JumpTo = Literal["tools", "model", "end"]

class AgentState(TypedDict, Generic[ResponseT]):
    messages: Required[Annotated[list[AnyMessage], add_messages]]
    jump_to: NotRequired[Annotated[JumpTo | None, EphemeralValue, PrivateStateAttr]]
    structured_response: NotRequired[Annotated[ResponseT, OmitFromInput]]
```

Exactly three keys:
- `messages` — the full conversation history; uses `add_messages` reducer (append semantics).
- `jump_to` — ephemeral routing signal set by middleware to short-circuit the loop; not persisted.
- `structured_response` — populated when `response_format` is set; absent from agent inputs.

> **⚠️ v1.0:** `thread_model_call_count` is NOT part of base `AgentState`. It is added by
> `ModelCallLimitMiddleware` via its own `state_schema` extension. Do not reference it on
> `AgentState` directly.

### Custom state schema

```python
from __future__ import annotations
from typing import NotRequired
from typing_extensions import TypedDict
from langchain.agents.middleware import AgentState


class AppState(AgentState):
    """Custom state extending AgentState with application-specific fields."""
    user_id: NotRequired[str]
    request_metadata: NotRequired[dict[str, str]]


# Pass to create_agent directly (top-level extension, no middleware needed):
from langchain.agents import create_agent

agent = create_agent(
    "claude-sonnet-4-5-20250929",
    tools=[],
    state_schema=AppState,
)
```

> **⚠️ v1.0:** Custom state schemas MUST be `TypedDict` subclasses of `AgentState`. Pydantic
> `BaseModel` and `dataclasses` are not supported. Perform validation inside middleware hooks.

---

## Graph Structure

`create_agent` builds a `StateGraph[AgentState]` with two primary nodes:

```
START → [before_agent middleware nodes] → model → [after_model middleware nodes]
                                            ↓ (tool calls present?)
                                         tools → [after_tool middleware nodes] → model (loop)
                                            ↓ (no tool calls)
                                         [after_agent middleware nodes] → END
```

Key v1 changes from v0:
- The model node is named `"model"` (renamed from `"agent"` in v0; affects streaming node filters and LangSmith traces).
- Middleware hooks insert additional nodes around model/tool calls rather than wrapping the entire graph.
- `interrupt_before`/`interrupt_after` parameters accept node names (e.g. `["tools"]`) for LangGraph-native interrupts without middleware.

---

## Thread Persistence with Checkpointers

```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


@tool
def get_weather(city: str) -> str:
    """Return current weather for a city."""
    return f"Sunny, 22°C in {city}"


async def main() -> None:
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[get_weather],
        system_prompt="You are a helpful weather assistant.",
        checkpointer=InMemorySaver(),
    )

    thread_cfg = {"configurable": {"thread_id": "user-alice"}}

    # First turn
    result1 = await agent.ainvoke(
        {"messages": [{"role": "user", "content": "What's the weather in Paris?"}]},
        config=thread_cfg,
    )
    print(result1["messages"][-1].content)

    # Second turn — agent remembers Paris was asked
    result2 = await agent.ainvoke(
        {"messages": [{"role": "user", "content": "And in London?"}]},
        config=thread_cfg,
    )
    print(result2["messages"][-1].content)


asyncio.run(main())
```

### Checkpointer options

| Checkpointer | Import | Use case |
|---|---|---|
| `InMemorySaver` | `langgraph.checkpoint.memory` | Development, tests — not persistent across process restarts |
| `AsyncPostgresSaver` | `langgraph.checkpoint.postgres.aio` | Production async; requires `psycopg[pool]` |
| `AsyncSqliteSaver` | `langgraph.checkpoint.sqlite.aio` | Single-server production; simpler ops |

Cross-thread long-term memory (user facts, preferences): pass `store=InMemoryStore()` (or a
persistent store from `langgraph.store`) alongside the checkpointer.

---

## Structured Output — `response_format`

### Strategies

| Strategy | Class | Mechanism | Model requirement |
|---|---|---|---|
| Provider-native | `ProviderStrategy(Schema)` | `json_schema` mode in the provider API | Provider must support native structured output |
| Tool-based | `ToolStrategy(Schema)` | Artificial tool with `tool_choice="any"` | Any tool-calling model |
| Auto (bare schema) | Pass `response_format=MySchema` directly | `ProviderStrategy` if supported, else `ToolStrategy` | Detected at runtime |

> **⚠️ v1.0:** Prompted JSON output ("return JSON matching this schema") was removed in v1 as
> unreliable. Only `ProviderStrategy` and `ToolStrategy` exist.

### Complete example

```python
from __future__ import annotations
import asyncio
from typing import Annotated
from pydantic import BaseModel, Field
from langchain.agents import create_agent
from langchain.agents.structured_output import ProviderStrategy, ToolStrategy
from langchain_core.tools import tool


class TravelPlan(BaseModel):
    destination: str = Field(description="Primary destination city")
    duration_days: int = Field(description="Trip duration in days", ge=1)
    highlights: list[str] = Field(description="Top 3 activities")
    estimated_budget_usd: float = Field(description="Estimated total cost in USD")


@tool
def search_flights(origin: str, destination: str) -> str:
    """Search for available flights between two cities."""
    return f"Found 3 flights from {origin} to {destination}, cheapest $450"


@tool
def get_hotel_rates(city: str, nights: int) -> str:
    """Get hotel rates for a city."""
    return f"Hotels in {city} from $120/night for {nights} nights"


async def main() -> None:
    # ProviderStrategy: use provider-native json_schema mode (Anthropic, OpenAI supported)
    agent = create_agent(
        "claude-sonnet-4-5-20250929",
        tools=[search_flights, get_hotel_rates],
        response_format=ProviderStrategy(TravelPlan),
        system_prompt="You are a travel planning assistant. Always search for flights and hotels.",
    )

    result = await agent.ainvoke({
        "messages": [{"role": "user", "content": "Plan a 5-day trip from NYC to Tokyo"}]
    })

    # Structured result is always in structured_response
    plan: TravelPlan = result["structured_response"]
    print(f"Destination: {plan.destination}")
    print(f"Duration: {plan.duration_days} days")
    print(f"Budget: ${plan.estimated_budget_usd:.2f}")
    print(f"Highlights: {', '.join(plan.highlights)}")


asyncio.run(main())
```

### ToolStrategy `handle_errors` parameter

| Value | Behaviour on parse failure |
|---|---|
| `True` (default) | Retry with error message injected; raises `StructuredOutputValidationError` after max retries |
| `False` | Raise immediately; may silently omit `structured_response` on no-tool-call responses (bug #36349) |
| `str` | Inject the string as error context and retry |
| `Callable[[Exception], str]` | Call the function to generate error context |

```python
from langchain.agents.structured_output import ToolStrategy

strategy = ToolStrategy(
    TravelPlan,
    handle_errors=lambda e: f"Validation failed: {e}. Re-read the schema and try again.",
)
```

### Known structured output issues

| Issue | Affects | Workaround |
|---|---|---|
| Silent `structured_response` omission when model makes no tool call | `handle_errors=False` + `ToolStrategy` (#36349) | Keep `handle_errors=True` (default) |
| Streaming suppression — `tool_choice="any"` prevents pre-tool text chunks (#34818) | `ToolStrategy` + streaming | Use `stream_mode="values"` for state snapshots; accept no token streaming before tool call |
| Dynamic/runtime schemas not supported (#34239) | All strategies | Schema must be static at `create_agent` construction time |

---

## Streaming

```python
from __future__ import annotations
import asyncio
from langchain.agents import create_agent
from langchain_core.tools import tool


@tool
def add(x: int, y: int) -> int:
    """Add two integers."""
    return x + y


async def stream_tokens() -> None:
    agent = create_agent("claude-sonnet-4-5-20250929", tools=[add])

    # stream_mode="messages" → yields (message_chunk, metadata) tuples for token streaming
    async for chunk, metadata in agent.astream(
        {"messages": [{"role": "user", "content": "What is 42 + 58?"}]},
        stream_mode="messages",
    ):
        if hasattr(chunk, "content") and chunk.content:
            print(chunk.content, end="", flush=True)
    print()


async def stream_state_snapshots() -> None:
    agent = create_agent("claude-sonnet-4-5-20250929", tools=[add])

    # stream_mode="values" → yields full AgentState dict at each graph step
    async for state in agent.astream(
        {"messages": [{"role": "user", "content": "What is 42 + 58?"}]},
        stream_mode="values",
    ):
        last_msg = state["messages"][-1]
        print(f"[{last_msg.__class__.__name__}] {getattr(last_msg, 'content', '')[:80]}")


asyncio.run(stream_tokens())
asyncio.run(stream_state_snapshots())
```

`AIMessageChunk` carries a `chunk_position` attribute set to `'last'` on the final chunk —
use this for clean end-of-stream detection instead of checking for empty content.

---

## Using `create_agent` as a Subgraph Node

```python
from __future__ import annotations
from typing import TypedDict
from langchain.agents import create_agent
from langchain_core.messages import AnyMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing import Annotated


@tool
def research(query: str) -> str:
    """Research a topic and return findings."""
    return f"Research findings for: {query}"


@tool
def write_report(findings: str, format: str) -> str:
    """Write a structured report from findings."""
    return f"Report in {format} format: {findings}"


class OrchestratorState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    research_complete: bool


# Each agent carries its own middleware, checkpointer, and middleware hooks
research_agent = create_agent(
    "claude-sonnet-4-5-20250929",
    tools=[research],
    system_prompt="You are a research specialist. Always use the research tool.",
    name="research_agent",
)

writing_agent = create_agent(
    "claude-sonnet-4-5-20250929",
    tools=[write_report],
    system_prompt="You are a technical writer. Produce clear, structured reports.",
    name="writing_agent",
)


def route_after_research(state: OrchestratorState) -> str:
    return "writing" if state.get("research_complete") else END


builder = StateGraph(OrchestratorState)
builder.add_node("research", research_agent)   # CompiledStateGraph used directly as node
builder.add_node("writing", writing_agent)
builder.add_edge(START, "research")
builder.add_conditional_edges("research", route_after_research)
builder.add_edge("writing", END)

orchestrator = builder.compile()
```

---

## Version Compatibility Matrix

| Feature | v0 (`create_react_agent`) | v1 (`create_agent`) |
|---|---|---|
| Import | `from langgraph.prebuilt import create_react_agent` | `from langchain.agents import create_agent` |
| Model node name | `"agent"` | `"model"` |
| Prompt param | `prompt=` (template or str) | `system_prompt=` (str or `SystemMessage`) |
| Pre/post hooks | `pre_model_hook=`, `post_model_hook=` | Middleware (`before_model`, `after_model`) |
| State schema | Pydantic/dataclasses/TypedDict | TypedDict only (subclass of `AgentState`) |
| `ToolNode` in tools | Accepted | Not accepted |
| Structured output | Output parser | `response_format=` |
| Memory | `ConversationBufferMemory` | `checkpointer=` + `thread_id` |
| Status | Deprecated v1.0, removed v2.0 | Stable, no breaking changes until v2.0 |

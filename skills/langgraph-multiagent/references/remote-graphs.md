# Remote Graphs Reference — `RemoteGraph` and `AsyncSubAgent`

## When to use RemoteGraph vs alternatives

| Approach | When to use | When to avoid |
|---|---|---|
| `RemoteGraph` | Specialist deployed independently on Agent Server; you want to invoke it as a graph node from an orchestrator | Same-process agents — adds network latency with no benefit |
| `AsyncSubAgent` (deepagents) | Long-running tasks you want to start non-blocking and poll/cancel; co-deployed via ASGI or remote Agent Protocol servers | Short tasks where the polling overhead exceeds the task duration |
| Subgraph (compiled local) | Agent can live in the same process and codebase | You need independent deploy, separate scaling, or language boundaries |
| Tool composition | Agent is stateless and behaves like an API call | Agent needs multi-turn memory, HITL interrupts, or its own checkpointer |

---

## `RemoteGraph` Class

`RemoteGraph` implements the full `Runnable`/`CompiledGraph` interface — it can be dropped in
as a node in any `StateGraph` exactly like a compiled local graph.

### Constructor

```python
from langgraph.pregel.remote import RemoteGraph

RemoteGraph(
    name: str,              # graph name or assistant ID on the deployment
    *,
    url: str | None = None,           # Agent Server base URL
    api_key: str | None = None,       # LANGSMITH_API_KEY (env var also accepted)
    headers: dict | None = None,      # extra HTTP headers (auth, tenant, etc.)
    client: LangGraphClient | None = None,      # async client (alternative to url)
    sync_client: SyncLangGraphClient | None = None,  # sync client (alternative to url)
    config: RunnableConfig | None = None,
)
```

**Exactly one of** `url`, `client`, or `sync_client` must be provided — omitting all three
raises a `ValueError` at runtime when the graph is first invoked.

### Environment variables

| Variable | Purpose |
|---|---|
| `LANGSMITH_API_KEY` | Default API key for Agent Server authentication |
| `LANGGRAPH_API_KEY` | Alternative; `LANGSMITH_API_KEY` takes precedence |

### Methods

| Method | Signature | Notes |
|---|---|---|
| `.invoke` | `(input, config, **kwargs) -> dict` | Blocking; runs the remote graph to completion |
| `.ainvoke` | `async (input, config, **kwargs) -> dict` | Async version |
| `.stream` | `(input, config, stream_mode, **kwargs) -> Iterator` | Streams events; `stream_mode="values"\|"updates"\|"events"` |
| `.astream` | `async (input, config, ...) -> AsyncIterator` | Async stream |
| `.get_state` | `(config) -> StateSnapshot` | Fetch current thread state |
| `.update_state` | `(config, values, as_node) -> RunnableConfig` | Inject state (HITL) |

---

## Complete Usage Example — Orchestrator with Two Remote Specialists

```python
from __future__ import annotations

import os
from typing import Literal

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, SystemMessage
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.pregel.remote import RemoteGraph
from langgraph.types import Command
from pydantic import BaseModel

# ── Remote graph wiring ───────────────────────────────────────────────────────

AGENT_SERVER_URL = os.environ["AGENT_SERVER_URL"]  # e.g. https://api.smith.langchain.com

research_remote = RemoteGraph(
    "research_agent",
    url=AGENT_SERVER_URL,
    api_key=os.environ["LANGSMITH_API_KEY"],
)

coding_remote = RemoteGraph(
    "coding_agent",
    url=AGENT_SERVER_URL,
    api_key=os.environ["LANGSMITH_API_KEY"],
)

# ── Orchestrator ──────────────────────────────────────────────────────────────

llm = ChatAnthropic(model="claude-sonnet-4-6")


class Route(BaseModel):
    next: Literal["research", "coding", "FINISH"]


def orchestrator(state: MessagesState) -> Command[Literal["research", "coding", "__end__"]]:
    route = llm.with_structured_output(Route).invoke(
        [SystemMessage("Route to research or coding specialist, or FINISH.")] + state["messages"]
    )
    if route.next == "FINISH":
        return Command(goto=END)
    return Command(goto=route.next)


def research_node(state: MessagesState) -> Command[Literal["orchestrator"]]:
    # Thread ID on the remote graph — create a thread per conversation for persistence
    remote_config = {"configurable": {"thread_id": state["messages"][0].id}}
    result = research_remote.invoke(state, config=remote_config)
    return Command(
        update={"messages": [AIMessage(content=result["messages"][-1].content, name="research")]},
        goto="orchestrator",
    )


def coding_node(state: MessagesState) -> Command[Literal["orchestrator"]]:
    remote_config = {"configurable": {"thread_id": state["messages"][0].id}}
    result = coding_remote.invoke(state, config=remote_config)
    return Command(
        update={"messages": [AIMessage(content=result["messages"][-1].content, name="coding")]},
        goto="orchestrator",
    )


# ── Graph assembly ────────────────────────────────────────────────────────────

builder = StateGraph(MessagesState)
builder.add_node("orchestrator", orchestrator)
builder.add_node("research", research_node)
builder.add_node("coding", coding_node)
builder.add_edge(START, "orchestrator")

graph = builder.compile(recursion_limit=40)
```

---

## Thread Persistence with RemoteGraph

Runs are **stateless by default** — a new thread is created per `.invoke()` call. To persist
state across turns, create a thread and pass the `thread_id` via config:

```python
from __future__ import annotations

import os

from langchain_langgraph_sdk import get_client  # type: ignore[import]

from langgraph.pregel.remote import RemoteGraph

remote = RemoteGraph(
    "my_agent",
    url=os.environ["AGENT_SERVER_URL"],
    api_key=os.environ["LANGSMITH_API_KEY"],
)

# Stateful multi-turn usage
config = {"configurable": {"thread_id": "user-42-session-7"}}

turn_1 = remote.invoke(
    {"messages": [{"role": "user", "content": "What is LangGraph?"}]},
    config=config,
)

turn_2 = remote.invoke(
    {"messages": [{"role": "user", "content": "Give me a code example."}]},
    config=config,   # same thread_id — remote agent sees full history
)
```

---

## Error Handling and Fallbacks

Network and remote failures surface as exceptions. Wrap with `.with_fallbacks()` for
graceful degradation, or add node-level retries.

```python
from __future__ import annotations

import os

from langchain_core.runnables import RunnableLambda
from langgraph.pregel.remote import RemoteGraph

remote = RemoteGraph(
    "specialist_agent",
    url=os.environ["AGENT_SERVER_URL"],
    api_key=os.environ["LANGSMITH_API_KEY"],
)


def fallback_fn(input_: dict) -> dict:
    """Simple local fallback when remote is unavailable."""
    return {
        "messages": [
            {
                "role": "assistant",
                "content": "Remote specialist unavailable. Please try again later.",
            }
        ]
    }


# Wrap with a fallback runnable
safe_remote = remote.with_fallbacks(
    [RunnableLambda(fallback_fn)],
    exceptions_to_handle=(ConnectionError, TimeoutError, RuntimeError),
)
```

### Node-level retry with exponential backoff

```python
from __future__ import annotations

import asyncio
import os
from collections.abc import Callable
from typing import Any

from langgraph.pregel.remote import RemoteGraph


async def invoke_with_retry(
    graph: RemoteGraph,
    input_: dict,
    config: dict,
    *,
    max_retries: int = 3,
    base_delay: float = 1.0,
) -> dict:
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            return await graph.ainvoke(input_, config=config)
        except (ConnectionError, TimeoutError) as exc:
            last_exc = exc
            await asyncio.sleep(base_delay * (2**attempt))
    raise RuntimeError(f"Remote graph failed after {max_retries} retries") from last_exc
```

---

## Distributed Tracing

`RemoteGraph` propagates LangSmith trace context automatically when `LANGSMITH_API_KEY` is
set and LangSmith tracing is enabled. Sub-agent runs appear as nested spans under the
orchestrator's root trace. To scope traces in deepagents CLI contexts:

```bash
export DEEPAGENTS_CODE_LANGSMITH_API_KEY="ls__..."
```

---

## `AsyncSubAgent` (deepagents v0.5+)

> **Status: preview (v0.5, April 7 2026).** APIs may change. Available in deepagents ≥0.5.

`AsyncSubAgent` runs on remote Agent Protocol servers via the LangGraph SDK. Unlike
`RemoteGraph`, it returns a task ID immediately (non-blocking) and gives the supervisor five
management tools: `start_async_task`, `check_async_task`, `update_async_task`,
`cancel_async_task`, `list_async_tasks`.

```python
from __future__ import annotations

from deepagents import AsyncSubAgent, create_deep_agent

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    subagents=[
        AsyncSubAgent(
            name="researcher",
            description="Background research tasks — runs non-blocking.",
            graph_id="researcher",
            # url=None → ASGI transport (co-deployed same process, zero network overhead)
        ),
        AsyncSubAgent(
            name="coder",
            description="Code generation and review.",
            graph_id="coder",
            url="https://coder-deployment.langsmith.dev",  # HTTP transport for remote deploy
            headers={"Authorization": "Bearer sk-..."},    # custom auth for self-hosted
        ),
    ],
)
```

### `AsyncSubAgent` vs `RemoteGraph` comparison

| Dimension | `AsyncSubAgent` | `RemoteGraph` |
|---|---|---|
| Transport | ASGI (co-located) or HTTP | HTTP only |
| Blocking | Non-blocking (returns task ID) | Blocking (`.invoke`) or streaming |
| Task management | start/check/update/cancel via supervisor tools | Manual via `.invoke`/`.update_state` |
| Task metadata persistence | `async_tasks` state channel (survives summarization) | Not natively managed |
| Auth | Automatic via env vars for LangGraph Platform | Explicit `api_key` / `headers` |
| Integration | deepagents `create_deep_agent` only | Any `StateGraph` node |
| Status | Preview (v0.5) | Stable |

### Co-deployment registration (`langgraph.json`)

```json
{
  "graphs": {
    "orchestrator": "./src/orchestrator/graph.py:graph",
    "researcher": "./src/researcher/graph.py:graph",
    "coder": "./src/coder/graph.py:graph"
  },
  "python_version": "3.11"
}
```

Co-deployed graphs are registered by `graph_id` in `langgraph.json`. Omitting `url` in
`AsyncSubAgent` tells the deepagents runtime to use ASGI in-process transport — zero network
overhead for co-located agents.

---

## Production Gotchas

| Failure mode | Root cause | Fix |
|---|---|---|
| `ValueError` on first invoke | No `url`, `client`, or `sync_client` provided | Always supply exactly one connection option |
| Remote state not persisted across turns | Missing `thread_id` in config | Pass `config={"configurable": {"thread_id": "..."}}` to all calls |
| Trace gap between orchestrator and remote span | `LANGSMITH_API_KEY` not set in remote environment | Ensure env var in both orchestrator and remote deployments |
| Async task metadata lost after summarization | Using regular `SubAgentMiddleware` | Switch to `AsyncSubAgentMiddleware` — tasks stored in `async_tasks` channel |
| Co-deployed ASGI transport fails | Graph ID not registered in `langgraph.json` | Add all co-deployed graph IDs to `langgraph.json` `graphs` key |

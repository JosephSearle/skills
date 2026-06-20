# HITL and Streaming Reference — LangGraph 1.x

## HITL Pattern Decision Table

| Pattern | When to use | Tradeoff |
|---|---|---|
| `compile(interrupt_before=["node"])` | Always pause before a specific node; static, known at build time | Simple; inflexible — fires every time, can't be conditional |
| `compile(interrupt_after=["node"])` | Always pause after a node produces output, before routing | Same simplicity/inflexibility as `interrupt_before` |
| `runtime interrupt()` inside a node | Conditional/dynamic pauses; payload-driven human decisions | Node re-runs from start on resume — pre-interrupt code must be deterministic |
| `update_state` + `stream(None, config)` | Edit state before resume without full node re-run | Requires care with reducers and `as_node=`; can clobber interrupts if misused |

---

## compile-time Breakpoints

```python
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.checkpoint.memory import InMemorySaver

builder = StateGraph(MessagesState)
builder.add_node("agent", agent_fn)
builder.add_node("tool_node", tool_fn)
builder.add_node("review", review_fn)
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_use_tool, {"tool": "tool_node", "end": END})
builder.add_edge("tool_node", "agent")

# Static breakpoint: always pause before "tool_node"
graph = builder.compile(
    checkpointer=InMemorySaver(),
    interrupt_before=["tool_node"],
    # OR: interrupt_after=["agent"]
    # OR: interrupt_before="all"   (pause before every node)
)

config = {"configurable": {"thread_id": "t1"}}

# First run — stops before tool_node
for event in graph.stream({"messages": [HumanMessage(content="search X")]}, config):
    print(event)

# Inspect state
state = graph.get_state(config)
print(state.next)  # ('tool_node',)

# Resume — pass None as input; graph resumes from where it paused
for event in graph.stream(None, config):
    print(event)
```

---

## Runtime interrupt()

`from langgraph.types import interrupt`

### Core pattern

```python
from __future__ import annotations

from typing import Any
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import interrupt, Command


def approval_node(state: MessagesState) -> Command:
    """Pause and ask a human to approve or reject."""
    last_msg = state["messages"][-1]
    # interrupt() raises GraphInterrupt; the payload is surfaced to the caller
    # On resume, interrupt() returns the value passed to Command(resume=...)
    decision: str = interrupt({
        "question": "Approve this action?",
        "action": last_msg.content,
        "options": ["yes", "no"],
    })
    return Command(
        goto="execute" if decision == "yes" else "cancel",
        update={"status": decision},
    )


builder = StateGraph(MessagesState)
builder.add_node("approval", approval_node)
builder.add_node("execute", execute_fn)
builder.add_node("cancel", cancel_fn)
builder.add_edge(START, "approval")
builder.add_edge("execute", END)
builder.add_edge("cancel", END)

graph = builder.compile(checkpointer=InMemorySaver())
config = {"configurable": {"thread_id": "approval-demo"}}

# First invocation — runs until interrupt
for event in graph.stream({"messages": [HumanMessage(content="delete /tmp")]}, config):
    if "__interrupt__" in event:
        interrupted = event["__interrupt__"]
        print("Interrupted:", interrupted[0].value)

# Resume with human decision
# Command(resume=...) is the ONLY input pattern intended for resuming interrupts
for event in graph.stream(Command(resume="yes"), config):
    print(event)
```

### interrupt() rules

| Rule | Detail |
|---|---|
| Never wrap in try/except | `interrupt()` raises `GraphInterrupt` (a `BaseException` subclass); catching it would prevent the checkpoint from being written |
| Node re-runs on resume | All code before `interrupt()` executes again; wrap side-effects in `@task` so they're checkpointed and skipped on re-run |
| Must use same thread_id | The `thread_id` in config must match between the interrupted run and the resume |
| Return value = resume value | The value passed to `Command(resume=value)` becomes the return value of `interrupt()` |
| Requires checkpointer | `interrupt()` without a checkpointer raises at runtime |

### Wrapping side-effects in @task for deterministic re-run

```python
from langgraph.func import task
from langgraph.types import interrupt, Command
from langgraph.graph import MessagesState


@task
def expensive_fetch(url: str) -> dict:
    """This runs once and is checkpointed; skipped on re-run after interrupt."""
    import httpx
    return httpx.get(url).json()


def review_node(state: MessagesState) -> Command:
    # @task result is checkpointed — not re-fetched on resume
    data = expensive_fetch("https://api.example.com/data").result()
    decision = interrupt({"data": data, "action": "approve?"})
    return Command(
        goto="process" if decision else "skip",
        update={"fetched_data": data, "approved": decision},
    )
```

---

## Tool-Call Approve/Reject Pattern

```python
from __future__ import annotations

from typing import Any
from langchain_core.messages import HumanMessage, ToolMessage
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import interrupt, Command


def human_review_node(state: MessagesState) -> Command:
    """Inspect the last tool call and approve, reject, or rewrite args."""
    last_msg = state["messages"][-1]
    tool_calls = last_msg.tool_calls  # list of tool call dicts

    action = interrupt({
        "question": "Review tool calls",
        "tool_calls": tool_calls,
        "options": ["approve", "reject", "rewrite"],
    })

    if action["decision"] == "approve":
        return Command(goto="tool_node")

    elif action["decision"] == "reject":
        # Inject a synthetic ToolMessage refusing the call
        tool_call_id = tool_calls[0]["id"]
        return Command(
            goto="agent",
            update={
                "messages": [
                    ToolMessage(
                        content="User rejected this action.",
                        tool_call_id=tool_call_id,  # MUST preserve original id
                    )
                ]
            },
        )

    elif action["decision"] == "rewrite":
        # Replace the tool call args while preserving the tool_call_id
        from langchain_core.messages import AIMessage
        import copy
        modified_msg = copy.deepcopy(last_msg)
        modified_msg.tool_calls[0]["args"] = action["new_args"]
        return Command(
            goto="tool_node",
            update={"messages": [modified_msg]},
        )
    else:
        raise ValueError(f"Unknown decision: {action['decision']}")
```

---

## Editing State Before Resume

```python
# Edit state mid-interrupt without re-running the node
config = {"configurable": {"thread_id": "t1"}}

# Modify a state value (reducers are applied as if as_node produced the update)
graph.update_state(
    config,
    values={"risk_score": 0.1, "override_reason": "reviewed by admin"},
    as_node="risk_classifier",
)

# Resume — pass None; graph continues from where it paused
for event in graph.stream(None, config):
    print(event)
```

---

## Multiple Interrupts

Multiple parallel branches can each call `interrupt()` in one super-step; multiple
`Interrupt` objects accumulate in the `__interrupt__` event.

```python
# Resume multiple interrupts — map each interrupt's id to its resume value
pending = event["__interrupt__"]
resume_map = {intr.id: "approved" for intr in pending}
for event in graph.stream(Command(resume=resume_map), config):
    print(event)
```

> **⚠️ Known bugs (version-specific):**
> - **#6626:** Parallel tool nodes can generate identical interrupt IDs, making them
>   indistinguishable. Confirm fixed status against your installed version.
> - **#4028:** "Unable to resume multiple interrupts from a single graph invoke" — affects
>   some 1.x patch versions. Verify against your installed version before relying on
>   multi-interrupt resume.

### Interrupt class (v1.0 simplified)

| Field | v1.0 (current) | Pre-1.0 (removed) |
|---|---|---|
| `value` | payload returned by `interrupt()` | same |
| `id` | unique identifier for this interrupt | — |
| `resumable` | removed | was bool |
| `ns` | removed | was namespace tuple |
| `when` | removed | was timing hint |
| `interrupt_id` | renamed to `id` | old name, deprecated |

---

## stream_mode — All 7 Values

`graph.stream(input, config, stream_mode=...)` / `graph.astream(...)`

| Mode | Emits | Payload shape | Use when |
|---|---|---|---|
| `"values"` | Full state dict after each super-step | `{"node_name": state_dict}` | Need complete snapshot at each step |
| `"updates"` | Per-node state deltas only | `{"node_name": delta_dict}` | Dashboards, progress bars; lower volume than `values` |
| `"messages"` | LLM token chunks as `(AIMessageChunk, metadata)` tuples | `(AIMessageChunk, {"langgraph_node": "...", ...})` | Token-by-token streaming for chat UIs |
| `"custom"` | Data pushed via `StreamWriter` inside a node | whatever you pass to `writer(...)` | In-node progress signals, partial results |
| `"debug"` | Checkpoints + tasks + rich metadata | verbose dict per event | Deep debugging; not for production UIs |
| `"checkpoints"` | Checkpoint write events | checkpoint event dict | Observing persistence; audit trails |
| `"tasks"` | Task start and finish events | task event dict | Tracing node scheduling; latency measurement |

> **Note:** `"messages-tuple"` is an additional mode available in some 1.x builds for
> structured message projection. Classic `"messages"` is the stable baseline.

### Combining stream_mode values

```python
# Combine modes — get both token streaming AND state deltas
async for event in graph.astream(
    {"messages": [HumanMessage(content="tell me a joke")]},
    config,
    stream_mode=["messages", "updates"],
):
    # event is a tuple: (mode_name, payload)
    mode, payload = event
    if mode == "messages":
        chunk, meta = payload
        print(chunk.content, end="", flush=True)
    elif mode == "updates":
        print("\nState update:", payload)
```

---

## Streaming Examples

### values mode

```python
import asyncio
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.checkpoint.memory import InMemorySaver


async def run_values() -> None:
    # ... build graph ...
    config = {"configurable": {"thread_id": "demo"}}
    async for state in graph.astream(
        {"messages": [HumanMessage(content="hello")]},
        config,
        stream_mode="values",
    ):
        # state is the full state dict after each super-step
        print("state:", state["messages"][-1].content)
```

### messages mode (token streaming)

```python
async def run_messages() -> None:
    config = {"configurable": {"thread_id": "demo"}}
    async for chunk, metadata in graph.astream(
        {"messages": [HumanMessage(content="write a poem")]},
        config,
        stream_mode="messages",
    ):
        # chunk is an AIMessageChunk; metadata contains node info
        if chunk.content:
            print(chunk.content, end="", flush=True)
        if metadata.get("langgraph_node") == "agent":
            pass  # filter by node if needed
    print()
```

### custom mode via StreamWriter

```python
from langgraph.config import get_stream_writer
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.checkpoint.memory import InMemorySaver


async def long_running_node(state: MessagesState) -> dict:
    writer = get_stream_writer()
    writer({"progress": 0.0, "status": "starting"})
    # ... do work ...
    writer({"progress": 0.5, "status": "halfway"})
    # ... more work ...
    writer({"progress": 1.0, "status": "done"})
    return {"messages": []}


async def consume_custom() -> None:
    config = {"configurable": {"thread_id": "progress-demo"}}
    async for event in graph.astream(
        {"messages": []},
        config,
        stream_mode="custom",
    ):
        print("Progress:", event)
```

### Injecting StreamWriter as parameter

```python
from typing import Annotated
from langgraph.types import StreamWriter
from langgraph.prebuilt import InjectedWriter  # or use get_stream_writer()


async def node_with_writer(
    state: MessagesState,
    writer: Annotated[StreamWriter, InjectedWriter],
) -> dict:
    writer({"event": "started", "count": len(state["messages"])})
    return {"messages": []}
```

---

## astream_events

`graph.astream_events(input, config, *, version="v2", ...)` — yields dicts following the
LangChain Runnable events protocol. LangGraph nodes/CompiledStateGraph surface as `chain`
events.

### astream_events signature

```python
# Full signature
async for event in graph.astream_events(
    input,
    config=None,
    *,
    version="v2",                # "v1" (deprecated) or "v2"
    include_names=None,          # list[str] — filter by node/chain name
    include_types=None,          # list[str] — e.g. ["chat_model", "tool"]
    include_tags=None,           # list[str]
    exclude_names=None,
    exclude_types=None,
    exclude_tags=None,
):
    pass
```

### Event keys

| Key | Type | Description |
|---|---|---|
| `event` | `str` | Event type string (see table below) |
| `name` | `str` | Name of the component (node name, model name, tool name) |
| `run_id` | `str` | UUID for this run instance |
| `parent_ids` | `list[str]` | Parent run IDs (for nested tracing) |
| `tags` | `list[str]` | Associated tags |
| `metadata` | `dict` | Includes `langgraph_node`, `langgraph_step`, etc. |
| `data` | `dict` | Event-specific payload |

### Event type strings

| Event | When fired |
|---|---|
| `on_chain_start` | Node/graph starts executing |
| `on_chain_stream` | Node/graph yields a streaming chunk |
| `on_chain_end` | Node/graph finishes |
| `on_chat_model_start` | LLM call begins |
| `on_chat_model_stream` | LLM token emitted |
| `on_chat_model_end` | LLM call completes |
| `on_llm_start` / `on_llm_stream` / `on_llm_end` | Non-chat LLM equivalent |
| `on_tool_start` / `on_tool_end` | Tool invocation (no stream event for tools) |
| `on_retriever_start` / `on_retriever_end` | Retriever invocation |
| `on_prompt_start` / `on_prompt_end` | Prompt template rendering |
| `on_custom_event` | Custom events pushed via `astream_events` dispatch |

```python
from __future__ import annotations

from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, MessagesState


async def trace_llm_tokens() -> None:
    """Stream only LLM tokens from the graph using astream_events."""
    config = {"configurable": {"thread_id": "trace-demo"}}
    async for event in graph.astream_events(
        {"messages": [HumanMessage(content="explain recursion")]},
        config,
        version="v2",
        include_types=["chat_model"],
    ):
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            print(chunk.content, end="", flush=True)
    print()
```

---

## Subgraph Streaming

By default, streaming a parent graph does not propagate subgraph internal events.
Pass `subgraphs=True` to expose them.

```python
async def stream_with_subgraphs() -> None:
    config = {"configurable": {"thread_id": "sub-demo"}}
    async for event in graph.astream(
        inputs,
        config,
        stream_mode="updates",
        subgraphs=True,
    ):
        # event is (namespace_tuple, update_dict)
        namespace, update = event
        if namespace:
            print(f"subgraph {namespace}:", update)
        else:
            print("parent:", update)
```

> **⚠️ Known issue #3362:** when a subgraph uses `Command` for routing, the final subgraph
> node's output may not appear in the parent stream. Confirm against your installed version.

---

## API Surface Table — HITL and Streaming

| Function / class | Import | Key params | Returns |
|---|---|---|---|
| `interrupt(value)` | `langgraph.types` | `value: Any` (JSON-serializable) | Any — the resume value on re-run |
| `Command` | `langgraph.types` | `goto`, `update`, `resume`, `graph` | node return / stream input |
| `Command.PARENT` | `langgraph.types` | — | sentinel for parent graph routing |
| `GraphInterrupt` | `langgraph.errors` | — | exception raised by `interrupt()` |
| `get_stream_writer()` | `langgraph.config` | — | `StreamWriter` callable |
| `InjectedWriter` | `langgraph.prebuilt` | — | annotation for node writer injection |
| `graph.stream()` | — | `input`, `config`, `stream_mode`, `subgraphs` | `Iterator` |
| `graph.astream()` | — | `input`, `config`, `stream_mode`, `subgraphs` | `AsyncIterator` |
| `graph.astream_events()` | — | `input`, `config`, `version`, `include_*`, `exclude_*` | `AsyncIterator[dict]` |

---

## Production Gotchas

| Gotcha | Detail | Fix |
|---|---|---|
| `try/except` around `interrupt()` | Swallows `GraphInterrupt`; checkpoint not written; graph appears to hang | Never catch `interrupt()`; let it propagate |
| Pre-interrupt code re-executes | Any side-effects (API calls, DB writes) before `interrupt()` fire again on resume | Wrap in `@task`; tasks are checkpointed and skipped on re-run |
| Wrong `thread_id` on resume | `Command(resume=...)` with a different `thread_id` starts a new thread instead of resuming | Always reuse the exact same `thread_id` config dict |
| `update_state` clobbering interrupts | `update_state(values={...})` without `as_node=` can overwrite pending interrupt state | Always pass `as_node=` when updating mid-interrupt |
| Tool-call ID mismatch | Rewriting a tool call without preserving `tool_call_id` breaks the LLM's tool loop | Copy the original `id` from `last_msg.tool_calls[0]["id"]` |
| `stream_mode="messages"` with non-LLM nodes | Emits nothing for nodes that don't call an LLM | Combine with `"updates"` to also see non-LLM node outputs |
| Subgraph events not appearing | Default streaming only shows parent graph events | Pass `subgraphs=True` to `stream`/`astream` |
| Multiple interrupt IDs colliding | Parallel tool branches may generate duplicate interrupt IDs (#6626) | Verify fix status; avoid multi-interrupt parallel patterns until confirmed fixed |

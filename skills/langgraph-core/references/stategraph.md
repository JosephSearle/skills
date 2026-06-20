# StateGraph Reference — LangGraph 1.x

## StateGraph Constructor

### Import

```python
from langgraph.graph import StateGraph, START, END, MessagesState, add_messages
```

### Signature (1.x)

```python
StateGraph(
    state_schema,           # TypedDict | Pydantic BaseModel | dataclass
    *,
    context_schema=None,    # run-scoped immutable context (user_id, db_conn, etc.)
    input_schema=None,      # subset of state_schema to accept as invoke() input
    output_schema=None,     # subset of state_schema to surface in invoke() output
)
```

### config_schema → context_schema Migration

> **⚠️ v0.6.0:** `config_schema=` was deprecated. Use `context_schema=` for run-scoped
> immutable context. Soft-removed target: v2.0.0. Both still work in 1.x — the old kwarg
> is silently routed to `context_schema` internally.

| Old (deprecated since v0.6.0) | New (v1.x standard) |
|---|---|
| `StateGraph(State, config_schema=RunConfig)` | `StateGraph(State, context_schema=RunConfig)` |
| `config["configurable"]["user_id"]` | `context["user_id"]` (via injected context arg) |

```python
# DEPRECATED — do not write new code this way
from typing import TypedDict
from langgraph.graph import StateGraph

class RunConfig(TypedDict):
    user_id: str

class State(TypedDict):
    question: str

builder = StateGraph(State, config_schema=RunConfig)  # deprecated

def my_node(state: State, config: dict) -> dict:
    user_id = config["configurable"]["user_id"]       # deprecated access pattern
    return {"question": f"{user_id}: {state['question']}"}
```

```python
# CURRENT — use context_schema
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

class Context(TypedDict):
    user_id: str
    tenant: str

class State(TypedDict):
    question: str
    answer: str

builder = StateGraph(State, context_schema=Context)

def my_node(state: State, context: Context) -> dict:
    # context is injected as second positional arg when context_schema is set
    return {"answer": f"[{context['user_id']}] answered: {state['question']}"}

builder.add_node("answer", my_node)
builder.add_edge(START, "answer")
builder.add_edge("answer", END)
```

---

## State Schema Options

| Schema type | Pros | Cons |
|---|---|---|
| `TypedDict` | Lightweight, no runtime overhead, great mypy/pyright support | No validation, no field defaults |
| Pydantic `BaseModel` | Runtime validation, field defaults, coercion | ~10–20% overhead per state update; must use `model_fields_set` pattern |
| `dataclass` | Field defaults, `__post_init__` hooks | Mutation footgun (LangGraph copies on update) |

**Recommendation:** use `TypedDict` for most graphs; use Pydantic `BaseModel` only when
you need runtime input validation on `invoke()` inputs.

---

## Reducers

Each state key may carry a reducer via `Annotated[T, reducer_fn]`. Without a reducer,
incoming updates **overwrite** the existing value.

### Reducer decision table

| Reducer | When to use | Tradeoff |
|---|---|---|
| None (default overwrite) | Simple scalar values: `status`, `score`, `last_response` | Simplest; loses previous value |
| `operator.add` | Append-only lists: log entries, trace spans | Never deduplicates; unbounded growth |
| `add_messages` | Message lists in chat/agent graphs | Appends AND deduplicates by message ID; correct for tool-calling loops |
| Custom `def reducer(current, update)` | Merge dicts, compute running totals, set operations | Full control; must handle `None` current on first write |

### add_messages — critical behaviour

`add_messages` (`from langgraph.graph.message import add_messages`) does **two** things:

1. **Appends** new messages that have a new or absent `id`
2. **Replaces in-place** any message whose `id` matches an existing message's `id`

This is essential in tool-calling loops: the LLM emits an `AIMessage` with `tool_calls`;
the tool node returns a `ToolMessage` with the matching `tool_call_id` as its `id`; the
loop completes correctly because both messages accumulate without duplication.

```python
from typing import Annotated, TypedDict
from operator import add
from langchain_core.messages import AnyMessage, AIMessage, HumanMessage
from langgraph.graph.message import add_messages

# Append behaviour — two messages with different ids → both kept
msgs_before = [HumanMessage(content="hello", id="1")]
update = [AIMessage(content="hi", id="2")]
# Result: [HumanMessage(id="1"), AIMessage(id="2")]

# Dedup behaviour — same id → in-place replace
msgs_before = [AIMessage(content="old", id="99")]
update = [AIMessage(content="new", id="99")]
# Result: [AIMessage(content="new", id="99")]
```

### Full reducer example with all patterns

```python
from typing import Annotated, TypedDict
from operator import add
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


def merge_dicts(left: dict | None, right: dict | None) -> dict:
    """Merge two dicts; handle None on first write."""
    left, right = left or {}, right or {}
    return {**left, **right}


def bounded_add(left: list | None, right: list | None) -> list:
    """Append but cap at 100 items."""
    combined = (left or []) + (right or [])
    return combined[-100:]


class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]   # dedup + append
    log_entries: Annotated[list[str], add]                # plain append
    meta: Annotated[dict, merge_dicts]                    # dict merge
    recent_tokens: Annotated[list[int], bounded_add]      # capped append
    status: str                                           # overwrite (no reducer)
```

---

## MessagesState

Pre-built convenience class with a single `messages` key using `add_messages`.
Subclass to add fields.

```python
from typing import Annotated
from langchain_core.messages import AnyMessage
from langgraph.graph import MessagesState, StateGraph, START, END

# MessagesState is equivalent to:
# class MessagesState(TypedDict):
#     messages: Annotated[list[AnyMessage], add_messages]

class AgentState(MessagesState):
    """Extend MessagesState with application fields."""
    user_id: str
    tool_results: Annotated[list[dict], lambda l, r: (l or []) + (r or [])]
    iteration_count: int   # overwrite — caller tracks this
```

---

## add_node — Full Signature

All 9 keyword arguments (LangGraph 1.x):

```python
builder.add_node(
    node,                    # str name OR the callable (name inferred from fn.__name__)
    action=None,             # callable — required when node is a str name
    *,
    defer=False,             # bool: run only AFTER all parallel branches in the
                             #   current super-step finish (fan-in synchronization)
    metadata=None,           # dict[str, Any] — attached to checkpoint metadata
    input_schema=None,       # per-node input TypedDict/BaseModel (narrows state view)
    retry_policy=None,       # RetryPolicy | Sequence[RetryPolicy]
    cache_policy=None,       # CachePolicy(ttl=N) — deterministic nodes only
    error_handler=None,      # callable(state, NodeError) -> Command
                             #   runs after all retries are exhausted
    destinations=None,       # dict[str, str] | tuple[str, ...] — rendering hint only,
                             #   NO runtime routing effect
    timeout=None,            # float | timedelta | TimeoutPolicy (async nodes ONLY)
                             #   raises NodeTimeoutError; sync nodes: compile-time error
)
```

### add_node examples

```python
from datetime import timedelta
from langgraph.types import RetryPolicy, CachePolicy
from langgraph.errors import NodeError
from langgraph.types import Command


# Minimal — name inferred from function
builder.add_node(my_async_node)


# Full production node with retry + error handler + timeout
def payment_error_handler(state: State, error: NodeError) -> Command:
    return Command(
        update={"status": f"payment_failed: {error.error}"},
        goto="compensate",
    )


builder.add_node(
    "charge_payment",
    charge_payment_async,
    retry_policy=RetryPolicy(
        max_attempts=3,
        backoff_factor=2.0,
        initial_interval=1.0,
        retry_on=ConnectionError,
    ),
    error_handler=payment_error_handler,
    timeout=timedelta(seconds=30),   # async node only
    metadata={"team": "billing"},
)


# Deferred fan-in node — runs after all parallel branches complete
builder.add_node("aggregate", aggregate_fn, defer=True)


# Cached deterministic node
builder.add_node(
    "embed_query",
    embed_fn,
    cache_policy=CachePolicy(ttl=300),   # 5 min TTL
)
```

---

## Edge Types

| Edge type | Method | When to use |
|---|---|---|
| Unconditional | `add_edge(src, dst)` | Always route src → dst |
| Conditional single target | `add_conditional_edges(src, fn)` | `fn(state)` returns one node name |
| Conditional multi-target | `add_conditional_edges(src, fn)` | `fn(state)` returns list of names (fan-out) |
| Dynamic Send | `add_conditional_edges(src, fn)` | `fn(state)` returns `list[Send]` for map-reduce |
| Mixed | `add_conditional_edges(src, fn)` | `fn(state)` returns mixed `str | Send | list[str | Send]` |

```python
from langgraph.graph import StateGraph, START, END
from langgraph.types import Command, Send


# Unconditional
builder.add_edge(START, "ingest")
builder.add_edge("ingest", "process")


# Conditional — path_map improves visualization
def route(state: State) -> str:
    return "tool_node" if state["messages"][-1].tool_calls else END

builder.add_conditional_edges(
    "agent",
    route,
    path_map={"tool_node": "tool_node", END: END},  # str keys required for Mermaid
)


# Map-reduce fan-out via Send
def fan_out(state: State) -> list[Send]:
    return [Send("worker", {"item": x}) for x in state["items"]]

builder.add_conditional_edges("dispatch", fan_out)


# Mixed: some items to a node, others via Send
def smart_route(state: State) -> list[str | Send]:
    routes: list[str | Send] = []
    for item in state["items"]:
        if item["urgent"]:
            routes.append(Send("fast_worker", {"item": item}))
        else:
            routes.append("slow_queue")
    return routes

builder.add_conditional_edges("router", smart_route)
```

### START / END sentinels

`START` and `END` are interned string sentinels (`"__start__"` / `"__end__"`). They are
never executed. Use them in `add_edge` / `add_conditional_edges`. The legacy
`set_entry_point()` / `set_finish_point()` are equivalent and still work in 1.x, but
`START`/`END` are the current convention.

---

## Command and Routing

`from langgraph.types import Command, Send`

### Command fields

| Field | Type | Purpose |
|---|---|---|
| `goto` | `str \| list[str] \| Send \| list[Send]` | Next node(s) — replaces the need for a conditional edge |
| `update` | `dict \| list[tuple]` | State delta, applied exactly as a plain dict return |
| `resume` | `Any` | Value to resume a paused `interrupt()` — use only as **input** to `invoke`/`stream` |
| `graph` | `None \| str \| Command.PARENT` | Target graph; `Command.PARENT` hands off to the nearest parent |

Return `Command` when you want to **combine** a state update with dynamic routing in
a single node return. Return a plain `dict` when routing is handled by edges.

Type-hint with `Command[Literal["a", "b"]]` so visualization and type-checkers can
verify possible destinations.

```python
from typing import Literal
from langgraph.types import Command
from langgraph.graph import END


def router(state: State) -> Command[Literal["agent_b", "__end__"]]:
    nxt = "agent_b" if state["score"] < 0.5 else END
    return Command(goto=nxt, update={"visited": state.get("visited", []) + ["router"]})
```

### Command.PARENT — subgraph handoff

```python
from langgraph.types import Command


def subgraph_node(state: SubState) -> Command:
    # Route back to parent and update a shared (reducer-backed) key
    return Command(
        graph=Command.PARENT,
        goto="parent_next_node",
        update={"shared_results": [state["result"]]},  # key must have reducer in parent
    )
```

> **⚠️ Known issue #6409:** `Command(goto=..., graph=Command.PARENT)` from a node nested
> **3 or more graph levels deep** can raise `langgraph.errors.ParentCommand`. Confirmed
> present in some 1.x patch versions — verify against your installed version before
> relying on deep nesting with PARENT handoffs.

### Send — map-reduce fan-out

`Send` schedules a node with a **custom** state dict distinct from the main graph state.
All Sends in one `add_conditional_edges` return run concurrently in one super-step.
Merge results back to the parent via a reducer (e.g. `operator.add`).

```python
from typing import Annotated, TypedDict
from operator import add
from langgraph.types import Send
from langgraph.graph import StateGraph, START, END


class MapState(TypedDict):
    items: list[str]
    results: Annotated[list[str], add]   # reducer collects worker outputs


class WorkerState(TypedDict):
    item: str


def dispatch(state: MapState) -> list[Send]:
    return [Send("worker", WorkerState(item=x)) for x in state["items"]]


def worker(state: WorkerState) -> dict:
    return {"results": [state["item"].upper()]}


def gather(state: MapState) -> dict:
    return {"results": state["results"]}  # already merged by reducer


builder: StateGraph = StateGraph(MapState)
builder.add_node("worker", worker)
builder.add_node("gather", gather)
builder.add_edge(START, "gather")  # gather waits for all workers via defer or reducer
builder.add_conditional_edges(START, dispatch)
builder.add_edge("worker", "gather")
builder.add_edge("gather", END)
```

---

## compile() — Full Signature

```python
graph = builder.compile(
    checkpointer=None,        # BaseCheckpointSaver | None | True
                              # True = auto-creates InMemorySaver (dev shorthand)
    *,
    cache=None,               # BaseCache for node-level caching
    store=None,               # BaseStore for long-term cross-thread memory
    interrupt_before=None,    # "all" | list[str] — pause before these nodes
    interrupt_after=None,     # "all" | list[str] — pause after these nodes
    debug=False,              # emit debug events to stdout
    name=None,                # string name for the compiled graph (used in tracing)
)
# Returns: CompiledStateGraph (implements Runnable: invoke/ainvoke/stream/astream/batch)
```

### compile() shorthand for dev/tests

```python
# compile(checkpointer=True) auto-creates an InMemorySaver — dev/test only
graph = builder.compile(checkpointer=True)
```

### Visualization

```python
# ASCII (no external deps)
graph.get_graph().print_ascii()

# Mermaid source
print(graph.get_graph().draw_mermaid())

# PNG (requires internet — uses Mermaid.Ink API by default)
graph.get_graph(xray=True).draw_mermaid_png()
# xray=True includes subgraph internals
```

> **⚠️ Gotcha:** `draw_mermaid()` fails if a conditional branch returns non-string keys
> (e.g. `bool`). Always use string keys in `path_map` — issue #692.

---

## API Surface Table — StateGraph

| Class / method | Import | Key params | Returns |
|---|---|---|---|
| `StateGraph` | `langgraph.graph` | `state_schema`, `context_schema`, `input_schema`, `output_schema` | `StateGraph` builder |
| `MessagesState` | `langgraph.graph` | — | `TypedDict` with `messages: Annotated[list[AnyMessage], add_messages]` |
| `add_messages` | `langgraph.graph.message` | — | reducer function |
| `START`, `END` | `langgraph.graph` | — | sentinel strings |
| `builder.add_node()` | — | `node`, `action`, `defer`, `metadata`, `input_schema`, `retry_policy`, `cache_policy`, `error_handler`, `destinations`, `timeout` | `StateGraph` (fluent) |
| `builder.add_edge()` | — | `src`, `dst` | `StateGraph` |
| `builder.add_conditional_edges()` | — | `src`, `path_fn`, `path_map` | `StateGraph` |
| `builder.compile()` | — | `checkpointer`, `cache`, `store`, `interrupt_before`, `interrupt_after`, `debug`, `name` | `CompiledStateGraph` |
| `graph.invoke()` | — | `input`, `config` | final state dict |
| `graph.ainvoke()` | — | `input`, `config` | awaitable final state dict |
| `graph.stream()` | — | `input`, `config`, `stream_mode` | `Iterator[dict]` |
| `graph.astream()` | — | `input`, `config`, `stream_mode` | `AsyncIterator[dict]` |
| `Command` | `langgraph.types` | `goto`, `update`, `resume`, `graph` | node return value |
| `Send` | `langgraph.types` | `node`, `arg` | used in conditional edge return |
| `RetryPolicy` | `langgraph.types` | `max_attempts`, `backoff_factor`, `initial_interval`, `max_interval`, `jitter`, `retry_on` | NamedTuple |
| `CachePolicy` | `langgraph.types` | `key_func`, `ttl` | dataclass |
| `NodeError` | `langgraph.errors` | `.error` (original exception) | used in error_handler |
| `NodeTimeoutError` | `langgraph.errors` | — | raised by async timed-out node |

---

## Production Gotchas

| Gotcha | Detail | Fix |
|---|---|---|
| `config_schema` silently deprecated | Code still runs but will break at v2.0.0 | Replace with `context_schema=`; update node signatures to accept `context: ContextType` |
| Pydantic `ValidationError` not retried | `RetryPolicy` default `retry_on` excludes `pydantic.ValidationError` | Add explicit `retry_on=(ConnectionError, pydantic.ValidationError)` if needed (#6027) |
| `draw_mermaid()` with bool keys | Conditional edge returning `True`/`False` breaks Mermaid renderer | Use `path_map={"yes": "node_a", "no": "node_b"}` and return strings |
| `add_node` name inference | Name is `fn.__name__`; lambdas and methods may produce unhelpful names | Always pass an explicit string name for nodes you reference in `interrupt_before` |
| Overwrite vs reducer | A node returning `{"messages": [new_msg]}` with no reducer **replaces** the whole list | Always use `Annotated[list[AnyMessage], add_messages]` for message lists |
| Multiple `add_edge` from one source | Multiple `add_edge(A, B)` and `add_edge(A, C)` fan out; all run in the same super-step | Intentional — only surprising when you expect exclusive routing |

---

## Version Migration Table

| Old API | Introduced/Deprecated | New API |
|---|---|---|
| `config_schema=RunConfig` in `StateGraph()` | Deprecated v0.6.0 | `context_schema=RunConfig` |
| `config["configurable"]["user_id"]` | Deprecated v0.6.0 | `context["user_id"]` (injected second arg) |
| `set_entry_point("node")` | Legacy | `add_edge(START, "node")` |
| `set_finish_point("node")` | Legacy | `add_edge("node", END)` |
| `Interrupt(value, resumable, ns, when)` | Simplified in v1.0 | `Interrupt(value, id)` — `resumable`/`ns`/`when` removed |
| `interrupt_id` field on `Interrupt` | Renamed v1.0 | `id` field |
| `create_react_agent` in `langgraph.prebuilt` | Deprecated v1.0 | `create_agent` in `langchain.agents` (removal: v2.0) |

---
name: langgraph-core
description: >
  Build, audit, and migrate production LangGraph 1.x applications. Triggers on:
  StateGraph, CompiledStateGraph, add_messages, reducer, MessagesState,
  PostgresSaver, InMemorySaver, interrupt(), Command(resume=, Send,
  stream_mode, checkpointer, BaseStore, PostgresStore, InjectedStore,
  CachePolicy, RetryPolicy, @entrypoint, @task, subgraph, time-travel,
  update_state, get_state_history, langgraph-checkpoint, super-step.
  Use when a developer is building a new graph from scratch (GREENFIELD),
  adding LangGraph to an existing Python codebase (RETROFIT), or asking a
  targeted question about a specific API surface — checkpointing, HITL,
  streaming, stores, caching, or the functional API.
---

## Core Philosophy

LangGraph 1.x (GA October 22, 2025) is a stable Pregel super-step engine; the
graph primitives (state/nodes/edges) had **no breaking changes** at the 1.0
promotion — upgrade confidently from 0.2.x once you address the `config_schema`
→ `context_schema` deprecation and the `Interrupt` field rename. Every
production graph needs a durable checkpointer (`AsyncPostgresSaver` behind a
connection pool) and a `RetryPolicy` on every I/O node; `InMemorySaver` and
`InMemoryStore` are test fixtures, not production infrastructure. Control flow
belongs in `Command` and `Send`, not in application code that wraps
`graph.invoke` in a loop. Pin `langgraph-checkpoint>=4.0.0` to close
CVE-2026-27794 (pickle-RCE via shared cache backends).

---

## Step 1 — Determine Context

| Intent | Signals | Action |
|---|---|---|
| **GREENFIELD** | "new graph", "build from scratch", "start a LangGraph project", `uv init` | Scaffold `StateGraph` + `MessagesState`, `AsyncPostgresSaver`, streaming loop |
| **RETROFIT** | "add LangGraph to existing repo", "migrate from 0.2.x", "swap InMemorySaver for Postgres" | Load migration tables; output only the delta (checkpointer swap, context_schema rename, Interrupt field update) |
| **SPECIFIC** | Single API question: checkpointer choice, HITL pattern, stream_mode, store vs checkpointer | Load only the one or two reference files that directly answer the question |
| **AUDIT** | "review my graph", "is this production-ready", "check for gotchas" | Load all four references; apply production checklist |

Cross-cutting: note the Python version (`>=3.10` required; `>=3.11` required for
async `@task`). If the request mentions multi-tenancy or semantic memory, load
`store-caching.md`.

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/stategraph.md` | StateGraph, reducers, MessagesState, add_node, edges, Command, Send, compile() | Any graph construction question; always load for GREENFIELD/AUDIT |
| `references/checkpointers.md` | BaseCheckpointSaver, InMemorySaver, PostgresSaver, SQLite, MongoDB, Redis, super-step, pending writes, time-travel | Any persistence, fault-tolerance, time-travel, or thread-state question |
| `references/hitl-streaming.md` | interrupt(), Command(resume=), stream_mode, StreamWriter, astream_events, subgraph streaming | Any HITL, approval loop, streaming, or token-delivery question |
| `references/store-caching.md` | BaseStore, PostgresStore, InjectedStore, namespacing, semantic search, CachePolicy, @entrypoint, @task, recursion_limit | Any long-term memory, cross-thread state, caching, or functional API question |

For GREENFIELD: load all four.
For RETROFIT: load `stategraph.md` + `checkpointers.md` as baseline; add others as needed.
For SPECIFIC: load only the matching reference(s).

---

## Step 3 — Build Graph

### API selection gate

| Scenario | Use | Reason |
|---|---|---|
| Complex branching, fine-grained time-travel, visualization needed | `StateGraph` (Graph API) | Named nodes, edges, per-node breakpoints, Mermaid export |
| Simple/linear flow, existing Python codebase, minimal boilerplate | `@entrypoint` / `@task` (Functional API) | No State/reducers required; tasks auto-checkpoint |
| Tightly-coupled co-deployed modules sharing state | Subgraph added as node | Shared state keys merge via parent reducers |
| Sub-agent invoked by LLM tool call | Agent-as-tool (invoke subgraph in tool fn) | LLM decides when to call; no direct edge |
| Sub-system independently deployed/scaled | `RemoteGraph` | Network boundary; async-safe |

### Checkpointer selection gate

See `references/checkpointers.md` for full API.

| Checkpointer | Use | Notes |
|---|---|---|
| `InMemorySaver` | Tests / dev only | Lost on restart; also `compile(checkpointer=True)` auto-creates one |
| `SqliteSaver` | Local / single-process | `threading.Lock`; not safe for concurrent prod |
| `AsyncPostgresSaver` | **Default production** | psycopg3 only; pool + `.setup()`; 4 tables |
| `MongoDBSaver` | Mongo-native shops | TTL in seconds; sharding supported |
| `RedisSaver` / `ShallowRedisSaver` | Low-latency / ephemeral | TTL in minutes; needs RedisJSON+RediSearch |

### HITL decision gate

| Pattern | When to use | Tradeoff |
|---|---|---|
| `compile(interrupt_before=["node"])` | Static pause; always fires before named node | Simple but inflexible; can't conditionally skip |
| `runtime interrupt()` inside a node | Dynamic/conditional pause; payload-driven | Re-runs pre-interrupt code on resume — keep it deterministic |
| `update_state` + `stream(None, config)` | Edit state before resume without re-running node | Use `as_node=` to apply reducers correctly |

---

## Step 4 — Output & Verification

### What gets produced

- `StateGraph` definition with typed `State`, reducers, nodes, edges
- `compile()` call with `checkpointer=`, `store=`, `interrupt_before=` as appropriate
- `AsyncPostgresSaver` pool setup with correct `autocommit=True`, `row_factory=dict_row`
- `.setup()` call annotated as one-time migration
- `RetryPolicy` on every I/O node
- `stream()` / `astream()` loop with correct `stream_mode`
- `CachePolicy` on deterministic nodes only

### Verification commands

```bash
# Add dependencies with uv add
uv add langgraph "langgraph-checkpoint>=4.0.0" langgraph-checkpoint-postgres psycopg[binary] psycopg-pool

# Confirm versions
uv run python -c "import langgraph; print(langgraph.__version__)"
uv run python -c "import langgraph_checkpoint; print(langgraph_checkpoint.__version__)"

# Run graph smoke test with InMemorySaver
uv run python -c "
from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.checkpoint.memory import InMemorySaver
b = StateGraph(MessagesState)
b.add_node('noop', lambda s: {})
b.add_edge(START, 'noop')
b.add_edge('noop', END)
g = b.compile(checkpointer=InMemorySaver())
print(g.get_graph().draw_mermaid())
"

# Type-check (Pyright — see developer-experience skill)
uv run pyright src/

# Enable MLflow tracing (single call covers all LangGraph graphs — see observability skill)
# import mlflow; mlflow.langchain.autolog()

# Security: confirm pickle fallback is disabled
uv run python -c "
import os; os.environ['LANGGRAPH_STRICT_MSGPACK'] = 'true'
from langgraph.checkpoint.base import BaseCheckpointSaver
print('strict msgpack:', os.getenv('LANGGRAPH_STRICT_MSGPACK'))
"
```

Set in your environment:
```bash
export LANGGRAPH_STRICT_MSGPACK=true
```

---

## Reference Files

| File | Domain | Primary source section |
|---|---|---|
| [references/stategraph.md](references/stategraph.md) | StateGraph, reducers, MessagesState, add_node (all 9 kwargs), edges, Command, Send, compile() | research/langgraph.md §§1, 2 |
| [references/checkpointers.md](references/checkpointers.md) | BaseCheckpointSaver, all savers, super-step, pending writes, fault tolerance, time-travel | research/langgraph.md §§3, 11 |
| [references/hitl-streaming.md](references/hitl-streaming.md) | interrupt(), Command(resume=), all 7 stream_mode values, StreamWriter, astream_events, subgraphs | research/langgraph.md §§4, 6, 7 |
| [references/store-caching.md](references/store-caching.md) | BaseStore, PostgresStore, InjectedStore, namespacing, CachePolicy, @entrypoint, @task, recursion_limit | research/langgraph.md §§5, 8, 9, 10 |

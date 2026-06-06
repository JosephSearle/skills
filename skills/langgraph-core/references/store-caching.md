# Store, Caching, and Functional API Reference — LangGraph 1.x

## Store vs Checkpointer — Comparison Table

| Dimension | Checkpointer | Store |
|---|---|---|
| Scope | Per-thread (short-term memory) | Cross-thread (long-term memory) |
| Keyed by | `thread_id` + `checkpoint_id` | `namespace: tuple[str, ...]` + `key: str` |
| Holds | Full graph state snapshot per super-step | Arbitrary memories, documents, facts |
| Query | `get_state`, `get_state_history`, `list` by config | `get`, `search` (exact + semantic), `list_namespaces` |
| Set at compile | `compile(checkpointer=)` | `compile(store=)` |
| Survives thread end | No — thread history only | Yes — persists indefinitely (until deleted) |
| Semantic search | No | Yes (via vector index on PostgresStore/RedisStore) |
| Cross-session sharing | No — thread-scoped | Yes — query across all threads |

---

## BaseStore Interface

`from langgraph.store.base import BaseStore`

### Core methods

| Method | Signature | Purpose |
|---|---|---|
| `put` | `(namespace, key, value)` | Write or overwrite a value |
| `get` | `(namespace, key)` → `Item \| None` | Fetch a single item by key |
| `delete` | `(namespace, key)` | Delete a single item |
| `search` | `(namespace, query=None, filter=None, limit=10, offset=0)` → `list[SearchItem]` | Semantic or filtered search |
| `list_namespaces` | `(prefix=None, suffix=None, max_depth=None, limit=100, offset=0)` | Enumerate namespaces |
| `batch` | `(ops: list[Op])` | Execute multiple ops atomically |
| `aput` | async variant of `put` | — |
| `aget` | async variant of `get` | — |
| `adelete` | async variant of `delete` | — |
| `asearch` | async variant of `search` | — |
| `alist_namespaces` | async variant of `list_namespaces` | — |
| `abatch` | async variant of `batch` | — |

### SearchItem schema

| Field | Type | Description |
|---|---|---|
| `namespace` | `tuple[str, ...]` | The namespace this item lives in |
| `key` | `str` | The item's key within the namespace |
| `value` | `dict` | The stored value |
| `score` | `float \| None` | Relevance score (semantic search); `None` for exact lookups |
| `created_at` | `datetime` | When the item was first written |
| `updated_at` | `datetime` | When the item was last updated |

---

## InMemoryStore

```python
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()

# Write
store.put(("users", "alice", "memories"), "pref-1", {"text": "prefers dark mode"})

# Read
item = store.get(("users", "alice", "memories"), "pref-1")
if item:
    print(item.value)  # {"text": "prefers dark mode"}

# Delete
store.delete(("users", "alice", "memories"), "pref-1")

# List namespaces
namespaces = store.list_namespaces(prefix=("users", "alice"))
```

**Use only for:** unit tests, local development. Data is lost on process exit.

---

## PostgresStore / AsyncPostgresStore

Package: `langgraph-checkpoint-postgres`

### Setup with semantic search

```python
from __future__ import annotations

import asyncio
from psycopg.rows import dict_row
from langchain.embeddings import init_embeddings
from langgraph.store.postgres import AsyncPostgresStore
from langgraph.store.postgres.base import PoolConfig

DB_URI = "postgresql://user:pass@localhost:5432/mydb?sslmode=disable"


async def build_store() -> AsyncPostgresStore:
    store = await AsyncPostgresStore.from_conn_string(
        DB_URI,
        index={
            "dims": 1536,                                           # embedding dimensions
            "embed": init_embeddings("openai:text-embedding-3-small"),
            "fields": ["text"],  # which value fields to embed; omit = embed whole value
        },
        pool_config=PoolConfig(
            min_size=2,
            max_size=20,
            kwargs={
                "autocommit": True,         # REQUIRED
                "prepare_threshold": 0,     # recommended for pgbouncer
                "row_factory": dict_row,    # REQUIRED
            },
        ),
    )
    await store.setup()   # run migrations once (idempotent)
    return store
```

### Sync (for non-async code)

```python
from langgraph.store.postgres import PostgresStore
from langchain.embeddings import init_embeddings

store = PostgresStore.from_conn_string(
    DB_URI,
    index={
        "dims": 1536,
        "embed": init_embeddings("openai:text-embedding-3-small"),
        "fields": ["text"],
    },
)
store.setup()
```

### Critical connection requirements (same as checkpointer)

| Requirement | Value | Consequence if wrong |
|---|---|---|
| `autocommit` | `True` | Writes silently lost |
| `row_factory` | `dict_row` | `TypeError` on reads |
| `prepare_threshold` | `0` (pooler) | Prepared statement errors with pgbouncer |

---

## Namespace Design Patterns

Namespaces are `tuple[str, ...]` — think of them as hierarchical folder paths.

| Pattern | Namespace example | Use case |
|---|---|---|
| Per-user memories | `(tenant_id, user_id, "memories")` | User preferences, facts, history |
| Per-agent knowledge | `(org_id, agent_name, "knowledge")` | Domain-specific agent facts |
| Global shared knowledge | `("global", "knowledge", "product")` | Shared facts across all users |
| Per-user per-topic | `(user_id, "notes", topic)` | Structured per-topic notes |
| Cross-session episodic | `(session_id, "episodes")` | Conversation summaries |

```python
# Write with namespacing
store.put(
    ("tenant-123", "user-alice", "memories"),   # namespace
    "work-pref-1",                               # key
    {"text": "Alice prefers bullet-point summaries", "category": "formatting"},
)

# Prefix search — all of Alice's memories
results = store.search(
    ("tenant-123", "user-alice", "memories"),
    query="how does Alice like summaries",   # semantic search
    limit=5,
)
for item in results:
    print(f"{item.key}: {item.value} (score={item.score:.3f})")

# Namespace listing — enumerate all of Alice's namespaces
namespaces = store.list_namespaces(prefix=("tenant-123", "user-alice"))
```

---

## Semantic Search

```python
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()

# Populate
store.put(("facts",), "f1", {"text": "Paris is the capital of France"})
store.put(("facts",), "f2", {"text": "Berlin is the capital of Germany"})
store.put(("facts",), "f3", {"text": "The Eiffel Tower is in Paris"})

# Semantic search (requires embeddings configured on PostgresStore in prod)
results = store.search(("facts",), query="European capitals", limit=2)
for item in results:
    print(item.key, item.score, item.value["text"])

# Exact search with filter (no query = no semantic scoring)
results = store.search(("facts",), filter={"category": "landmark"})
```

---

## Batch Operations

```python
from langgraph.store.base import PutOp, GetOp, DeleteOp, SearchOp

# Batch write + read atomically
ops = [
    PutOp(namespace=("users", "alice", "prefs"), key="theme", value={"color": "dark"}),
    PutOp(namespace=("users", "alice", "prefs"), key="lang",  value={"locale": "en-GB"}),
    GetOp(namespace=("users", "bob",   "prefs"), key="theme"),
]
results = store.batch(ops)
# results[2] is the GetOp result: Item | None
```

---

## InjectedStore — Accessing Store in Nodes and Tools

```python
from __future__ import annotations

from typing import Annotated
from langgraph.store.base import BaseStore
from langgraph.prebuilt import InjectedStore
from langchain_core.tools import tool


# In a tool (used with prebuilt tool node)
@tool
def remember_preference(
    preference: str,
    user_id: str,
    *,
    store: Annotated[BaseStore, InjectedStore],
) -> str:
    """Save a user preference to long-term memory."""
    store.put(
        ("users", user_id, "preferences"),
        f"pref-{hash(preference)}",
        {"text": preference},
    )
    return f"Remembered: {preference}"


@tool
def recall_preferences(
    query: str,
    user_id: str,
    *,
    store: Annotated[BaseStore, InjectedStore],
) -> list[str]:
    """Search long-term memory for user preferences."""
    results = store.search(
        ("users", user_id, "preferences"),
        query=query,
        limit=3,
    )
    return [r.value["text"] for r in results]
```

### Accessing store via runtime in a graph node

```python
from langgraph.graph import MessagesState


async def memory_node(state: MessagesState, store: BaseStore) -> dict:
    """Node receives store as second positional arg when compiled with store=."""
    user_id = "alice"  # extract from state or context
    memories = store.search(("users", user_id, "memories"), query="recent topics", limit=5)
    context = "\n".join(m.value.get("text", "") for m in memories)
    return {"messages": []}  # use context in LLM call
```

> **Note:** LangGraph injects `store` into node functions that accept it as a second
> positional argument, or via `Annotated[BaseStore, InjectedStore]` in tool functions.

---

## CachePolicy — Node-Level Caching

`from langgraph.types import CachePolicy`

### Setup

```python
from langgraph.types import CachePolicy
from langgraph.cache.memory import InMemoryCache   # also: SqliteCache
from langgraph.graph import StateGraph, MessagesState, START, END


def embed_query(state: MessagesState) -> dict:
    """Deterministic embedding node — safe to cache."""
    # Embedding is deterministic for a given input; same query always yields same vector
    query_text = state["messages"][-1].content if state["messages"] else ""
    # Using a fixed vector for illustration; replace with real embedding call
    embedding = [hash(query_text) % 100 / 100.0] * 3
    return {"embedding": embedding}


builder = StateGraph(MessagesState)
builder.add_node(
    "embed_query",
    embed_query,
    cache_policy=CachePolicy(ttl=300),   # 300 second TTL; None = never expires
)
builder.add_edge(START, "embed_query")
builder.add_edge("embed_query", END)

# Cache must be passed at compile time
graph = builder.compile(cache=InMemoryCache())
```

### CachePolicy fields

| Field | Type | Default | Description |
|---|---|---|---|
| `key_func` | `callable` | `default_cache_key` | Builds cache key from node input (default = pickle hash of input) |
| `ttl` | `float \| None` | `None` | TTL in seconds; `None` = never expires |

### Cache key semantics

The cache key is derived from the node's input state (or the per-node `input_schema`
projection). A different input → different key → cache miss = automatic invalidation.
**Only cache deterministic/pure nodes.** Non-deterministic nodes (LLM calls without
fixed seeds, time-sensitive API calls) must not be cached.

### CachePolicy on @task and @entrypoint

```python
from langgraph.func import task, entrypoint
from langgraph.types import CachePolicy
from langgraph.cache.memory import InMemoryCache


@task(cache_policy=CachePolicy(ttl=600))
def compute_embedding(text: str) -> list[float]:
    """Embedding is deterministic for a given text — safe to cache."""
    import httpx
    response = httpx.post(
        "https://api.openai.com/v1/embeddings",
        json={"input": text, "model": "text-embedding-3-small"},
        headers={"Authorization": "Bearer sk-..."},  # use env var in real code
    )
    return response.json()["data"][0]["embedding"]


@entrypoint(
    checkpointer=InMemorySaver(),
    cache=InMemoryCache(),
)
def pipeline(query: str) -> dict:
    embedding = compute_embedding(query).result()  # cache hit on repeated query
    return {"embedding": embedding}
```

### Cache gotchas

| Gotcha | Detail | Fix |
|---|---|---|
| `InMemoryCache` + `InMemorySaver` no-hit (#5980) | Cache may not hit when both are used together; "NOT CACHED" logs twice | Confirmed bug in some 1.x versions; use `SqliteCache` or `PostgresStore` as workaround |
| Custom stream data not re-emitted (#6265) | With `stream_mode="custom"`, cached nodes don't re-push custom events | Don't rely on custom stream events from cached nodes |
| CVE-2026-27794 / GHSA-mhr3-j7m5-c7c9 | Prior to `langgraph-checkpoint<4.0.0`, `BaseCache` defaulted to `pickle_fallback=True` in serializer; attacker-controlled bytes in shared/unauthed Redis or world-writable SQLite → RCE via `pickle.loads` | **Pin `langgraph-checkpoint>=4.0.0`**; set `LANGGRAPH_STRICT_MSGPACK=true` |
| Non-deterministic LLM nodes cached | Temperature > 0, time-sensitive calls produce stale results | Only cache nodes with no randomness or external mutable state |

---

## Functional API — @entrypoint and @task

`from langgraph.func import entrypoint, task`

### @entrypoint

Decorates a function and produces a `Pregel` instance — the functional equivalent of a
compiled `StateGraph`. The function takes a single positional argument (use a dict for
multiple inputs).

```python
from langgraph.func import entrypoint
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.store.memory import InMemoryStore
from langgraph.types import CachePolicy, RetryPolicy
from langgraph.cache.memory import InMemoryCache


# Full @entrypoint signature — all kwargs shown
@entrypoint(
    checkpointer=InMemorySaver(),      # BaseCheckpointSaver | None
    store=InMemoryStore(),             # BaseStore | None
    cache=InMemoryCache(),             # BaseCache | None
    context_schema=None,               # run-scoped context TypedDict
    cache_policy=CachePolicy(ttl=60),  # CachePolicy | None
    retry_policy=RetryPolicy(max_attempts=3),  # RetryPolicy | None
)
def my_workflow(inputs: dict) -> dict:
    # inputs is the single positional argument; use a dict for multiple inputs
    return {"processed": inputs.get("query", "")}
```

### @task

Wraps a discrete unit of work. Calling a `@task` function returns a **future**; call
`.result()` to get the value. Futures can be collected and `.result()`-ed in parallel.
Async tasks require **Python 3.11+**.

Task results are written into the entrypoint's checkpoint. On resume after an
`interrupt()`, completed tasks are **not re-run** — their results are loaded from the
checkpoint. This is the key mechanism for HITL determinism in the functional API.

### Full functional API example with HITL

```python
from __future__ import annotations

import asyncio
from langgraph.func import entrypoint, task
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import interrupt


@task
def fetch_document(doc_id: str) -> dict:
    """Fetch a document from an external API. Checkpointed — not re-fetched on resume."""
    import httpx
    return httpx.get(f"https://docs.example.com/{doc_id}").json()


@task
def summarise(doc: dict) -> str:
    """Summarise the document. Checkpointed."""
    return f"Summary of {doc['title']}: {doc['body'][:200]}"


@entrypoint(checkpointer=InMemorySaver())
def review_pipeline(doc_id: str) -> dict:
    """Fetch, summarise, then pause for human review."""
    doc = fetch_document(doc_id).result()
    summary = summarise(doc).result()

    # Pause — human reviews the summary
    approved: bool = interrupt({
        "summary": summary,
        "action": "Approve for publishing?",
    })

    return {
        "doc_id": doc_id,
        "summary": summary,
        "approved": approved,
        "published": approved,
    }


def run_review() -> None:
    config = {"configurable": {"thread_id": "review-doc-42"}}

    # First run — stops at interrupt
    result = review_pipeline.invoke("doc-42", config)
    if result is None:
        print("Waiting for approval...")

    # Human approves
    from langgraph.types import Command
    final = review_pipeline.invoke(Command(resume=True), config)
    print("Final:", final)
```

### previous — accessing prior invocation result

```python
from langgraph.func import entrypoint
from langgraph.checkpoint.memory import InMemorySaver


@entrypoint(checkpointer=InMemorySaver())
def stateful_agent(inputs: dict, *, previous: dict | None = None) -> dict:
    """previous holds the return value of the last invocation on this thread."""
    prior_count = previous["count"] if previous else 0
    new_count = prior_count + 1
    return {"count": new_count, "message": inputs["message"]}
```

### entrypoint.final — decouple return from saved value

```python
from langgraph.func import entrypoint
from langgraph.checkpoint.memory import InMemorySaver


@entrypoint(checkpointer=InMemorySaver())
def pipeline_with_final(query: str) -> str:
    result = "expensive computation result"
    # return the result to the caller, but save a compact summary to the checkpoint
    return entrypoint.final(
        value=result,                                  # returned to caller
        save={"summary": result[:100], "ts": "now"},   # what gets checkpointed
    )
```

### StateGraph vs Functional API

| Dimension | StateGraph | @entrypoint / @task |
|---|---|---|
| State definition | Explicit `TypedDict` / reducers | No explicit state; function return |
| Time-travel granularity | Per super-step | Per entrypoint invocation (coarser) |
| Visualization | Mermaid / ASCII | None |
| Branching | Named edges + `Command` | Python control flow |
| HITL determinism | `@task` wrapper or care with pre-interrupt code | `@task` results auto-checkpointed; skipped on resume |
| Best for | Complex branching, multi-agent, fine-grained observability | Simple/linear flows, integrating into existing codebases |

Both share the same Pregel runtime and can be composed.

---

## RunnableConfig for LangGraph

```python
from langchain_core.runnables import RunnableConfig

config: RunnableConfig = {
    "configurable": {
        "thread_id": "session-abc",     # required for checkpointing
        "checkpoint_ns": "",            # subgraph isolation; default ""
        "checkpoint_id": "uuid-...",    # time-travel: pin to a specific snapshot
    },
    "recursion_limit": 25,              # default 25 — counts super-steps
    "max_concurrency": 4,               # cap parallel node execution (Send fan-out)
    "tags": ["prod", "billing"],        # propagated to astream_events
    "metadata": {"user_id": "alice"},   # propagated to tracing
    "callbacks": [],                    # LangChain callbacks list
    "run_name": "billing-pipeline",     # trace name
}
```

### recursion_limit

| Scenario | Behaviour |
|---|---|
| Default (25) | Raises `GraphRecursionError` after 25 super-steps |
| Agent tool loop with many tool calls | Increase: `{"recursion_limit": 100}` in config |
| Infinite cycle bug | **Do not just raise the limit** — audit for unintended cycles first |
| Map-reduce with nested loops | Pair with a max-loop guard in node logic |

```python
# Raises: "Recursion limit of 25 reached without hitting a stop condition.
#          You can increase the limit by setting the recursion_limit config key."
graph.invoke(inputs, {"recursion_limit": 100})
```

### RemainingSteps

A node can read how many super-steps remain before `GraphRecursionError`:

```python
from langgraph.managed import RemainingSteps
from typing import Annotated
from langgraph.graph import StateGraph


class State(MessagesState):
    remaining_steps: Annotated[int, RemainingSteps]


def guard_node(state: State) -> dict:
    if state["remaining_steps"] < 3:
        # Graceful early exit before hitting the limit
        return {"messages": [AIMessage(content="Stopping early to avoid recursion limit.")]}
    return {}
```

---

## API Surface Table — Store and Caching

| Class / method | Import | Key params | Returns |
|---|---|---|---|
| `InMemoryStore` | `langgraph.store.memory` | — | `BaseStore` |
| `PostgresStore` | `langgraph.store.postgres` | `conn_or_pool`, `index` | `BaseStore` |
| `AsyncPostgresStore` | `langgraph.store.postgres` | `conn_or_pool`, `index`, `pool_config` | `BaseStore` |
| `store.put()` | — | `namespace`, `key`, `value` | `None` |
| `store.get()` | — | `namespace`, `key` | `Item \| None` |
| `store.search()` | — | `namespace`, `query`, `filter`, `limit`, `offset` | `list[SearchItem]` |
| `store.delete()` | — | `namespace`, `key` | `None` |
| `store.batch()` | — | `ops: list[Op]` | `list[result]` |
| `InjectedStore` | `langgraph.prebuilt` | — | annotation marker |
| `CachePolicy` | `langgraph.types` | `key_func`, `ttl` | dataclass |
| `InMemoryCache` | `langgraph.cache.memory` | — | `BaseCache` |
| `@entrypoint` | `langgraph.func` | `checkpointer`, `store`, `cache`, `context_schema`, `cache_policy`, `retry_policy` | `Pregel` |
| `@task` | `langgraph.func` | `cache_policy`, `retry_policy` | future-returning callable |
| `entrypoint.final` | `langgraph.func` | `value`, `save` | special return marker |
| `RemainingSteps` | `langgraph.managed` | — | managed value annotation |

---

## Production Gotchas

| Gotcha | Detail | Fix |
|---|---|---|
| `autocommit=True` on PostgresStore pool | Same requirement as `AsyncPostgresSaver` | Always set in `pool_config.kwargs` |
| `row_factory=dict_row` on PostgresStore | Same requirement | Always set in `pool_config.kwargs` |
| Semantic search without `index` config | `store.search(query=...)` returns empty results | Set `index={"dims": ..., "embed": ..., "fields": [...]}` at construction |
| `@task` async requires Python 3.11+ | Async `@task` uses `asyncio.TaskGroup` semantics | Pin `python_requires = ">=3.11"` in `pyproject.toml` |
| `entrypoint.previous` not None on first run | On the very first invocation, `previous` is `None` | Always guard: `prior = previous or default_value` |
| CachePolicy security (CVE-2026-27794) | `langgraph-checkpoint<4.0.0`: pickle fallback on shared cache → RCE | **Pin `langgraph-checkpoint>=4.0.0`**; `LANGGRAPH_STRICT_MSGPACK=true` |
| `InMemoryCache` + `InMemorySaver` no-hit | GitHub #5980 | Use `SqliteCache` or production `PostgresStore`-backed cache |

---

## Version Matrix

| Feature | Available since | Notes |
|---|---|---|
| `BaseStore` / `InMemoryStore` | `langgraph>=0.2.x` | Long-term memory API |
| `PostgresStore` semantic search | `langgraph-checkpoint-postgres>=1.0` | Requires `index=` config and `store.setup()` |
| `CachePolicy` node-level caching | `langgraph>=1.0.0` | GA in 1.0 |
| `@entrypoint` / `@task` functional API | `langgraph>=0.2.x` | Stable in 1.0; async `@task` requires Python 3.11+ |
| `entrypoint.final` | `langgraph>=1.0.0` | Decouple return value from saved state |
| `RemainingSteps` managed value | `langgraph>=0.2.x` | Read steps until `GraphRecursionError` |
| CVE-2026-27794 fix | `langgraph-checkpoint>=4.0.0` | Pickle fallback disabled; `LANGGRAPH_STRICT_MSGPACK` honoured |

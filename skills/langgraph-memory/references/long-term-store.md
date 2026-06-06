# Long-Term Store Reference — BaseStore, PostgresStore, InMemoryStore, Namespaces

## Overview: Checkpointer vs Store

| Dimension | Checkpointer (`PostgresSaver`) | Store (`PostgresStore`) |
|---|---|---|
| Scope | Per `thread_id` (single conversation) | Cross-thread (any user, any session) |
| Contents | Full graph state snapshots | Namespaced key-value + vector records |
| Persistence unit | Checkpoint per super-step | `put` / `delete` per item |
| Retrieval | Load by `thread_id` (exact) | `get` (exact) or `search` (semantic/filter) |
| Use for | Short-term conversation history | Long-term facts, preferences, episodic memory |

Both use the same Postgres connection pool. Create one pool at ASGI lifespan; share it.

---

## `BaseStore` Interface — Full Method Reference

`BaseStore` is the abstract base for all store implementations. Two abstract methods —
`batch(ops)` / `abatch(ops)` — back every higher-level method.

### Synchronous methods

| Method | Signature | Returns | Notes |
|---|---|---|---|
| `put` | `put(namespace, key, value, index=None, *, ttl=None)` | `None` | `value=None` → delete; `index=False` → skip embedding; `index=["field"]` → embed only those fields |
| `get` | `get(namespace, key)` | `Item \| None` | Exact fetch by `(namespace, key)` |
| `search` | `search(namespace_prefix, *, query=None, filter=None, limit=10, offset=0)` | `list[SearchItem]` | With `query` → semantic; with `filter` only → filtered list; without either → all items in prefix |
| `delete` | `delete(namespace, key)` | `None` | Hard delete |
| `list_namespaces` | `list_namespaces(*, prefix=None, suffix=None, max_depth=None, limit=100, offset=0)` | `list[tuple[str, ...]]` | Enumerate existing namespaces |
| `batch` | `batch(ops: list[Op])` | `list[Result \| None]` | All ops in one round-trip |

### Async variants

Every synchronous method has an `a`-prefixed async counterpart: `aput`, `aget`, `asearch`,
`adelete`, `alist_namespaces`, `abatch`.

### `Item` schema

```python
@dataclass
class Item:
    namespace: tuple[str, ...]
    key: str
    value: dict              # the stored document
    created_at: datetime
    updated_at: datetime
```

### `SearchItem` schema

```python
@dataclass
class SearchItem(Item):
    score: float | None      # similarity score (0–1); None for filter-only results
```

---

## `InMemoryStore` — Tests and Development Only

`InMemoryStore` is process-local. All data is lost on process exit. Use it in unit tests and
local development only — **never** in production.

```python
from langgraph.store.memory import InMemoryStore

# Without vector search (key-value only)
store = InMemoryStore()
store.put(("users", "u1", "preferences"), "theme", {"value": "dark"})
item = store.get(("users", "u1", "preferences"), "theme")
assert item.value == {"value": "dark"}

# With in-memory vector search
# The embed callable receives a list[str] and returns list[list[float]]
def dummy_embed(texts: list[str]) -> list[list[float]]:
    import hashlib
    result = []
    for text in texts:
        h = int(hashlib.md5(text.encode()).hexdigest(), 16)
        result.append([(h >> i & 0xFF) / 255.0 for i in range(4)])
    return result

store_vec = InMemoryStore(index={"dims": 4, "embed": dummy_embed})
store_vec.put(("mem", "u1"), "k1", {"text": "prefers Python"})
results = store_vec.search(("mem", "u1"), query="programming language preference", limit=3)
for r in results:
    print(r.key, r.score, r.value)
```

---

## `PostgresStore` — Production Setup

`PostgresStore` uses `pgvector` for semantic search. The `autocommit=True` and
`row_factory=dict_row` requirements are both mandatory — omitting either causes
`TypeError: tuple indices must be integers or slices, not str` on reads.

### Synchronous pool setup

```python
from langgraph.store.postgres import PostgresStore
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

DB_URI = "postgresql://user:pass@localhost:5432/mydb"

pool = ConnectionPool(
    conninfo=DB_URI,
    kwargs={
        "autocommit": True,       # required — do NOT omit
        "row_factory": dict_row,  # required — do NOT omit
        "prepare_threshold": 0,
    },
    min_size=2,
    max_size=10,
)

store = PostgresStore(
    conn=pool,
    index={
        "dims": 1536,
        "embed": "openai:text-embedding-3-small",  # or init_embeddings(...) instance
        "fields": ["text"],   # which JSON fields to embed; use ["$"] for the whole doc
    },
)
store.setup()  # run once at deploy time — creates tables, enables pgvector extension
```

> **⚠️ langgraph issue #4343:** The documented index key is `fields`, but `PostgresIndexConfig`
> internally reads `text_fields`. In some versions `fields` is silently ignored, meaning
> embeddings are never populated. Verify that vectors are being written after `.setup()` by
> checking the `store_vectors` table. If empty after a `put`, try `text_fields` as the key
> instead and file a bug against your installed version.

### Async pool setup (FastAPI/ASGI lifespan)

```python
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from langchain.chat_models import init_chat_model
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres import AsyncPostgresStore
from langgraph.store.postgres.base import PoolConfig
from psycopg.rows import dict_row

DB_URI = "postgresql://user:pass@localhost:5432/mydb"

# Module-level references set during lifespan
checkpointer: AsyncPostgresSaver | None = None
store: AsyncPostgresStore | None = None

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global checkpointer, store

    pool_kwargs = {
        "autocommit": True,
        "row_factory": dict_row,
        "prepare_threshold": 0,
    }
    pool_cfg = PoolConfig(min_size=5, max_size=20, kwargs=pool_kwargs)

    async with AsyncPostgresSaver.from_conn_string(DB_URI) as cp:
        await cp.setup()
        checkpointer = cp

        async with AsyncPostgresStore.from_conn_string(
            DB_URI,
            index={"dims": 1536, "embed": "openai:text-embedding-3-small"},
            pool_config=pool_cfg,
        ) as st:
            await st.setup()
            store = st
            yield

app = FastAPI(lifespan=lifespan)
```

> **⚠️ langgraph issue #6367:** `AsyncPostgresStore` emits `"Task was destroyed but it is
> pending"` warnings on event-loop shutdown due to pending background batch tasks. This is a
> known bug in the async store implementation; it does not cause data loss but clutters logs.
> Suppress with a log filter on that specific message if needed.

### Index types

| Index type | Build speed | Memory | Recall | Use when |
|---|---|---|---|---|
| `hnsw` (default) | Slower | Higher | Better | Production default; best recall/latency trade-off |
| `ivfflat` | Faster | Lower | Slightly lower | Very large collections; constrained RAM |

Scale limit: HNSW indexes must fit in RAM. A single namespace exceeding ~5–10 million vectors
at 768 dimensions (~150 GB RAM) requires HNSW tuning, pruning/consolidation, or `pgvectorscale`
/ DiskANN for out-of-core indexing.

---

## Namespace Design Conventions

Namespaces are tuples of strings that act as hierarchical folder paths. Postgres and SQLite
implementations **disallow dots (`.`) in individual namespace components**.

### Standard patterns

| Pattern | Namespace tuple | Notes |
|---|---|---|
| User-scoped memories | `("users", user_id, "memories")` | One user's facts and preferences |
| User-scoped preferences | `("users", user_id, "preferences")` | Profile; typically a single document |
| Agent-scoped knowledge | `("agents", agent_id, "knowledge")` | Per-agent learned knowledge |
| Shared team memory | `("teams", team_id, "shared")` | Cross-agent read, per-agent write |
| Global facts | `("global", "facts")` | Shared across all users/agents |
| Instructions / system prompts | `("instructions",)` | Procedural memory for prompt optimiser |

### Multi-tenancy rule

Always put `user_id` (or tenant id) as the **first** meaningful component after any scope
prefix. This ensures GDPR deletion is a namespace prefix sweep:

```python
# GOOD — deletion is one list_namespaces call
("users", "user-42", "memories")
("users", "user-42", "preferences")

# BAD — deletion requires scanning all namespaces
("memories", "user-42")    # user_id buried; harder to enumerate all of a user's data
```

LangMem tool placeholders use `("{user_id}")` or `("{langgraph_user_id}")` — resolved from
`config["configurable"]`, **never** from model output (cross-tenant leakage risk).

---

## Atomic Operations and Race Conditions

`BaseStore.put` is **last-write-wins** with no built-in optimistic concurrency or compare-and-swap.
Concurrent writers to the same `(namespace, key)` silently overwrite each other.

| Scenario | Risk | Remedy |
|---|---|---|
| Two background workers updating the same profile key | One write is silently lost | Use distinct keys per writer (LangMem collection pattern); or serialise via app-level lock |
| Read-modify-write on a shared "profile" document | TOCTOU race | Application-level lock, or Postgres advisory lock / `SELECT ... FOR UPDATE` around read+write |
| Multiple agents writing to shared team namespace | Key collision | Partition by agent sub-namespace; merge reads via `search` across the shared prefix |

`batch()` groups multiple ops into one round-trip but is not a cross-row transaction — it
does not provide conflict detection or rollback.

```python
from langgraph.store.base import PutOp, GetOp, SearchOp, DeleteOp
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()

# Batch write + read in one round-trip
results = store.batch([
    PutOp(
        namespace=("users", "u1", "memories"),
        key="pref-1",
        value={"text": "prefers Python over JavaScript"},
    ),
    PutOp(
        namespace=("users", "u1", "memories"),
        key="pref-2",
        value={"text": "uses dark mode"},
    ),
    GetOp(namespace=("users", "u1", "memories"), key="pref-1"),
])
# results[0] and results[1] are None (PutOp returns None)
# results[2] is an Item
item = results[2]
print(item.value)
```

---

## Semantic Search

When `PostgresStore` is configured with an `index`, calling `store.search(namespace, query=...)`
embeds the query using the configured `embed` function and runs a vector similarity search.

```python
from langgraph.store.postgres import PostgresStore
from langgraph.store.base import SearchItem

def search_user_memories(
    store: PostgresStore,
    user_id: str,
    query: str,
    memory_type: str | None = None,
    limit: int = 5,
) -> list[SearchItem]:
    """Retrieve semantically relevant memories for a user."""
    filter_dict: dict | None = None
    if memory_type is not None:
        filter_dict = {"type": memory_type}

    return store.search(
        ("users", user_id, "memories"),
        query=query,
        filter=filter_dict,    # equality filter on stored document fields
        limit=limit,
        offset=0,
    )

# Usage in a graph node
def load_memories_node(state: dict, *, store: PostgresStore) -> dict:
    results = search_user_memories(
        store,
        user_id=state["user_id"],
        query=state["messages"][-1].content,
        limit=5,
    )
    block = "\n".join(
        f"[{r.score:.3f}] {r.value.get('text', r.value)}" for r in results
    )
    return {"memory_context": block}
```

### Filter syntax

The `filter` parameter accepts a dict of equality constraints or operator dicts:

```python
# Equality
filter={"type": "preference"}

# Operator form (syntax varies by backend version — verify against installed)
filter={"status": {"$eq": "active"}, "priority": {"$gte": 3}}
```

Without `query`, `search` returns all items matching the filter without ranking (no score).

---

## Accessing the Store from Nodes and Tools

Three idioms, in order of preference:

### 1. Node injection (preferred)

Declare `*, store: BaseStore` in the node signature. The store compiled into the graph is
injected automatically at runtime.

```python
from langgraph.store.base import BaseStore

def search_node(state: dict, *, store: BaseStore) -> dict:
    items = store.search(
        ("users", state["user_id"], "memories"),
        query=state["messages"][-1].content,
        limit=5,
    )
    return {"context": [item.value for item in items]}
```

### 2. `get_store()` context variable (inside any node or task)

```python
from langgraph.config import get_store
from langgraph.store.base import BaseStore

def prompt_node(state: dict) -> list[dict]:
    store: BaseStore = get_store()
    items = store.search(("memories",), query=state["messages"][-1].content)
    system = {
        "role": "system",
        "content": "Memories:\n" + "\n".join(str(i.value) for i in items),
    }
    return [system, *state["messages"]]
```

### 3. `InjectedStore` annotation (verbose, still supported)

```python
from typing import Annotated
from langgraph.store.base import BaseStore
from langgraph.prebuilt import InjectedStore

def my_tool(query: str, store: Annotated[BaseStore, InjectedStore]) -> str:
    items = store.search(("memories",), query=query, limit=3)
    return "\n".join(str(i.value) for i in items)
```

---

## GDPR Deletion by Namespace Prefix

To fully delete a user's long-term memory:

```python
from langgraph.store.postgres import PostgresStore

def delete_user_memories(store: PostgresStore, user_id: str) -> int:
    """
    Delete all long-term memory for a user.
    Returns the number of items deleted.
    """
    namespaces = store.list_namespaces(prefix=("users", user_id))
    deleted = 0
    for ns in namespaces:
        # list all items in this namespace
        items = store.search(ns)
        for item in items:
            store.delete(ns, item.key)
            deleted += 1
    return deleted
```

For short-term state: separately call `checkpointer.delete_thread(thread_id)` for every
`thread_id` belonging to the user. Maintain a `user_id → [thread_ids]` mapping (e.g., in
your application database) so you can enumerate them at deletion time.

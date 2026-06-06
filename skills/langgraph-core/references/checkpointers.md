# Checkpointers Reference — LangGraph 1.x

## Checkpointer Decision Table

| Checkpointer | Use case | Persistence | Async | Notes |
|---|---|---|---|---|
| `InMemorySaver` | Tests / dev only | None — lost on restart | Yes | Also: `compile(checkpointer=True)` auto-creates one |
| `SqliteSaver` / `AsyncSqliteSaver` | Local / single-process / embedded | SQLite file | Yes | `threading.Lock`; not safe for concurrent prod writes |
| `PostgresSaver` / `AsyncPostgresSaver` | **Default production choice** | PostgreSQL | Yes | psycopg3 only — psycopg2 NOT supported; pool + `.setup()`; 4 tables |
| `MongoDBSaver` / `AsyncMongoDBSaver` | MongoDB-native shops | MongoDB | Yes | TTL in seconds; compound index; sharding supported |
| `RedisSaver` / `AsyncRedisSaver` | Low-latency / ephemeral threads | Redis | Yes | TTL in minutes; needs RedisJSON+RediSearch modules |
| `ShallowRedisSaver` / `AsyncShallowRedisSaver` | Memory-optimised ephemeral | Redis (latest checkpoint only) | Yes | Lower memory; no history; TTL in minutes |

---

## BaseCheckpointSaver Interface

`from langgraph.checkpoint.base import BaseCheckpointSaver`

### Required methods

| Method | Signature | Purpose |
|---|---|---|
| `put` | `(config, checkpoint, metadata, new_versions) -> config` | Store a new checkpoint |
| `put_writes` | `(config, writes, task_id) -> None` | Store pending writes for a node within a super-step |
| `get_tuple` | `(config) -> CheckpointTuple \| None` | Fetch the checkpoint tuple for a given config |
| `list` | `(config, *, filter, before, limit) -> Iterator[CheckpointTuple]` | List matching checkpoints |
| `delete_thread` | `(thread_id) -> None` | Delete all checkpoints for a thread |
| `get_next_version` | `(current, channel)` | Internal versioning; implement when subclassing |

### Async variants (all checkpointers implement both)

`aput`, `aput_writes`, `aget_tuple`, `alist` — same signatures, return awaitables.

`get(config)` / `aget(config)` — convenience wrappers that call `get_tuple` and return
the checkpoint dict directly (not the full tuple).

### CheckpointTuple fields

| Field | Type | Contents |
|---|---|---|
| `config` | `RunnableConfig` | The config that identifies this checkpoint (thread_id, checkpoint_id, checkpoint_ns) |
| `checkpoint` | `dict` | The serialized graph state at this super-step boundary |
| `metadata` | `dict` | Source node, step index, writes, parents |
| `parent_config` | `RunnableConfig \| None` | Config of the preceding checkpoint |
| `pending_writes` | `list[tuple]` | Task writes not yet merged into a checkpoint (in-progress super-step) |

---

## Super-Step Concept

A super-step is one Pregel iteration — one round of node executions.

| Scenario | Super-step behaviour |
|---|---|
| Two nodes connected by a sequential edge: `A → B` | Each runs in a **separate** super-step; two checkpoints written |
| Two nodes both reachable from the same node (`fan_out → A`, `fan_out → B`) | Both run in the **same** super-step; one checkpoint written at the end |
| `Send` fan-out: N workers dispatched by one conditional edge | All N workers run in one super-step |
| `defer=True` node | Runs in a new super-step after all parallel branches of the current super-step finish |

**Time-travel note:** `get_state_history` surfaces one snapshot per super-step boundary.
You can only resume from a super-step boundary, not from mid-super-step.

---

## Pending Writes and Fault Tolerance

Within a super-step, each node's outputs are written to `checkpoint_writes` as durable
task entries linked to the in-progress checkpoint **as soon as the node finishes** — before
the super-step completes.

| Scenario | Behaviour |
|---|---|
| Node A and Node B run in parallel (same super-step); B fails | A's writes are already durable; on resume, only B re-executes |
| No checkpointer configured; B fails | The entire super-step's updates are discarded; both A and B re-run from scratch |
| Entire process crashes mid-super-step | On next invoke with the same thread_id, all already-durable task writes are replayed; no re-execution of successful nodes |

**Rule:** in production, always use a checkpointer. Without one, parallel node failures
cause redundant (and potentially side-effectful) node re-execution.

---

## InMemorySaver

```python
from langgraph.checkpoint.memory import InMemorySaver

# Standard import (current)
checkpointer = InMemorySaver()
graph = builder.compile(checkpointer=checkpointer)

# Shorthand — compile(checkpointer=True) auto-creates InMemorySaver
graph = builder.compile(checkpointer=True)
```

> **⚠️ Naming:** `MemorySaver` was renamed to `InMemorySaver`. Both are importable from
> `langgraph.checkpoint.memory` in current 1.x versions, but `InMemorySaver` is canonical.

```python
# Both work in 1.x — InMemorySaver is preferred
from langgraph.checkpoint.memory import InMemorySaver   # canonical
from langgraph.checkpoint.memory import MemorySaver     # legacy alias, still importable
```

**Use only for:** unit tests, local development, smoke tests. Data is lost on process exit.

---

## PostgresSaver / AsyncPostgresSaver

Package: `langgraph-checkpoint-postgres`
**psycopg3 only — psycopg2 is NOT supported.**

```python
uv add langgraph-checkpoint-postgres "psycopg[binary]" psycopg-pool
```

### Async (recommended for production)

```python
from __future__ import annotations

import asyncio
from psycopg_pool import AsyncConnectionPool
from psycopg.rows import dict_row
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.graph import StateGraph, MessagesState, START, END

DB_URI = "postgresql://user:pass@localhost:5432/mydb?sslmode=disable"


async def build_graph() -> object:
    pool = AsyncConnectionPool(
        conninfo=DB_URI,
        max_size=20,
        open=False,
        kwargs={
            "autocommit": True,         # REQUIRED — saver does not manage transactions
            "prepare_threshold": 0,     # disable prepared statements (pooler compatibility)
            "row_factory": dict_row,    # REQUIRED — saver reads rows as dicts
        },
    )
    await pool.open()

    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()  # ONE-TIME: creates/migrates tables; idempotent; run in CI

    builder = StateGraph(MessagesState)
    builder.add_node("agent", agent_node)
    builder.add_edge(START, "agent")
    builder.add_edge("agent", END)
    return builder.compile(checkpointer=checkpointer)


graph = asyncio.run(build_graph())
```

### Sync (for non-async code paths)

```python
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row
from langgraph.checkpoint.postgres import PostgresSaver

pool = ConnectionPool(
    conninfo=DB_URI,
    max_size=10,
    open=False,
    kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
)
pool.open()

checkpointer = PostgresSaver(pool)
checkpointer.setup()  # one-time migration
graph = builder.compile(checkpointer=checkpointer)
```

### Critical connection requirements

| Requirement | Value | Consequence if wrong |
|---|---|---|
| `autocommit` | `True` | Saver does not call `BEGIN`/`COMMIT`; if `False`, writes silently disappear |
| `row_factory` | `dict_row` | Saver reads rows as dicts; if omitted: `TypeError: tuple indices must be integers or slices, not str` |
| `prepare_threshold` | `0` (recommended) | PgBouncer / pgpool2 don't support prepared statements; `0` disables them |
| psycopg version | psycopg3 (`psycopg` package) | psycopg2 (`psycopg2` package) is NOT supported |

### .setup() behaviour

`.setup()` is **idempotent** — safe to call on every deploy. It runs versioned migrations
tracked in the `checkpoint_migrations` table. Run it as a CI/CD step before starting your
application, not on every request.

### Postgres table schema

| Table | Purpose | Notable columns |
|---|---|---|
| `checkpoints` | One row per state snapshot per super-step | `thread_id`, `checkpoint_ns`, `checkpoint_id`, `parent_checkpoint_id`, metadata, JSONB blob |
| `checkpoint_blobs` | Large/complex channel values (e.g. message lists) | BYTEA; referenced from `checkpoints` |
| `checkpoint_writes` | Pending task writes within an in-progress super-step | Enables pending-writes recovery |
| `checkpoint_migrations` | Internal schema version tracking | `v` (migration number) |

> **⚠️ Table growth:** one production team measured ~93 rows per average conversation
> across the four tables, with `checkpoint_blobs` reaching ~56 MB / ~18k rows after a week
> at ~120k conversations/week. Add a TTL-based cron delete on `checkpoint_blobs` /
> `checkpoint_writes` / `checkpoints` partitioned by `thread_id` to avoid table bloat.
> Partition by `thread_id` when running deletes to avoid full-table locks.

---

## SqliteSaver / AsyncSqliteSaver

Package: `langgraph-checkpoint-sqlite`

```python
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

# Sync — file-based
with SqliteSaver.from_conn_string("./checkpoints.db") as checkpointer:
    graph = builder.compile(checkpointer=checkpointer)
    result = graph.invoke(inputs, {"configurable": {"thread_id": "t1"}})

# Async
async def run() -> None:
    async with AsyncSqliteSaver.from_conn_string("./checkpoints.db") as checkpointer:
        graph = builder.compile(checkpointer=checkpointer)
        result = await graph.ainvoke(inputs, {"configurable": {"thread_id": "t1"}})
```

SQLite uses a `threading.Lock`. Not suitable for concurrent writes from multiple processes.
Use for: local development, single-user CLI tools, tests that need persistence across runs.

---

## MongoDBSaver / AsyncMongoDBSaver

Package: `langgraph-checkpoint-mongodb`

```python
from langgraph.checkpoint.mongodb import MongoDBSaver
from langgraph.checkpoint.mongodb.aio import AsyncMongoDBSaver

# Sync
with MongoDBSaver.from_conn_string(
    "mongodb://localhost:27017",
    db_name="checkpoint_db",
) as checkpointer:
    graph = builder.compile(checkpointer=checkpointer)

# Manual constructor (more control)
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
checkpointer = MongoDBSaver(
    client,
    db_name="checkpointing_db",
    checkpoint_collection_name="checkpoints",
    writes_collection_name="checkpoint_writes",
    ttl=86400,   # seconds — creates a MongoDB TTL index
)
graph = builder.compile(checkpointer=checkpointer)
```

MongoDB automatically creates a unique compound index on `(thread_id, checkpoint_ns,
checkpoint_id desc)`. Supports sharding via shard keys. TTL is in **seconds**
(unlike Redis which uses minutes).

---

## RedisSaver / ShallowRedisSaver

Package: `langgraph-checkpoint-redis` (redis-developer org)
Requires: **RedisJSON + RediSearch modules** — bundled in Redis 8.0+; use Redis Stack for
older versions.

```python
from langgraph.checkpoint.redis import RedisSaver
from langgraph.checkpoint.redis import ShallowRedisSaver  # latest checkpoint only

# Full history
ttl_config = {
    "default_ttl": 60,          # minutes (NOT seconds — unlike MongoDB)
    "refresh_on_read": True,    # reset expiry on access
}
with RedisSaver.from_conn_string("redis://localhost:6379", ttl=ttl_config) as checkpointer:
    checkpointer.setup()    # creates RediSearch indices — call once
    graph = builder.compile(checkpointer=checkpointer)

# Memory-optimised: only the latest checkpoint per thread
with ShallowRedisSaver.from_conn_string("redis://localhost:6379") as checkpointer:
    checkpointer.setup()
    graph = builder.compile(checkpointer=checkpointer)
```

> **⚠️ redis-checkpoint 0.2.0:** upgraded to LangGraph 1.0 / checkpoint 3.0; blob encoding
> changed from JSON strings to base64 bytes. Old 0.1.x checkpoints may return `None` on
> read after upgrading. Migrate or flush your checkpoint keys before upgrading.

### Redis TTL notes

| Parameter | Unit | Default behaviour |
|---|---|---|
| `default_ttl` | minutes | `None` = persistent (no TTL) |
| `refresh_on_read` | bool | `True` resets expiry on every read; `False` expires from write time |

TTL is applied to all related keys (checkpoint hash, blob keys, write keys) together.

---

## Thread Model and Config

```python
# Full config structure
config = {
    "configurable": {
        "thread_id": "user-123-session-456",  # groups a conversation
        "checkpoint_ns": "",                   # isolates subgraph checkpoints; default ""
        "checkpoint_id": "abc123",             # pins a point-in-time (for time-travel)
    },
    "recursion_limit": 25,
    "max_concurrency": 4,
}
```

| Config key | Purpose |
|---|---|
| `thread_id` | Groups all checkpoints for one conversation/session |
| `checkpoint_ns` | Namespace for subgraph isolation; default `""` for top-level |
| `checkpoint_id` | Pins invocation to a specific past snapshot (time-travel) |

---

## Reading State and Time-Travel

```python
from langgraph.graph import StateGraph
from langgraph.checkpoint.memory import InMemorySaver

# Assume graph and config are already set up
config = {"configurable": {"thread_id": "t1"}}

# Latest state snapshot
snapshot = graph.get_state(config)
# snapshot.values      — current state dict
# snapshot.next        — tuple of nodes scheduled to run next
# snapshot.config      — config identifying this snapshot
# snapshot.metadata    — step, source, writes
# snapshot.created_at  — ISO timestamp
# snapshot.parent_config — config of the previous snapshot
# snapshot.tasks       — pending task details

# Full history (newest first)
history = list(graph.get_state_history(config))
# Each entry is a StateSnapshot

# Time-travel: resume from a past checkpoint
past_config = history[2].config  # third-most-recent
result = graph.invoke(None, past_config)  # replay from there

# update_state: inject state as if a node produced it
# Useful for editing state before resuming an interrupt
graph.update_state(
    config,
    values={"status": "approved"},
    as_node="human_review",  # applies reducers as if this node produced the update
)
# Then resume
for event in graph.stream(None, config):
    print(event)
```

### update_state special as_node values

| `as_node` value | Behaviour |
|---|---|
| Node name string | Applies update as if that node produced it; reducers respected |
| `END` | Flushes pending updates; marks thread as complete |
| `"__copy__"` | Forks the checkpoint without advancing; creates a branch |
| `None` | Applies update without attributing to any node |

> **⚠️ Gotcha:** calling `update_state(values={"messages": [...]})` without an `as_node`
> can clobber pending interrupts. Always pass `as_node=` when updating state mid-interrupt.

---

## API Surface Table — Checkpointers

| Class / method | Import | Key params | Returns |
|---|---|---|---|
| `InMemorySaver` | `langgraph.checkpoint.memory` | — | `BaseCheckpointSaver` |
| `PostgresSaver` | `langgraph.checkpoint.postgres` | `conn` or `pool` | `BaseCheckpointSaver` |
| `AsyncPostgresSaver` | `langgraph.checkpoint.postgres.aio` | `pool` | `BaseCheckpointSaver` |
| `SqliteSaver` | `langgraph.checkpoint.sqlite` | `conn` | `BaseCheckpointSaver` |
| `MongoDBSaver` | `langgraph.checkpoint.mongodb` | `client`, `db_name`, `ttl` (seconds) | `BaseCheckpointSaver` |
| `RedisSaver` | `langgraph.checkpoint.redis` | `redis_url`, `ttl` (minutes dict) | `BaseCheckpointSaver` |
| `ShallowRedisSaver` | `langgraph.checkpoint.redis` | `redis_url` | `BaseCheckpointSaver` |
| `graph.get_state()` | — | `config` | `StateSnapshot` |
| `graph.get_state_history()` | — | `config` | `Iterator[StateSnapshot]` |
| `graph.update_state()` | — | `config`, `values`, `as_node` | updated `config` |
| `checkpointer.list()` | — | `config`, `filter`, `before`, `limit` | `Iterator[CheckpointTuple]` |
| `checkpointer.delete_thread()` | — | `thread_id` | `None` |

---

## Production Gotchas

| Gotcha | Detail | Fix |
|---|---|---|
| psycopg2 silently used | `import psycopg2` and `PostgresSaver` together — unsupported combination | Use `psycopg` (v3) package; uninstall `psycopg2` from the venv |
| `autocommit=False` (default) | Writes disappear; no error raised | Always set `autocommit=True` in pool `kwargs` |
| Missing `row_factory=dict_row` | `TypeError: tuple indices must be integers or slices, not str` | Add `row_factory=dict_row` to pool `kwargs` |
| `.setup()` not called | Tables missing; `UndefinedTable` on first invoke | Call `.setup()` once before any graph invocation; gate on migration table |
| `MemorySaver` vs `InMemorySaver` | Old tutorials use `MemorySaver`; it's a legacy alias | Import `InMemorySaver`; both work in 1.x |
| Redis TTL unit mismatch | MongoDB TTL = seconds; Redis TTL = minutes | Double-check unit when setting TTL in config |
| Redis 0.1.x → 0.2.x blob encoding | Old checkpoints return `None` after upgrade | Flush Redis checkpoint keys or run a migration script before upgrading |
| Unbounded checkpoint table growth | ~93 rows/conversation; blobs grow fastest | Add cron-delete with `thread_id` partitioning; ETL old threads to cold storage |

---

## Version Matrix

| Feature | Package version | Notes |
|---|---|---|
| `InMemorySaver` canonical name | `langgraph>=0.2.x` | `MemorySaver` still importable as alias |
| `compile(checkpointer=True)` shorthand | `langgraph>=1.0.0` | Auto-creates `InMemorySaver` |
| `checkpoint_migrations` table | `langgraph-checkpoint-postgres>=1.0` | Idempotent versioned migrations |
| `AsyncPostgresStore` `pool_config=` | `langgraph-checkpoint-postgres>=1.0` | Pool config via `PoolConfig` dataclass |
| Redis checkpoint 0.2.0 | `langgraph-checkpoint-redis>=0.2.0` | Requires LangGraph 1.0 / checkpoint 3.0; blob encoding changed |
| CVE-2026-27794 pickle-RCE fix | `langgraph-checkpoint>=4.0.0` | Pickle fallback disabled by default; set `LANGGRAPH_STRICT_MSGPACK=true` |

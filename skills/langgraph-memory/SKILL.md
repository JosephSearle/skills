---
name: langgraph-memory
description: >
  Implement production-grade memory for LangGraph agents: short-term context
  management with trim_messages and SummarizationNode, long-term cross-thread
  facts with PostgresStore and InMemoryStore accessed via InjectedStore, and
  high-level memory SDK patterns using LangMem (langmem), including
  create_manage_memory_tool, create_search_memory_tool,
  create_memory_store_manager, ReflectionExecutor, and create_prompt_optimizer.
  Triggers on: context_length_exceeded, message history overflow, RemoveMessage,
  memory namespace, episodic memory, semantic memory, procedural memory,
  LOCOMO benchmark, cross-thread memory, PostgresStore setup, InMemoryStore
  testing, SummarizationNode configuration, migration from
  ConversationBufferMemory / ConversationSummaryMemory /
  ConversationBufferWindowMemory / VectorStoreRetrieverMemory.
---

## Core Philosophy

Every LangGraph agent in production needs two orthogonal memory systems: a **checkpointer**
for per-thread short-term state and a **Store** for cross-thread long-term facts — they are
independent and both are necessary for personalisation. Context overflow is a **hard error**
(provider `context_length_exceeded` 400), not silent truncation; you must manage the window
explicitly before every model call. LangMem is the right abstraction for long-term memory
management but is still pre-1.0 (0.0.x) — pin it and verify the read-back paths on every
upgrade. Default storage is `InMemoryStore`/`InMemorySaver` for tests and
`PostgresStore`/`PostgresSaver` for everything else; never use in-memory stores in production.

---

## Step 1 — Determine Context

Classify the request before loading any reference:

| Intent signal | Mode |
|---|---|
| `trim_messages`, `max_tokens`, message count limit, `context_length_exceeded`, `RemoveMessage`, `ConversationBufferWindowMemory` migration | **SHORT-TERM** |
| `SummarizationNode`, `RunningSummary`, `ConversationSummaryMemory` migration, "summarize long history" | **SHORT-TERM** |
| `PostgresStore`, `InMemoryStore`, `InjectedStore`, namespace design, `store.put`/`store.search`, cross-thread memory, `BaseStore`, GDPR deletion | **LONG-TERM** |
| `langmem`, `LangMem`, `create_manage_memory_tool`, `create_search_memory_tool`, `create_memory_store_manager`, `ReflectionExecutor`, `create_prompt_optimizer`, episodic memory, semantic memory, procedural memory, LOCOMO benchmark | **LANGMEM** |
| `ConversationBufferMemory`, `ConversationSummaryMemory`, `ConversationBufferWindowMemory`, `VectorStoreRetrieverMemory`, "migrate from LangChain memory", "legacy memory" | **MIGRATION** |

Multiple modes may apply; load all relevant references.

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/short-term.md` | `trim_messages`, `SummarizationNode`, `RemoveMessage`, thread lifecycle | Mode is SHORT-TERM; any question about context window management, summarisation, message deduplication |
| `references/long-term-store.md` | `BaseStore`, `PostgresStore`, `InMemoryStore`, namespace design, semantic search, GDPR | Mode is LONG-TERM; any question about cross-thread facts, store setup, namespace conventions, batch ops |
| `references/langmem.md` | `create_manage_memory_tool`, `create_search_memory_tool`, `ReflectionExecutor`, `create_prompt_optimizer`, LOCOMO benchmarks | Mode is LANGMEM; any question about LangMem SDK, hot-path vs background, memory types, benchmarks |
| `references/migration-from-legacy-memory.md` | Side-by-side migration code for all deprecated LangChain memory classes | Mode is MIGRATION; any mention of `ConversationBufferMemory` or other legacy classes |

For a new agent that needs "full memory": load all four references.

---

## Step 3 — Implement Memory

### 3.1 Short-term decision gate: trim vs summarise

| Condition | Decision |
|---|---|
| Recent context suffices, cost-sensitive, independent turns | `trim_messages(strategy="last")` — zero LLM cost |
| Long multi-step sessions, older context matters (support, technical work) | `SummarizationNode` — LLM cost per summarisation pass |
| Both: very long histories + cost tolerance | Hybrid: `SummarizationNode` prefix + `trim_messages` on the tail |

Always add at least `trim_messages` before the first production deploy. Treat "no trim node"
as a latent `context_length_exceeded` outage.

### 3.2 Long-term decision gate: hot-path vs background

| Condition | Decision |
|---|---|
| User explicitly says "remember X", write must be immediately visible | Hot-path: `create_manage_memory_tool` |
| Zero added latency on response, consolidated extraction, memory available next session | Background: `create_memory_store_manager` + `ReflectionExecutor` |
| Sub-second recall required on main path | `store.search()` at session start (cached within session); do NOT use LangMem managed pipeline (p95 59.82s) |
| Full control, custom retrieval logic | Manual `store.put` / `store.search` in nodes |

### 3.3 Multi-tenancy rule

Always put tenant/user id as the **first** namespace component: `("users", user_id, "memories")`.
Resolve `{user_id}` from `config["configurable"]`, never from model output, to prevent
cross-tenant namespace leakage.

---

## Step 4 — Output and Verification

Every implementation must produce:

1. A node or `pre_model_hook` that handles context window management (trim or summarise).
2. A Store initialised with `.setup()` called once (deploy step, not per-request).
3. One shared `ConnectionPool` created in ASGI lifespan, reused by both `PostgresSaver` and
   `PostgresStore` with `autocommit=True`.

**Testing rule**: Always use `InMemorySaver` (not `AsyncPostgresSaver`) and `InMemoryStore` (not
`PostgresStore`) in tests, and always create fresh instances per test function — never share a
checkpointer or store between tests (causes cross-test state bleed). See `testing-foundations`
skill for the `@pytest.fixture` patterns.

Verify with:

```bash
# Confirm pgvector extension and store tables exist
uv run python -c "
from langgraph.store.postgres import PostgresStore
import os
store = PostgresStore.from_conn_string(os.environ['DB_URI'])
store.setup()
items = list(store.list_namespaces())
print('namespaces:', items)
"

# Smoke-test a round-trip put/search
uv run python -c "
from langgraph.store.memory import InMemoryStore
store = InMemoryStore(index={'dims': 4, 'embed': lambda texts: [[0.1,0.2,0.3,0.4]]*len(texts)})
store.put(('test', 'user-1'), 'k1', {'text': 'hello world'})
results = store.search(('test', 'user-1'), query='hello')
assert results, 'no results returned'
print('store round-trip OK')
"

# Confirm LangMem version
uv run python -c "import langmem; print('langmem version:', langmem.__version__)"
```

---

## Reference Files

| File | Domain | Primary source section |
|---|---|---|
| `references/short-term.md` | `trim_messages`, `SummarizationNode`, `RemoveMessage`, thread lifecycle | Research §1, §2 |
| `references/long-term-store.md` | `BaseStore`, `PostgresStore`, namespace design, semantic search, batch ops, GDPR | Research §3 |
| `references/langmem.md` | LangMem SDK, memory types, hot-path tools, background extraction, LOCOMO | Research §4 |
| `references/migration-from-legacy-memory.md` | Side-by-side code for all deprecated → current migrations | Research §6 |

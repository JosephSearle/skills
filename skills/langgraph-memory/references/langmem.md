# LangMem Reference — Memory SDK, Hot-Path Tools, Background Extraction, Benchmarks

## Version Warning

> **⚠️ LangMem 0.0.x — UNSTABLE API:** LangMem is pre-1.0 (latest on PyPI: `langmem 0.0.30`
> as of mid-2025). `0.0.30` was published specifically to lift the LangGraph version cap so
> it installs alongside LangGraph 1.x (see langmem issue #125, #130). Treat every API
> surface as subject to breaking change without a major version bump. **Pin the exact version
> in `pyproject.toml` and re-validate on every upgrade.** Known unstable areas:
> `actions_permitted` vs `enable_*` flag naming; manager ↔ search-tool read-back
> compatibility (issue #140); custom embed function injection (issue #114).

```toml
# pyproject.toml — pin exact LangMem version
[project]
dependencies = [
    "langmem==0.0.30",
    "langgraph>=1.0.0",
]
```

---

## Three Memory Types

| Type | Storage model | API | When to use |
|---|---|---|---|
| **Semantic** — facts and preferences | Collection (many searchable records) or Profile (one schema-bound document) | `create_manage_memory_tool`, `create_memory_store_manager` | Durable user preferences, facts, relationships |
| **Episodic** — past interactions | `Episode` records (`observation`, `thoughts`, `action`, `result`) retrieved as few-shot examples | `create_memory_store_manager(schemas=[Episode])` | "How did we handle a case like this before?" few-shot guidance |
| **Procedural** — self-updating prompts | System-prompt document in the Store, updated from conversation feedback | `create_prompt_optimizer` | Agent instructions that evolve from feedback |

### Semantic: Collection vs Profile

| | Collection | Profile |
|---|---|---|
| `enable_inserts` | `True` | `False` |
| Records | Many individual items (one per memory) | One document updated in place |
| Good for | Open-ended facts that accumulate | Stable user profile fields |
| Collision risk | Low (distinct keys per memory) | High — concurrent writes overwrite each other |

---

## Hot-Path Tools

Hot-path tools are standard LangChain tools attached to a `create_react_agent` or any tool
node. The agent **decides** when to call them — it can miss a write. They add tool-call and
tool-result tokens to every relevant turn.

### `create_manage_memory_tool` — full signature

```python
from typing import Literal, Type
from langchain_core.tools import BaseTool
from langgraph.store.base import BaseStore
from langmem import create_manage_memory_tool

tool: BaseTool = create_manage_memory_tool(
    namespace="memories",                     # str or tuple[str, ...]
    *,
    instructions: str = (
        "Proactively call this tool when you: "
        "1. Identify a new USER preference, fact, or important detail. "
        "2. Need to update or correct an existing memory. "
        "3. Need to remove an outdated memory."
    ),
    schema: Type = str,                       # Pydantic model for typed memory; default is str
    actions_permitted: tuple[Literal["create", "update", "delete"], ...] = (
        "create", "update", "delete"
    ),
    store: BaseStore | None = None,           # injected from graph if None
    name: str = "manage_memory",
)
```

> **⚠️ API naming in flux:** Older docs and examples show `enable_inserts=`, `enable_updates=`,
> `enable_deletes=` as parameters. Current reference uses `actions_permitted` for tools and
> reserves `enable_inserts`/`enable_updates`/`enable_deletes` for managers
> (`create_memory_manager`, `create_memory_store_manager`). Verify against your installed
> version — both forms may coexist during the 0.0.x transition.

### `create_search_memory_tool` — full signature

```python
from typing import Literal
from langchain_core.tools import BaseTool
from langgraph.store.base import BaseStore
from langmem import create_search_memory_tool

tool: BaseTool = create_search_memory_tool(
    namespace="memories",                     # str or tuple[str, ...]
    *,
    instructions: str = (
        "Search your memory for relevant information before answering questions "
        "about the user's preferences, past conversations, or stored facts."
    ),
    store: BaseStore | None = None,           # injected from graph if None
    response_format: Literal["content", "content_and_artifact"] = "content",
    name: str = "search_memory",
)
```

The tool exposes `query`, `limit`, `offset`, and `filter` to the agent. It runs a semantic
search against the store and returns `(serialized_memories, raw_memories)` when
`response_format="content_and_artifact"`.

### Complete agent setup with hot-path tools

```python
from __future__ import annotations

from langchain.chat_models import init_chat_model
from langgraph.prebuilt import create_react_agent
from langgraph.store.postgres import PostgresStore
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row
from langmem import create_manage_memory_tool, create_search_memory_tool

DB_URI = "postgresql://user:pass@localhost:5432/mydb"
pool = ConnectionPool(
    conninfo=DB_URI,
    kwargs={"autocommit": True, "row_factory": dict_row, "prepare_threshold": 0},
    min_size=2,
    max_size=10,
)
store = PostgresStore(
    conn=pool,
    index={"dims": 1536, "embed": "openai:text-embedding-3-small", "fields": ["text"]},
)
store.setup()  # run once at deploy time

agent = create_react_agent(
    init_chat_model("anthropic:claude-3-5-sonnet-latest"),
    tools=[
        create_manage_memory_tool(namespace=("memories", "{user_id}")),
        create_search_memory_tool(namespace=("memories", "{user_id}")),
    ],
    store=store,
)

# The {user_id} placeholder is resolved from config["configurable"]
result = agent.invoke(
    {"messages": [{"role": "user", "content": "Remember that I prefer dark mode."}]},
    config={"configurable": {"user_id": "user-42"}},
)
```

### Testing tools in isolation (no agent loop required)

```python
from langgraph.store.memory import InMemoryStore
from langmem import create_manage_memory_tool, create_search_memory_tool

store = InMemoryStore()

manage_tool = create_manage_memory_tool(namespace=("test", "u1"), store=store)
search_tool = create_search_memory_tool(namespace=("test", "u1"), store=store)

# Write a memory directly
manage_tool.invoke({"content": "user prefers Python", "action": "create"})

# Verify it was stored
items = store.search(("test", "u1"))
assert any("Python" in str(item.value) for item in items), "memory not written"

# Read via search tool
result = search_tool.invoke({"query": "programming language preference", "limit": 3})
assert "Python" in result
```

---

## Background Memory Extraction

Background extraction uses `create_memory_store_manager` to run an LLM extraction pass and
`ReflectionExecutor` to **debounce** that pass off the main path. This adds zero latency to
the user-facing response; the trade-off is that memories are available only in the next
session (eventual consistency).

### `create_memory_store_manager` — full signature

```python
from typing import Callable, Type
from langchain_core.language_models import BaseChatModel
from langgraph.store.base import BaseStore
from langmem import create_memory_store_manager

manager = create_memory_store_manager(
    model="anthropic:claude-3-5-sonnet-latest",  # str model name or BaseChatModel
    *,
    schemas: list[Type] | None = None,            # Pydantic models for typed extraction
    instructions: str = "Extract memory-worthy information from the conversation.",
    default: str | dict | None = None,            # default document for profile stores
    default_factory: Callable | None = None,
    enable_inserts: bool = True,
    enable_deletes: bool = False,
    query_model: str | BaseChatModel | None = None,  # smaller model for embedding queries
    query_limit: int = 5,
    namespace: tuple[str, ...] = ("memories", "{langgraph_user_id}"),
    store: BaseStore | None = None,
    phases: list | None = None,
)
```

### `ReflectionExecutor` — debounce pattern

```python
from __future__ import annotations

import asyncio
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.func import entrypoint
from langgraph.store.postgres import PostgresStore
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row
from langmem import ReflectionExecutor, create_memory_store_manager

DB_URI = "postgresql://user:pass@localhost:5432/mydb"
pool = ConnectionPool(
    conninfo=DB_URI,
    kwargs={"autocommit": True, "row_factory": dict_row},
    min_size=2,
    max_size=10,
)
store = PostgresStore(
    conn=pool,
    index={"dims": 1536, "embed": "openai:text-embedding-3-small", "fields": ["text"]},
)
store.setup()

llm = init_chat_model("anthropic:claude-3-5-sonnet-latest")

manager = create_memory_store_manager(
    "anthropic:claude-3-5-sonnet-latest",
    namespace=("memories", "{user_id}"),
    enable_inserts=True,
    enable_deletes=False,
)
# ReflectionExecutor wraps the manager with debounce logic
executor = ReflectionExecutor(manager, store=store)


@entrypoint(store=store)
def chat(message: str, config: dict) -> str:
    """Simple chat entrypoint with background memory extraction."""
    response: AIMessage = llm.invoke(message)

    # Submit conversation for background extraction
    # If another message arrives within 30 minutes, the pending task is cancelled
    # and rescheduled — extraction runs once on the settled conversation
    to_process = {
        "messages": [
            {"role": "user", "content": message},
            {"role": "assistant", "content": response.content},
        ]
    }
    executor.submit(
        to_process,
        after_seconds=1_800,   # 30-minute debounce — adjust to your session cadence
        config=config,
    )
    return response.content
```

### Debounce behaviour

- Each `executor.submit(payload, after_seconds=N)` cancels any pending extraction task for
  the same config and schedules a new one `N` seconds out.
- With a long `after_seconds` (e.g. 1800), extraction effectively runs once per conversation
  burst — not per message.
- For guaranteed extraction at session end (e.g., on a disconnect signal), call
  `await manager.ainvoke(to_process, config=config)` synchronously.

### Production failure handling for background extraction

Background failures are **silent by default** — an exception in the manager swallows the
extraction with no signal to the caller. Always wrap:

```python
import logging

logger = logging.getLogger(__name__)

async def safe_extract(manager, payload: dict, config: dict) -> None:
    """Wrapper for background memory extraction with error logging."""
    try:
        await manager.ainvoke(payload, config=config)
    except Exception:
        logger.exception(
            "Background memory extraction failed for user %s",
            config.get("configurable", {}).get("user_id"),
        )
        # Optional: push to a dead-letter queue / Sentry / PagerDuty
```

### Serverless caveat

On serverless platforms (AWS Lambda, Google Cloud Run), local background threads die between
function invocations. Use the Platform remote executor form:

```python
from langmem import ReflectionExecutor

# Remote executor — survives across serverless invocations
executor = ReflectionExecutor(
    "manager_name",
    ("memories",),
    url="http://localhost:2024",   # LangGraph Platform URL
)
```

---

## Memory Injection at Session Start

Read relevant memories before the first model call and inject them into the system prompt.
This is the **deterministic recall** pattern — no agent discretion, fixed token cost per turn.

```python
from __future__ import annotations

from langchain.chat_models import init_chat_model
from langchain_core.messages import AnyMessage
from langgraph.graph import StateGraph, START, MessagesState
from langgraph.store.base import BaseStore

class State(MessagesState):
    user_id: str
    memory_context: str

llm = init_chat_model("anthropic:claude-3-5-sonnet-latest")

def load_memories(state: State, *, store: BaseStore) -> dict:
    """Inject semantically relevant memories into state at session start."""
    last_message = state["messages"][-1].content if state["messages"] else ""
    results = store.search(
        ("memories", state["user_id"]),
        query=last_message,
        limit=5,
    )
    block = "\n".join(
        f"- {r.value.get('content', r.value)}" for r in results
    )
    return {"memory_context": block}

def call_model(state: State) -> dict:
    system = {
        "role": "system",
        "content": (
            "You are a helpful assistant.\n"
            f"Known about the user:\n{state['memory_context']}"
            if state["memory_context"]
            else "You are a helpful assistant."
        ),
    }
    response = llm.invoke([system, *state["messages"]])
    return {"messages": [response]}

builder = StateGraph(State)
builder.add_node("load_memories", load_memories)
builder.add_node("call_model", call_model)
builder.add_edge(START, "load_memories")
builder.add_edge("load_memories", "call_model")
```

**Cache within the session.** Memories rarely change mid-session; avoid repeated vector
queries on every turn by loading once at session start and holding in state.

---

## Custom Pydantic Schemas for Typed Memory

Default memory is unstructured string content. Pass `schemas=[MyModel]` for typed extraction.
Richer field docstrings yield higher-quality, more consistent extraction.

```python
from __future__ import annotations

from pydantic import BaseModel, Field
from langgraph.store.memory import InMemoryStore
from langmem import create_memory_store_manager

class UserProfile(BaseModel):
    """Stable facts about the user's identity and preferences."""
    name: str = Field(description="User's real name or preferred name")
    preferred_name: str = Field(description="How the user wants to be addressed")
    response_style_preference: str = Field(
        description="e.g., 'concise', 'detailed', 'casual', 'formal'"
    )
    special_skills: list[str] = Field(
        default_factory=list,
        description="Technical skills or expertise the user has mentioned",
    )
    other_preferences: list[str] = Field(
        default_factory=list,
        description="Any other stated preferences (e.g., 'dark mode', 'metric units')",
    )

class Episode(BaseModel):
    """A successful past interaction, stored for few-shot retrieval."""
    observation: str = Field(description="What the user asked or what triggered this episode")
    thoughts: str = Field(description="The reasoning or approach taken")
    action: str = Field(description="What was done or recommended")
    result: str = Field(description="The outcome or user feedback")

store = InMemoryStore()

# Profile manager — one document per user, updated in place
profile_manager = create_memory_store_manager(
    "anthropic:claude-3-5-sonnet-latest",
    schemas=[UserProfile],
    namespace=("profiles", "{user_id}"),
    enable_inserts=False,  # profile mode: update in place, not accumulate
    enable_deletes=False,
    store=store,
)

# Episode collection manager — accumulates records
episode_manager = create_memory_store_manager(
    "anthropic:claude-3-5-sonnet-latest",
    schemas=[Episode],
    namespace=("episodes", "{user_id}"),
    enable_inserts=True,   # collection mode: each episode is a separate record
    enable_deletes=True,
    store=store,
)
```

---

## Procedural Memory — `create_prompt_optimizer`

The `create_prompt_optimizer` updates an agent's system prompt based on conversation
trajectories and feedback. The revised prompt is stored in the Store and read back at the
start of subsequent runs.

```python
from __future__ import annotations

from langchain.chat_models import init_chat_model
from langgraph.store.memory import InMemoryStore
from langmem import create_prompt_optimizer

store = InMemoryStore()
model = init_chat_model("anthropic:claude-3-5-sonnet-latest")

optimizer = create_prompt_optimizer(
    model,
    kind="metaprompt",        # "metaprompt" or "gradient" (trajectory-based)
    config={"max_reflection_steps": 3},
)

# Initial prompt
current_prompt = "You are a helpful coding assistant."

# Optimise from a trajectory + feedback pair
messages = [
    {"role": "user", "content": "Explain decorators in Python"},
    {"role": "assistant", "content": "Decorators are functions that wrap other functions..."},
]
feedback = "Too abstract. Give a concrete example first."

result = optimizer.invoke(
    {
        "trajectories": [(messages, feedback)],
        "prompt": current_prompt,
    }
)
revised_prompt = result["prompt"]

# Persist the revised prompt for future sessions
store.put(("instructions",), "system_prompt", {"text": revised_prompt})

# Read back at agent startup
def load_system_prompt(store: InMemoryStore) -> str:
    item = store.get(("instructions",), "system_prompt")
    if item is not None:
        return item.value["text"]
    return "You are a helpful assistant."
```

---

## LOCOMO Benchmark Results and Latency Warning

On the LOCOMO long-term-conversation benchmark (LLM-as-a-Judge):

| Metric | LangMem score | Notes |
|---|---|---|
| Overall | 58.10% | Question-weighted figure; computed by third-party repos (memobase/Backboard) |
| Single-hop | 62.23% | |
| Multi-hop | 47.92% | |
| Open-domain | 71.12% | |
| Temporal | **23.43%** | Clear weakness — barely above OpenAI baseline of 21.71% |
| p50 search latency | 17.99 s | Per Mem0 paper arXiv:2504.19413, Table 2 |
| p95 search latency | **59.82 s** | |

From the Mem0 paper (arXiv:2504.19413, Prateek Chhikara et al., April 2025, Table 2):

> "LangMem exhibits even higher search latencies (p50: 17.99s, p95: 59.82s), **rendering it
> impractical for interactive applications.**"

**This benchmark was authored by a competitor (the Mem0 team).** Treat the numbers as
directional, not definitive — later third-party re-runs (Memori, Memobase) report materially
different numbers under different judges and configurations. The temporal score weakness and
the latency finding are, however, consistent with production reports.

### Latency implications

| Requirement | Recommended approach |
|---|---|
| Sub-second recall on main path | `store.search()` at session start (cached); do NOT use the LangMem managed pipeline here |
| p95 < 1 s | Evaluate Mem0 (reported p95 0.200 s) or Zep |
| Temporal reasoning critical | LangMem's 23.43% temporal score makes it a poor fit; consider a dedicated temporal knowledge graph |
| Background consolidation, no latency requirement | `ReflectionExecutor` is fine |

---

## Known Bugs and Open Issues

| Issue | Description | Status |
|---|---|---|
| langmem #140 | Memories written by `create_memory_store_manager` may not be retrievable by `create_search_memory_tool`; automatic hydration into agent context did not work as documented | Open — validate read-back path explicitly before shipping |
| langmem #126 | Parallel tool calls can break `SummarizationNode` — multiple `ToolMessage`s for one `AIMessage` not handled | Open |
| langmem #111 | `SummarizationNode` used as `pre_model_hook` drops `HumanMessage` after a tool invocation; LLM call fails | Open |
| langmem #114 | Custom `embed` function not used by agent; falls back to default silently | Open |
| langmem #125, #130 | `langmem<=0.0.29` pins `langgraph<0.7.0`; `0.0.30` lifts the cap — only version compatible with LangGraph 1.x | Fixed in 0.0.30 |

**Always test the manager → search-tool read-back path** (issue #140) in an integration test
before shipping any feature that depends on background extraction + hot-path retrieval:

```python
from langgraph.store.memory import InMemoryStore
from langmem import create_memory_store_manager, create_search_memory_tool

store = InMemoryStore()
manager = create_memory_store_manager(
    "anthropic:claude-3-5-sonnet-latest",
    namespace=("test", "u1"),
    store=store,
)
search_tool = create_search_memory_tool(namespace=("test", "u1"), store=store)

# Write via manager
manager.invoke({
    "messages": [{"role": "user", "content": "I use dark mode and prefer Python."}]
})

# Verify retrieval via search tool
result = search_tool.invoke({"query": "color scheme preference", "limit": 5})
assert "dark" in result.lower(), (
    "Manager-written memories not visible to search tool — langmem issue #140 may be active"
)
```

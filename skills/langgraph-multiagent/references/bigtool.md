# langgraph-bigtool Reference

> **Version: `langgraph-bigtool` v0.0.3** (Jun 3 2025). Three releases total.
> **Low maintenance velocity** — validate behavior before depending on this in production.
> The library has not had a release in the 12 months following its initial publish.
> Consider wrapping it in a thin adapter so you can swap out the retrieval mechanism if needed.

---

## Problem Statement

Standard LangGraph agents receive their full tool list in every model call. Anthropic and
OpenAI models have hard context limits; passing hundreds of tool schemas can:

1. Exhaust the context window before any task-relevant content is added.
2. Degrade routing accuracy — models perform worse when choosing among very large tool sets.
3. Increase cost linearly with the number of tools even when most are irrelevant.

`langgraph-bigtool` solves this by storing all tools in a LangGraph `Store` with embeddings
and surfacing a `retrieve_tools` tool that fetches a small relevant subset per turn.

---

## When to use langgraph-bigtool vs alternatives

| Scenario | Recommendation |
|---|---|
| < ~20 tools, all plausibly relevant | Standard `create_react_agent` with full tool list |
| 20–100 tools, categorical domains | Router pattern — classify domain, dispatch to sub-agent with domain's tool subset |
| 100+ tools, semantic diversity, single agent | **`langgraph-bigtool`** — semantic retrieval per turn |
| Tools change frequently at runtime | `langgraph-bigtool` with a mutable Store; re-index on tool additions |
| Tools are MCP tools from multiple servers | Router to per-server sub-agents is usually more reliable than a single bigtool index |

---

## `create_agent` API

Note: `langgraph-bigtool` exports its own `create_agent` — not to be confused with
`langchain.agents.create_react_agent` or `langgraph.prebuilt.create_react_agent`.

```python
from langgraph_bigtool import create_agent

# Minimal signature (as of v0.0.3)
create_agent(
    llm: LanguageModelLike,
    tool_registry: dict[str, BaseTool],
    *,
    retrieve_tools_function: Callable | None = None,
    retrieve_tools_coroutine: Callable | None = None,
) -> StateGraph   # returns uncompiled StateGraph
```

The agent automatically injects a `retrieve_tools` tool that the LLM calls when it needs a
capability it doesn't have in the current turn's active tool list.

---

## Complete Setup Example

```python
from __future__ import annotations

from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool
from langchain_openai import OpenAIEmbeddings
from langgraph.store.memory import InMemoryStore
from langgraph_bigtool import create_agent

# ── Build the tool registry ───────────────────────────────────────────────────

@tool
def search_web(query: str) -> str:
    """Search the web for current information."""
    return f"Web results for: {query}"


@tool
def read_csv(path: str) -> str:
    """Read a CSV file and return its contents as JSON."""
    return f"Contents of {path}"


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email."""
    return f"Email sent to {to}"


@tool
def query_database(sql: str) -> str:
    """Run a SQL query and return results."""
    return f"Results for: {sql}"


@tool
def resize_image(path: str, width: int, height: int) -> str:
    """Resize an image file."""
    return f"Resized {path} to {width}x{height}"


# Register all tools — keys are stable IDs used for retrieval
tool_registry: dict[str, object] = {
    "search_web": search_web,
    "read_csv": read_csv,
    "send_email": send_email,
    "query_database": query_database,
    "resize_image": resize_image,
}

# ── Build the indexed Store ───────────────────────────────────────────────────

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

store = InMemoryStore(
    index={
        "embed": embeddings,
        "dims": 1536,
        "fields": ["description"],   # the Store field whose value is embedded
    }
)

# Index each tool — embed "{name}: {description}" for retrieval accuracy
for tool_id, t in tool_registry.items():
    store.put(
        ("tools",),           # namespace tuple
        tool_id,              # key
        {"description": f"{t.name}: {t.description}"},  # type: ignore[union-attr]
    )

# ── Build and compile the agent ───────────────────────────────────────────────

llm = ChatAnthropic(model="claude-sonnet-4-6")

builder = create_agent(llm, tool_registry)
agent = builder.compile(store=store)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "Search for the latest LangGraph news."}]}
)
```

---

## Retrieval Tuning

### Changing result count

```python
from __future__ import annotations

from langgraph.store.memory import InMemoryStore


def custom_retrieve_tools(
    store: InMemoryStore,
    query: str,
    *,
    limit: int = 5,
) -> list[str]:
    """Return up to `limit` tool IDs ranked by semantic similarity."""
    results = store.search(("tools",), query=query, limit=limit)
    return [item.key for item in results]


builder = create_agent(llm, tool_registry, retrieve_tools_function=custom_retrieve_tools)
agent = builder.compile(store=store)
```

### Categorical (non-semantic) retrieval

When tools cluster into clear categories, categorical dispatch often outperforms semantic
similarity — the model picks a category rather than embedding-matching against individual
tool descriptions.

```python
from __future__ import annotations

from typing import Literal

from langchain_core.tools import tool


CATEGORY_TOOLS: dict[str, list[str]] = {
    "web": ["search_web"],
    "data": ["read_csv", "query_database"],
    "communication": ["send_email"],
    "media": ["resize_image"],
}


def categorical_retrieve(
    store: object,  # unused; kept for interface compatibility
    category: Literal["web", "data", "communication", "media"],
) -> list[str]:
    """Return tool IDs for the given category."""
    return CATEGORY_TOOLS.get(category, [])


builder = create_agent(
    llm, tool_registry, retrieve_tools_function=categorical_retrieve
)
agent = builder.compile(store=store)
```

### Async retrieval (for async agents)

```python
from __future__ import annotations

from langgraph.store.memory import InMemoryStore


async def async_retrieve_tools(
    store: InMemoryStore,
    query: str,
    *,
    limit: int = 5,
) -> list[str]:
    results = await store.asearch(("tools",), query=query, limit=limit)
    return [item.key for item in results]


builder = create_agent(
    llm, tool_registry, retrieve_tools_coroutine=async_retrieve_tools
)
agent = builder.compile(store=store)
```

---

## Store Backends

| Backend | Import | Use case |
|---|---|---|
| `InMemoryStore` | `from langgraph.store.memory import InMemoryStore` | Development, testing, ephemeral sessions |
| Postgres store | `from langgraph.store.postgres import PostgresStore` | Production; persistent across restarts |

### Postgres store setup

```python
from __future__ import annotations

from langchain_openai import OpenAIEmbeddings
from langgraph.store.postgres import PostgresStore  # requires langgraph[postgres]

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

store = PostgresStore.from_conn_string(
    "postgresql://user:pass@localhost:5432/mydb",
    index={
        "embed": embeddings,
        "dims": 1536,
        "fields": ["description"],
    },
)
```

---

## Tool Schema Indexing Best Practices

| Decision | Recommendation | Why |
|---|---|---|
| What to embed | `"{name}: {description}"` — both name and description | Name alone misses semantic intent; description alone misses the callable identifier |
| Namespace | Use `("tools",)` consistently | Enables `store.search(("tools",), ...)` with no ambiguity |
| Key | Stable tool ID (snake_case, matches registry key) | Used to look up the `BaseTool` object after retrieval |
| Field name | `"description"` matching the Store `fields` config | Mismatch silently produces no embeddings |
| Index timing | At startup, before first agent invocation | Store must be populated before the `retrieve_tools` tool runs |
| Dynamic tool additions | Call `store.put(...)` then `store.aput(...)` at runtime | InMemoryStore supports runtime updates; Postgres store also supports this |

---

## Known Limitations

| Limitation | Detail |
|---|---|
| Tools must be pre-registered | All tools must be in `tool_registry` and indexed before the agent runs — no runtime discovery |
| Retrieval can miss | Semantic search returns top-K; if the right tool falls outside top-K it is never offered to the model. Increase `limit` or use categorical retrieval to mitigate |
| Embedding latency per turn | Every model call that needs tools triggers a `store.search()` — adds ~50–150 ms per turn depending on backend |
| Library maintenance velocity | v0.0.3 (Jun 3 2025) — three releases total; has not been updated in ~12 months as of mid-2026 |
| No built-in re-ranking | Retrieval is pure embedding similarity; no cross-encoder re-ranking available |
| Tool schema drift | If a tool's description changes, re-index by calling `store.put(...)` again — stale embeddings persist otherwise |

---

## Research Background

`langgraph-bigtool` is grounded in:
- **RAG-Tool Fusion** (arXiv:2410.14594) — using retrieval-augmented generation to select
  relevant tools from a large pool.
- **ToolBench** (arXiv:2502.07223) — benchmarking LLM tool use at scale with retrieval.

The embedding-based retrieval approach mirrors RAG for documents but applied to tool schemas.
The same failure modes apply: embedding distance is a proxy for semantic relevance, not a
guarantee. Evaluate retrieval recall on your specific tool set before deploying.

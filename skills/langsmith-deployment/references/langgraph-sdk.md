# LangGraph SDK Reference

Install: `uv add langgraph-sdk`

The Python SDK provides `LangGraphClient` (async) and `SyncLangGraphClient` (sync) with
identical sub-client APIs. All new code should use the async client.

---

## Client Factory Functions

| Function | Returns | Use when |
|---|---|---|
| `get_client(...)` | `LangGraphClient` (async) | Production code, FastAPI handlers, async scripts |
| `get_sync_client(...)` | `SyncLangGraphClient` | REPL exploration, scripts without an event loop, legacy codebases |

### `get_client` — full constructor

```python
from langgraph_sdk import get_client

client = get_client(
    url="https://your-deployment.langsmith.com",  # default: http://localhost:8123
    api_key="lsv2_...",                            # falls back to LANGSMITH_API_KEY or LANGGRAPH_API_KEY env var
    headers={"X-Custom-Header": "value"},          # optional extra headers on every request
)
```

| Param | Type | Default | Description |
|---|---|---|---|
| `url` | `str` | `"http://localhost:8123"` | Deployment base URL. `langgraph dev` runs on port 2024 by default; `langgraph up` runs on port 8123. |
| `api_key` | `str \| None` | `None` → env var | API key sent as `x-api-key` header. Falls back to `LANGSMITH_API_KEY`, then `LANGGRAPH_API_KEY`. |
| `headers` | `dict[str, str] \| None` | `None` | Additional HTTP headers merged with every request. |

> **⚠️ Port note:** `langgraph dev` defaults to port **2024**; `langgraph up` defaults to
> **8123**. The SDK default URL (`localhost:8123`) matches `langgraph up`, not `langgraph dev`.
> Set `url="http://localhost:2024"` when connecting to a `langgraph dev` server.

### `get_sync_client` — full constructor

```python
from langgraph_sdk import get_sync_client

sync_client = get_sync_client(
    url="http://localhost:8123",
    api_key="lsv2_...",
)
```

Same params as `get_client`. All sub-client methods are synchronous equivalents.

---

## Sub-Client Overview

| Sub-client | Attribute | Primary resource |
|---|---|---|
| Assistants | `client.assistants` | Graph configurations + versioning |
| Threads | `client.threads` | Stateful execution contexts |
| Runs | `client.runs` | Graph executions |
| Crons | `client.crons` | Scheduled executions |
| Store | `client.store` | Long-term memory (shared key-value + semantic search) |
| HTTP (raw) | `client.http` | Direct `get`/`post` for unlisted endpoints |

---

## `client.assistants` — Full API

| Method | Signature | Returns | Description |
|---|---|---|---|
| `create` | `(graph_id, *, config=None, metadata=None, name=None, if_exists=None)` | `Assistant` | Create assistant |
| `get` | `(assistant_id)` | `Assistant` | Get by UUID |
| `update` | `(assistant_id, *, config=None, metadata=None, name=None)` | `Assistant` | Replace config (full replace, new version) |
| `delete` | `(assistant_id)` | `None` | Delete all versions |
| `search` | `(*, metadata=None, graph_id=None, limit=10, offset=0)` | `list[Assistant]` | Search assistants |
| `get_versions` | `(assistant_id, *, metadata=None, limit=10, offset=0)` | `list[AssistantVersion]` | List all versions |
| `set_latest` | `(assistant_id, *, version)` | `Assistant` | Promote a version to latest |

```python
import asyncio
from langgraph_sdk import get_client

async def assistant_lifecycle() -> None:
    client = get_client(url="http://localhost:8123", api_key="lsv2_...")

    # Create a custom assistant
    assistant = await client.assistants.create(
        graph_id="agent",
        config={"configurable": {"model_name": "claude-sonnet-4-6", "temperature": 0.7}},
        name="production-agent",
        metadata={"team": "backend", "env": "prod"},
    )
    assistant_id: str = assistant["assistant_id"]

    # Update config (full replace — not a merge)
    updated = await client.assistants.update(
        assistant_id,
        config={"configurable": {"model_name": "claude-opus-4", "temperature": 0.3}},
    )

    # List versions
    versions = await client.assistants.get_versions(assistant_id)
    print(f"Versions: {len(versions)}")

    # Rollback to version 1
    await client.assistants.set_latest(assistant_id, version=1)

    # Search all assistants for graph "agent"
    all_agents = await client.assistants.search(graph_id="agent", limit=50)
    print(f"Total agents: {len(all_agents)}")

asyncio.run(assistant_lifecycle())
```

---

## `client.threads` — Full API

| Method | Signature | Returns | Description |
|---|---|---|---|
| `create` | `(*, metadata=None, thread_id=None, if_exists=None)` | `Thread` | Create thread |
| `get` | `(thread_id)` | `Thread` | Get thread |
| `update` | `(thread_id, *, metadata)` | `Thread` | Update thread metadata |
| `delete` | `(thread_id)` | `None` | Delete thread |
| `search` | `(*, metadata=None, status=None, limit=10, offset=0)` | `list[Thread]` | Search threads |
| `get_state` | `(thread_id, *, checkpoint_id=None, subgraphs=False)` | `ThreadState` | Get state (optionally at a checkpoint) |
| `update_state` | `(thread_id, values, *, checkpoint_id=None, as_node=None)` | `dict` | Write state (creates checkpoint; fork if checkpoint_id provided) |
| `get_history` | `(thread_id, *, limit=10, before=None, metadata=None, checkpoint=None)` | `AsyncIterator[ThreadState]` | Reverse-chronological checkpoint history |
| `join_stream` | `(thread_id, *, last_event_id=None)` | `AsyncIterator[StreamPart]` | Join/resume active stream |

```python
import asyncio
from langgraph_sdk import get_client

async def thread_state_operations() -> None:
    client = get_client(url="http://localhost:8123", api_key="lsv2_...")
    thread = await client.threads.create(metadata={"session": "demo"})
    thread_id: str = thread["thread_id"]

    # Run something
    run = await client.runs.create(
        thread_id,
        "agent",
        input={"messages": [{"role": "user", "content": "What time is it?"}]},
    )
    await client.runs.join(thread_id, run["run_id"])

    # Read current state
    state = await client.threads.get_state(thread_id)
    print("State keys:", list(state["values"].keys()))

    # Inject a human-in-the-loop state update
    await client.threads.update_state(
        thread_id,
        values={"human_review": {"approved": True, "reviewer": "alice"}},
        as_node="human_review_node",
    )

    # Resume from the updated state (input=None means resume from last checkpoint)
    async for chunk in client.runs.stream(
        thread_id,
        "agent",
        input=None,
        stream_mode="updates",
    ):
        if chunk.event != "end":
            print("[resume update]", chunk.data)

asyncio.run(thread_state_operations())
```

---

## `client.runs` — Full API

| Method | Signature | Returns | Description |
|---|---|---|---|
| `create` | `(thread_id, assistant_id, *, input=None, config=None, metadata=None, stream_mode=None, interrupt_before=None, interrupt_after=None, multitask_strategy=None, on_completion=None, durability=None, webhook=None, context=None)` | `Run` | Background run |
| `create_batch` | `(payloads)` | `list[Run]` | Create multiple runs at once |
| `wait` | `(thread_id, assistant_id, *, input=None, ...)` | `dict` | Blocking run — returns final state |
| `stream` | `(thread_id, assistant_id, *, input=None, stream_mode=None, ...)` | `AsyncIterator[StreamPart]` | Streaming run — yields SSE chunks |
| `get` | `(thread_id, run_id)` | `Run` | Get run by ID |
| `list` | `(thread_id, *, limit=10, offset=0)` | `list[Run]` | List runs on thread |
| `join` | `(thread_id, run_id)` | `None` | Wait for background run to complete |
| `cancel` | `(thread_id, run_id, *, wait=False, action="interrupt")` | `None` | Cancel run |
| `delete` | `(thread_id, run_id)` | `None` | Delete run |

**Stateless variants:** Pass `thread_id=None` for stateless runs.

### Streaming consumption pattern

```python
import asyncio
from langgraph_sdk import get_client
from langgraph_sdk.schema import StreamPart

async def stream_agent_response(user_input: str) -> str:
    """Stream a single turn and collect the assistant's text response."""
    client = get_client(
        url="https://your-deployment.langsmith.com",
        api_key="lsv2_...",
    )
    thread = await client.threads.create()
    collected_tokens: list[str] = []

    async for chunk in client.runs.stream(
        thread["thread_id"],
        "agent",
        input={"messages": [{"role": "user", "content": user_input}]},
        stream_mode=["updates", "messages-tuple"],
    ):
        chunk: StreamPart
        if chunk.event == "messages-tuple":
            # chunk.data is (message_chunk_dict, metadata_dict)
            msg_chunk, _metadata = chunk.data
            content = msg_chunk.get("content", "")
            if isinstance(content, str) and content:
                collected_tokens.append(content)
                print(content, end="", flush=True)
        elif chunk.event == "updates":
            # node-level state delta
            pass
        elif chunk.event == "error":
            raise RuntimeError(f"Run error: {chunk.data}")

    print()  # newline after stream
    return "".join(collected_tokens)


asyncio.run(stream_agent_response("Summarise the Agent Server in 3 sentences."))
```

### multitask_strategy with enqueue

```python
import asyncio
from langgraph_sdk import get_client

async def enqueue_two_messages(deployment_url: str, api_key: str) -> None:
    client = get_client(url=deployment_url, api_key=api_key)
    thread = await client.threads.create()
    thread_id: str = thread["thread_id"]

    first = await client.runs.create(
        thread_id,
        "agent",
        input={"messages": [{"role": "user", "content": "What is 2+2?"}]},
        multitask_strategy="enqueue",
    )
    second = await client.runs.create(
        thread_id,
        "agent",
        input={"messages": [{"role": "user", "content": "Multiply by 5."}]},
        multitask_strategy="enqueue",
    )

    # Wait for both; they execute sequentially
    await client.runs.join(thread_id, first["run_id"])
    await client.runs.join(thread_id, second["run_id"])

    final_state = await client.threads.get_state(thread_id)
    print("Final messages count:", len(final_state["values"].get("messages", [])))

asyncio.run(enqueue_two_messages("http://localhost:8123", "lsv2_..."))
```

---

## `client.crons` — Full API

| Method | Signature | Returns | Description |
|---|---|---|---|
| `create` | `(assistant_id, *, schedule, input=None, metadata=None, config=None, interrupt_before=None, interrupt_after=None, multitask_strategy=None, webhook=None, end_time=None, enabled=True, on_run_completed=None, timezone=None)` | `Cron` | Stateless cron (new thread per execution) |
| `create_for_thread` | `(thread_id, assistant_id, *, schedule, ...)` | `Cron` | Threaded cron (fixed thread) |
| `get` | `(cron_id)` | `Cron` | Get cron |
| `update` | `(cron_id, *, schedule=None, input=None, metadata=None, enabled=None)` | `Cron` | Update cron |
| `delete` | `(cron_id)` | `None` | Delete cron |
| `search` | `(*, graph_id=None, assistant_id=None, limit=10, offset=0)` | `list[Cron]` | Search crons |

---

## `client.store` — Full API

| Method | Signature | Returns | Description |
|---|---|---|---|
| `put_item` | `(namespace, /, key, value, *, index=None, ttl=None)` | `None` | Upsert item |
| `get_item` | `(namespace, /, key, *, refresh_ttl=None)` | `Item` | Get item |
| `delete_item` | `(namespace, /, key)` | `None` | Delete item |
| `search_items` | `(namespace_prefix, /, *, filter=None, limit=10, offset=0, query=None, refresh_ttl=None)` | `SearchItemsResponse` | Search / list items |
| `list_namespaces` | `(*, prefix=None, suffix=None, max_depth=None, limit=100, offset=0)` | `list[list[str]]` | List namespace paths |

`namespace` is a positional-or-keyword `list[str]` (uses `/` as positional separator in the
SDK signature — always pass as a list).

```python
import asyncio
from langgraph_sdk import get_client

async def store_example() -> None:
    client = get_client(url="http://localhost:8123", api_key="lsv2_...")
    ns = ["project", "assistant", "memory"]

    # Store multiple items
    await client.store.put_item(ns, key="fact-1", value={"fact": "User prefers dark mode"})
    await client.store.put_item(ns, key="fact-2", value={"fact": "User speaks English and French"})

    # List all items in namespace
    all_items = await client.store.search_items(ns, limit=100)
    print(f"Stored {len(all_items['items'])} items")

    # Semantic search (requires index config)
    hits = await client.store.search_items(
        ns,
        query="what language does this user speak?",
        limit=3,
    )
    for item in hits["items"]:
        print(f"  {item['key']}: {item['value']}")

    # Filter search
    filtered = await client.store.search_items(
        ["project"],
        filter={"type": "preference"},
        limit=10,
    )

    # List namespaces under "project"
    namespaces = await client.store.list_namespaces(prefix=["project"], max_depth=3)
    for ns_path in namespaces:
        print("Namespace:", "/".join(ns_path))

asyncio.run(store_example())
```

---

## `RemoteGraph`

`RemoteGraph` wraps a deployed Agent Server as a callable LangGraph node. It implements the
same interface as a local `CompiledGraph` — supporting `.invoke()`, `.stream()`, `.ainvoke()`,
and `.astream()` — making it drop-in composable into multi-agent graphs.

### Constructor

```python
from langgraph.pregel import RemoteGraph

remote = RemoteGraph(
    graph_id="agent",                                  # graph ID or assistant UUID
    url="https://your-deployment.langsmith.com",       # Agent Server base URL
    api_key="lsv2_...",                                # falls back to LANGSMITH_API_KEY env var
    client=None,                                       # optional: provide an existing LangGraphClient
    config=None,                                       # optional: {"configurable": {...}}
)
```

| Param | Type | Default | Description |
|---|---|---|---|
| `graph_id` | `str` | required | Graph ID in `langgraph.json` or assistant UUID |
| `url` | `str \| None` | `None` | Deployment URL; required if `client` not provided |
| `api_key` | `str \| None` | `None` | Auth key; falls back to env vars |
| `client` | `LangGraphClient \| None` | `None` | Pre-configured client (takes precedence over `url`/`api_key`) |
| `config` | `RunnableConfig \| None` | `None` | Base config applied to all invocations |

### Usage

```python
import asyncio
from langgraph.pregel import RemoteGraph

async def use_remote_graph() -> None:
    remote = RemoteGraph(
        "agent",
        url="https://your-deployment.langsmith.com",
        api_key="lsv2_...",
    )

    # Synchronous invoke
    result = remote.invoke(
        {"messages": [{"role": "user", "content": "Hello from RemoteGraph"}]},
    )
    print("Invoke result:", result)

    # Async stream
    async for chunk in remote.astream(
        {"messages": [{"role": "user", "content": "Stream this please"}]},
        stream_mode="updates",
    ):
        print("Remote chunk:", chunk)

asyncio.run(use_remote_graph())
```

### RemoteGraph vs direct SDK client

| Aspect | `RemoteGraph` | `client.runs.stream` |
|---|---|---|
| Interface | LangGraph `Runnable` API (invoke/stream/ainvoke/astream) | Raw HTTP API mirroring REST |
| Composability | Drop-in as a node in another graph | Not composable as a graph node |
| Thread management | Auto-creates threads | Manual thread lifecycle |
| Config propagation | Via `RunnableConfig` | Via `config` kwarg |
| Streaming | Via `astream` / `stream` | Via `client.runs.stream` async iterator |

Use `RemoteGraph` when building orchestrator graphs that delegate to remote sub-agents. Use
`client.runs.stream` when you need full control over thread IDs, run metadata, or webhook
configuration.

---

## agent-chat-ui

**Next.js** web application for chatting with any LangGraph server that exposes a `messages`
key. Source: `langchain-ai/agent-chat-ui`. Hosted demo: `agentchat.vercel.app`.

### Self-hosting configuration

| Environment variable | Required | Description |
|---|---|---|
| `LANGGRAPH_API_URL` | Yes (proxy mode) | Agent Server URL — kept server-side only |
| `NEXT_PUBLIC_API_URL` | Yes (proxy mode) | Your site URL + `/api` (e.g., `https://yourapp.com/api`) |
| `LANGSMITH_API_KEY` | Yes (proxy mode) | Server-side only — never exposed to browser |
| `NEXT_PUBLIC_ASSISTANT_ID` | No | Pre-fill the assistant/graph ID (skips setup form) |
| `NEXT_PUBLIC_AUTH_SCHEME` | No | `langsmith` or `custom` — controls auth mode display |

> **Security:** Never expose `LANGSMITH_API_KEY` in a browser-served environment variable
> (no `NEXT_PUBLIC_` prefix on the key). Use the **API Passthrough** proxy package:
> set `NEXT_PUBLIC_API_URL` to your site's `/api` route and `LANGSMITH_API_KEY` server-side.

**Generative UI:** The graph can push UI components via `push_ui_message()`; the client
renders them client-side. Requires `custom` in `stream_mode`. Hide streamed messages from
display with the `langsmith:nostream` tag in message metadata.

### Bypass setup form

Set these env vars to skip the connection setup form for a production deployment:

```bash
NEXT_PUBLIC_API_URL=https://yourapp.com/api
NEXT_PUBLIC_ASSISTANT_ID=agent
```

---

## `create-agent-chat-app`

CLI scaffolder that creates a full-stack project: a frontend (Next.js or Vite) plus up to
4 pre-built agent starters backed by LangGraph graphs.

```bash
npx create-agent-chat-app@latest
```

| Flag | Description |
|---|---|
| `-Y` / `--yes` | Accept all defaults (non-interactive) |

**Interactive prompts:**

| Prompt | Options |
|---|---|
| Project name | Free text |
| Package manager | npm, pnpm, yarn |
| Frontend framework | Next.js, Vite |
| Agent starters (multi-select) | ReAct Agent, Memory Agent, Research Agent, Retrieval Agent |

The scaffolder starts both the web server and `langgraph dev` simultaneously. Each agent
starter includes a complete `langgraph.json`, graph implementation, and frontend configuration.

---

## Auth and Context Management

### API key auth

```python
import os
from langgraph_sdk import get_client

# Explicit key (preferred for prod — no env var dependency)
client = get_client(
    url=os.environ["LANGGRAPH_DEPLOYMENT_URL"],
    api_key=os.environ["LANGSMITH_API_KEY"],
)

# Implicit: SDK reads LANGSMITH_API_KEY or LANGGRAPH_API_KEY automatically
client_implicit = get_client(url=os.environ["LANGGRAPH_DEPLOYMENT_URL"])
```

### Async context manager

The async client supports use as a context manager for explicit connection cleanup:

```python
import asyncio
from langgraph_sdk import get_client

async def managed_session() -> None:
    async with get_client(url="http://localhost:8123", api_key="lsv2_...") as client:
        thread = await client.threads.create()
        result = await client.runs.wait(
            thread["thread_id"],
            "agent",
            input={"messages": [{"role": "user", "content": "Hello"}]},
        )
        print("Final state:", result)

asyncio.run(managed_session())
```

---

## Complete End-to-End Example — Async Client

```python
"""
Production-ready async client example: assistant creation, thread lifecycle,
streaming with reconnect support, store operations, and cron scheduling.
"""
import asyncio
import os
from langgraph_sdk import get_client
from langgraph_sdk.schema import StreamPart, Thread, Assistant


async def full_workflow() -> None:
    client = get_client(
        url=os.environ["LANGGRAPH_DEPLOYMENT_URL"],
        api_key=os.environ["LANGSMITH_API_KEY"],
    )

    # --- Assistants ---
    assistant: Assistant = await client.assistants.create(
        graph_id="agent",
        config={"configurable": {"temperature": 0.5}},
        name="demo-assistant",
        if_exists="do_nothing",
    )
    assistant_id: str = assistant["assistant_id"]

    # --- Thread + streaming run ---
    thread: Thread = await client.threads.create(metadata={"user": "demo"})
    thread_id: str = thread["thread_id"]

    last_event_id: str | None = None
    try:
        async for chunk in client.runs.stream(
            thread_id,
            assistant_id,
            input={"messages": [{"role": "user", "content": "Tell me a haiku."}]},
            stream_mode=["updates", "messages-tuple"],
        ):
            chunk: StreamPart
            last_event_id = getattr(chunk, "id", last_event_id)
            if chunk.event == "messages-tuple":
                msg, _meta = chunk.data
                print(msg.get("content", ""), end="", flush=True)
            elif chunk.event == "error":
                raise RuntimeError(chunk.data)
    except Exception:
        # Reconnect from last event if disconnected mid-stream
        if last_event_id:
            async for chunk in client.threads.join_stream(
                thread_id, last_event_id=last_event_id
            ):
                if chunk.event == "messages-tuple":
                    msg, _meta = chunk.data
                    print(msg.get("content", ""), end="", flush=True)

    print()

    # --- Store a memory ---
    await client.store.put_item(
        ["sessions", thread_id],
        key="summary",
        value={"text": "User asked for a haiku."},
    )

    # --- Schedule a daily cron ---
    cron = await client.crons.create(
        assistant_id,
        schedule="0 9 * * *",  # 09:00 UTC daily
        input={"messages": [{"role": "user", "content": "Morning check-in"}]},
        timezone="UTC",
        enabled=True,
        on_run_completed="delete",
    )
    print(f"Cron created: {cron['cron_id']}")

    # --- Cleanup ---
    await client.crons.delete(cron["cron_id"])
    await client.threads.delete(thread_id)


asyncio.run(full_workflow())
```

---

## Production Gotchas

| Failure mode | Root cause | Remedy |
|---|---|---|
| `RuntimeError: no running event loop` | `get_client()` called in sync context but awaited | Use `get_sync_client()` or call from within `asyncio.run()` |
| Wrong port for `langgraph dev` | SDK default URL is port 8123 (matches `langgraph up`) | Explicitly set `url="http://localhost:2024"` for `langgraph dev` |
| `401 Unauthorized` on Cloud deployment | `api_key` not set and env var not found | Set `LANGSMITH_API_KEY` or pass `api_key` explicitly to `get_client` |
| `RemoteGraph` invocation fails silently | Remote graph raised an error that wasn't propagated | Check `run.status` or wrap in try/except; errors surface as `RuntimeError` |
| `stream_mode` list order matters | Server may emit events in the order of stream_mode list | Always handle all expected `chunk.event` values; don't assume ordering |
| `client.store.put_item` TTL has no effect | TTL requires `store.ttl` configured in `langgraph.json` | Add `store.ttl` block to `langgraph.json` and redeploy |
| `join_stream` after reconnect replays all events | `last_event_id` not tracked by client | Track last seen event ID manually in the streaming loop |
| `create_batch` runs not ordered | Batch creates are independent; execution order depends on worker scheduling | Do not rely on batch ordering for sequenced logic; use `multitask_strategy: enqueue` |

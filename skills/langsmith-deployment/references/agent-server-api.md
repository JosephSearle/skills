# Agent Server REST API Reference

Base URL: your deployment URL (e.g., `https://your-deployment.langsmith.com` for Cloud or
`http://localhost:8123` for local). All endpoints accept and return `application/json` unless
noted. Authentication: `x-api-key: $LANGSMITH_API_KEY` header (required for Cloud and
self-hosted with auth enabled).

---

## Health Endpoints

| Method | Path | Returns | Description |
|---|---|---|---|
| `GET` | `/ok` | `{"status":"ok"}` | Liveness and readiness probe |
| `GET` | `/info` | server metadata object | Server version, supported features |

---

## Assistants

Assistants are versioned configurations of a graph (prompts, model, tools) decoupled from
graph logic. Each graph in `langgraph.json` gets an auto-created default Assistant on deploy.
Editing an Assistant creates a new version. Deleting an Assistant deletes ALL its versions.
The `PATCH` (update) endpoint replaces the **entire** config — it is NOT a merge.

### Endpoint surface

| Method | Path | Description |
|---|---|---|
| `POST` | `/assistants` | Create assistant |
| `GET` | `/assistants/{assistant_id}` | Get assistant by ID |
| `PATCH` | `/assistants/{assistant_id}` | Update assistant (replaces full config, creates new version) |
| `DELETE` | `/assistants/{assistant_id}` | Delete assistant and ALL versions |
| `POST` | `/assistants/search` | Search assistants |
| `GET` | `/assistants/{assistant_id}/versions` | List all versions |
| `PUT` | `/assistants/{assistant_id}/latest` | Promote a version to latest |

### `POST /assistants` body

| Field | Type | Required | Description |
|---|---|---|---|
| `graph_id` | `string` | Yes | Graph ID as declared in `langgraph.json` |
| `config` | `object` | No | `{"configurable": {...}}` — arbitrary config passed to graph |
| `name` | `string` | No | Human-readable name |
| `metadata` | `object` | No | Arbitrary key-value metadata |
| `if_exists` | `"raise" \| "do_nothing" \| "update"` | No | Collision behaviour (default: `"raise"`) |

```bash
curl -X POST https://your-deployment/assistants \
  -H "Content-Type: application/json" \
  -H "x-api-key: $LANGSMITH_API_KEY" \
  -d '{
    "graph_id": "agent",
    "config": {"configurable": {"model_name": "openai"}},
    "name": "openai_assistant"
  }'
```

---

## Threads

A Thread maintains and accumulates graph state across multiple Runs. The queue enforces
**at most 1 run executing per thread at a time** (concurrent runs are handled by
`multitask_strategy`).

### Thread status lifecycle

| Status | Meaning |
|---|---|
| `idle` | No run executing; ready for new run |
| `busy` | A run is currently executing |
| `interrupted` | Run was interrupted (human-in-the-loop or `multitask_strategy: interrupt`) |
| `error` | Last run ended in an error state |

### Endpoint surface

| Method | Path | Description |
|---|---|---|
| `POST` | `/threads` | Create thread |
| `GET` | `/threads/{thread_id}` | Get thread |
| `PATCH` | `/threads/{thread_id}` | Update thread metadata |
| `DELETE` | `/threads/{thread_id}` | Delete thread |
| `POST` | `/threads/search` | Search threads |
| `GET` | `/threads/{thread_id}/state` | Get current thread state (latest checkpoint) |
| `POST` | `/threads/{thread_id}/state` | Update thread state (creates new checkpoint) |
| `GET` | `/threads/{thread_id}/history` | Get checkpoint history (reverse chronological) |
| `GET` | `/threads/{thread_id}/runs/stream` | Join/resume an active streaming run |

### `POST /threads/search` body

| Field | Type | Default | Description |
|---|---|---|---|
| `limit` | `integer` | `10` | Max results |
| `offset` | `integer` | `0` | Pagination offset |
| `metadata` | `object` | — | Filter by metadata key-value pairs |
| `status` | `ThreadStatus` | — | Filter by status: `idle`, `busy`, `interrupted`, `error` |

### `POST /threads/{thread_id}/state` body

| Field | Type | Required | Description |
|---|---|---|---|
| `values` | `object` | Yes | State values to merge into the checkpoint |
| `checkpoint_id` | `string` | No | Target checkpoint (for time-travel forks) |
| `as_node` | `string` | No | Node name to associate the state update with |

Updating state creates a **new checkpoint**. Resuming from a past `checkpoint_id` creates a
**fork** — the new branch is preserved alongside the original history.

---

## Thread Runs

Runs are executions of a graph on a specific Thread. Run status lifecycle: `pending` →
`running` → `success` / `error` / `timeout` / `interrupted`.

### Endpoint surface

| Method | Path | Description |
|---|---|---|
| `POST` | `/threads/{thread_id}/runs` | Create background run (returns immediately) |
| `POST` | `/threads/{thread_id}/runs/wait` | Create blocking run (waits for completion) |
| `POST` | `/threads/{thread_id}/runs/stream` | Create streaming run (SSE response) |
| `GET` | `/threads/{thread_id}/runs/{run_id}` | Get run |
| `POST` | `/threads/{thread_id}/runs/{run_id}/cancel` | Cancel run |
| `GET` | `/threads/{thread_id}/runs/{run_id}/join` | Wait for run to complete (long-poll) |

### Run create body fields (applies to background, wait, and stream endpoints)

| Field | Type | Required | Description |
|---|---|---|---|
| `assistant_id` | `string` | Yes | Graph ID or assistant UUID |
| `input` | `object \| null` | No | Graph input; `null` to resume from last checkpoint |
| `config` | `object` | No | `{"configurable": {...}}` — merged with assistant config |
| `metadata` | `object` | No | Arbitrary metadata attached to the run |
| `stream_mode` | `StreamMode \| StreamMode[]` | No | SSE event types (stream endpoint only) |
| `interrupt_before` | `string[]` | No | Node names to interrupt before |
| `interrupt_after` | `string[]` | No | Node names to interrupt after |
| `multitask_strategy` | `MultitaskStrategy` | No | Concurrency handling (see below) |
| `on_completion` | `"delete" \| "keep"` | No | Thread cleanup after run (default: `"keep"`) |
| `durability` | `"sync" \| "async" \| "exit"` | No | Checkpoint persistence timing (default: `"async"`) |
| `webhook` | `string` | No | URL to POST run result on completion |
| `context` | `object` | No | Arbitrary context passed to the graph outside of state |

### `multitask_strategy` — all 4 values

| Value | Behaviour | When to use |
|---|---|---|
| `reject` | Refuse the new run with an HTTP error while one is already running on the thread | Chat assistants (ChatGPT-like); user must wait before sending again |
| `interrupt` | Pause the current run at the next checkpoint; keep its state; start the new run immediately | Steerable agents where the user can redirect mid-flight |
| `rollback` | Stop the current run AND **delete** it plus all its checkpoints; start the new run | Agents where interrupted state is never useful; irreversible — checkpoints are unrecoverable |
| `enqueue` | Queue the new run to execute after the current one finishes | "Finish then follow-up" UX; multi-turn queued conversations |

> **⚠️ rollback:** Checkpoints for the interrupted run are **permanently deleted**. The run
> cannot be restarted or inspected after rollback. Use only when discarding in-progress work
> is explicitly acceptable.

### `durability` — checkpoint persistence timing

| Value | When checkpoints are written | Trade-off |
|---|---|---|
| `async` | After each super-step (default) | Best throughput; may lose last step on sudden crash |
| `sync` | Before the next step begins | Higher write latency; guarantees no step loss |
| `exit` | Only at run completion | Lowest write pressure; no mid-run recovery on crash |

### Cancel run body

| Field | Type | Values | Description |
|---|---|---|---|
| `action` | `CancelAction` | `"interrupt"`, `"rollback"` | Whether to interrupt (keep state) or rollback (delete state) |

---

## Stateless Runs

No thread required. Use for one-off invocations where persistence, history, time travel, and
human-in-the-loop are not needed. Ephemeral threads are auto-cleaned after the run.

| Method | Path | Description |
|---|---|---|
| `POST` | `/runs` | Stateless background run |
| `POST` | `/runs/wait` | Stateless blocking run |
| `POST` | `/runs/stream` | Stateless streaming run (SSE) |

Body fields are identical to thread runs except `assistant_id` is required and there is no
`thread_id`. Pass `None` as `thread_id` in the Python SDK for stateless streaming.

---

## Crons

Scheduled executions of a graph. Stateless crons create a new thread per execution; threaded
crons run on a fixed thread.

> **Note:** Crons may not be supported on all license tiers. Verify against your plan.

| Method | Path | Description |
|---|---|---|
| `POST` | `/runs/crons` | Create stateless cron (new thread per execution) |
| `POST` | `/threads/{thread_id}/runs/crons` | Create threaded cron (fixed thread) |
| `GET` | `/runs/crons/{cron_id}` | Get cron |
| `PATCH` | `/runs/crons/{cron_id}` | Update cron |
| `DELETE` | `/runs/crons/{cron_id}` | Delete cron |
| `POST` | `/runs/crons/search` | Search crons |

### `POST /runs/crons` body

| Field | Type | Required | Description |
|---|---|---|---|
| `assistant_id` | `string` | Yes | Graph ID or assistant UUID |
| `schedule` | `string` | Yes | Standard 5-field cron expression (e.g., `"27 15 * * *"`) |
| `timezone` | `string` | No | IANA timezone name (default: `"UTC"`) |
| `input` | `object` | No | Graph input for each execution |
| `metadata` | `object` | No | Metadata attached to each created run |
| `config` | `object` | No | `{"configurable": {...}}` merged with assistant config |
| `interrupt_before` | `string[]` | No | Node names to interrupt before |
| `interrupt_after` | `string[]` | No | Node names to interrupt after |
| `webhook` | `string` | No | Webhook URL called on each run completion |
| `multitask_strategy` | `MultitaskStrategy` | No | Concurrency strategy for overlapping executions |
| `end_time` | `string` | No | ISO 8601 datetime after which the cron will not fire |
| `enabled` | `boolean` | No | Enable/disable the cron (default: `true`) |
| `on_run_completed` | `"delete" \| "keep"` | No | `delete` removes execution thread post-run; `keep` creates new thread each time without cleanup |
| `stream_mode` | `StreamMode` | No | Streaming mode if cron run output is streamed |
| `durability` | `Durability` | No | Checkpoint persistence timing |

```python
import asyncio
from langgraph_sdk import get_client

async def create_daily_cron() -> dict:
    client = get_client(
        url="https://your-deployment.langsmith.com",
        api_key="lsv2_..."
    )
    cron = await client.crons.create(
        assistant_id="agent",
        schedule="27 15 * * *",
        input={"messages": [{"role": "user", "content": "daily digest"}]},
        webhook="https://my.webhook.com/cron-done",
        multitask_strategy="interrupt",
        enabled=True,
    )
    return cron

asyncio.run(create_daily_cron())
```

---

## Store (Long-Term Memory)

DB-backed key-value store shared across all runs and threads. Postgres + pgvector by default.
Semantic search available when `index` is configured in `langgraph.json`. The Store is
auto-injected into graph nodes: `def node(state, *, store: BaseStore)`.

### Endpoint surface

| Method | Path | Status | Description |
|---|---|---|---|
| `PUT` | `/store/items` | 204 | Upsert an item |
| `GET` | `/store/items` | 200 | Get a single item by namespace + key |
| `DELETE` | `/store/items` | 204 | Delete an item |
| `POST` | `/store/items/search` | 200 | Search items (filter, semantic, or list) |
| `POST` | `/store/namespaces` | 200 | List namespace paths |

### `PUT /store/items` body

| Field | Type | Required | Description |
|---|---|---|---|
| `namespace` | `string[]` | Yes | Namespace path segments, e.g., `["users", "user123"]` |
| `key` | `string` | Yes | Item key within the namespace |
| `value` | `object` | Yes | Arbitrary JSON object to store |
| `index` | `false \| string[] \| null` | No | Override which fields to embed; `false` = skip indexing |
| `ttl` | `number \| null` | No | Expiry in minutes (REST docs) / seconds (SDK docstring) — verify per version |

### `GET /store/items` query params

| Param | Required | Description |
|---|---|---|
| `key` | Yes | Item key |
| `namespace` | No | Namespace path (comma-separated or repeated) |
| `refresh_ttl` | No | `true` to reset TTL on read |

### `POST /store/items/search` body

| Field | Type | Default | Description |
|---|---|---|---|
| `namespace_prefix` | `string[] \| null` | — | Namespace prefix to search within |
| `filter` | `object \| null` | — | Exact-match metadata filters |
| `limit` | `integer` | `10` | Max results |
| `offset` | `integer` | `0` | Pagination offset |
| `query` | `string \| null` | — | Natural-language semantic search query; if omitted, lists by last-updated |
| `refresh_ttl` | `boolean` | — | Reset TTL on matching items |

Returns `{"items": [...]}`. Each item has: `namespace`, `key`, `value`, `created_at`,
`updated_at`.

---

## Streaming (SSE)

Streaming endpoints respond with `text/event-stream`. Each event has `event:` and `data:`
fields. The SDK decodes these into `StreamPart` objects with `.event` and `.data` attributes.

### `stream_mode` options

| Mode | Payload on each event | Best for |
|---|---|---|
| `values` | Full state snapshot after each super-step | Displaying latest state to user |
| `updates` | State delta from each node execution | Efficient incremental updates |
| `messages` | LLM token stream + metadata | Chat UIs; token-by-token display |
| `messages-tuple` | `(message_chunk, metadata)` tuples | Chat UIs needing sender metadata |
| `events` | All graph events (LCEL-style) | Migration from LCEL; debug |
| `tasks` | Task-level execution events | Workflow visualisation |
| `checkpoints` | Checkpoint writes | Observability; audit trail |
| `debug` | Maximum information | Development debugging |
| `custom` | User data pushed via `push()` inside graph nodes | Generative UI; custom events |

Pass a list to receive multiple modes in a single stream:
`"stream_mode": ["updates", "messages-tuple"]`

### SSE event structure

```
event: updates
data: {"node_name": {"messages": [{"role": "assistant", "content": "Hello"}]}}

event: messages-tuple
data: [{"role": "assistant", "content": "Hello", "id": "..."}, {"run_id": "..."}]

event: end
data: {}
```

The first event in a thread run stream is typically:
```
event: metadata
data: {"run_id": "...", "attempt": 1}
```

### Resuming a stream

If a client disconnects mid-stream, reconnect using the last received event ID:

```bash
# Resume from last event
GET /threads/{thread_id}/runs/stream
Headers: Last-Event-ID: <last_event_id>
```

Set `stream_resumable: true` in the run create body to persist chunks server-side, enabling
reconnection even if the worker already moved past those events.

---

## Webhooks

Pass `webhook` in run/cron creation. On run completion, the Agent Server sends an HTTP POST
to the specified URL with a **Run** object as the body.

### Webhook payload fields

| Field | Type | Description |
|---|---|---|
| `run_id` | `string` | Run UUID |
| `thread_id` | `string \| null` | Thread UUID (null for stateless runs) |
| `assistant_id` | `string` | Assistant/graph ID |
| `status` | `RunStatus` | `success`, `error`, `timeout`, `interrupted` |
| `created_at` | `string` | ISO 8601 |
| `updated_at` | `string` | ISO 8601 |
| `run_started_at` | `string` | ISO 8601 |
| `run_ended_at` | `string` | ISO 8601 |
| `webhook_sent_at` | `string` | ISO 8601 |
| `metadata` | `object` | Run metadata |
| `kwargs` | `object` | Original invocation params (input, config, etc.) |
| `values` | `object \| null` | Latest checkpoint state (stateful runs only; null for stateless) |
| `multitask_strategy` | `MultitaskStrategy \| null` | Strategy used |
| `error` | `object \| null` | `{"error": "...", "message": "..."}` on failure; null on success |

### Webhook security

```python
# Server-side token validation
from fastapi import Request, HTTPException

async def receive_webhook(request: Request) -> dict:
    token = request.query_params.get("token")
    if token != "my-secret-token":
        raise HTTPException(status_code=401, detail="Invalid webhook token")
    payload = await request.json()
    return payload
```

- Append `?token=<secret>` to the webhook URL and validate server-side
- Static request headers configurable in `langgraph.json` under `webhooks.headers`
  (requires `langgraph-api ≥ 0.5.36`) using `${{ env.HEADER_VAR }}` templating
- Restrict destinations via `webhooks.url` keys: `allowed_domains`, `require_https`,
  `allowed_ports`, `disable_loopback`

---

## A2A Protocol (Agent-to-Agent)

JSON-RPC 2.0 over HTTP/SSE for cross-framework agent communication. Any deployed Assistant
automatically exposes A2A endpoints.

| Method | Path | Description |
|---|---|---|
| `POST` | `/a2a/{assistant_id}` | A2A message/send or message/stream (JSON-RPC) |
| `GET` | `/.well-known/agent-card.json?assistant_id={id}` | Agent Card (capabilities, endpoint, I/O modes) |

### A2A RPC methods

| Method | Transport | Description |
|---|---|---|
| `message/send` | HTTP POST | Send a message and receive the full response |
| `message/stream` | SSE | Send a message and stream the response |
| `tasks/get` | HTTP POST | Retrieve a task by ID |

### A2A identifiers

| Identifier | Maps to | Notes |
|---|---|---|
| `contextId` | `thread_id` (LangSmith tracing grouping) | Omit on first message; server generates and returns it |
| `taskId` | Per-request run identifier | Omit on first message; server generates and returns it |

The graph state must contain a `messages` key for A2A "text" parts to be mapped correctly.
`RemoteGraph` instances in multi-framework hosts use A2A clients to delegate to these endpoints.

---

## MCP Endpoint (Model Context Protocol)

Exposes deployed LangGraph agents as MCP tools consumable by any MCP-compliant client.

| Method | Path | Transport | Description |
|---|---|---|---|
| `POST` / `GET` | `/mcp` | Streamable HTTP | MCP tool discovery and invocation |

- Requires `langgraph-api ≥ 0.2.3` and `langgraph-sdk ≥ 0.1.61`
- New Cloud revisions auto-include the correct versions
- Disable with `{"http": {"disable_mcp": true}}` in `langgraph.json`
- Custom auth middleware can populate `langgraph_auth_user` for user-scoped tool access

---

## Complete Python 3.11+ Example — Threads, Runs, and Store

```python
"""
Full async Agent Server client example covering thread lifecycle, multitask_strategy,
streaming, and Store operations.
"""
import asyncio
from collections.abc import AsyncIterator

from langgraph_sdk import get_client
from langgraph_sdk.schema import Thread, StreamPart


async def run_with_enqueueing(deployment_url: str, api_key: str) -> None:
    """Demonstrate enqueueing: two user messages on the same thread."""
    client = get_client(url=deployment_url, api_key=api_key)

    # Create a thread
    thread: Thread = await client.threads.create(metadata={"user_id": "u-001"})
    thread_id: str = thread["thread_id"]

    # First run — starts executing immediately
    first = await client.runs.create(
        thread_id,
        "agent",
        input={"messages": [{"role": "user", "content": "What is 2+2?"}]},
        multitask_strategy="enqueue",
    )

    # Second run — enqueued; will start after first finishes
    second = await client.runs.create(
        thread_id,
        "agent",
        input={"messages": [{"role": "user", "content": "Now multiply by 3."}]},
        multitask_strategy="enqueue",
    )

    # Wait for both to complete
    await client.runs.join(thread_id, first["run_id"])
    await client.runs.join(thread_id, second["run_id"])

    # Inspect final state
    state = await client.threads.get_state(thread_id)
    print("Final messages:", state["values"].get("messages", []))


async def stream_updates(deployment_url: str, api_key: str) -> None:
    """Stream node-level updates and LLM tokens from a run."""
    client = get_client(url=deployment_url, api_key=api_key)
    thread: Thread = await client.threads.create()

    async for chunk in client.runs.stream(
        thread["thread_id"],
        "agent",
        input={"messages": [{"role": "user", "content": "Explain asyncio briefly."}]},
        stream_mode=["updates", "messages-tuple"],
    ):
        chunk: StreamPart
        if chunk.event == "updates":
            print("[update]", chunk.data)
        elif chunk.event == "messages-tuple":
            msg, metadata = chunk.data
            print("[token]", msg.get("content", ""), end="", flush=True)
        elif chunk.event == "end":
            print("\n[stream complete]")


async def store_user_preference(deployment_url: str, api_key: str) -> None:
    """Store a user preference and retrieve it with semantic search."""
    client = get_client(url=deployment_url, api_key=api_key)
    namespace = ["users", "user-123"]

    # Upsert preference
    await client.store.put_item(
        namespace,
        key="pref-theme",
        value={"preference": "dark mode", "set_at": "2026-06-06"},
    )

    # Exact lookup
    item = await client.store.get_item(namespace, key="pref-theme")
    print("Stored item:", item)

    # Semantic search (requires index configured in langgraph.json)
    results = await client.store.search_items(
        namespace,
        query="what display settings does this user prefer?",
        limit=5,
    )
    for hit in results["items"]:
        print("Search hit:", hit["key"], hit["value"])

    # Delete when no longer needed
    await client.store.delete_item(namespace, key="pref-theme")


async def time_travel_example(deployment_url: str, api_key: str) -> None:
    """Inspect thread history and fork from a past checkpoint."""
    client = get_client(url=deployment_url, api_key=api_key)
    thread: Thread = await client.threads.create()
    thread_id: str = thread["thread_id"]

    # Run an initial conversation
    await client.runs.create(
        thread_id,
        "agent",
        input={"messages": [{"role": "user", "content": "Hello!"}]},
    )
    await asyncio.sleep(2)  # let the run complete

    # Get checkpoint history (reverse chronological)
    history = await client.threads.get_history(thread_id)
    checkpoints = list(history)
    print(f"Total checkpoints: {len(checkpoints)}")

    if len(checkpoints) >= 2:
        # Fork from the second-most-recent checkpoint
        past_checkpoint_id: str = checkpoints[1]["checkpoint_id"]
        await client.threads.update_state(
            thread_id,
            values={"messages": []},
            checkpoint_id=past_checkpoint_id,
        )
        print(f"Forked from checkpoint: {past_checkpoint_id}")

        # Resume from the fork — input=None means resume from last checkpoint
        async for chunk in client.runs.stream(
            thread_id,
            "agent",
            input=None,
            stream_mode="values",
        ):
            if chunk.event == "values":
                print("[forked state]", chunk.data)


async def main() -> None:
    url = "https://your-deployment.langsmith.com"
    api_key = "lsv2_your_api_key"

    await run_with_enqueueing(url, api_key)
    await stream_updates(url, api_key)
    await store_user_preference(url, api_key)
    await time_travel_example(url, api_key)


asyncio.run(main())
```

---

## Production Gotchas

| Failure mode | Root cause | Remedy |
|---|---|---|
| `multitask_strategy: rollback` deletes prior run | Intended behaviour — rollback permanently removes interrupted run and checkpoints | Use `interrupt` if you need the prior state; use `rollback` only when discarding it is acceptable |
| Webhook POST not received | Webhook URL unreachable from Agent Server egress | Test with a public endpoint (e.g., ngrok); check `allowed_domains` restrictions |
| Semantic search returns empty results | `pgvector` not installed or `index` not configured in `langgraph.json` | Confirm `CREATE EXTENSION vector;` ran and `store.index` is set |
| Store TTL expires unexpectedly fast/slow | TTL unit mismatch (docs say minutes; SDK says seconds) | Test with a known TTL value and observe actual expiry time |
| A2A `contextId` not persisting across calls | `contextId` omitted on follow-up messages | Save and re-send `contextId` from the first response in subsequent requests |
| Stream disconnects lose events | Client disconnects before stream ends | Set `stream_resumable: true`; reconnect with `Last-Event-ID` header |
| `/mcp` endpoint returns 404 | `langgraph-api` version below 0.2.3 | Upgrade the deployment or pin `api_version: "0.2.3"` or newer in `langgraph.json` |
| Webhook headers contain secrets in logs | Default logging includes request headers | Configure `webhooks.headers` with `${{ env.* }}` and audit log-header controls |

# Async Subagents Reference — deepagents

> Added in deepagents v0.5 (April 7 2026). `AsyncSubAgent` and `AsyncSubAgentMiddleware` required.

---

## AsyncSubAgent TypedDict

```python
from typing import TypedDict, NotRequired

class AsyncSubAgent(TypedDict):
    name: str            # required — unique identifier
    description: str     # required — shown to supervisor LLM
    graph_id: str        # required — LangGraph graph ID (must be in langgraph.json)
    url: NotRequired[str]  # optional — remote Agent Protocol server URL
                           # omit for in-process ASGI transport (zero network latency)
```

---

## The five async task tools

| Tool | Signature | What it does |
|---|---|---|
| `start_async_task` | `(agent_name: str, task: str) -> str` | Launch task on the named subagent; returns `task_id` (= thread_id of new thread) |
| `check_async_task` | `(task_id: str) -> str` | Check current status and result of an in-flight task |
| `update_async_task` | `(task_id: str, update: str) -> str` | Send new instructions to a running task (uses `multitask_strategy="interrupt"`) |
| `cancel_async_task` | `(task_id: str) -> str` | Cancel an in-flight task |
| `list_async_tasks` | `() -> str` | List all tracked tasks with their statuses |

---

## async_tasks state channel

The `async_tasks` channel is separate from message history. This is the critical design choice:

```
Message history:
  [user] → [tool: start_async_task → task_id: abc123] → [assistant] → ...
  ↑ This gets compacted/summarised — task_id may be lost in the summary

async_tasks channel (separate, not compacted):
  {
    "abc123": {
      "task_id": "abc123",
      "agent_name": "researcher",
      "thread_id": "abc123",
      "run_id": "run-xyz",
      "status": "running",
      "created_at": "2026-06-20T10:00:00Z",
      "updated_at": "2026-06-20T10:01:00Z",
    }
  }
  ↑ Always available — call list_async_tasks() to recover IDs after compaction
```

**If task IDs were only in tool messages, they would be lost during compaction.** The `async_tasks` channel guarantees the supervisor can always recover all active task IDs via `list_async_tasks`.

---

## Launch semantics (start_async_task)

When `start_async_task` is called:
1. Creates a new thread on the server (or in-process) with a fresh conversation.
2. Starts a new run with the task description as the initial user message.
3. Returns the thread ID as the `task_id`.
4. The supervisor **does not poll** — it reports the task ID to the user and moves on.

```python
# Agent calls:
# start_async_task("researcher", "Research quantum computing trends in 2026")
# → returns "thread-abc123"
# Agent tells user: "I've started the research task (task_id: thread-abc123)."
# User can later ask: check_async_task("thread-abc123")
```

---

## Update semantics (update_async_task)

`update_async_task` uses `multitask_strategy="interrupt"`:
- Interrupts the current run (if still running).
- Creates a new run on the **same thread** (full conversation history preserved).
- New instructions are appended as a new user message.
- **The task_id remains the same** — no new ID is created.

```python
# Agent calls:
# update_async_task("thread-abc123", "Focus only on quantum error correction, not algorithms.")
# → same task_id, same thread, new run with updated instructions
```

---

## Registering async subagents

```python
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    subagents=[
        {
            "name": "researcher",
            "description": "Researches topics asynchronously. Call with a research question.",
            "graph_id": "researcher",   # must match graph ID in langgraph.json
            # url not set → in-process transport
        },
        {
            "name": "coder",
            "description": "Writes and runs code asynchronously.",
            "graph_id": "coder",
            "url": "https://my-coder-service.example.com",  # remote Agent Protocol server
        },
    ],
)
```

Mixing in-process and remote async subagents in the same agent is supported.

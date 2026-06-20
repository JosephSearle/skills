# LangGraph SDK Client Reference

## Installation

```bash
uv add langgraph-sdk
```

## Python client — basic usage

```python
from langgraph_sdk import get_client

client = get_client(url="http://localhost:8000")

# Create a thread
thread = await client.threads.create()
thread_id = thread["thread_id"]

# Run the agent (blocking until complete)
result = await client.runs.create(
    thread_id=thread_id,
    assistant_id="my_agent",
    input={"messages": [{"role": "user", "content": "Hello!"}]},
)

# Stream events
async for event in client.runs.stream(
    thread_id=thread_id,
    assistant_id="my_agent",
    input={"messages": [{"role": "user", "content": "Tell me about LangGraph"}]},
    stream_mode="values",  # or "messages", "events", "debug"
):
    print(event.event, event.data)
```

## Thread management

```python
# Create with metadata
thread = await client.threads.create(metadata={"user_id": "user-123", "session": "abc"})

# Get thread state (latest checkpoint)
state = await client.threads.get_state(thread_id)
print(state["values"])  # current graph state

# Update thread state (for HITL edit-then-resume)
await client.threads.update_state(
    thread_id,
    values={"messages": [{"role": "user", "content": "corrected input"}]},
    as_node="human_review",
)

# List threads (paginated)
threads = await client.threads.list(metadata={"user_id": "user-123"}, limit=20)

# Search thread history
history = await client.threads.get_history(thread_id)
```

## Run management

```python
# Wait for run to complete
run = await client.runs.wait(
    thread_id,
    assistant_id="my_agent",
    input={"messages": [...]},
)

# Resume after interrupt (HITL)
run = await client.runs.create(
    thread_id,
    assistant_id="my_agent",
    command={"resume": "approved"},  # value passed to interrupted node
)

# Cancel a run
await client.runs.cancel(thread_id, run_id)

# Get run result
result = await client.runs.get(thread_id, run_id)
```

## Stream modes

| `stream_mode` | What it emits | Use for |
|---|---|---|
| `"values"` | Full state snapshot after each super-step | Displaying final agent output |
| `"messages"` | Individual message chunks as they stream | Real-time chat UI |
| `"events"` | All internal events (node start/end, tool calls) | Debugging, observability |
| `"debug"` | Verbose internal state — all tasks and results | Deep debugging only |

## Assistant management

```python
# List assistants (= registered graphs in langgraph.json)
assistants = await client.assistants.list()
# → [{"assistant_id": "my_agent", "graph_id": "my_agent", ...}]

# Get assistant metadata
assistant = await client.assistants.get("my_agent")

# Create a versioned assistant (overrides config)
versioned = await client.assistants.create(
    graph_id="my_agent",
    config={"configurable": {"model": "claude-haiku-4-5-20251001"}},
    metadata={"version": "2025-06"},
)
```

## RemoteGraph — calling a deployed agent from another agent

```python
from langgraph.pregel.remote import RemoteGraph

remote_agent = RemoteGraph(
    "my_agent",
    url="http://langgraph-server:8000",
)

# Use as a subgraph node
builder = StateGraph(State)
builder.add_node("remote_agent", remote_agent)
```

`RemoteGraph` implements the same interface as a local `CompiledGraph` — it can be used as a
subgraph, invoked directly, or called via `astream_events`.

## Authentication header

```python
client = get_client(
    url="http://localhost:8000",
    headers={"x-api-key": "my-secret-key"},
)
```

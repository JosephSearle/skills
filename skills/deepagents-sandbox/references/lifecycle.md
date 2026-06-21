# Sandbox Lifecycle & Scoping Reference — deepagents

---

## Scoping modes

| Mode | Default? | Behaviour | Use when |
|---|---|---|---|
| **Thread-scoped** | Yes | Each conversation (thread_id) gets its own sandbox, created on first tool call | Standard — isolates each user session |
| **Assistant-scoped** | No | All threads for a given assistant share one sandbox | Long-running background work that must persist across sessions |

### Thread-scoped (default)

```python
# No configuration needed — this is the default
sandbox = ModalSandbox(image="python:3.12-slim")
agent = create_deep_agent(model="...", backend=sandbox)

# Each call with a different thread_id gets a fresh sandbox
agent.invoke({...}, config={"configurable": {"thread_id": "user-123"}})
agent.invoke({...}, config={"configurable": {"thread_id": "user-456"}})
# ^^ two independent sandboxes, isolated from each other
```

### Assistant-scoped

```python
sandbox = ModalSandbox(
    image="python:3.12-slim",
    scope="assistant",   # all threads share this one sandbox
    ttl=3600,            # 1-hour TTL; recreated on next tool call after expiry
)
```

**Risks of assistant-scoped:**
- State from one user's conversation is visible to another.
- A crashed or poisoned sandbox affects all concurrent sessions.
- Only use if you explicitly need shared state across threads.

---

## TTL (Time To Live)

Set TTL to prevent billing exposure from idle sandboxes.

```python
sandbox = ModalSandbox(
    image="python:3.12-slim",
    timeout=600,    # 10 minutes; sandbox auto-terminates after 10 min of inactivity
)
```

- Providers charge for running sandboxes even when idle.
- The harness uses **get-or-create** by `thread_id` label: if a TTL-expired sandbox is referenced, a new one is created transparently.
- **Always set a TTL in production.** Without it, sandboxes accumulate and bill indefinitely.

---

## File transfer APIs

Two planes of file access exist:

| Plane | Who calls it | When to use |
|---|---|---|
| **In-sandbox** (agent tools) | The LLM agent via `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute` | Normal agent operation; file manipulation during a task |
| **Host-side** (application code) | Your Python application directly | Seeding input files before the agent runs; retrieving output artifacts after the agent finishes |

### upload_files — seed files from host into sandbox

```python
import asyncio
from deepagents.backends import ModalSandbox

sandbox = ModalSandbox(image="python:3.12-slim")

async def seed_and_run():
    # Upload a file from the host filesystem into the sandbox
    await sandbox.upload_files([
        ("/data/input.csv", open("/host/path/input.csv", "rb").read()),
        ("/config/settings.json", b'{"debug": true}'),
    ])
    # Now run the agent — it will find /data/input.csv inside the sandbox
```

`upload_files` signature: `upload_files(files: list[tuple[str, bytes]]) -> None`
- First element of tuple: **absolute path inside the sandbox**
- Second element: **raw bytes** of the file content

### download_files — retrieve artifacts from sandbox to host

```python
async def retrieve_outputs():
    files = await sandbox.download_files([
        "/output/report.pdf",
        "/output/results.json",
    ])
    # files: dict[str, bytes] mapping path → content
    for path, content in files.items():
        with open(f"/host/output{path}", "wb") as f:
            f.write(content)
```

`download_files` signature: `download_files(paths: list[str]) -> dict[str, bytes]`

---

## get-or-create behaviour

The harness tracks sandboxes by `thread_id` label. On each tool call:
1. Look up existing sandbox for this `thread_id`.
2. If found and alive: reuse it.
3. If not found or TTL expired: create a new one.
4. On creation: optionally restore from a snapshot (if `snapshot_name` is set — Modal only).

This means:
- Agent can safely call `execute` multiple times in a session — same sandbox reused.
- After TTL expiry, a new sandbox starts fresh (no prior filesystem state unless from a snapshot).

---

## Billing exposure checklist

| Risk | Mitigation |
|---|---|
| Idle sandboxes accumulating | Always set `timeout`/TTL |
| Assistant-scoped sandbox never cleaned up | Set TTL; add explicit cleanup in application teardown |
| Runaway agent looping in execute | Set `interrupt_on={"execute": True}` for HITL; set recursion limit on the agent graph |
| High-concurrency cost spike | Budget-cap at the provider level (Modal spending limits, Daytona quotas) |

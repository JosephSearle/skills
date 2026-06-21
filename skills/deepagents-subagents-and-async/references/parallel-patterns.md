# Parallel Patterns Reference — deepagents AsyncSubAgent

---

## Fan-out / fan-in pattern

The canonical pattern: launch N tasks in parallel, then aggregate results.

```
Supervisor
  ├─ start_async_task("researcher", "Research topic A")  → task_id_1
  ├─ start_async_task("researcher", "Research topic B")  → task_id_2
  └─ start_async_task("coder", "Implement feature X")    → task_id_3

[later]
  ├─ check_async_task(task_id_1) → result A
  ├─ check_async_task(task_id_2) → result B
  └─ check_async_task(task_id_3) → result X

[aggregate]
  └─ Combine A + B + X into final output
```

### Supervisor prompt guidance for fan-out

Add this to `system_prompt_suffix` or the main system prompt when expecting parallel work:

```
When you have multiple independent tasks, start all of them with start_async_task before
checking any of them. Do not wait for each task to complete before starting the next.
After starting all tasks, poll with check_async_task in a loop until all are done, then
aggregate the results.
```

---

## list_async_tasks for status aggregation

```python
# Agent calls list_async_tasks() to see all in-flight tasks:
# → Returns a table like:
# | task_id       | agent_name | status    | created_at          |
# |---------------|------------|-----------|---------------------|
# | thread-abc123 | researcher | running   | 2026-06-20 10:00:00 |
# | thread-def456 | researcher | completed | 2026-06-20 10:01:00 |
# | thread-ghi789 | coder      | running   | 2026-06-20 10:02:00 |
```

Use `list_async_tasks` in the system prompt as the recovery mechanism:

```
If you lose track of task IDs, call list_async_tasks() to see all active tasks.
```

This is especially important after context compaction — `list_async_tasks` reads from the `async_tasks` state channel which survives compaction.

---

## Worker-pool exhaustion

**Symptom:** Tasks queue up and don't start promptly; latency spikes with many parallel tasks.

**Cause:** The LangGraph server has a fixed number of worker slots. When all slots are busy, new tasks queue.

**Fix:** Increase `--n-jobs-per-worker` on the LangGraph server:

```bash
langgraph up --n-jobs-per-worker 8   # default is typically 1-4
```

Or use a remote Agent Protocol server with independent scaling for high-concurrency workloads.

---

## task_id truncation

**Symptom:** The supervisor produces a truncated task ID in its output (e.g. `thread-abc...` instead of `thread-abc123456789`), then fails to use `check_async_task` correctly.

**Cause:** Some models truncate long identifiers in their output, especially in streaming mode.

**Fix 1 — Prompt:**

```python
HarnessProfile(
    system_prompt_suffix=(
        "When you receive a task_id from start_async_task, reproduce it exactly and completely "
        "in all subsequent references. Never truncate, abbreviate, or paraphrase a task_id."
    )
)
```

**Fix 2 — Model switch:**

Switch to a model with stronger instruction-following (e.g. from Haiku to Sonnet) for the supervisor. The truncation issue is more common with smaller/faster models.

---

## Concurrent task limits per subagent

A single `AsyncSubAgent` can have multiple concurrent tasks against the same `graph_id`. Each `start_async_task` call creates an independent thread — tasks don't interfere with each other.

However, if the subagent server (or in-process worker pool) has limited concurrency, tasks will queue. Design for this:

1. Set realistic concurrency expectations based on the server's `--n-jobs-per-worker`.
2. Use `check_async_task` polling with reasonable intervals — don't tight-loop.
3. Use `cancel_async_task` to clean up abandoned tasks and free worker slots.

---

## Timeout and cleanup pattern

```python
# Application-level timeout and cleanup (wrap around agent invocation)
import asyncio
from deepagents import create_deep_agent

agent = create_deep_agent(model="anthropic:claude-sonnet-4-6", subagents=[...])

async def run_with_timeout(input_msg: str, timeout_secs: int = 300):
    try:
        result = await asyncio.wait_for(
            agent.ainvoke(
                {"messages": [{"role": "user", "content": input_msg}]},
                config={"configurable": {"thread_id": "session-1"}},
            ),
            timeout=timeout_secs,
        )
        return result
    except asyncio.TimeoutError:
        # Cancel all in-flight tasks via state inspection
        state = agent.get_state({"configurable": {"thread_id": "session-1"}})
        for task_id in state.values.get("async_tasks", {}).keys():
            # cancel_async_task via direct API call or agent tool invocation
            pass
        raise
```

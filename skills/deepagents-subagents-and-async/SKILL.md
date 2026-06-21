---
name: deepagents-subagents-and-async
version: 1.0.0
description: >
  Deep Agents sync and async subagents — SubAgent TypedDict, CompiledSubAgent, task tool,
  AsyncSubAgent, AsyncSubAgentMiddleware, five async task tools, async_tasks state channel,
  Agent Protocol ASGI transport, in-process subgraph wiring, and parallelism troubleshooting.
  Triggers on: SubAgent, CompiledSubAgent, task tool, response_format subagent, interrupt_on
  subagent, AsyncSubAgent, AsyncSubAgentMiddleware, start_async_task, check_async_task,
  update_async_task, cancel_async_task, list_async_tasks, async_tasks channel, multitask_strategy
  interrupt, Agent Protocol, ASGI transport, langgraph.json, url param subagent, in-process,
  parallel subagents, worker-pool, n-jobs-per-worker, task_id truncation, fan-out fan-in.
  Async subagents require deepagents>=0.5 (April 7 2026).
---

## Core Philosophy

Subagents come in two flavours: **sync** (delegation with a `task` tool call, blocking until done) and **async** (non-blocking launch via `start_async_task`, polled or updated later). The most subtle design in async subagents is the `async_tasks` state channel — separate from message history specifically so task IDs survive context summarisation/compaction. If task IDs were only in tool messages they would be lost when the conversation is compacted. The Agent Protocol ASGI transport is an equally non-obvious choice: when `url` is omitted, SDK calls route through in-process function calls with zero network overhead, requiring both graphs to be in the same `langgraph.json`.

---

## Step 1 — Determine Context

| Signal | Sub-topic | Reference to load |
|---|---|---|
| `SubAgent`, `CompiledSubAgent`, `task` tool, `response_format`, per-subagent `interrupt_on` | Sync subagents | `references/sync-subagents.md` |
| `AsyncSubAgent`, `start_async_task`, `check_async_task`, `async_tasks` channel | Async subagents | `references/async-subagents.md` |
| `url` param, ASGI, in-process, `langgraph.json`, Agent Protocol server | Agent Protocol transport | `references/agent-protocol.md` |
| Parallel patterns, worker-pool, `--n-jobs-per-worker`, `task_id` truncation | Parallelism & troubleshooting | `references/parallel-patterns.md` |
| General "how do subagents work?" | All of the above | Load all four references |

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/sync-subagents.md` | SubAgent TypedDict, CompiledSubAgent, task tool, response_format, interrupt_on | Sync delegation questions |
| `references/async-subagents.md` | AsyncSubAgent, five tools, async_tasks channel, launch/update/cancel semantics | Async or parallel subagent questions |
| `references/agent-protocol.md` | ASGI transport, in-process vs HTTP, langgraph.json, Agent Protocol server targets | Transport / deployment topology questions |
| `references/parallel-patterns.md` | Fan-out/fan-in patterns, worker-pool, task_id truncation fix | Parallelism scaling or troubleshooting questions |

---

## Step 3 — Implement

### Sync vs async decision gate

```
Do you need the result before proceeding?
  └─ YES → Sync SubAgent (task tool)
      └─ Blocks until the subagent returns
      └─ Use for sequential delegation with a single worker

Do you want to run multiple agents in parallel?
  └─ YES → AsyncSubAgent (start_async_task)
      └─ Launches in background; supervisor polls with check_async_task
      └─ Use for fan-out/fan-in patterns and long-running parallel work

Does the subagent have custom LangGraph topology?
  └─ YES → CompiledSubAgent (wraps any compiled graph)
      └─ Accepts both sync and async (if the graph is async)
```

### Minimal async pattern

```python
from deepagents import create_deep_agent

async_research = {
    "name": "researcher",
    "description": "Researches a topic asynchronously.",
    "graph_id": "researcher-graph",     # must be registered in langgraph.json
    # url omitted → in-process ASGI transport (zero network latency)
}

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    subagents=[async_research],
)
# The agent can now call:
# start_async_task("researcher", task="Research quantum computing")
# → returns task_id
# check_async_task(task_id) → returns status/result
# list_async_tasks() → shows all in-flight tasks (survives compaction)
```

### Mandatory checklist for async subagents

| Concern | Requirement |
|---|---|
| `langgraph.json` registration | When `url` is omitted, both graphs must be in the same `langgraph.json` |
| Task ID survival | Use `list_async_tasks` to recover task IDs after context compaction — they are stored in `async_tasks` channel |
| task_id truncation | If the model truncates task IDs in output, add "never truncate the task_id" to the system prompt or switch to a model with better instruction-following |
| Worker pool | Default `--n-jobs-per-worker` may throttle high-concurrency scenarios; increase if tasks are queuing |
| Update semantics | `update_async_task` uses `multitask_strategy="interrupt"` — the subagent restarts with full history + new instructions; same task_id is preserved |

---

## Step 4 — Verify

```bash
# Confirm async subagent tools are available
uv run python -c "
from deepagents import create_deep_agent

agent = create_deep_agent(
    model='anthropic:claude-sonnet-4-6',
    subagents=[
        {
            'name': 'test-worker',
            'description': 'Test async worker',
            'graph_id': 'test-worker-graph',
        }
    ],
)
# Check that async task tools are registered
tools = [getattr(t, 'name', str(t)) for t in getattr(agent, 'tools', [])]
async_tools = [t for t in tools if 'async_task' in t or 'task' in t]
print('task tools:', async_tools)
"

# Verify async_tasks channel exists in state schema
uv run python -c "
from deepagents import create_deep_agent
agent = create_deep_agent(model='anthropic:claude-sonnet-4-6', subagents=[])
schema = agent.get_output_schema()
print('state channels:', list(schema.schema().get('properties', {}).keys()))
# async_tasks should appear when async subagents are configured
"
```

---

## Reference Files

| File | Domain | Load when |
|---|---|---|
| [references/sync-subagents.md](references/sync-subagents.md) | SubAgent TypedDict, CompiledSubAgent, task tool, response_format, interrupt_on per subagent | Sync delegation questions |
| [references/async-subagents.md](references/async-subagents.md) | AsyncSubAgent, five async tools, async_tasks channel, launch/update/cancel semantics | Async or parallel subagent questions |
| [references/agent-protocol.md](references/agent-protocol.md) | ASGI transport, in-process vs HTTP, langgraph.json, valid Agent Protocol targets | Transport or deployment topology questions |
| [references/parallel-patterns.md](references/parallel-patterns.md) | Fan-out/fan-in, worker-pool sizing, task_id truncation fix, list_async_tasks aggregation | Parallelism scaling or troubleshooting |

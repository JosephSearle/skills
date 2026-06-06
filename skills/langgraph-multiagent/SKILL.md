---
name: langgraph-multiagent
description: >
  Design, implement, and debug production multi-agent systems with LangGraph and the Deep Agents
  SDK. Triggers on: multi-agent, orchestrator, worker agent, supervisor pattern, swarm pattern,
  handoff, create_deep_agent, deepagents, langgraph-supervisor, langgraph-swarm,
  create_handoff_tool, Command(goto=, Command.PARENT, RemoteGraph, langgraph-bigtool,
  SubAgentMiddleware, FilesystemMiddleware, SkillsMiddleware, AgentsMdMiddleware,
  BackendProtocolV2. Covers the five official LangChain multi-agent patterns, manual
  Command(goto=) supervisor graphs, peer-to-peer swarms, distributed RemoteGraph topologies,
  large tool-set management with langgraph-bigtool, and the full deepagents 0.6.7 harness
  including all built-in middleware, backends, async subagents, and the dcode CLI.
---

## Core Philosophy

The production-favored pattern for hierarchical multi-agent LangGraph as of mid-2026 is the
**manual tool-calling supervisor** — nodes returning `Command(goto=...)` with handoff tools
built from `InjectedToolCallId` and `InjectedState`. This gives full context-engineering
control and is explicitly recommended over the `langgraph-supervisor` library in the library's
own README. `langgraph-supervisor` remains valid for quick prototypes; `langgraph-swarm` is
the right choice when peers hand off directly with a persistent active-agent cursor. For
long-horizon, tool-heavy, single-thread work the Deep Agents harness (`create_deep_agent`) is
the composable solution — it handles planning, filesystem, summarization, and sandboxed code
execution as a first-class stack, not bolt-ons. Multi-agent systems fail in predictable ways:
handoff loops, checkpoint explosion, and missing recursion limits; address all three at design
time, not after the first production incident.

---

## Step 1 — Determine Context

Classify the request using the table below before loading any reference file.

| Signal | Mode | Notes |
|---|---|---|
| "supervisor", "orchestrator", "hierarchy", `Command(goto=`, `create_supervisor` | **SUPERVISOR** | Manual `Command` graph or `langgraph-supervisor` library |
| "swarm", "peer handoff", "active agent", `create_swarm`, `create_handoff_tool` | **SWARM** | `langgraph-swarm`; needs checkpointer for multi-turn |
| `create_deep_agent`, `deepagents`, "deep agent", "harness", `SubAgentMiddleware`, `FilesystemMiddleware`, `SkillsMiddleware`, `AgentsMdMiddleware`, `BackendProtocolV2` | **DEEP-AGENT** | deepagents 0.6.7 harness — batteries-included |
| `RemoteGraph`, "distributed", "remote agent", "Agent Server", async subagents, `AsyncSubAgent` | **REMOTE** | Independently deployed specialists; `RemoteGraph` or `AsyncSubAgent` |
| `langgraph-bigtool`, "hundreds of tools", "tool registry", "tool retrieval" | **BIGTOOL** | Large tool-set problem; `create_agent` + Store + embeddings |
| "custom workflow", "deterministic branching", "not LLM routed" | **CUSTOM** | Raw `StateGraph`; load patterns.md only |

Then detect cross-cutting requirements:

| Requirement | Action |
|---|---|
| Long-horizon / planning / filesystem / summarization | Load `references/deepagents.md` |
| Independent deployment / Agent Server / async task management | Load `references/remote-graphs.md` |
| Hundreds or thousands of tools | Load `references/bigtool.md` |
| Pattern selection in doubt | Load `references/patterns.md` first |

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/patterns.md` | Supervisor, swarm, network, subgraph patterns; token-call benchmarks; Command/handoff mechanics | SUPERVISOR, SWARM, CUSTOM, or any pattern-selection question |
| `references/remote-graphs.md` | `RemoteGraph`, `AsyncSubAgent`, distributed topology | REMOTE; any mention of Agent Server, remote deployment, async tasks |
| `references/bigtool.md` | `langgraph-bigtool`, Store + embeddings, tool registry | BIGTOOL; any "too many tools" question |
| `references/deepagents.md` | `create_deep_agent`, all middleware, backends, harness profiles, dcode CLI | DEEP-AGENT; any deepagents / `create_deep_agent` question |

For SUPERVISOR or SWARM requests: load `references/patterns.md`.
For DEEP-AGENT requests: load `references/deepagents.md`; load `references/patterns.md` if the
question also involves multi-agent topology choices.
For REMOTE requests: load `references/remote-graphs.md`; load `references/deepagents.md` if
async subagents are in scope.

---

## Step 3 — Build System

### Pattern selection decision gate

Apply the decision from `references/patterns.md` § "When to use each pattern":

1. **Clear hierarchy, centralized routing** → manual `Command(goto=)` supervisor (default)
2. **Quick prototype only** → `langgraph-supervisor` library (then migrate to manual)
3. **Peer-to-peer, resume-with-specialist semantics** → `langgraph-swarm`
4. **Long-horizon, planning, filesystem, tool-heavy** → `create_deep_agent`
5. **Hundreds / thousands of tools** → `langgraph-bigtool`
6. **Independent deploys, async parallelism** → `RemoteGraph` / `AsyncSubAgent`
7. **Deterministic branching, no LLM routing** → raw `StateGraph`

### Mandatory implementation checklist

Every multi-agent system must address all of:

| Concern | Requirement |
|---|---|
| Recursion limit | Set `recursion_limit` explicitly at compile; default is 25 |
| Loop detection | Add state-level counter or repeated-handoff guard for all handoff edges |
| Checkpointer | Required for swarm (loses `active_agent` without it); required for HITL |
| Worker names | Unique, non-default — `langgraph-supervisor` raises on `name="LangGraph"` |
| Parallel tool calls | Disable or use `ToolCallLimitMiddleware` if subgraphs share a checkpoint namespace |
| Error handling | Wrap remote calls with `.with_fallbacks([...])` or node-level retry |
| Context cost | Set `output_mode="last_message"` unless full history is required |
| Checkpoint growth | Enable DeltaChannel (langgraph ≥1.2) for threads exceeding ~50 turns |

### Handoff mechanics summary

Refer to `references/patterns.md` for complete typed examples. The two canonical forms:

- **Node-level `Command`** — node function returns `Command(goto="worker", update={...})`;
  no `add_conditional_edges` needed; routing logic stays in Python, not graph topology.
- **Handoff tool** — `InjectedToolCallId` + `InjectedState` tool returns
  `Command(goto=agent_name, graph=Command.PARENT, update={...})`; natural fit for
  tool-calling supervisors.

---

## Step 4 — Output & Verification

After generating any agent or graph, emit the exact shell commands to verify the system:

```bash
# Install (never pip install — use uv)
uv add langgraph langchain-core

# Pattern-specific additions
uv add langgraph-supervisor   # only if using the library
uv add langgraph-swarm        # only if using swarm
uv add langgraph-bigtool      # only if using bigtool
uv add deepagents             # only if using deepagents harness

# Smoke-test a compiled graph (replace agent with your variable)
uv run python -c "
from langgraph.checkpoint.memory import InMemorySaver
result = agent.invoke(
    {'messages': [{'role': 'user', 'content': 'ping'}]},
    config={'configurable': {'thread_id': 'test-1'}},
)
print(result['messages'][-1].content)
"

# Verify recursion limit is set (prints the compiled config)
uv run python -c "import json; print(agent.config)"

# Stream with subgraph attribution
uv run python -c "
for ns, chunk in agent.stream(
    {'messages': [{'role': 'user', 'content': 'ping'}]},
    config={'configurable': {'thread_id': 'test-2'}},
    subgraphs=True,
):
    print(ns, list(chunk.keys()))
"
```

For deepagents systems, additionally verify:

```bash
# Confirm deepagents version (pin to 0.6.x)
uv run python -c "import deepagents; print(deepagents.__version__)"

# Confirm model is explicit (None default deprecated since 0.5.3)
uv run python -c "
from deepagents import create_deep_agent
# Should NOT pass model=None
agent = create_deep_agent(model='anthropic:claude-sonnet-4-6', tools=[])
print('agent created ok')
"
```

---

## Reference Files

| File | Domain | Primary source section |
|---|---|---|
| [references/patterns.md](references/patterns.md) | Five official LangChain patterns, token benchmarks, Command/handoff mechanics, supervisor lib, swarm, network, subgraph isolation | research § 1a–1e; decision tables |
| [references/remote-graphs.md](references/remote-graphs.md) | `RemoteGraph` class, `AsyncSubAgent`, distributed topology, auth, error handling | research § 1f, 3d |
| [references/bigtool.md](references/bigtool.md) | `langgraph-bigtool`, Store + embeddings, retrieval tuning, limitations | research § 2 |
| [references/deepagents.md](references/deepagents.md) | `create_deep_agent` API, all middleware, backends, harness profiles, stability matrix, dcode | research § 3a–3g, stability matrix, API changelog |

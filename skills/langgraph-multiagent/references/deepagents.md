# Deep Agents Reference — `create_deep_agent` and the deepagents Harness

> **Version: `deepagents` 0.6.7** (verified June 1 2026). Python 3.11+ required.
> Install: `uv add deepagents`
>
> **Critical:** The entry point is `create_deep_agent` — NOT `create_agent`.
> `create_agent` is a LangChain / LangGraph prebuilt; `create_deep_agent` is the deepagents
> batteries-included harness. Confusing them produces a working but unharnessed agent.

---

## Positioning

deepagents is an opinionated harness layer on top of LangGraph's `create_react_agent`
for **long-horizon, planning-heavy, tool-heavy work** (Claude Code-style agents). It returns
a compiled LangGraph graph so you can use `.invoke`, `.stream`, and `.get_state` without
adapter code. It integrates LangSmith tracing/deployment by default and is model-agnostic
(any tool-calling LLM). Security model: "trust the LLM" — enforce boundaries at the
tool/sandbox level, not via model self-policing.

### deepagents vs alternatives decision table

| Need | Use |
|---|---|
| Planning + filesystem + subagents + summarization out of the box, long-horizon | **`deepagents.create_deep_agent`** |
| Lighter harness, custom middleware, you control the stack | `langchain.agents.create_agent` |
| Non-standard control flow, deterministic branching, full topology control | Raw `langgraph.StateGraph` |
| Simple "call tool, get result, respond" | `langgraph.prebuilt.create_react_agent` |
| Hundreds–thousands of tools with retrieval | `langgraph-bigtool` |

---

## `create_deep_agent` — Full Signature

```python
from deepagents import create_deep_agent

create_deep_agent(
    model: str | BaseChatModel | None = None,
    # ^^^ None was the default before 0.5.3 (resolved to claude-sonnet-4-6).
    # DEPRECATED since 0.5.3 — will raise in 1.0.0. Always pass model explicitly.
    tools: Sequence[BaseTool | Callable | dict] | None = None,
    system_prompt: str | SystemMessage | None = None,
    # Pass a SystemMessage (not a plain str) to preserve cache_control markers
    # for Anthropic prompt caching.
    middleware: Sequence[AgentMiddleware] = (),
    subagents: Sequence[SubAgent | CompiledSubAgent | AsyncSubAgent] | None = None,
    skills: list[str] | None = None,    # paths to SKILL.md files for SkillsMiddleware
    memory: list[str] | None = None,    # paths to AGENTS.md files for MemoryMiddleware
    permissions: list[FilesystemPermission] | None = None,
    backend: BackendProtocol | BackendFactory | None = None,
    interrupt_on: dict[str, bool | InterruptOnConfig] | None = None,  # HITL config
    response_format: type | None = None,    # structured output; requires deepagents ≥0.5.3
    context_schema: type | None = None,
    checkpointer: Checkpointer | None = None,
    store: BaseStore | None = None,
    debug: bool = False,
    name: str | None = None,
    cache: BaseCache | None = None,
)
```

`async_create_deep_agent` has the same signature with `is_async=True` — changes how
`SubAgentMiddleware` handles tool execution (uses async task dispatch).

### Prompt assembly order

1. Caller's `system_prompt` (first — use `cache_control` markers here for max cache hits)
2. SDK default deep-agent prompt
3. HarnessProfile model-tuning suffix (if a profile is registered for the selected model)

---

## `SubAgent` TypedDict

```python
from deepagents import create_deep_agent
from typing import NotRequired

# SubAgent is a TypedDict with these fields:
research_subagent: dict = {
    "name": "researcher",                          # required — unique identifier
    "description": "Researches and summarizes topics.",  # required — shown to supervisor LLM
    "system_prompt": "You are a research specialist.",   # optional (also accepts "prompt")
    "tools": [],                                   # NotRequired[list[BaseTool | Callable]]
    "model": "anthropic:claude-haiku-4-5",         # NotRequired — cheaper model for worker
    "middleware": [],                              # NotRequired — inherits parent minus Memory/SubAgent
    "skills": [],                                  # NotRequired — SKILL.md paths for this worker
    "response_format": None,                       # NotRequired — structured output (deepagents ≥0.5.3)
}
```

`CompiledSubAgent(name, description, runnable)` wraps any pre-compiled LangGraph graph as a
subagent — use for subagents with custom topology.

An **auto-added general-purpose subagent** is always present unless disabled in the harness
profile YAML: `general_purpose_subagent: enabled: false`.

---

## Complete Production Example

```python
from __future__ import annotations

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.store.memory import InMemoryStore

from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend


def internet_search(query: str) -> str:
    """Search the internet for current information on the given query."""
    # Replace with real implementation
    return f"Search results for: {query}"


research_subagent = {
    "name": "researcher",
    "description": "Researches topics and returns structured findings.",
    "system_prompt": "Research the topic thoroughly; return only a concise summary.",
    "tools": [internet_search],
    "model": "anthropic:claude-haiku-4-5",  # cheaper model for the worker
}


def make_backend(runtime: object) -> CompositeBackend:
    return CompositeBackend(
        default=StateBackend(runtime),
        routes={"/memories/": StoreBackend(runtime)},  # cross-thread memory via Store
    )


agent = create_deep_agent(
    model=ChatAnthropic(model="claude-sonnet-4-6"),   # always explicit — None is deprecated
    tools=[internet_search],
    system_prompt=SystemMessage(
        content="You are a senior research lead. Plan with write_todos before acting.",
        # Preserve cache_control for Anthropic prompt caching if using AnthropicPromptCachingMiddleware
    ),
    subagents=[research_subagent],
    backend=make_backend,
    store=InMemoryStore(),
    checkpointer=InMemorySaver(),
    interrupt_on={"write_file": True},   # HITL gate — pause before writing files
    debug=False,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "Research LangGraph multi-agent patterns and write report.md"}]},
    config={"configurable": {"thread_id": "session-1"}},
)
print(result["messages"][-1].content)
```

---

## Built-in Middleware

The default middleware stack runs in the following order. All middleware except
`SubAgentMiddleware` and `FilesystemMiddleware` can be excluded via `excluded_middleware`
in a HarnessProfile (those two raise `ValueError` if you try to remove them — use
`excluded_tools` to hide their model-visible surface instead).

### Middleware stack (default order)

| # | Middleware | Source | What it does |
|---|---|---|---|
| 1 | `TodoListMiddleware` | langchain | `write_todos`/`read_todos` tools; `todos` state channel; planning instructions via `wrap_model_call` |
| 2 | `MemoryMiddleware` | langchain | Loads AGENTS.md paths (`memory` param) into the system prompt once at session start |
| 3 | `SkillsMiddleware` | deepagents | Progressive disclosure — metadata first (~100 tokens/skill); full skill body loaded on-demand via `read_file` |
| 4 | `FilesystemMiddleware` | deepagents | `ls, read_file, write_file, edit_file, glob, grep` + conditional `execute`; large tool results evicted to filesystem (`tool_token_limit_before_evict`) |
| 5 | `SubAgentMiddleware` | deepagents | `task` tool for delegating to subagents; filters `_EXCLUDED_STATE_KEYS` so parent state doesn't leak to children |
| 6 | `SummarizationMiddleware` | deepagents | Auto-compacts when context fills; model-aware defaults (e.g. `trigger=("fraction", 0.85)`, `keep=("fraction", 0.10)`); `compact_conversation` tool; backend-aware (offloads old messages to filesystem) |
| 7 | `AnthropicPromptCachingMiddleware` | langchain-anthropic | Marks static content for caching |
| 8 | `PatchToolCallsMiddleware` | deepagents | Fixes dangling tool calls in history |
| 9 | Your custom middleware | — | Added via `middleware` param |
| 10 | `HumanInTheLoopMiddleware` | deepagents | Added automatically when `interrupt_on` is configured |

### Subagent middleware inheritance

Subagents inherit the parent middleware stack **minus** MemoryMiddleware and SubAgentMiddleware
(subagents cannot spawn subagents by default; they don't inherit cross-session memory loading).

### `AgentsMdMiddleware` / `MemoryMiddleware` distinction

| Middleware | Load timing | Content |
|---|---|---|
| `MemoryMiddleware` | Once at session start (`before_agent`) | AGENTS.md personality/conventions file; always loaded |
| `AgentsMdMiddleware` | On-demand (Anthropic Memory-Tool style) | Additional `.deepagents/*.md` files; loaded when the agent calls the memory tool |

---

## Backends

### Backend decision table

| Backend | Persistence | Security | Use case |
|---|---|---|---|
| `StateBackend` | Ephemeral (thread-scoped) | N/A | Default; development |
| `StoreBackend` | Persistent (cross-thread) | Depends on store | Cross-session memory via LangGraph BaseStore |
| `FilesystemBackend(root_dir, virtual_mode=False)` | Real disk | **None** — no process isolation | Local dev only; never production |
| `FilesystemBackend(root_dir, virtual_mode=True)` | Real disk | Path-guardrail only (**NOT a sandbox**) | Mild isolation; prompt-injection risk remains |
| `CompositeBackend(default, routes={...})` | Mixed | Mixed | Route `/memories/` to Store, rest to State |
| `LocalShellBackend` | Ephemeral | **None** — unrestricted shell | Development with HITL only |
| `ContextHubBackend` | LangSmith Hub versioned | LangSmith auth | Auditable, versioned memory (beta) |
| Sandbox backends (Modal/Daytona/Runloop/LangSmith) | Varies | Container isolation | **Production code execution** |

### `CompositeBackend` routing

```python
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langgraph.store.memory import InMemoryStore

store = InMemoryStore()

def make_backend(runtime: object) -> CompositeBackend:
    return CompositeBackend(
        default=StateBackend(runtime),
        routes={
            "/memories/": StoreBackend(runtime),  # longest-prefix routing
        },
    )
```

Routing is longest-prefix match. `/memories/` paths persist to the Store; all other paths
use the ephemeral StateBackend.

### Sandbox — "sandbox as tool" pattern (recommended for production)

The recommended pattern: the agent runs on the host, API keys stay outside the sandbox,
and you swap sandbox backends freely. Sandboxes launched in deepagents v0.4.

```python
from __future__ import annotations

from daytona import Daytona
from langchain_daytona import DaytonaSandbox  # uv add langchain-daytona

from deepagents import create_deep_agent

sandbox = Daytona().create()

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    backend=DaytonaSandbox(sandbox=sandbox),
)

try:
    result = agent.invoke(
        {"messages": [{"role": "user", "content": "Create a Python package and run pytest."}]},
        config={"configurable": {"thread_id": "sandbox-1"}},
    )
finally:
    sandbox.stop()   # always clean up; also check provider dashboard for orphaned sandboxes
```

Custom sandbox: implement `BackendProtocol` / `SandboxBackendProtocol`. Implement `execute()`
and inherit `BaseSandbox` to get filesystem tools translated to shell commands automatically.

> **Security note:** `FilesystemBackend(virtual_mode=True)` is path-guardrail only, NOT
> process isolation. `LocalShellBackend` is unrestricted local shell — never use either in
> production without sandboxing. Assume prompt-injection risk persists even in a sandbox.

---

## Harness Profiles (v0.6 — beta)

```python
from deepagents import create_deep_agent
from deepagents.profiles import HarnessProfile, register_harness_profile

# Register a custom profile for a specific model
register_harness_profile(
    "anthropic:claude-sonnet-4-6",
    HarnessProfile(
        system_prompt_suffix="Always use structured JSON output for tool calls.",
        excluded_tools=["execute"],          # hide model-visible tools
        # excluded_middleware cannot include SubAgentMiddleware or FilesystemMiddleware
    ),
)

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    tools=[],
)
```

Impact reported by LangChain (v0.6 blog):
- gpt-5.2-codex: **52.8% → 66.5%** on Terminal-Bench 2.0 (Top 30 → Top 5) — 13.7-point gain
  with the model fixed; harness-layer changes alone drove the improvement.
- gpt-5.3-codex: **+20%** on tau2-bench.
- opus-4.7: **+10%** on tau2-bench.

---

## Async Subagents (v0.5, April 7 2026 — preview)

> **Shipped in v0.5 (April 7 2026) — NOT "v1.9.0 alpha"** (an incorrect earlier claim).
> Status: **preview** — APIs may change. Requires `deepagents >= 0.5`.

`AsyncSubAgent` runs on remote Agent Protocol servers via the LangGraph SDK. Returns a task
ID immediately (non-blocking). The supervisor gets five management tools:
`start_async_task`, `check_async_task`, `update_async_task`, `cancel_async_task`,
`list_async_tasks`.

```python
from __future__ import annotations

from deepagents import AsyncSubAgent, create_deep_agent

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    subagents=[
        AsyncSubAgent(
            name="researcher",
            description="Background research — non-blocking.",
            graph_id="researcher",
            # url=None → ASGI in-process transport (co-deployed, zero network overhead)
        ),
        AsyncSubAgent(
            name="coder",
            description="Code generation and review.",
            graph_id="coder",
            url="https://coder.langsmith.dev",  # HTTP transport for remote deployment
            headers={"Authorization": "Bearer sk-..."},
        ),
    ],
)
```

Task metadata is stored in the `async_tasks` state channel — it survives summarization,
unlike tool messages that may be compacted away.

Auth for LangGraph Platform: automatic via `LANGGRAPH_API_KEY` / `LANGSMITH_API_KEY` /
`LANGCHAIN_API_KEY` environment variables. Self-hosted: pass `headers`.

---

## Stability Matrix

| Feature | Status | Available since |
|---|---|---|
| `create_deep_agent`, sync subagents, filesystem, TodoList, Summarization, prompt caching | **GA / stable** | 0.1.x |
| Sandboxes (Modal / Daytona / Runloop / LangSmith) | **Stable** | 0.4 |
| Harness profiles, `ContextHubBackend` | **Beta** | 0.6 |
| DeltaChannel (langgraph ≥1.2 required) | **Beta** | 0.6 |
| Async subagents (`AsyncSubAgent`) | **Preview** — APIs may change | 0.5 (Apr 7 2026) |
| `CodeInterpreterMiddleware` / QuickJS REPLMiddleware | **Experimental** | 0.6 |
| Deep Agents Code CLI (`dcode`) | Stable CLI, rapidly iterating | 0.1.0 (separate package) |
| `model=None` default | **Deprecated** since 0.5.3 | **Removed in 1.0.0** |

---

## API Changelog — Breaking Changes by Minor Version

| Version | Date | Breaking changes |
|---|---|---|
| 0.2 | — | Positioning push toward more autonomous agents |
| 0.4 | — | Pluggable sandboxes; OpenAI Responses API as default; smarter summarization |
| 0.5 | Apr 7 2026 | Async subagents (`AsyncSubAgent`); multimodal filesystem (PDF/audio/video via `read_file`) |
| 0.5.3 | — | `model=None` default deprecated |
| 0.6 | — | Harness profiles; `ContextHubBackend`; DeltaChannel (beta); `CodeInterpreterMiddleware` (QuickJS); `stream_events` v3 support |
| CLI 0.1.0 | — | Interactive REPL moved to `deepagents-code` (`dcode`); `deepagents-cli` now holds only `init`/`dev`/`deploy` subcommands |

> **Versioning rule:** `0.Y.Z` — **minor (Y) bumps may carry breaking changes** to public
> APIs. Pin `deepagents==0.6.*` and watch the changelog before upgrading.

---

## DeltaChannel — Checkpoint Storage Optimization

DeltaChannel is a LangGraph primitive (≥1.2, beta) wired into deepagents v0.6. It stores
only the per-step delta rather than a full snapshot at each step.

| Metric | Without DeltaChannel | With DeltaChannel | Reduction |
|---|---|---|---|
| Storage (200-turn coding session) | **5.3 GB** | **129 MB** | **41×** |
| Growth rate | O(N²) | O(N) | — |

deepagents ships an `AgentState` with DeltaChannel pre-wired on the `messages` field to cut
checkpoint growth from O(N²) to O(N). Enable when:
- Session length exceeds ~50 turns.
- Checkpoint storage grows superlinearly with turns.
- You observe >1 GB checkpoints in production.

---

## Deep Agents Code CLI (`dcode`)

```bash
# Install
curl -LsSf https://langch.in/dcode | bash

# Non-interactive one-shot
dcode -n "Create a FastAPI app with tests"

# Specific model
dcode --model anthropic:claude-opus-4-7 -n "Refactor this codebase"

# Auto-approve all actions (CI / scripted use)
dcode -y -n "Run tests and fix any failures"

# Sandbox execution
dcode --sandbox modal -n "Run benchmarks in an isolated environment"
dcode --sandbox daytona -n "Build and test the Docker image"
dcode --sandbox runloop -n "Execute the integration test suite"

# Pipe from stdin
echo "What does this code do?" | dcode
```

Benchmark: **Deep Agents CLI (Sonnet 4.5) scored ~42.5% on Terminal-Bench 2.0** (89 manually
verified tasks) — on par with Claude Code itself (LangChain evaluation blog).

---

## Production Gotchas

| Failure mode | Root cause | Fix |
|---|---|---|
| Agent created but unharnessed | Used `create_react_agent` instead of `create_deep_agent` | Always import from `deepagents` |
| `TypeError` at model invocation | `model=None` with deepagents ≥1.0.0 | Always pass `model` explicitly |
| Subagent leaks parent state | Not filtering `_EXCLUDED_STATE_KEYS` in custom middleware | Use `SubAgentMiddleware`; do not bypass its state filtering |
| `ValueError` on `excluded_middleware` | Tried to exclude `SubAgentMiddleware` or `FilesystemMiddleware` | Use `excluded_tools` to hide model-visible surface instead |
| Context window fills before task completes | `SummarizationMiddleware` trigger fraction too high | Lower `trigger` fraction or enable DeltaChannel |
| Checkpoint storage explosion | >50-turn sessions without DeltaChannel | Enable DeltaChannel (langgraph ≥1.2 + deepagents 0.6) |
| Async task metadata lost after summarization | Using synchronous `SubAgentMiddleware` | Use `AsyncSubAgentMiddleware`; tasks in `async_tasks` channel survive compaction |
| Orphaned sandbox | `sandbox.stop()` not called on exception | Wrap in `try/finally`; audit provider dashboard |
| Breaking change on minor bump | Upgraded `0.5.x → 0.6.x` without review | Pin `deepagents==0.6.*`; read changelog before upgrading |
| Skills not loading | Paths in `skills=` param are wrong or SKILL.md missing | Verify paths at startup; `SkillsMiddleware` silently skips missing files |

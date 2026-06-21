# Sync Subagents Reference — deepagents

---

## SubAgent TypedDict

```python
from typing import TypedDict, NotRequired
from langchain_core.tools import BaseTool
from langchain_core.language_models import BaseChatModel
from deepagents.middleware import AgentMiddleware

class SubAgent(TypedDict):
    name: str                                           # required — unique identifier
    description: str                                    # required — shown to supervisor LLM
    system_prompt: NotRequired[str]                     # also accepted as "prompt"
    tools: NotRequired[list[BaseTool | callable]]
    model: NotRequired[str | BaseChatModel]             # cheaper model for worker
    middleware: NotRequired[list[AgentMiddleware]]      # inherits parent minus Memory/SubAgent
    skills: NotRequired[list[str]]                      # SKILL.md paths for this worker
    response_format: NotRequired[type]                  # structured output (deepagents>=0.5.3)
    interrupt_on: NotRequired[dict[str, bool]]          # per-subagent HITL (can differ from parent)
```

### Field notes

| Field | Notes |
|---|---|
| `name` | Must be unique across all subagents in the same `create_deep_agent` call |
| `description` | This is what the supervisor LLM sees when deciding whether to delegate — write for discoverability |
| `system_prompt` | Also accepted as `"prompt"` (legacy alias) |
| `model` | Set to a cheaper model (e.g. `claude-haiku-4-5`) for routine worker tasks |
| `middleware` | Inherits parent stack minus `MemoryMiddleware` and `SubAgentMiddleware`; cannot nest subagents by default |
| `interrupt_on` | Can require HITL approval on specific tools **even when the parent doesn't** — enables targeted human review |

---

## CompiledSubAgent

Wraps any pre-compiled LangGraph graph as a subagent:

```python
from deepagents import CompiledSubAgent

compiled = CompiledSubAgent(
    name="custom-worker",
    description="A worker with custom LangGraph topology.",
    runnable=my_compiled_graph,   # any compiled LangGraph graph
)

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    subagents=[compiled],
)
```

Use `CompiledSubAgent` when the worker needs:
- Custom state channels
- Conditional branching (not a simple react loop)
- Its own checkpointer or store

---

## task tool

The `task` tool is the model-visible delegation mechanism for sync subagents:

```
task(agent_name: str, task: str) -> str
```

- The supervisor calls `task("researcher", "Research quantum computing")`.
- The harness routes the call to the matching subagent by `agent_name`.
- Execution blocks until the subagent returns.
- The return value is the subagent's final message content.

---

## response_format (structured output)

```python
from pydantic import BaseModel

class ResearchResult(BaseModel):
    summary: str
    sources: list[str]
    confidence: float

research_subagent: SubAgent = {
    "name": "researcher",
    "description": "Returns structured research results.",
    "response_format": ResearchResult,   # requires deepagents>=0.5.3
}
```

When `response_format` is set, the subagent's output is parsed into the specified type. The supervisor receives a structured object, not a raw string.

---

## Middleware inheritance

Subagents inherit the parent middleware stack **minus**:
- `MemoryMiddleware` (subagents don't load cross-session memory at each call)
- `SubAgentMiddleware` (subagents cannot spawn subagents by default)

The harness **auto-injects** before custom subagent middleware:
1. `TodoListMiddleware`
2. `FilesystemMiddleware`
3. `SummarizationMiddleware`

This means subagents can use todos, read/write files, and handle long contexts without any extra configuration.

---

## Per-subagent interrupt_on

```python
research_subagent: SubAgent = {
    "name": "researcher",
    "description": "Does web research.",
    "tools": [web_search_tool],
    "interrupt_on": {
        "web_search": True,   # pause before every web search — even if parent doesn't
    },
}
```

`interrupt_on` at the subagent level is independent from the parent's `interrupt_on`. A subagent can require approval even when the supervisor does not (and vice versa). This enables fine-grained HITL: auto-approve low-risk supervisor actions but gate high-risk subagent tool calls.

---

## Auto-added general-purpose subagent

The harness always adds a general-purpose subagent unless disabled in a HarnessProfile:

```python
from deepagents import HarnessProfile, GeneralPurposeSubagentProfile, register_harness_profile

# Disable it
register_harness_profile(
    "anthropic:claude-sonnet-4-6",
    HarnessProfile(
        general_purpose_subagent=GeneralPurposeSubagentProfile(enabled=False),
    ),
)
```

The general-purpose subagent handles overflow tasks — anything the supervisor delegates that doesn't match a named subagent.

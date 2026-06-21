# AGENTS.md Memory Reference — deepagents MemoryMiddleware

---

## MemoryMiddleware

```python
from deepagents.middleware import MemoryMiddleware

# Registered automatically by create_deep_agent when memory= is passed
MemoryMiddleware(
    backend=backend,
    sources=[
        "~/.deepagents/AGENTS.md",     # global conventions (loaded first)
        "./.deepagents/AGENTS.md",     # project-level overrides (loaded after)
    ],
)
```

- Loads all AGENTS.md source files **once at session start** (`before_agent` hook).
- Wraps content in `<agent_memory>` tags before injecting into the system prompt.
- When multiple sources are listed, all are loaded and **concatenated** — later sources append after earlier ones.
- Does not reload between turns — memory is static for the session lifetime.

### When memory is injected

```
System prompt assembly (per session start):
  [USER system_prompt]
  [BASE deep-agent prompt]
  [HarnessProfile SUFFIX]
  <agent_memory>
  [AGENTS.md content from source 1]
  [AGENTS.md content from source 2]
  </agent_memory>
```

MemoryMiddleware is placed **after** `AnthropicPromptCachingMiddleware` in the default stack so memory updates don't invalidate the Anthropic cache prefix (see `deepagents-harness-and-claude` skill).

---

## AGENTS.md content rules

### What to store

```markdown
# Agent Conventions

## Code style
- Use uv, never pip
- Python 3.12+ minimum
- Type hints required on all public functions

## Project context
- This is a data pipeline for financial reporting
- All monetary values are in USD cents (integer), never floats
- The `reports/` directory is read-only; never write to it

## Persona
You are a senior data engineer with deep PostgreSQL expertise.
Respond concisely. Prefer code over prose for technical answers.
```

### What NOT to store

The MEMORY_SYSTEM_PROMPT explicitly forbids:
- API keys, credentials, tokens, secrets of any kind
- Transient session information ("I'm on my phone", "I'm in a hurry")
- Conversation-specific context that won't be relevant in future sessions
- Large blobs of content that belong in a skill's L3 references

---

## AgentsMdMiddleware vs MemoryMiddleware

| Attribute | MemoryMiddleware | AgentsMdMiddleware |
|---|---|---|
| Load timing | Always — once at session start | On-demand — when agent calls a memory tool |
| Content source | Fixed `sources=` list | `.deepagents/*.md` files discovered at runtime |
| Model visibility | Always in context | Only when the agent explicitly retrieves it |
| Use case | Persistent conventions, persona, project context | Supplementary context the agent retrieves as needed |
| Token cost | Paid on every request | Paid only when retrieved |

Use `MemoryMiddleware` (via `memory=` param) for conventions the agent must always follow. Use `AgentsMdMiddleware` for supplementary context the agent might occasionally need.

---

## Agent-persisted learnings

The agent can update its own memory by calling `edit_file` on an AGENTS.md source path:

```python
# The agent will do this automatically when it learns something worth remembering:
# edit_file("/memories/AGENTS.md", old_string="...", new_string="...")

# In your application, seed the initial AGENTS.md:
from deepagents.backends.utils import create_file_data

result = agent.invoke(
    {
        "messages": [...],
        "files": {
            "/memories/AGENTS.md": create_file_data(
                "# Project Memory\n\n## Learned facts\n(agent will add here)\n"
            ),
        },
    },
    config={"configurable": {"thread_id": "session-1"}},
)
```

- The MEMORY_SYSTEM_PROMPT instructs the agent when and how to persist new learnings.
- Agent-persisted content survives only as long as the backend persists the file (use `FilesystemBackend` or a persistent store for durable memory).

---

## Using memory= param in create_deep_agent

```python
agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    memory=[
        "~/.deepagents/my-agent/agent.md",   # global conventions
        "./.deepagents/agent.md",            # project-level additions
    ],
)
```

Paths in `memory=` are resolved at agent construction time. They must point to readable files; missing files are silently skipped (no error).

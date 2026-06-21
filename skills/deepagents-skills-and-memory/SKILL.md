---
name: deepagents-skills-and-memory
version: 1.0.0
description: >
  Deep Agents skills and memory system — SKILL.md authoring, SkillsMiddleware, three-level
  progressive disclosure model, AGENTS.md memory, MemoryMiddleware, source layering and
  precedence, and CLI directory conventions. Triggers on: SKILL.md, SkillsMiddleware,
  MemoryMiddleware, AGENTS.md, progressive disclosure, agentskills.io, skill frontmatter,
  skill-authoring, memory vs skills, .deepagents, create_file_data, StateBackend seeding,
  source precedence, last-wins, skill sources, memory sources, AgentsMdMiddleware,
  skills= param, memory= param, skill invocation, L1 L2 L3 disclosure.
  Requires deepagents>=0.5.0.
---

## Core Philosophy

This skill is self-referential: the plugin system itself authors SKILL.md files. The deepagents skills system follows a **three-level progressive disclosure** model designed to minimise token cost — the agent sees only a name and description at startup (L1), loads the full skill body on demand (L2), and reads supporting files only when needed (L3). Memory (AGENTS.md) differs fundamentally: it is always loaded at session start and provides persistent personality/convention context, not on-demand workflows. Confusing skills with memory — or over-loading L1 with content that should be L3 — is the most common authoring mistake.

---

## Step 1 — Determine Context

| Signal | Sub-topic | Reference to load |
|---|---|---|
| Authoring a SKILL.md, frontmatter fields, `name`, `description`, `allowed-tools` | Skill authoring | `references/skill-authoring.md` |
| L1/L2/L3 levels, token budget, how the agent loads a skill, invocation flow | Progressive disclosure | `references/progressive-disclosure.md` |
| AGENTS.md format, what to store vs skip, `MemoryMiddleware`, `AgentsMdMiddleware` | Memory (AGENTS.md) | `references/agents-md-memory.md` |
| `sources=[...]`, last-wins, `.deepagents/` dirs, global vs project, `create_file_data` | Source precedence | `references/source-precedence.md` |
| General "how do skills and memory work?" | All of the above | Load all four references |

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/skill-authoring.md` | SKILL.md spec, frontmatter fields, body structure, file limits | Any skill authoring question |
| `references/progressive-disclosure.md` | L1/L2/L3 model, token costs, invocation mechanism | Questions about how skills are loaded or when content appears to the agent |
| `references/agents-md-memory.md` | MemoryMiddleware, AGENTS.md format, AgentsMdMiddleware distinction | AGENTS.md authoring; memory vs skills decision |
| `references/source-precedence.md` | Source layering, last-wins, CLI dirs, `create_file_data` for StateBackend | Source configuration; override layering; programmatic seeding |

---

## Step 3 — Implement

### Skills vs memory decision gate

```
Does the agent need this context on EVERY request?
  └─ YES → Memory (AGENTS.md via MemoryMiddleware)
      Examples: coding conventions, persona, project glossary, permanent constraints

Does the agent need this context OCCASIONALLY (only when doing a specific task)?
  └─ YES → Skill (SKILL.md via SkillsMiddleware)
      Examples: "how to write a migration", "deploy process", "code review checklist"

Rule of thumb: memory is for WHO the agent is; skills are for WHAT the agent knows how to do.
```

### Registering skills and memory

```python
from deepagents import create_deep_agent

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    # Skills: paths to SKILL.md files (or directories containing them)
    skills=[
        "~/.deepagents/my-agent/skills/",      # global skills directory
        "./.deepagents/skills/",                # project-level skills (override by name)
    ],
    # Memory: paths to AGENTS.md files
    memory=[
        "~/.deepagents/my-agent/agent.md",     # global personality/conventions
        "./.deepagents/agent.md",              # project-level overrides
    ],
)
```

### Seeding skills programmatically (StateBackend)

When using `StateBackend` (in-memory, no disk), you cannot point `skills=` at a filesystem path. Instead, seed via `invoke(files={...})`:

```python
from deepagents.backends.utils import create_file_data

result = agent.invoke(
    {
        "messages": [{"role": "user", "content": "Help me write a migration."}],
        "files": {
            "/skills/db-migration/SKILL.md": create_file_data(skill_md_content),
        },
    },
    config={"configurable": {"thread_id": "session-1"}},
)
```

**Raw strings are not supported** as file values — always use `create_file_data()`.

### Mandatory skill authoring checklist

| Requirement | Rule |
|---|---|
| `name` field | Must exactly match the directory name |
| `description` length | Maximum 1024 characters |
| `description` content | Must include trigger phrases — this is the agent's search surface |
| File size | Maximum 10 MB per SKILL.md |
| Body | Must contain at least one numbered step |
| Supporting files | Place in the same directory or a subdirectory; reference them explicitly in steps |

---

## Step 4 — Verify

```bash
# Confirm skills are loaded at startup (L1 — name + description only)
uv run python -c "
from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend

agent = create_deep_agent(
    model='anthropic:claude-sonnet-4-6',
    backend=FilesystemBackend(root_dir='/my/project'),
    skills=['./.deepagents/skills/'],
    memory=['./.deepagents/agent.md'],
)
print('agent created — skills and memory registered')
"

# Confirm agent.md is always injected (wrap agent output and check for <agent_memory> tag)
uv run python -c "
from deepagents import create_deep_agent
from deepagents.backends import StateBackend
from deepagents.backends.utils import create_file_data

agent = create_deep_agent(
    model='anthropic:claude-sonnet-4-6',
    backend=StateBackend(),
)
result = agent.invoke(
    {
        'messages': [{'role': 'user', 'content': 'What conventions should I follow?'}],
        'files': {'/agent.md': create_file_data('# Conventions\nAlways use uv, never pip.')},
    },
    config={'configurable': {'thread_id': 'test-1'}},
)
print(result['messages'][-1].content)
"
```

---

## Reference Files

| File | Domain | Load when |
|---|---|---|
| [references/skill-authoring.md](references/skill-authoring.md) | SKILL.md frontmatter spec, body structure, file size limits, required fields | Any skill authoring question |
| [references/progressive-disclosure.md](references/progressive-disclosure.md) | L1/L2/L3 disclosure model, token costs, invocation mechanism, when content appears | Questions about how skills are loaded or token budget |
| [references/agents-md-memory.md](references/agents-md-memory.md) | MemoryMiddleware, AGENTS.md content rules, AgentsMdMiddleware distinction | AGENTS.md authoring; memory vs skills decision |
| [references/source-precedence.md](references/source-precedence.md) | Source layering, last-wins override, CLI conventions, create_file_data for StateBackend | Source configuration; override layering; programmatic seeding |

# Source Precedence Reference — deepagents SkillsMiddleware & MemoryMiddleware

---

## SkillsMiddleware source layering

```python
from deepagents.middleware import SkillsMiddleware

SkillsMiddleware(
    backend=backend,
    sources=[
        "~/.deepagents/my-agent/skills/",      # global skills (loaded first)
        "./.deepagents/skills/",               # project skills (loaded after — overrides by name)
        ("~/.deepagents/shared/", "shared"),   # labelled source (path, label) tuple
    ],
)
```

### last-wins rule

When two sources provide a skill with the same `name`, **the later source wins**. The earlier version is discarded entirely.

```
sources=[
    "~/.deepagents/skills/",      # has db-migration/SKILL.md (version A)
    "./.deepagents/skills/",      # has db-migration/SKILL.md (version B)
]
# result: version B is active; version A is discarded
```

This enables a layering pattern:
1. Global skills (`~/.deepagents/<agent>/skills/`) — base conventions
2. Team skills (shared path) — team-level overrides
3. Project skills (`./.deepagents/skills/`) — project-specific overrides

---

## CLI directory conventions

The `dcode` CLI and `create_deep_agent` both auto-discover skills and memory from standard locations.

### Global location (user-level)

```
~/.deepagents/
  <agent-name>/
    agent.md           # global AGENTS.md for this agent
    skills/
      <skill-name>/
        SKILL.md
```

### Project location (auto-detected via .git)

```
<project-root>/
  .deepagents/
    agent.md           # project-level AGENTS.md
    skills/
      <skill-name>/
        SKILL.md
```

The CLI detects `<project-root>` by walking up the directory tree until it finds a `.git` directory.

**Override order:** project skills override global skills by name (last-wins).

---

## Labelled sources

Sources can be `(path, label)` tuples. The label is used for display and disambiguation:

```python
sources=[
    ("~/.deepagents/skills/", "global"),
    ("~/.deepagents/team-skills/", "team"),
    ("./.deepagents/skills/", "project"),
]
```

Labels appear in the L1 skill listing injected into the system prompt, helping the agent understand the provenance of each skill.

---

## Seeding skills into StateBackend

`StateBackend` stores files in LangGraph's state store (in-memory by default). Since there is no filesystem, you cannot point `skills=` at a directory path. Instead, seed files via the `invoke` call:

```python
from deepagents import create_deep_agent
from deepagents.backends import StateBackend
from deepagents.backends.utils import create_file_data

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    backend=StateBackend(),
    skills=["/skills/"],    # virtual path inside state
    memory=["/agent.md"],   # virtual path inside state
)

skill_content = """---
name: db-migration
description: >
  Write and run database migrations. Triggers on: migration, alembic, schema change.
---

## Step 1 — Determine Context
...
"""

result = agent.invoke(
    {
        "messages": [{"role": "user", "content": "Help me write a migration."}],
        "files": {
            "/skills/db-migration/SKILL.md": create_file_data(skill_content),
            "/agent.md": create_file_data("# Conventions\nUse uv, never pip.\n"),
        },
    },
    config={"configurable": {"thread_id": "session-1"}},
)
```

### create_file_data

```python
from deepagents.backends.utils import create_file_data

# Accepts a string and returns the internal file data structure
file_data = create_file_data("file content here")

# Raw strings are NOT valid — always use create_file_data()
# WRONG:  "files": {"/path": "raw content"}
# CORRECT: "files": {"/path": create_file_data("raw content")}
```

---

## MemoryMiddleware source layering

Memory sources are **concatenated**, not overridden. All sources are loaded and joined:

```python
memory=[
    "~/.deepagents/global.md",   # loaded first, content appears first
    "./.deepagents/project.md",  # loaded second, content appended after
]
```

If you want project memory to override global memory, you cannot use the same `memory=` layering mechanism — instead, use a single source that combines the content, or use separate `MemoryMiddleware` instances with explicit ordering.

---

## Source resolution at construction time

Both `skills=` and `memory=` paths are resolved when `create_deep_agent` is called:
- Directories are scanned for valid skill directories (containing `SKILL.md`).
- Missing files are silently skipped (no error at construction time).
- Changes to skill files after construction are not picked up until the agent is reconstructed.

For hot-reload of skills in development, use `StateBackend` with programmatic seeding via `invoke(files={...})` — each invoke call can include updated skill content.

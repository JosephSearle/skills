# Skill Authoring Reference — deepagents Agent Skills

> Spec: Agent Skills (agentskills.io). Skills are Markdown files with YAML frontmatter.
> Only SKILL.md is required. Maximum file size: 10 MB (enforced as a DoS guard).

---

## Required frontmatter fields

```yaml
---
name: <skill-name>           # must exactly match the directory name
description: >
  <what the skill does and what triggers it — max 1024 characters>
---
```

`name` and `description` are the only two required fields.

### Optional frontmatter fields

```yaml
---
name: my-skill
version: 1.0.0               # semantic version (major.minor.patch)
description: >
  ...
license: MIT                 # SPDX identifier
compatibility:               # version constraints (informational)
  deepagents: ">=0.6.0"
metadata:                    # arbitrary key-value pairs
  author: team-name
  category: data-engineering
allowed-tools:               # list of tool names the skill is permitted to call
  - read_file
  - write_file
  - execute
---
```

---

## Body structure

The body must contain at least one numbered step. A complete skill follows this pattern:

```markdown
## Core Philosophy
<1–3 sentence framing — security/correctness intent, what problem this skill solves>

## Step 1 — Determine Context
<classification table: signals → sub-topic>

## Step 2 — Load References
<table: reference file | domain | load when>

## Step 3 — Implement
<topic-specific decision gates, code patterns, mandatory checklist>

## Step 4 — Verify
<exact shell commands to confirm the feature works>

## Reference Files
<table pointing to reference files in the references/ subdirectory>
```

Steps must be `## Step N —` or numbered list items for the validator to accept them.

---

## Directory layout

```
skills/<skill-name>/
  SKILL.md                      # required
  references/                   # optional: supporting files
    <topic-a>.md
    <topic-b>.md
    frameworks/                  # optional subdirectory
      <framework>.md
    scenarios/                   # optional subdirectory
      <scenario>.md
  assets/                       # optional: code templates, config stubs
  scripts/                      # optional: audit/check scripts
```

The `name` in frontmatter must exactly match `<skill-name>` — the validator checks this.

---

## Description authoring rules

| Rule | Detail |
|---|---|
| Max length | 1024 characters |
| Must include trigger phrases | These are the agent's search surface for skill discovery |
| Should answer "what does this skill do?" | In one sentence, then list keywords |
| Use block scalar (`>`) | Allows multi-line without escaping |

### Good description example

```yaml
description: >
  Configure PostgreSQL indexes, query plans, and connection pooling for production workloads.
  Triggers on: EXPLAIN ANALYZE, slow query, index bloat, pg_stat_statements, connection pool,
  PgBouncer, VACUUM, autovacuum, pg_trgm, partial index, covering index, index scan,
  sequential scan, lock contention.
```

### Poor description example

```yaml
description: >
  Helps with database stuff.  # too vague — no trigger phrases, won't be selected
```

---

## allowed-tools field

`allowed-tools` lists tool names the skill is explicitly permitted to invoke. This is an advisory field — the harness uses it for documentation and may enforce it in future versions.

```yaml
allowed-tools:
  - read_file
  - write_file
  - edit_file
  - glob
  - grep
  - execute       # only list if the skill genuinely needs shell access
```

Omit `allowed-tools` if the skill should inherit all tools from the harness configuration.

---

## Versioning rules

| Change type | Version bump |
|---|---|
| Clarify wording, fix typo, add example | Patch (0.0.x) |
| Add optional step or new reference file | Minor (0.x.0) |
| Change required inputs/outputs, reorder steps, change core goal | Major (x.0.0) |

---

## Common authoring mistakes

| Mistake | Correct approach |
|---|---|
| `name:` doesn't match directory name | Validator rejects — must match exactly |
| Description over 1024 characters | Trim to key trigger phrases; move detail to Step 1 |
| Raw file content in frontmatter string values | Escape special YAML characters or use block scalars |
| Supporting files in `references/` but never referenced in steps | Explicitly load them in Step 2 — agents won't discover them automatically |
| Putting everything in SKILL.md (no L3 files) | Move verbose reference content to `references/*.md` for L3 loading |

# Progressive Disclosure Reference — deepagents SkillsMiddleware

> Three levels of disclosure minimise token cost while keeping full content available on demand.

---

## The three levels

| Level | What the agent sees | When | Token cost |
|---|---|---|---|
| **L1** | `name` + `description` from frontmatter | At session start, for every registered skill | ~100 tokens/skill |
| **L2** | Full SKILL.md body | When the agent decides to invoke the skill | Full skill content |
| **L3** | Supporting files in `references/` | When the agent explicitly calls `read_file` on a reference path | Per-file content |

---

## L1 — Startup injection

At session start, `SkillsMiddleware` injects a compact summary of each registered skill into the system prompt:

```
Available skills:
- my-skill: Configure PostgreSQL indexes, query plans, and connection pooling...
- another-skill: ...
```

Only `name` and `description` appear. The agent uses these to decide whether to invoke a skill for the current task.

**Design implication:** The `description` field is the **only content the agent sees** when deciding whether a skill is relevant. Write descriptions for discoverability, not documentation.

---

## L2 — Skill invocation

When the agent decides to use a skill, it calls `read_file` on the skill path (e.g. `/skills/my-skill/SKILL.md`). `SkillsMiddleware` intercepts this and returns the full SKILL.md body.

The agent then follows the skill's steps, loading reference files as directed by Step 2.

**L2 is on-demand — it is not loaded at startup.** A skill with 50 KB of content costs 0 tokens until the agent invokes it.

---

## L3 — Reference file loading

Reference files in `references/` are L3 content. The agent reads them by calling `read_file` on the reference path, following explicit instructions in the skill's Step 2.

```markdown
## Step 2 — Load References

Load `references/indexes.md` when the user asks about query performance.
Load `references/pooling.md` when the user mentions connection limits.
```

L3 files stay on the backend until the agent calls `read_file`. They never appear in context unless explicitly loaded.

**Design implication:** Move all verbose reference content to L3 files. Keep SKILL.md (L2) focused on decision gates and pointers to references.

---

## Token budget guidelines

| Content type | Where to put it | Level |
|---|---|---|
| Trigger keywords, one-line summary | `description` frontmatter | L1 |
| Decision tables, mode classification, step logic | SKILL.md body | L2 |
| API signatures, code patterns, detailed rules | `references/*.md` | L3 |
| Code templates, config files | `assets/` directory | L3 (read on demand) |

---

## Invocation flow (step by step)

```
1. Session starts
   └─ SkillsMiddleware injects L1 (name + description) for all skills

2. User sends a message
   └─ Model reads L1 summaries; decides skill X is relevant

3. Agent calls read_file("/skills/skill-x/SKILL.md")
   └─ SkillsMiddleware returns L2 (full SKILL.md body)
   └─ Agent reads Step 1 (context detection)
   └─ Agent reads Step 2 (reference loading instructions)

4. Agent calls read_file("/skills/skill-x/references/topic-a.md")
   └─ L3 reference loaded; agent applies its content

5. Agent executes Step 3 (implementation)
   └─ May load more L3 references as needed

6. Agent executes Step 4 (verification)
```

---

## Designing for progressive disclosure

### Good L1 description (discovery-optimised)

```yaml
description: >
  PostgreSQL production tuning: indexes, query plans, connection pooling, VACUUM, lock
  contention. Triggers on: EXPLAIN ANALYZE, slow query, index bloat, pg_stat_statements,
  PgBouncer, autovacuum, pg_trgm, partial index, covering index, sequential scan.
```

### Good L2 step (routes to L3, doesn't embed the content)

```markdown
## Step 2 — Load References

Load `references/indexes.md` when the question involves query performance or index selection.
Load `references/pooling.md` when the question mentions connections, PgBouncer, or pool size.
```

### Bad L2 (embeds what should be L3)

```markdown
## Step 2 — Reference

The GIN index is used for full-text search. CREATE INDEX idx_name ON table USING GIN (col).
For trigram matching use pg_trgm extension... [500 more lines of content]
```

Move that content to `references/indexes.md` and point to it from Step 2.

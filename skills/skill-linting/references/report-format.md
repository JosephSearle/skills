# Report Format

Defines severity levels, report structure, and verdict rules for the skill-linting skill.
Load this file alongside `universal.md` when producing a lint report.

---

## Severity Levels

| Severity | Label | Definition | Blocks merge? |
|---|---|---|---|
| Blocker | `[blocker]` | The skill cannot be loaded or used by an agent at all — broken frontmatter, missing `name`, directory/name mismatch, no numbered steps | Yes — must fix before committing |
| Major | `[major]` | The skill loads but will not work correctly — missing trigger phrases, wrong naming convention, README not updated, referenced file missing | Yes — should fix before merging |
| Minor | `[minor]` | The skill works but is below standard — description too short, no Core Philosophy section, passive voice in steps | No — worth fixing, does not block merge |
| Nit | `[nit]` | Minor polish — first sentence could be stronger, description first sentence doesn't lead with the action | No — optional improvement |

---

## Verdict Rules

| Condition | Verdict |
|---|---|
| Any `[blocker]` present | **FAIL** |
| Any `[major]` present (no blockers) | **FAIL** |
| Only `[minor]` or `[nit]` | **PASS** (with recommendations noted) |
| No findings at all | **PASS** |

---

## Report Template

Use this exact structure. Omit empty severity sections entirely.

```
## Skill Lint Report: <skill-name>

**File:** skills/<skill-name>/SKILL.md
**Findings:** <N blocker(s), N major, N minor, N nit(s)>
**Verdict:** PASS | FAIL

---

### Blockers — must fix before committing
- [blocker] <finding>
  → <what to write instead, with a concrete example>

### Majors — should fix before merging
- [major] <finding>
  → <what to write instead, with a concrete example>

### Minors — worth fixing, do not block merge
- [minor] <finding>
  → <suggested improvement>

### Nits — optional
- [nit] <finding>

---

### Summary
<1–3 sentences: overall quality assessment and the single most important thing to fix first.>
```

---

## Formatting Rules

- Each finding occupies one bullet under its severity section
- Every finding must be followed by a `→` line with a concrete, actionable fix
- Quote the offending text verbatim when flagging a semantic issue (e.g. passive voice, wrong trigger phrase phrasing) — the author needs to see exactly what triggered the finding
- Omit the `→` line only for `[nit]` findings where the improvement is already clear from the finding text
- Do not combine multiple findings into a single bullet — one finding per bullet, always
- Count findings accurately in the `**Findings:**` line; use singular for 1 (`1 blocker`) and plural for 2+ (`2 blockers`)
- Omit severity sections that have zero findings — do not print an empty `### Blockers` header

---

## Example: FAIL Report

```
## Skill Lint Report: my-skill

**File:** skills/my-skill/SKILL.md
**Findings:** 1 blocker, 1 major, 1 minor
**Verdict:** FAIL

---

### Blockers — must fix before committing
- [blocker] frontmatter `name: myskill` does not match directory name `my-skill`
  → Change the name field to `name: my-skill` so the agent runtime can resolve this skill.

### Majors — should fix before merging
- [major] The description contains no `Triggers on:` clause
  → Add: `Triggers on: "run my-skill", "apply my-skill to this file", ...`

### Minors — worth fixing, do not block merge
- [minor] No `## Core Philosophy` section found
  → Add a 2–4 sentence section immediately after the H1 title explaining the skill's single job and what failure looks like.

---

### Summary
The name/directory mismatch is a runtime blocker — fix it first. After that, add trigger phrases so agents can route to the skill, then add a Core Philosophy section to complete the standard structure.
```

---

## Example: PASS Report

```
## Skill Lint Report: spike-generation

**File:** skills/spike-generation/SKILL.md
**Findings:** 0 blockers, 0 majors, 1 nit
**Verdict:** PASS

---

### Nits — optional
- [nit] The description's first sentence does not lead with the action word. Consider starting with "Generate..." or "Create..." for immediate clarity.

---

### Summary
The skill meets all structural and semantic standards. The nit is cosmetic and does not affect agent routing or execution.
```

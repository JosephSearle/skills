---
name: skill-linting
description: >
  Review a SKILL.md file against all authoring standards for this repository: frontmatter
  validity, naming convention, body structure, README registration, semantic quality of
  descriptions, step imperative voice, trigger phrase presence, reference file naming, and
  version correctness. Produces a severity-classified report with one actionable finding per
  violation. Triggers on: "lint this skill", "validate this SKILL.md", "check my skill",
  "review this skill file", "does this skill meet standards", "validate the frontmatter",
  "is this skill valid", "check skill quality", or any instruction to validate, lint, or
  review a SKILL.md file against the repository's authoring standards.
---

# Skill Linting Skill

A skill for reviewing SKILL.md files against all authoring standards defined in CLAUDE.md and
CONTRIBUTING.md. Covers structural validity, semantic quality, and version correctness —
producing a severity-classified report modelled on the code-review skill's output format.

---

## Core Philosophy

A skill file is a contract between the author and every agent that will ever load it. A broken
contract — missing frontmatter, wrong name, no trigger phrases — degrades every downstream
agent run silently. The linter's job is to surface every violation before the skill is
committed, with enough context that the author can fix it without reading the standards
documents themselves.

Every finding must answer: what is wrong, why it matters for an agent loading this skill, and
what the author should write instead.

---

## Step 1 — Locate the Target File

```
Was a file path provided in the instruction?
  └─ YES → Verify the path resolves to a SKILL.md file
           └─ File exists    → proceed to Step 2
           └─ File not found → report: "No SKILL.md found at <path>. Check the path and try again."
  └─ NO  → Is a SKILL.md open in the current editor context or attached to the session?
            └─ YES → use that file
            └─ NO  → ask: "Which SKILL.md should I lint? Provide the file path."
```

Read the full file into context before running any checks. Collect all findings first, then
output the report in Step 6 — do not emit findings incrementally.

Also read:

- `references/universal.md` — canonical standards checklist (always load)
- `CLAUDE.md` in the repository root — naming convention, frontmatter rules, versioning policy
- `README.md` in the repository root — Skills Index table (needed for Steps 2e and 5)

---

## Step 2 — Structural Checks

These checks have definitive pass/fail outcomes. Run all of them before moving to semantic
checks in Step 3.

### 2a. Frontmatter presence

```
Does the file open with a line containing only "---"?
  └─ NO  → [blocker] No YAML frontmatter block found. SKILL.md must open with "---".
Does a second "---" delimiter appear within the first 30 lines?
  └─ NO  → [blocker] Frontmatter block is not closed. Add a closing "---" delimiter.
```

### 2b. Required frontmatter fields

Parse all key-value pairs between the two `---` delimiters.

1. Does a `name:` field exist?
   - Missing → `[blocker]` `name` field is absent from frontmatter. Add `name: <skill-directory-name>`.
2. Is the `name` value non-empty?
   - Empty → `[blocker]` `name` field is present but has no value.
3. Does the `name` value exactly match the skill's directory name?
   - Mismatch → `[blocker]` `name: <value>` does not match the directory name `<dirname>`. These must be identical — the agent runtime uses the directory name to resolve the skill.
4. Does a `description:` field exist?
   - Missing → `[blocker]` `description` field is absent from frontmatter. Add a `description:` block.
5. Is the `description` value non-empty (after stripping the `>` block scalar marker and whitespace)?
   - Empty → `[blocker]` `description` field is present but has no content.

### 2c. Naming convention

Derive the skill name from the directory path of the file being linted.

1. Does the directory name match `^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)+$`?
   - No match → `[blocker]` Directory name `<name>` does not follow the `<domain>-<action>` kebab-case pattern. All segments must be lowercase and separated by hyphens.
2. Does the directory name appear to be verb-first? (First segment is a common English verb: `review`, `generate`, `create`, `build`, `run`, `check`, `test`, `write`, `make`, `get`, `set`, `add`, `delete`, `update`, `deploy`, `train`, `load`, `fetch`, `send`)
   - Yes → `[major]` Directory name `<name>` appears verb-first. Convention is domain-first: `code-review` not `review-code`.
3. Does any segment appear to be an abbreviation? (Fewer than 4 characters and not a recognised domain keyword such as `llm`, `git`, `doc`)
   - Yes → `[major]` Segment `<segment>` looks like an abbreviation. Use the full form: e.g. `generation` not `gen`, `workflow` not `wf`.

### 2d. Body structure

The body is everything after the closing frontmatter `---` delimiter.

1. Does the body contain at least one numbered step — either a `## Step N —` heading or a numbered list item matching `^\s*[0-9]+[.)]`?
   - No → `[blocker]` No numbered steps found. A skill must have at least one `## Step N — Title` heading or numbered list item.
2. Does the body contain at least one `## Step N —` heading?
   - No → `[major]` No `## Step N — Title` headings found. Skills use numbered step headings to structure the agent's workflow.
3. If the body names any `references/` paths, does a `## Reference Files` section exist?
   - References named but section absent → `[minor]` References are mentioned in the body but there is no `## Reference Files` section. Add one at the bottom listing all reference files with a one-line description each.

### 2e. README registration

Read the Skills Index table from `README.md`.

1. Is the skill's directory name listed as a link in the table?
   - No → `[major]` Skill `<name>` is not listed in the README.md Skills Index table. Add a row before merging.

---

## Step 3 — Semantic Checks

These checks require judgment. Apply them after all structural checks are complete.

### 3a. Trigger phrases in description

1. Does the description contain the literal phrase `Triggers on:`?
   - No → `[major]` The description does not contain a `Triggers on:` clause. Agents use this to decide whether to load the skill. Add: `Triggers on: "<phrase 1>", "<phrase 2>", ...`
2. After the `Triggers on:` clause, are there at least two quoted trigger phrases?
   - Fewer than two → `[minor]` Only one trigger phrase found. Provide at least two so agents have enough signal to trigger reliably.
3. Do the trigger phrases reflect how a user would ask for the task (natural language) rather than what the skill does (technical description)?
   - Technical phrasing → `[minor]` Trigger phrases should reflect what a user would say, not the skill's internal label.

### 3b. Imperative voice in step bodies

For each `## Step N —` section, sample the first two prose sentences.

1. Do they use imperative voice (e.g. "Detect the language", "Load the reference file")?
   - Past tense or passive voice found → `[minor]` Step `<N>` body uses past or passive voice: "<example>". Steps are instructions to the agent — use imperative voice.

### 3c. Core Philosophy section

1. Does the body contain a `## Core Philosophy` section?
   - No → `[minor]` No `## Core Philosophy` section found. Every skill has one — add a 2–4 sentence statement of what the skill's single job is and what failure looks like.

### 3d. Reference file naming and existence

For each `references/<filename>` path mentioned in the body:

1. Does the file actually exist at that path relative to the skill directory?
   - No → `[major]` Reference file `references/<filename>` is named in the skill but does not exist in the skill's `references/` directory.
2. Does the filename use kebab-case with a `.md` extension?
   - No → `[minor]` Reference file name `<filename>` should use kebab-case lowercase with a `.md` extension (e.g. `llm-security.md` not `LLMSecurity.md`).

### 3e. Description quality

1. Is the description at least 40 words long?
   - Shorter → `[minor]` Description is very short (<40 words). It should explain what the skill does, what its inputs are, and what triggers it.
2. Does the description's first sentence identify the skill's primary action?
   - No → `[nit]` The first sentence does not clearly identify what the skill does. Lead with the action: "Generate...", "Perform...", "Review...".

---

## Step 4 — Version Check

Apply this check only when the file has been modified relative to the base branch, or the
user has indicated a version change is involved.

```
Does the frontmatter contain a `version:` field?
  └─ NO  → [nit] No version field in frontmatter. Consider adding `version: 1.0.0` to enable
            downstream agents to pin to a specific skill version.
  └─ YES → Is the value a valid SemVer string (MAJOR.MINOR.PATCH)?
            └─ NO  → [major] version: <value> is not a valid SemVer string. Use MAJOR.MINOR.PATCH.
```

If a `version` field exists and the user has indicated the type of change, validate the bump:

| Change type | Required bump |
|---|---|
| Wording, typos, examples | Patch — PATCH increments, MINOR and MAJOR unchanged |
| New optional step or output | Minor — MINOR increments, MAJOR unchanged, PATCH resets to 0 |
| Changed required inputs, removed or reordered steps, changed core goal | Major — MAJOR increments, MINOR and PATCH reset to 0 |

Bump mismatch → `[major]` The stated change type requires a `<MAJOR|MINOR|PATCH>` bump, but the version shows `<old>` → `<new>`. Correct per CONTRIBUTING.md versioning rules.

---

## Step 5 — Overlap Check

Read the Skills Index from `README.md`. For each other listed skill, read its description
from the README table or from its SKILL.md frontmatter.

```
Does any other skill describe substantially the same task?
  └─ High overlap (same domain, same action, same primary output) →
       [major] Skill <name> appears to overlap with <other-name>: "<evidence>".
               Review whether this is a new skill or an extension of the existing one.
  └─ Partial overlap (same domain, different scope) →
       [nit] Skill <name> shares domain territory with <other-name>.
             If they are distinct, clarify the boundary in the description.
```

---

## Step 6 — Produce the Report

Load `references/report-format.md` for the output template and verdict rules. Apply
findings from Steps 2–5.

Output the report in this structure:

```
## Skill Lint Report: <skill-name>

**File:** skills/<skill-name>/SKILL.md
**Findings:** <N blocker(s), N major, N minor, N nit(s)>
**Verdict:** PASS | FAIL

---

### Blockers — must fix before committing
- [blocker] <finding>
  → <what to write instead>

### Majors — should fix before merging
- [major] <finding>
  → <what to write instead>

### Minors — worth fixing, do not block merge
- [minor] <finding>
  → <suggested improvement>

### Nits — optional
- [nit] <finding>

---

### Summary
<1–3 sentences: overall quality assessment and the single most important thing to fix first.>
```

Omit empty severity sections. Verdict: FAIL if any Blocker or Major is present; PASS otherwise.

---

## Hard Rules

- Never report a finding without a suggested fix — "this is wrong" with no correction is useless to the author
- Never fail on a subjective check without quoting the offending text — show exactly what triggered the finding
- Never skip Step 2 structural checks even if Step 3 semantic checks would also catch the same issue — structural failures must be reported independently because they break agent runtime loading
- Never mark a skill PASS if any Blocker or Major is present

---

## Reference Files

- `references/universal.md` — Canonical authoring standards checklist: all required frontmatter fields, naming convention rules, body structure requirements, and README registration requirements derived from CLAUDE.md and CONTRIBUTING.md; always load
- `references/report-format.md` — Severity classification table, full report output template, verdict decision rules, and formatting guidelines; always load

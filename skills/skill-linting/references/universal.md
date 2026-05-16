# Universal Authoring Standards

Canonical checklist of all authoring standards for SKILL.md files in this repository.
Derived from `CLAUDE.md` and `CONTRIBUTING.md`. Load this file whenever linting a skill.

---

## 1. Frontmatter Requirements

Every `SKILL.md` must open with a YAML frontmatter block delimited by `---`.

### Required fields

| Field | Requirement |
|---|---|
| `name` | Must exist, be non-empty, and exactly match the skill's directory name |
| `description` | Must exist and be non-empty after stripping the YAML block scalar marker (`>`) and whitespace |

### Optional fields

| Field | Notes |
|---|---|
| `version` | Recommended: SemVer string `MAJOR.MINOR.PATCH` (e.g. `1.0.0`) |

---

## 2. Naming Convention

**Pattern:** `<domain>-<action>` in kebab-case.

| Rule | Valid | Invalid |
|---|---|---|
| Domain first, action second | `code-review`, `test-generation` | `review-code`, `generate-tests` |
| All lowercase | `git-workflow` | `Git-Workflow` |
| Hyphens only — no underscores | `prompt-engineering` | `prompt_engineering` |
| No abbreviations | `readme-generation` | `readme-gen` |
| Action must be a noun form | `spike-generation` | `spike-generate` |
| At least two hyphen-separated segments | `skill-linting` | `skilllinting` |

**Regex:** `^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)+$`

**Recognised short domain keywords** (not treated as abbreviations): `llm`, `git`, `doc`

---

## 3. Body Structure Requirements

### Mandatory elements

| Element | Requirement |
|---|---|
| H1 title | First line of body must be a single `# Title` heading |
| `## Core Philosophy` | Must be present; 2–4 sentences stating the skill's single job and what failure looks like |
| Numbered steps | Body must contain at least one numbered list item (`1.` or `1)`) |
| `## Step N — Title` headings | At least one; numbered sequentially starting from 1 |
| `## Reference Files` section | Required if any `references/` paths are named in the body |

### Step conventions

- Steps use **imperative voice** — they are instructions to the agent, not descriptions
- Each step heading follows the pattern `## Step N — Title` (em dash, not hyphen)
- Steps are numbered sequentially and do not skip numbers
- Decision trees use indented `└─` connectors for branching logic

### Description conventions

- Must include a `Triggers on:` clause with at least two quoted natural-language trigger phrases
- Trigger phrases describe what a user would **say**, not what the skill does internally
- Description must be at least 40 words
- First sentence should identify the skill's primary action ("Generate...", "Perform...", "Review...")

---

## 4. Reference Files

- Reference files live in `references/` relative to the skill directory
- Filenames use kebab-case with `.md` extension (e.g. `universal.md`, `llm-security.md`)
- Every `references/` path named in the skill body must actually exist on disk
- A `## Reference Files` section at the bottom of the skill lists all reference files with one-line descriptions and loading conditions

---

## 5. README Registration

Every skill directory must have a corresponding row in the README.md Skills Index table.

**Table row format:**
```
| [skill-name](skills/skill-name/SKILL.md) | One-sentence description of what the skill does |
```

The description in the README should be a concise single sentence (not the full frontmatter description).

---

## 6. Versioning Policy (from CONTRIBUTING.md)

| Change type | Version bump |
|---|---|
| Clarify wording, fix typos, add examples | **Patch** — increment PATCH, MINOR and MAJOR unchanged |
| Add optional inputs/outputs or steps that don't break existing behaviour | **Minor** — increment MINOR, reset PATCH to 0, MAJOR unchanged |
| Change required inputs/outputs, remove or reorder steps, change the skill's core goal | **Major** — increment MAJOR, reset MINOR and PATCH to 0 |

---

## 7. Overlap Policy

A new skill must not duplicate an existing skill. Before adding a skill, check the README Skills Index to verify no existing skill covers the same domain and action.

- **High overlap** — same domain, same action, same primary output: reject or merge
- **Partial overlap** — same domain, different scope: permitted if the boundary is clearly stated in the description

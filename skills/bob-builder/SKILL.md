---
name: bob-builder
description: >
  Create and configure IBM Bob custom modes and skills, or analyse an existing project
  and recommend which modes and skills would improve developer workflows there.
  Triggers on: "create a bob mode", "add a bob skill", "new bob mode", "new bob skill",
  "what bob modes should I add", "what bob skills should I add", "analyze my project for
  bob", "review existing bob config", "enhance my bob mode", "recommend bob config".
version: 1.0.0
---

# IBM Bob Builder

IBM Bob is an AI SDLC partner embedded in VS Code. It supports five built-in modes (Code,
Ask, Plan, Advanced, Orchestrator), custom modes defined in YAML, and Skills — reusable
instruction sets that auto-activate in Advanced mode. This skill creates and configures
all three, and can analyse an existing project to generate context-aware recommendations.

---

## Core Philosophy

IBM Bob's power comes from its composability: modes shape how Bob behaves for a given
persona, and skills encode repeatable workflows Bob can load on demand. The best Bob
configs are specific — a well-scoped mode with precise `roleDefinition` and
`customInstructions` outperforms a generic one every time.

Design for the developer's workflow, not for completeness. An `api-developer` mode with
`fileRegex` locked to `*.ts` and security rules loaded via `.bob/rules/` is more valuable
than a mode that does everything.

---

## Step 1 — Mode Detection

Determine which of three sub-modes the user wants:

```
User says "analyze / what should I add / recommend / review project / what bob" → ANALYZE
User says "create / add / new mode / bob mode"                                  → CREATE_MODE
User says "create / add / new skill / bob skill"                                → CREATE_SKILL
Ambiguous or no clear signal                                                    → Ask:
  "Do you want to (1) analyze your project for Bob recommendations,
   (2) create a Bob custom mode, or (3) create a Bob skill?"
```

---

## Step 2 — Load Base Reference

**Always load `references/bob-schemas.md` before proceeding** regardless of mode. This
file contains the authoritative IBM Bob schema for both Skills and Modes and must be
active throughout to ensure generated output is valid.

---

## Step 3 — ANALYZE: Project Scan

> Skip to Step 4 if mode is CREATE_MODE. Skip to Step 5 if mode is CREATE_SKILL.

Load `references/bob-project-signals.md` now.

Scan the project root for the following signals **in this order**. Read each file
that exists; skip gracefully if absent.

### A — Existing Bob Config

```
.bob/                          — Does a Bob config already exist?
  custom_modes.yaml            — Existing custom modes (note slugs and groups)
  skills/                      — Existing skills (note names and descriptions)
  rules/                       — Existing rules files
  rules-<slug>/                — Mode-specific rules
  mcp.json                     — MCP server config
```
Summarise what is already configured before recommending additions.

### B — Project Intent Docs

Read these files if present:
- `README.md` — primary language/stack, project purpose, target audience
- `AGENTS.md` — existing agent/AI config conventions the team follows
- `CONTRIBUTING.md` — contribution workflow (branching, PR standards, testing gates)
- `docs/architecture/` — C4 diagrams, ADRs, architecture style (Monolith / Microservices / Serverless / Event-Driven)

### C — Stack Detection

Check for stack manifests:
```
package.json / package-lock.json     → Node.js / TypeScript ecosystem
pyproject.toml / requirements.txt    → Python ecosystem
pom.xml / build.gradle               → JVM ecosystem (Java / Kotlin)
go.mod                               → Go ecosystem
Cargo.toml                           → Rust ecosystem
```

For TypeScript projects, scan `package.json` `dependencies` and `devDependencies` for key libraries:
- `@langchain/core`, `langchain`, `@langchain/langgraph` → LangChain / LangGraph agent framework
- `@nestjs/core` → NestJS API server
- `@modelcontextprotocol/sdk` → MCP server development
- `express`, `fastify` → REST API
- `next`, `remix` → Full-stack web framework

For Python projects, scan `pyproject.toml` / `requirements.txt`:
- `langchain`, `langgraph`, `langsmith` → LangChain agent stack
- `fastapi`, `django`, `flask` → Web framework
- `pytest`, `deepeval`, `ragas`, `promptfoo` → Testing / eval framework
- `anthropic`, `openai`, `boto3` + `bedrock` → LLM provider

### D — CI/CD & Security Posture

```
.github/workflows/                   → GitHub Actions (check for security scanning, test gates)
SECURITY.md                          → Security disclosure policy (signals security awareness)
.snyk / snyk.yml                     → Snyk scanning active
docs/compliance/ or COMPLIANCE.md    → Compliance requirements documented
.pre-commit-config.yaml              → Pre-commit hooks active
```

If **any** security/compliance signals are found, also load `references/bob-security.md`.

### E — Synthesis: Generate Recommendations

Produce a structured report using this layout:

```
## Bob Configuration Recommendations for <Project Name>

### Detected Stack
<Brief bullet list of stack and key libraries>

### Existing Bob Config
<Summary of what's already in .bob/ — or "None detected">

---

### Recommended Modes

#### Mode: <slug>
**Rationale:** <Why this project benefits from this mode>
**Persona:** <Who uses it>

```yaml
<full customModes YAML entry>
```

(Repeat for each recommended mode)

---

### Recommended Skills

#### Skill: <name>

**Rationale:** <Why this skill would help>
**Activates when:** <Trigger phrases>

```markdown
<full Bob SKILL.md content in XML <Steps><Step> format>
```

(Repeat for each recommended skill)

---

### Mode Enhancements

<If existing modes found: specific additions to customInstructions or groups>
<If none: "No existing modes detected — start with the recommended modes above">

---

### Setup Instructions

1. <First file to create and where>
2. <Second file, etc.>
3. <Note: Skills require Advanced mode to activate>
```

---

## Step 4 — CREATE_MODE: Gather Requirements and Generate

> Skip to Step 5 if mode is CREATE_SKILL.

Ask the developer the following questions (or infer from context if they have already
provided enough detail):

1. **Purpose** — What persona or task is this mode designed for? (e.g. "security reviewer", "API developer", "data scientist")
2. **Tool groups** — Which groups should be enabled?
   - `read` — read files, search codebase
   - `edit` — write and modify files
   - `browser` — open URLs, search the web
   - `command` — run terminal commands *(note: high privilege — see Hard Rules)*
   - `mcp` — call registered MCP tools
3. **File restriction** — Should edits be limited to certain file types? (e.g. `".*\\.py$"` for Python only)
4. **Custom instructions** — Any specific behaviour rules, tone constraints, or output format requirements?
5. **Scope** — Project scope (`.bob/custom_modes.yaml`) or global for this developer (`~/.bob/settings/custom_modes.yaml`)?

Use `assets/mode-template.yaml` as the structural base. Fill in all five required fields
(`slug`, `name`, `roleDefinition`, `customInstructions`, `groups`). Add `fileRegex` only
if a restriction was requested. Add `source: global` only for global scope (see Hard Rules
— this field is community-documented, not in primary IBM docs).

**Write the mode:** Append the new entry to the `customModes` array in the target file.
If the file does not exist, create it with a `customModes:` root key.

Confirm the file path written and remind the developer: **reload Bob after saving** to
activate the new mode.

---

## Step 5 — CREATE_SKILL: Gather Requirements and Generate

Ask or infer:

1. **Task** — What repetitive developer task does this skill automate or guide? (e.g. "write a Bob SKILL.md", "run a security audit", "generate PR description")
2. **Triggers** — What phrases should cause Bob to load this skill? (used in `description` frontmatter)
3. **Steps** — What are the numbered phases of the workflow? (aim for 3–7 steps)
4. **Supporting files** — Does it need:
   - `references/` files Bob should load conditionally during the skill?
   - `scripts/` shell scripts Bob executes as part of the skill?

Use `assets/skill-template.md` as the structural base. Generate the full SKILL.md in
IBM Bob's XML `<Steps><Step>` body format. The frontmatter must contain **only** `name`
and `description` — no other fields are recognised by Bob.

**Write the skill:**
- Primary file: `.bob/skills/<name>/SKILL.md`
- If reference files requested: `.bob/skills/<name>/references/<file>.md`
- If scripts requested: `.bob/skills/<name>/scripts/<file>.sh`

Confirm all file paths written and remind the developer: **Skills activate only in
Advanced mode.** Bob auto-selects the skill based on the `description` field matching
the developer's intent — write it precisely.

---

## Step 6 — Emit Files

Report a clean summary of every file created or modified:

```
Files written:
  ✓ .bob/custom_modes.yaml              (created / updated)
  ✓ .bob/skills/my-skill/SKILL.md       (created)
  ✓ .bob/skills/my-skill/references/... (created, if applicable)

Next steps:
  1. <Any reload or activation instruction>
  2. <Any dependency (e.g. Advanced mode must be active for skills)>
```

---

## Hard Rules

These apply in every mode. Never deviate from them.

1. **IBM Bob SKILL.md frontmatter recognises only `name` and `description`.** Extra fields are silently ignored. Never add `version`, `author`, or other keys to a generated Bob skill.

2. **IBM Bob skills only activate in Advanced mode.** Always include this note in generated skills and in any ANALYZE recommendations that include skills.

3. **Bob skill body uses `<Steps><Step>` XML, not Markdown headings.** Do not generate Bob skills with `## Step N —` headings in the body — Bob expects the XML pattern.

4. **`groups` accepts exactly five values:** `read`, `edit`, `browser`, `command`, `mcp`. Any other value is invalid and will be silently ignored by Bob.

5. **Project-scope modes go in `.bob/custom_modes.yaml`; global-scope modes go in `~/.bob/settings/custom_modes.yaml`.** Never write a project-scoped mode to the global path or vice versa without explicit confirmation.

6. **The `source: global` field is community-documented, not in primary IBM docs.** If used, label it with: *"Note: `source: global` is documented by the community — verify against the official IBM Bob changelog before relying on it."*

7. **Always validate `fileRegex` is a valid JS regex before writing.** Test mentally: does `new RegExp("<pattern>")` throw? If unsure, omit `fileRegex` and note it was skipped.

8. **Never recommend or generate a mode with the `command` group enabled without explicitly stating the security trade-off.** Command execution gives Bob shell access — document why it is needed and what scope it should be limited to.

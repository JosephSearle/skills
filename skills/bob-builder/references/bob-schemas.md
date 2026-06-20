# IBM Bob Schema Reference

**Authority:** All schemas marked 🟢 HIGH are sourced from official IBM Bob documentation
(`bob.ibm.com/docs/ide`). Fields marked 🟡 MEDIUM are community-documented and should be
verified against the official IBM Bob changelog before encoding in production config.

Load this reference on every invocation of the bob-builder skill.

---

## 1. IBM Bob Skill Schema

### Frontmatter (YAML front-matter)

IBM Bob recognises **exactly two** frontmatter fields. All other keys are silently ignored.

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | Yes 🟢 | string | Kebab-case identifier; must match the directory name under `.bob/skills/` |
| `description` | Yes 🟢 | string | Bob reads this to decide when to auto-activate the skill — write it precisely |

**Example (correct):**
```yaml
---
name: my-skill
description: >
  Guide the developer through creating a structured PR description following
  Conventional Commits. Triggers on: "write PR description", "create PR", "PR template".
---
```

**Example (incorrect — extra fields are silently dropped):**
```yaml
---
name: my-skill
description: ...
version: 1.0.0      # ← Bob ignores this
author: Joe         # ← Bob ignores this
---
```

### Body Structure — `<Steps><Step>` XML

The body of a Bob SKILL.md uses an XML wrapper, **not** Markdown headings for steps.

```markdown
<Steps>
  <Step>
    ## Step 1 — Detect Context
    Read the current working directory and identify the project type.
    - If `package.json` exists → TypeScript/Node project
    - If `pyproject.toml` exists → Python project
  </Step>
  <Step>
    ## Step 2 — Load Reference
    Load the relevant language reference from `references/`.
  </Step>
  <Step>
    ## Step 3 — Generate Output
    Produce the output and write it to disk.
  </Step>
</Steps>
```

Markdown headings, tables, code blocks, and lists work normally **inside** each `<Step>`.

### Directory Layout for Bob Skills 🟢

```
.bob/
  skills/
    <skill-name>/
      SKILL.md          ← required; the skill itself
      scripts/          ← optional; shell scripts Bob executes during the skill
      references/       ← optional; topic files Bob loads conditionally per step
      assets/           ← optional; code or config templates Bob emits verbatim
```

Bob auto-detects skills in `.bob/skills/` when Advanced mode is active. The skill
activates when Bob determines the developer's intent matches the `description` field.

### Activation Requirement 🟢

**Skills require Advanced mode.** They do not activate in Code, Ask, Plan, or Orchestrator
built-in modes. Always remind developers of this requirement.

---

## 2. IBM Bob Custom Modes Schema

### File Locations

| Scope | Path | Notes |
|---|---|---|
| Project 🟢 | `.bob/custom_modes.yaml` | Checked into the repo; applies to all contributors |
| Global 🟡 | `~/.bob/settings/custom_modes.yaml` | Per-developer; community-documented path |

### `customModes` YAML Array Schema

```yaml
customModes:
  - slug: <string>              # Required 🟢 — URL-safe identifier; used in /mode command
    name: <string>              # Required 🟢 — Human-readable display name
    roleDefinition: <string>    # Required 🟢 — System-prompt persona for Bob in this mode
    customInstructions: <string># Optional 🟢 — Additional behavioural rules appended to prompt
    groups: <array>             # Optional 🟢 — Tool permission groups (defaults to all if omitted)
    fileRegex: <string>         # Optional 🟢 — JS regex; restricts which files Bob can edit
    source: global              # Optional 🟡 — Community-documented; not in primary IBM docs
```

### Field Detail

**`slug`** (required)
- Kebab-case; used with the `/mode <slug>` slash command
- Must be unique across all modes (built-in + custom)
- Example: `security-reviewer`, `api-developer`, `data-scientist`

**`name`** (required)
- Shown in the mode picker UI
- Example: `"Security Reviewer"`, `"API Developer"`

**`roleDefinition`** (required)
- Sets Bob's persona for this mode — this is the core of the mode
- Write in second person ("You are a …")
- State the primary responsibility and key constraints
- Example:
  ```yaml
  roleDefinition: >-
    You are a security-focused code reviewer specialising in OWASP Top 10 and
    NIST SSDF. You read code to identify vulnerabilities — you never modify files
    unless explicitly asked to apply a specific fix you have already explained.
  ```

**`customInstructions`** (optional)
- Additional rules appended to the system prompt after `roleDefinition`
- Good for output format requirements, tone, or project-specific conventions
- Example:
  ```yaml
  customInstructions: >-
    Always classify findings as [blocker], [major], [minor], or [nit].
    Format output as a Markdown table with columns: Severity | File | Line | Finding.
    Never suggest framework migrations — only propose changes within the existing stack.
  ```

**`groups`** (optional)
Restricts which tool categories Bob can invoke in this mode.

| Value | What it allows |
|---|---|
| `read` 🟢 | Read files, search codebase, list directories |
| `edit` 🟢 | Write, create, and modify files |
| `browser` 🟢 | Open URLs, search the web |
| `command` 🟢 | Execute terminal commands (high privilege — see security note) |
| `mcp` 🟢 | Call registered MCP server tools |

If `groups` is omitted, Bob defaults to all groups. To create a read-only mode:
```yaml
groups:
  - read
```

**`fileRegex`** (optional)
- A JavaScript regular expression string
- Restricts which files Bob is allowed to edit in this mode
- Must be a valid JS regex (test with `new RegExp(pattern)`)
- Applied to the full relative file path from the project root
- Examples:
  ```yaml
  fileRegex: ".*\\.py$"                     # Python files only
  fileRegex: ".*\\.(ts|tsx)$"               # TypeScript files only
  fileRegex: "src/.*\\.go$"                 # Go files under src/ only
  fileRegex: "^(?!.*\\.env).*"              # Everything except .env files
  fileRegex: "docs/.*\\.md$"               # Markdown under docs/ only
  ```

**`source: global`** 🟡 (optional, community-documented)
- When set to `global`, signals this mode is user-scoped rather than project-scoped
- Not present in primary IBM docs; community-documented in April 2026 blog posts
- Prefer controlling scope by **file location** (global path vs project path) rather than this field
- If used, add a comment: `# source: global — community-documented field; verify with IBM docs`

### Complete Mode Example

```yaml
customModes:
  - slug: api-developer
    name: API Developer
    roleDefinition: >-
      You are a senior backend engineer working on a NestJS REST API. Your primary
      responsibility is implementing and reviewing TypeScript service and controller code.
      You follow OpenAPI specification standards, apply Zod input validation on every
      endpoint, and prefer dependency injection over direct instantiation.
    customInstructions: >-
      Always generate OpenAPI JSDoc annotations on new controller methods.
      Prefer `class-validator` decorators for DTO validation.
      When suggesting database queries, default to the existing TypeORM repository pattern.
      Do not modify test files unless explicitly asked.
    groups:
      - read
      - edit
      - mcp
    fileRegex: ".*\\.(ts|spec\\.ts)$"
```

---

## 3. IBM Bob Built-in Modes

Available without any config. Reference when recommending which built-in mode to pair
with a custom skill or when deciding whether a custom mode is needed at all.

| Mode | Slug | Purpose |
|---|---|---|
| Code 🟢 | `code` | Default dev mode — full file editing, terminal access |
| Ask 🟢 | `ask` | Q&A mode — read-only; never modifies files |
| Plan 🟢 | `plan` | Planning mode — creates plans before acting; no direct edits |
| Advanced 🟢 | `advanced` | Full capabilities + Skills activation |
| Orchestrator 🟢 | `orchestrator` | Routes tasks to other modes or agents |

**Guidance:**
- Use Plan mode first for complex multi-step tasks; then switch to Code or Advanced for implementation
- Use Ask mode for pure Q&A that must not touch files
- Skills **only activate** in Advanced mode — if a project will use custom skills, Advanced is the primary working mode

---

## 4. IBM Bob Rules System

Rules are Markdown files that Bob loads as additional system-prompt context.

### File Locations 🟢

| Scope | Path | Notes |
|---|---|---|
| Global | `~/.bob/rules/` | Loaded for every project this developer uses |
| Project | `.bob/rules/` | Loaded for all modes in this project |
| Mode-specific | `.bob/rules-<slug>/` | Loaded only when the named mode is active |

### Loading Behaviour 🟢

- Files are loaded in **alphabetical order** within each directory
- `AGENTS.md` in the project root is **auto-loaded** by Bob (no manual configuration required)
- Files outside the above paths are not loaded automatically

### Recommended Naming Pattern

Prefix rules files with a number to control load order:
```
.bob/rules/
  01-project-conventions.md
  02-coding-standards.md
  10-security-policy.md
```

---

## 5. MCP Configuration Schema

### File Locations 🟢

| Scope | Path |
|---|---|
| Project | `.bob/mcp.json` |
| Global | `~/.bob/mcp.json` |

### Schema 🟢

```json
{
  "mcpServers": {
    "<server-name>": {
      "transport": "stdio",
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      },
      "alwaysAllow": ["tool_name_1", "tool_name_2"],
      "disabled": ["tool_name_to_hide"]
    }
  }
}
```

### Transport Types 🟢

| Transport | Config key | Use case |
|---|---|---|
| STDIO | `"transport": "stdio"` | Local process; most common for developer tools |
| SSE | `"transport": "sse"` | Remote server over HTTP+SSE |
| HTTP | `"transport": "http"` | Remote server over plain HTTP |

### Security Notes 🟢

- `alwaysAllow` bypasses Bob's approval prompt for listed tools — use sparingly
- Never commit secrets in `mcp.json` — use environment variable references (`${VAR}`)
- The `mcp` group in a mode's `groups` array must be enabled for MCP tools to be callable in that mode

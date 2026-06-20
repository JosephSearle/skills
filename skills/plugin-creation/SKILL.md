---
name: plugin-creation
description: >
  Scaffold a Claude Code plugin from scratch or convert existing standalone `.claude/`
  configuration into a shareable plugin. Generates the correct directory structure,
  `.claude-plugin/plugin.json` manifest, skill stubs, agent definitions, hook handlers,
  MCP server configs, and validates the result. Use whenever someone wants to build,
  create, or package a Claude Code plugin. Triggers on: "create a plugin",
  "make a Claude plugin", "scaffold a plugin", "build a plugin for Claude Code",
  "convert to a plugin", "new plugin", "package my skills as a plugin".
  Does not cover publishing to a marketplace — that is a separate concern.
---

# Plugin Creation Skill

A skill for scaffolding Claude Code plugins: correct directory layout, populated
manifest, working component stubs, and a validate-and-test pass at the end.

---

## Core Philosophy

A plugin is correct when `claude plugin validate` exits clean and `claude --plugin-dir`
loads every declared component. Generate that state in one pass — don't leave broken
skeletons for the user to fix.

---

## Step 1 — Detect Mode and Components

Determine the following before writing any files:

**Mode**
```
Is the user converting existing .claude/ config?
  └─ YES → note which files are in .claude/commands/, .claude/agents/, .claude/skills/
            and which hooks exist in .claude/settings.json
  └─ NO  → new plugin from scratch
```

**Plugin identity** (ask if not provided):
- `name` — kebab-case, becomes the skill namespace prefix (e.g. `my-plugin` → `/my-plugin:skill-name`)
- `description` — one sentence describing the plugin's purpose
- `version` — default `"1.0.0"` for new plugins; omit if the user wants commit-SHA versioning

**Component checklist** (ask or infer from context):

| Component | Needed? | Default location |
|-----------|---------|-----------------|
| Skills | Yes/No | `skills/<name>/SKILL.md` |
| Agents | Yes/No | `agents/<name>.md` |
| Hooks | Yes/No | `hooks/hooks.json` |
| MCP servers | Yes/No | `.mcp.json` |
| LSP servers | Yes/No | `.lsp.json` |
| Background monitors | Yes/No | `monitors/monitors.json` |
| User config (credentials) | Yes/No | `userConfig` in `plugin.json` |
| Marketplace listing | Yes/No | `.claude-plugin/marketplace.json` |

**Scope**:
```
Is this for personal use only, or for sharing via a marketplace?
  └─ Personal → suggest skills-dir deployment (~/.claude/skills/<name>/)
  └─ Marketplace → generate at a standalone path, include README.md + CHANGELOG.md
                   and generate .claude-plugin/marketplace.json
```

---

## Step 2 — Load References

Always load `references/manifest-schema.md` before writing `plugin.json`.

Load `references/component-schemas.md` when any of these are needed: agents, hooks,
MCP servers, LSP servers, or monitors.

---

## Step 3 — Scaffold Directory Structure

Create the following layout. Place **only** `plugin.json` (and optionally
`marketplace.json`) inside `.claude-plugin/`. All other directories belong at the
plugin root.

```
<plugin-name>/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json             ← omit unless targeting the Claude Code marketplace
├── skills/                      ← omit if no skills
│   └── <skill-name>/
│       └── SKILL.md
├── agents/                      ← omit if no agents
│   └── <agent-name>.md
├── hooks/                       ← omit if no hooks
│   └── hooks.json
├── .mcp.json                    ← omit if no MCP servers
├── .lsp.json                    ← omit if no LSP servers
├── monitors/                    ← omit if no monitors
│   └── monitors.json
├── scripts/                     ← omit if no hook/monitor scripts
└── README.md
```

**Hard rule**: never put `commands/`, `agents/`, `skills/`, or `hooks/` inside
`.claude-plugin/`. That is the single most common plugin authoring mistake.

---

## Step 4 — Write `plugin.json`

Consult `references/manifest-schema.md` for the complete field reference.

Minimum viable manifest:
```json
{
  "name": "<plugin-name>",
  "description": "<what this plugin does>",
  "version": "1.0.0",
  "author": {
    "name": "<author name>"
  }
}
```

Add fields based on what was determined in Step 1:

- Add `displayName` when the name differs from the human-readable label
- Add `repository` + `license` for marketplace plugins
- Add `keywords` for discoverability
- Add `defaultEnabled: false` for plugins that connect to external services or incur cost
- Add `userConfig` for any credentials or user-provided settings (mark secrets `sensitive: true`)
- Add component path fields **only** when overriding the defaults — if all components live
  in their default locations, no path fields are needed
- Use a descriptive filename for hooks when the plugin targets multiple hosts, e.g.
  `"hooks": "./hooks/claude-codex-hooks.json"` instead of the default `hooks/hooks.json`

Do **not** add path fields that just point at the default location (e.g. `"skills": "./skills/"`)
— that is redundant and generates a warning from `claude plugin validate`.

---

## Step 5 — Create Component Files

Write a working stub for each selected component. Consult `references/component-schemas.md`
for the exact frontmatter fields and JSON schemas.

### Skills

`skills/<skill-name>/SKILL.md`:
```markdown
---
description: >
  <What this skill does and when Claude should invoke it. Include trigger phrases.>
---

# <Skill Title>

<Instructions for the skill. Use numbered steps. Tell Claude exactly what to do.>
```

Rules:
- `description` is what Claude reads to decide whether to invoke the skill automatically — make it specific
- Use `disable-model-invocation: true` for skills that only run when the user explicitly calls them
- Set `name` in frontmatter when you need a stable invocation name regardless of directory name

### Agents

`agents/<agent-name>.md`:
```markdown
---
name: <agent-name>
description: <When Claude should delegate to this agent>
model: sonnet
effort: medium
maxTurns: 20
---

<System prompt for the agent. Describe its role, constraints, and how it should behave.>
```

Permitted frontmatter: `name`, `description`, `model`, `effort`, `maxTurns`, `tools`,
`disallowedTools`, `skills`, `memory`, `background`, `isolation`.
**Never** include `hooks`, `mcpServers`, or `permissionMode` — these are not supported
in plugin agents and will cause a load error.

### Hooks

`hooks/hooks.json`:
```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<tool-name-pattern>",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/<script>.sh"
          }
        ]
      }
    ]
  }
}
```

Always use `"${CLAUDE_PLUGIN_ROOT}"` (with surrounding double-quotes in shell-form commands)
for paths to bundled scripts. Scripts must be executable (`chmod +x`).

### MCP Servers

`.mcp.json` at the plugin root:
```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "<binary or interpreter>",
      "args": ["<arg1>", "<arg2>"],
      "env": {
        "SOME_TOKEN": "${user_config.api_token}",
        "DATA_DIR": "${CLAUDE_PLUGIN_DATA}"
      }
    }
  }
}
```

Use `${user_config.<key>}` to inject values from `userConfig`. Use `${CLAUDE_PLUGIN_ROOT}`
for bundled binaries, `${CLAUDE_PLUGIN_DATA}` for persistent state.

### Monitors

`monitors/monitors.json`:
```json
[
  {
    "name": "<identifier>",
    "command": "tail -F ./logs/app.log",
    "description": "<What is being watched>",
    "when": "always"
  }
]
```

`when` is either `"always"` (default) or `"on-skill-invoke:<skill-name>"` to start the
monitor only when that skill is first dispatched.

---

## Step 6 — Validate and Test

After generating all files, provide the user with these commands:

```bash
# Validate manifest, skill frontmatter, agent frontmatter, and hooks schema
claude plugin validate ./<plugin-name>

# For strict validation (treat unrecognised fields as errors — use in CI)
claude plugin validate ./<plugin-name> --strict

# Test locally without installing
claude --plugin-dir ./<plugin-name>
```

Inside the test session:
```
/reload-plugins          ← pick up edits without restarting
/<plugin-name>:<skill>   ← invoke a skill by name
/agents                  ← verify agents appear
/plugin list             ← confirm the plugin loaded
```

**For personal skills-dir deployment** (no marketplace):
```bash
# Scaffold directly into personal skills dir
claude plugin init <name>

# Or manually place the plugin folder
mv ./<plugin-name> ~/.claude/skills/<plugin-name>/
# Loads automatically as <name>@skills-dir on next session
```

**Common errors to pre-empt:**
- `Plugin has an invalid manifest` → check JSON syntax and that `name` is present
- `No commands found in custom directory` → ensure SKILL.md files are in `skills/<name>/` subdirectories, not loose in `skills/`
- `Executable not found` (LSP) → user must install the language server binary separately
- Components missing after load → confirm they are at the plugin root, not inside `.claude-plugin/`

---

## Reference Files

| File | When to load |
|------|-------------|
| `references/manifest-schema.md` | Always — before writing `plugin.json` |
| `references/component-schemas.md` | When creating agents, hooks, MCP servers, LSP servers, or monitors |

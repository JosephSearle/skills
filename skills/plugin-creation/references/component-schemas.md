# Plugin Component Schemas Reference

Source: Claude Code official documentation — `plugins-reference`, `skills`, `sub-agents`, `hooks`

---

## Skills (`skills/<name>/SKILL.md`)

Each skill lives in its own subdirectory under `skills/`. The directory name becomes
the skill's invocation name (unless overridden by the `name` frontmatter field).

**Invocation:** `/<plugin-name>:<skill-name>` (user-triggered) or auto-triggered by Claude based on `description`.

### Frontmatter Fields

```yaml
---
name: stable-name          # optional — overrides directory name as the invocation name
description: >
  What this skill does and when Claude should invoke it automatically.
  Include trigger phrases. Be specific — this is what Claude reads to decide relevance.
disable-model-invocation: true   # optional — skill only runs when user explicitly calls it
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `description` | Recommended | Tells Claude when to auto-invoke this skill. Omit only for user-only skills. |
| `name` | No | Stable invocation name, independent of the directory name. |
| `disable-model-invocation` | No | If `true`, Claude cannot auto-invoke — only the user can call it directly. |

### Skill Content

- Use numbered steps for sequential tasks
- Use `$ARGUMENTS` placeholder to capture text the user types after the skill name: `/my-plugin:greet Alice` → `$ARGUMENTS` is `"Alice"`
- Supporting files (reference docs, scripts) can live alongside `SKILL.md` in the same directory
- A `CLAUDE.md` at the plugin root is NOT loaded as project context — use skills for context injection

### Single-skill Plugin Layout

A plugin with `SKILL.md` at its root (no `skills/` subdirectory) automatically loads
as a single-skill plugin (Claude Code v2.1.142+). The `name` frontmatter field (or the
directory name) determines the invocation name.

---

## Agents (`agents/<name>.md`)

Each agent is a single Markdown file with YAML frontmatter and a system prompt body.

**Invocation:** Claude auto-invokes based on `description`, or user selects from `/agents`.

### Frontmatter Fields

```yaml
---
name: agent-name
description: What this agent specialises in and when Claude should invoke it.
model: sonnet
effort: medium
maxTurns: 20
disallowedTools: Write, Edit
---
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Identifier. Appears in `/agents` as `<plugin-name>:<name>`. |
| `description` | Yes | string | Used by Claude to decide when to delegate. Be specific about the agent's expertise and trigger conditions. |
| `model` | No | string | Model to use: `opus`, `sonnet`, `haiku`, or a full model ID. |
| `effort` | No | string | Thinking budget: `low`, `medium`, `high`. |
| `maxTurns` | No | number | Maximum tool-use turns before the agent must return. |
| `tools` | No | string | Comma-separated allowlist of tools the agent may use. |
| `disallowedTools` | No | string | Comma-separated list of tools the agent cannot use. |
| `skills` | No | string | Comma-separated skill names this agent can invoke. |
| `memory` | No | boolean | Whether the agent has access to memory tools. |
| `background` | No | boolean | If `true`, the agent runs without blocking the main thread. |
| `isolation` | No | string | Only valid value: `"worktree"` — agent runs in an isolated git worktree. |

**Never include** `hooks`, `mcpServers`, or `permissionMode` — these are not supported
in plugin agents and will cause a load error.

---

## Hooks (`hooks/hooks.json`)

Hooks respond to Claude Code lifecycle events. The format mirrors user-defined hooks
in `settings.json`, but lives in a standalone file at the plugin root.

### File Format

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<regex-pattern-matching-tool-names>",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/my-hook.sh"
          }
        ]
      }
    ]
  }
}
```

The `matcher` field is optional for events that aren't tool-specific (e.g. `SessionStart`).

### Hook Types

| Type | Description | Fields |
|------|-------------|--------|
| `command` | Execute a shell command or script | `command` (string) |
| `http` | POST the event JSON to a URL | `url`, optional `headers` |
| `mcp_tool` | Call a tool on a configured MCP server | `server`, `tool`, optional `arguments` |
| `prompt` | Evaluate a prompt with an LLM | `prompt` (use `$ARGUMENTS` for context) |
| `agent` | Run an agentic verifier with tools | `agent` name |

### Hook Events

| Event | When it fires |
|-------|--------------|
| `SessionStart` | When a session begins or resumes |
| `Setup` | On `--init-only` or `--init`/`--maintenance` in `-p` mode |
| `UserPromptSubmit` | When the user submits a prompt, before Claude processes it |
| `UserPromptExpansion` | When a slash command expands into a prompt (can block the expansion) |
| `PreToolUse` | Before a tool call executes (can block it) |
| `PermissionRequest` | When a permission dialog appears |
| `PermissionDenied` | When a tool call is denied. Return `{"retry": true}` to allow retry. |
| `PostToolUse` | After a tool call succeeds |
| `PostToolUseFailure` | After a tool call fails |
| `PostToolBatch` | After a full batch of parallel tool calls resolves |
| `Notification` | When Claude Code sends a notification |
| `MessageDisplay` | While assistant message text is being displayed |
| `SubagentStart` | When a subagent is spawned |
| `SubagentStop` | When a subagent finishes |
| `TaskCreated` | When a task is being created via `TaskCreate` |
| `TaskCompleted` | When a task is being marked as completed |
| `Stop` | When Claude finishes responding |
| `StopFailure` | When the turn ends due to an API error |
| `TeammateIdle` | When an agent team teammate is about to go idle |
| `InstructionsLoaded` | When a `CLAUDE.md` or `.claude/rules/*.md` file is loaded |
| `ConfigChange` | When a configuration file changes during a session |
| `CwdChanged` | When the working directory changes |
| `FileChanged` | When a watched file changes. `matcher` specifies which filenames to watch. |
| `WorktreeCreate` | When a worktree is being created (replaces default git behaviour) |
| `WorktreeRemove` | When a worktree is being removed |
| `PreCompact` | Before context compaction |
| `PostCompact` | After context compaction completes |
| `Elicitation` | When an MCP server requests user input during a tool call |
| `ElicitationResult` | After the user responds to an MCP elicitation |
| `SessionEnd` | When a session terminates |

### Hook Script Requirements

- Scripts must be executable: `chmod +x ./scripts/your-script.sh`
- Shebang line required: `#!/usr/bin/env bash`
- Always use `"${CLAUDE_PLUGIN_ROOT}"` (double-quoted) for paths to bundled scripts
- Hook input arrives as JSON on stdin — use `jq` to extract fields

Example hook that lints files after Write/Edit:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs \"${CLAUDE_PLUGIN_ROOT}\"/scripts/lint.sh"
          }
        ]
      }
    ]
  }
}
```

---

## MCP Servers (`.mcp.json`)

Standard MCP server configuration. Plugin MCP servers start automatically when the
plugin is enabled and appear as standard tools in Claude's toolkit.

### File Format

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "<binary or interpreter>",
      "args": ["<arg1>", "<arg2>"],
      "env": {
        "VAR_NAME": "${user_config.api_token}",
        "DATA_DIR": "${CLAUDE_PLUGIN_DATA}",
        "SCRIPT_DIR": "${CLAUDE_PLUGIN_ROOT}"
      },
      "cwd": "${CLAUDE_PLUGIN_ROOT}"
    }
  }
}
```

### Server Config Fields

| Field | Required | Description |
|-------|----------|-------------|
| `command` | Yes | The binary to execute (`node`, `python`, `uvx`, or a path) |
| `args` | No | Array of command-line arguments |
| `env` | No | Environment variables. Supports `${user_config.*}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}` |
| `cwd` | No | Working directory for the server process |

### Common Patterns

```json
{
  "mcpServers": {
    "my-api": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server/index.js"],
      "env": {
        "API_KEY": "${user_config.api_key}",
        "NODE_PATH": "${CLAUDE_PLUGIN_DATA}/node_modules"
      }
    },
    "python-tool": {
      "command": "uvx",
      "args": ["my-mcp-server"],
      "env": {
        "ENDPOINT": "${user_config.endpoint}"
      }
    }
  }
}
```

---

## LSP Servers (`.lsp.json`)

Language Server Protocol integration gives Claude real-time code intelligence.
Users must install the language server binary separately — the plugin only configures
how Claude Code connects to it.

### File Format

```json
{
  "<language-id>": {
    "command": "<language-server-binary>",
    "args": ["serve"],
    "extensionToLanguage": {
      ".ts": "typescript",
      ".tsx": "typescript"
    }
  }
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `command` | Yes | LSP binary to execute. Must be in `$PATH`. |
| `extensionToLanguage` | Yes | Maps file extensions to language identifiers. |
| `args` | No | Command-line arguments for the LSP server. |
| `transport` | No | Communication transport: `"stdio"` (default) or `"socket"`. |
| `env` | No | Environment variables for the server process. |
| `initializationOptions` | No | Options passed during LSP initialization. |
| `settings` | No | Settings passed via `workspace/didChangeConfiguration`. |
| `workspaceFolder` | No | Workspace folder path for the server. |
| `startupTimeout` | No | Max milliseconds to wait for server startup. |
| `maxRestarts` | No | Maximum restart attempts before giving up. |

---

## Background Monitors (`monitors/monitors.json`)

Monitors run shell commands as persistent background processes for the session lifetime.
Each stdout line is delivered to Claude as a notification. Claude Code v2.1.105+ required.

### File Format

```json
[
  {
    "name": "<unique-identifier>",
    "command": "tail -F ./logs/error.log",
    "description": "<What is being watched>",
    "when": "always"
  },
  {
    "name": "deploy-status",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/poll-deploy.sh ${user_config.api_endpoint}",
    "description": "Deployment status changes",
    "when": "on-skill-invoke:deploy"
  }
]
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier within the plugin. Prevents duplicate processes on plugin reload. |
| `command` | Yes | Shell command run as a persistent background process in the session working directory. |
| `description` | Yes | Short summary of what is being watched. Shown in the task panel and notification summaries. |
| `when` | No | `"always"` (default) — starts at session start. `"on-skill-invoke:<skill-name>"` — starts the first time the named skill is dispatched. |

Variable substitution in `command`: `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`,
`${CLAUDE_PROJECT_DIR}`, `${user_config.*}`, and any `${ENV_VAR}`.

**Note:** Disabling a plugin mid-session does not stop already-running monitors. They
stop when the session ends.

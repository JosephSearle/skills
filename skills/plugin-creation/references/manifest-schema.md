# Plugin Manifest Schema Reference

Source: Claude Code official documentation — `plugins-reference`

---

## File Location

`.claude-plugin/plugin.json` inside the plugin root directory.

The manifest is **optional**. If omitted, Claude Code auto-discovers components from
default locations and uses the directory name as the plugin name. Include a manifest
when you need to provide metadata, override component paths, or declare `userConfig`.

---

## Required Fields

If a manifest is present, only `name` is required.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique kebab-case identifier. Becomes the namespace prefix for all components (e.g. skills are invoked as `/<name>:<skill-name>`). No spaces or path separators. |

---

## Metadata Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `$schema` | string | JSON Schema URL for editor autocomplete. Ignored at load time. | `"https://json.schemastore.org/claude-code-plugin-manifest.json"` |
| `displayName` | string | Human-readable name shown in the `/plugin` picker. May contain spaces and any casing. Falls back to `name` when omitted. Requires Claude Code v2.1.143+. | `"My Plugin"` |
| `version` | string | Semantic version string. Setting this pins updates — users only receive changes when you bump the field. If omitted, the git commit SHA is used (every commit = new version). | `"1.2.0"` |
| `description` | string | Brief explanation of plugin purpose. Shown in marketplace and plugin manager. | `"Deployment automation tools"` |
| `author` | object | `{"name": "...", "email": "...", "url": "..."}` | `{"name": "Dev Team"}` |
| `homepage` | string | Documentation URL | `"https://docs.example.com"` |
| `repository` | string | Source code URL | `"https://github.com/user/plugin"` |
| `license` | string | SPDX license identifier | `"MIT"` |
| `keywords` | array of strings | Discovery tags for marketplace search | `["deployment", "ci-cd"]` |
| `defaultEnabled` | boolean | Whether the plugin starts enabled after install. Defaults to `true`. Set `false` for plugins that connect to external services or incur cost. Requires Claude Code v2.1.154+. | `false` |

---

## Component Path Fields

These fields customise which directories/files Claude Code loads for each component.
Omit a field to use the default location.

**Path rules:**
- All paths must be relative to the plugin root and start with `./`
- `skills` **adds** to the default `skills/` directory (default is always scanned)
- All other component fields **replace** the default directory
- To keep the default and add more, list both explicitly: `"agents": ["./agents/", "./extras/"]`

| Field | Type | Description | Default location |
|-------|------|-------------|-----------------|
| `skills` | string \| array | Additional skill directories containing `<name>/SKILL.md` subdirectories | `skills/` |
| `commands` | string \| array | Flat `.md` skill files or directories (replaces default `commands/`) | `commands/` |
| `agents` | string \| array | Agent markdown files (replaces default `agents/`) | `agents/` |
| `hooks` | string \| array \| object | Hook config paths or inline config | `hooks/hooks.json` |
| `mcpServers` | string \| array \| object | MCP config paths or inline config | `.mcp.json` |
| `outputStyles` | string \| array | Output style files/directories | `output-styles/` |
| `lspServers` | string \| array \| object | LSP server config paths or inline config | `.lsp.json` |
| `experimental.themes` | string \| array | Color theme files/directories | `themes/` |
| `experimental.monitors` | string \| array | Background monitor configurations | `monitors/monitors.json` |
| `userConfig` | object | User-configurable values. See section below. | — |
| `channels` | array | Message channel declarations (Telegram/Slack/Discord style injection) | — |
| `dependencies` | array | Other plugins this plugin requires. Each entry is a name string or `{"name": "...", "version": "~x.y.z"}` | — |

---

## `userConfig` Schema

Declares values Claude Code prompts the user for when the plugin is enabled. Values
are available as `${user_config.<key>}` in MCP/LSP configs, hook commands, and monitor
commands. Non-sensitive values are also substitutable in skill and agent content.

```json
{
  "userConfig": {
    "<key>": {
      "type": "string",
      "title": "Label shown in the configuration dialog",
      "description": "Help text shown beneath the field",
      "sensitive": false,
      "required": false,
      "default": "optional-default-value"
    }
  }
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `type` | Yes | string | One of: `string`, `number`, `boolean`, `directory`, `file` |
| `title` | Yes | string | Label shown in the configuration dialog |
| `description` | Yes | string | Help text shown beneath the field |
| `sensitive` | No | boolean | If `true`, masks input and stores in OS keychain (not `settings.json`). Use for tokens and passwords. |
| `required` | No | boolean | If `true`, validation fails when the field is empty |
| `default` | No | any | Value used when the user provides nothing |
| `multiple` | No | boolean | For `string` type — allow an array of strings |
| `min` / `max` | No | number | Bounds for `number` type |

**Storage:** Non-sensitive values → `settings.json` under `pluginConfigs[<plugin-id>].options`. Sensitive values → OS keychain. Keychain is shared with OAuth tokens; keep sensitive values small (~2 KB total limit).

**Environment export:** All values are exported to plugin subprocesses as `CLAUDE_PLUGIN_OPTION_<KEY>`.

---

## Environment Variables

Available for substitution in MCP/LSP configs, hook commands, monitor commands, and
(non-sensitive values only) skill and agent content.

| Variable | Description |
|----------|-------------|
| `${CLAUDE_PLUGIN_ROOT}` | Absolute path to the plugin's installation directory. Use for bundled scripts, binaries, and config files. Changes when the plugin updates. **Wrap in double-quotes in shell commands**: `"${CLAUDE_PLUGIN_ROOT}"/scripts/foo.sh` |
| `${CLAUDE_PLUGIN_DATA}` | Persistent directory that survives plugin updates. Use for `node_modules`, virtual environments, caches, and generated files. Created automatically on first reference. Deleted on uninstall (unless `--keep-data` is passed). |
| `${CLAUDE_PROJECT_DIR}` | The project root (the directory Claude Code was launched from). Use to reference project-local scripts or config files. |
| `${user_config.<key>}` | Value of a `userConfig` field entered by the user. |
| `${ANY_ENV_VAR}` | Any environment variable from the host environment. |

---

## Complete Example

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "deployment-tools",
  "displayName": "Deployment Tools",
  "version": "2.1.0",
  "description": "Automates deployment workflows and monitors production health.",
  "author": {
    "name": "Platform Team",
    "email": "platform@example.com",
    "url": "https://github.com/example"
  },
  "homepage": "https://docs.example.com/deployment-tools",
  "repository": "https://github.com/example/deployment-tools",
  "license": "MIT",
  "keywords": ["deployment", "ci-cd", "monitoring"],
  "defaultEnabled": false,
  "userConfig": {
    "api_endpoint": {
      "type": "string",
      "title": "API endpoint",
      "description": "Your team's deployment API endpoint",
      "required": true
    },
    "api_token": {
      "type": "string",
      "title": "API token",
      "description": "Authentication token for the deployment API",
      "sensitive": true,
      "required": true
    }
  }
}
```

---

## Versioning Strategy

| Approach | How | When to use |
|----------|-----|-------------|
| Explicit version | Set `"version": "x.y.z"` in `plugin.json` | Published plugins with stable release cycles. Must bump the field to push updates. |
| Commit-SHA version | Omit `version` from both `plugin.json` and marketplace entry | Internal/team plugins under active development. Every commit is a new version. |

Follow semantic versioning when using explicit versions:
- **MAJOR** — breaking changes (removed skills, renamed namespaces)
- **MINOR** — new features (new skills/agents, new optional config)
- **PATCH** — bug fixes, wording changes, non-breaking improvements

---

## Unrecognised Fields

Claude Code ignores top-level fields it does not recognise, so a `plugin.json` can
double as an npm `package.json` or VS Code extension manifest. Fields with the wrong
**type** (e.g. `keywords` as a string instead of an array) are still a load error.

Pass `--strict` to `claude plugin validate` to treat unrecognised fields as errors.

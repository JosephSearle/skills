# dcode CLI Reference — Deep Agents Code

> `dcode` is a separate package from the deepagents SDK. Install independently.

---

## Install

```bash
# One-liner (recommended)
curl -LsSf https://langch.in/dcode | bash

# Via uv (no install — runs in isolated env)
uvx deepagents-cli

# Via uv (install globally)
uv tool install deepagents-cli
```

---

## All flags

| Flag | Short | Description |
|---|---|---|
| `--model` | `-m` | Model to use (e.g. `anthropic:claude-sonnet-4-6`) |
| `--non-interactive` | `-n` | Single task mode: provide task as argument, exit when done |
| `--yes` | `-y` | Auto-approve all tool call confirmations |
| `--sandbox` | — | Sandbox provider: `modal`, `runloop`, `daytona` |
| `--sandbox-setup` | — | Shell command to run inside the sandbox at startup |
| `--sandbox-id` | — | Attach to an existing sandbox by ID (instead of creating new) |
| `--sandbox-snapshot-name` | — | Restore sandbox from a named snapshot (Modal only) |
| `--shell-allow-list` | `-S` | `recommended` (safe subset) or `all` (no restrictions — dangerous) |
| `--startup-cmd` | — | Command to run in the agent's working directory before starting |

---

## Usage patterns

```bash
# Interactive REPL (default)
dcode

# Single non-interactive task
dcode -n "Refactor the authentication module to use JWT"

# Auto-approve + specific model
dcode -y -m anthropic:claude-opus-4-7 -n "Run all tests and fix failures"

# With Modal sandbox (isolated execution)
dcode --sandbox modal -n "Build and benchmark the new indexing algorithm"

# With Daytona sandbox
dcode --sandbox daytona -n "Run integration tests against the staging database"

# With Runloop sandbox
dcode --sandbox runloop -n "Execute the full CI pipeline"

# Restore from sandbox snapshot (Modal)
dcode --sandbox modal --sandbox-snapshot-name my-base-env -n "Add feature X"

# Custom shell allow list (recommended subset only — safer than 'all')
dcode -S recommended -n "Set up the project and install dependencies"

# DANGEROUS: all shell commands, no confirmation
dcode -S all -y -n "Run the deployment script"

# Pipe from stdin (auto-activates non-interactive mode)
echo "What does auth.py do?" | dcode
cat tasks.txt | dcode
```

---

## Slash commands (interactive mode only)

| Command | What it does |
|---|---|
| `/auth` | Configure authentication (API keys, credentials) |
| `/model` | Switch the active model mid-session |
| `/trace` | Open the LangSmith trace for the current session |

---

## Incognito shell (`!!`)

Prefix any shell command with `!!` to run it without the agent seeing the output:

```
!! cat ~/.ssh/id_rsa    # output goes to your terminal only, not into agent context
!! env | grep SECRET    # check env vars without leaking them to the LLM
```

Use `!!` when you need to run a command for your own reference without polluting the agent's context with sensitive data.

---

## State persistence between -n runs

Each `-n` invocation starts a **fresh thread** but file-based state (files written to disk) persists across runs:

```bash
# Run 1: creates output.txt
dcode -n "Write a Python script to output.txt that generates primes up to 100"

# Run 2: sees output.txt from Run 1
dcode -n "Add error handling to the script in output.txt"
```

Thread-level state (todos, conversation history) does NOT persist between `-n` runs. Only filesystem state persists.

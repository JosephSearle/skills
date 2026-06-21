# Headless / CI Usage Reference — dcode

---

## Non-interactive activation

| Method | How | Notes |
|---|---|---|
| `-n "task"` flag | `dcode -n "Run tests"` | Explicit; task is the argument |
| Piped stdin | `echo "task" \| dcode` | Auto-activates non-interactive mode |
| `cat tasks.txt \| dcode` | Reads task from file | Useful for multi-line task specs |

In non-interactive mode, the agent is instructed to "make reasonable assumptions and proceed autonomously" and prefers non-interactive command variants.

---

## Preferred command variants in -n mode

When writing tasks for non-interactive mode, use explicit non-interactive variants of common commands:

| Interactive variant | Non-interactive variant |
|---|---|
| `npm init` | `npm init -y` |
| `apt-get install pkg` | `apt-get install -y pkg` |
| `pip install pkg` | `pip install -q pkg` (or better: `uv add pkg`) |
| `git commit` | `git commit -m "message"` |
| `terraform apply` | `terraform apply -auto-approve` |

Instruct the agent in the task description: "Use non-interactive flags for all commands; do not prompt for confirmation."

---

## Auto-approving tool calls (-y)

```bash
# Auto-approve ALL tool calls (write_file, execute, edit_file, etc.)
dcode -y -n "Set up the project and run initial tests"
```

`-y` is equivalent to answering "yes" to every confirmation prompt. Combine with a sandbox for safety:

```bash
dcode --sandbox modal -y -n "Install dependencies and run benchmarks"
# All tool calls auto-approved, but execution happens inside Modal sandbox
```

**Do not use `-y` without `-S` or a sandbox in untrusted environments** — the agent can write arbitrary files and execute arbitrary commands.

---

## Shell allow-list (-S / --shell-allow-list)

| Value | Behaviour | When to use |
|---|---|---|
| _(omitted)_ | Default confirmation on shell commands | Interactive development |
| `recommended` | Allows a safe subset of shell commands without confirmation | Standard CI — vetted safe commands |
| `all` | No shell restrictions, no confirmation | Fully trusted, isolated sandbox environments only |

```bash
# CI with recommended safe subset
dcode -S recommended -y -n "Run linting, tests, and generate coverage report"

# Full automation in Modal sandbox (all shell, no prompt)
dcode --sandbox modal -S all -y -n "Build Docker image and run integration tests"
```

**Document every use of `-S all`.** It is the equivalent of giving the agent root shell access with no human review.

---

## LangSmith tracing separation

By default, dcode traces agent LLM calls and shell command (execute) calls to the same LangSmith project. To separate them:

```bash
# Agent LLM traces → "my-agent-project"
# Shell execute traces → separate project (configured separately by dcode)
DEEPAGENTS_LANGSMITH_PROJECT=my-agent-project dcode -n "Run tests"
```

This separation makes it easier to:
- Monitor agent reasoning cost separately from execution cost
- Audit shell commands independently from LLM calls
- Set different retention policies for sensitive shell output vs agent traces

---

## CI pipeline example (GitHub Actions)

```yaml
name: Agent-assisted test fix
on: [pull_request]

jobs:
  fix-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install dcode
        run: curl -LsSf https://langch.in/dcode | bash
      - name: Run tests and fix failures
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_API_KEY }}
          DEEPAGENTS_LANGSMITH_PROJECT: ci-agent-runs
        run: |
          dcode -S recommended -y -n "Run pytest. If any tests fail, fix the code and re-run until all tests pass. Do not modify test files."
```

---

## Fresh thread per -n run

Each `-n` invocation creates a new LangGraph thread. There is no shared conversation state between runs. Use file-based state (write files to disk in one run; read them in the next) for cross-run continuity.

```bash
# Run 1
dcode -n "Analyse the codebase and write a plan to analysis.md"

# Run 2 (reads analysis.md from Run 1)
dcode -n "Read analysis.md and implement the first three items in the plan"
```

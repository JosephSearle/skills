---
name: deepagents-codegen-dcode
version: 1.0.0
description: >
  Deep Agents Code CLI (dcode) and CodeInterpreterMiddleware — interactive and headless
  coding agent, CI/non-interactive mode, QuickJS JavaScript interpreter, Terminal-Bench
  benchmarks, and sandbox integration. Triggers on: dcode, deepagents-cli, deepagents-code,
  Deep Agents Code, CodeInterpreterMiddleware, langchain_quickjs, createCodeInterpreterMiddleware,
  eval tool quickjs, programmatic tool calling ptc, -n flag, -y flag, shell-allow-list,
  --sandbox dcode, --startup-cmd, /auth /model /trace, incognito shell, Terminal-Bench,
  harbor sandbox, HarborSandbox, headless CI, non-interactive dcode, DEEPAGENTS_LANGSMITH_PROJECT,
  dcode install curl, uvx deepagents-cli.
  Requires deepagents-code (separate package); CodeInterpreterMiddleware requires deepagents-code>=0.1.4.
---

## Core Philosophy

`dcode` is the flagship coding agent and the Terminal-Bench 2.0 baseline. It is a separate package (`deepagents-code`) from the SDK (`deepagents`) — install steps differ. The QuickJS interpreter (`CodeInterpreterMiddleware`) adds a sandboxed `eval` tool that runs JavaScript in isolation with **no host filesystem, network, shell, or clock access by default** — but programmatic tool calls (PTC) that bridge host tools **bypass `interrupt_on` approval**. This is the most security-relevant gotcha in the codegen stack. `-S all` (shell-allow-list all) lets the agent run arbitrary shell with no confirmation — document and use with intent, not convenience.

---

## Step 1 — Determine Context

| Signal | Sub-topic | Reference to load |
|---|---|---|
| Interactive use, `dcode`, `/auth`, `/model`, `/trace`, `!!`, install | dcode CLI | `references/dcode-cli.md` |
| `-n`, `-y`, piped stdin, `--sandbox`, `DEEPAGENTS_LANGSMITH_PROJECT`, CI | Headless / CI | `references/headless-ci.md` |
| `CodeInterpreterMiddleware`, `eval` tool, `langchain_quickjs`, `ptc=`, PTC bypass | QuickJS interpreter | `references/quickjs-interpreter.md` |
| Terminal-Bench 2.0, scores, `harbor`, Daytona scale, evaluation setup | Benchmarks | `references/terminal-bench.md` |
| General "how does dcode work?" | All of the above | Load all four references |

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/dcode-cli.md` | Install, all flags, slash commands, incognito shell | Any dcode CLI question |
| `references/headless-ci.md` | `-n`/`-y` modes, piped stdin, LangSmith tracing, non-interactive conventions | CI or scripted dcode usage |
| `references/quickjs-interpreter.md` | CodeInterpreterMiddleware, eval tool, PTC allowlist, security model | Any QuickJS or eval tool question |
| `references/terminal-bench.md` | Terminal-Bench 2.0 results, harbor evaluation framework, Daytona at scale | Benchmarking or performance questions |

---

## Step 3 — Implement

### Package install decision gate

```
Need the dcode CLI?
  └─ One-liner: curl -LsSf https://langch.in/dcode | bash
  └─ Or via uv: uvx deepagents-cli

Need CodeInterpreterMiddleware in your Python code?
  └─ Python: uv add langchain-quickjs    (provides CodeInterpreterMiddleware)
  └─ JS/TS:  npm add @langchain/quickjs  (provides createCodeInterpreterMiddleware)
  └─ Requires deepagents-code>=0.1.4

deepagents (SDK) and deepagents-code (CLI + QuickJS) are separate packages.
```

### Shell-allow-list decision gate

```
What shell access does the agent need?
  └─ No shell access (pure code interpreter)
     → Use CodeInterpreterMiddleware only; omit -S flag
  └─ Curated safe shell commands only (recommended for most CI)
     → dcode -S recommended
  └─ ALL shell commands with no confirmation (dangerous)
     → dcode -S all
     → ONLY use in fully trusted, isolated environments
     → Document this decision explicitly

-S all bypasses all shell confirmation prompts.
Combine only with -y in sandboxed CI environments where commands are already audited.
```

### Mandatory checklist for dcode / CodeInterpreterMiddleware

| Concern | Requirement |
|---|---|
| PTC bypass of interrupt_on | `ptc=[...]` tool calls bypass `interrupt_on` approval — treat QuickJS as a scoped runtime, not a security boundary |
| `-S all` risk | Explicitly document every use of `-S all`; limit to sandboxed CI environments |
| Sandbox selection | Use `--sandbox modal\|runloop\|daytona` for isolated code execution; don't run untrusted code without a sandbox |
| LangSmith tracing separation | Set `DEEPAGENTS_LANGSMITH_PROJECT` to separate agent traces from shell (user-code) traces |
| Non-interactive commands | In `-n` mode, prefer non-interactive variants (`npm init -y`, `apt-get install -y`) |

---

## Step 4 — Verify

```bash
# Confirm dcode is installed and working
dcode --version

# Run a single non-interactive task
dcode -n "List the files in the current directory and tell me what you see"

# Confirm CodeInterpreterMiddleware is available (requires langchain-quickjs)
uv run python -c "
from langchain_quickjs import CodeInterpreterMiddleware
from deepagents import create_deep_agent

agent = create_deep_agent(
    model='anthropic:claude-sonnet-4-6',
    middleware=[CodeInterpreterMiddleware()],
)
print('CodeInterpreterMiddleware registered ok')
tools = [getattr(t, 'name', str(t)) for t in getattr(agent, 'tools', [])]
print('tools:', [t for t in tools if 'eval' in t.lower()])
"

# Verify LangSmith tracing separation
DEEPAGENTS_LANGSMITH_PROJECT=my-agent-project dcode -n "echo hello"
# Agent traces → my-agent-project
# Shell (execute) traces → separate project
```

---

## Reference Files

| File | Domain | Load when |
|---|---|---|
| [references/dcode-cli.md](references/dcode-cli.md) | Install, all CLI flags, slash commands, incognito shell | Any dcode CLI usage question |
| [references/headless-ci.md](references/headless-ci.md) | -n/-y modes, piped stdin, LangSmith trace separation, non-interactive tips | CI/scripted dcode or automation |
| [references/quickjs-interpreter.md](references/quickjs-interpreter.md) | CodeInterpreterMiddleware, eval tool, PTC allowlist, isolation model, security | QuickJS or eval tool question |
| [references/terminal-bench.md](references/terminal-bench.md) | Terminal-Bench 2.0 scores, harbor framework, Daytona at scale | Benchmarking, evaluation, performance comparison |

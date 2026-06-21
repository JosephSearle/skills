---
name: deepagents-sandbox
version: 1.0.0
description: >
  Deep Agents sandbox layer — BaseSandbox, SandboxBackendProtocol, provider setup (Modal,
  Daytona, Runloop, AgentCore, LangSmith), sandbox lifecycle and scoping, integration
  patterns, and the secrets security model. Triggers on: sandbox, ModalSandbox, DaytonaSandbox,
  RunloopSandbox, AgentCoreSandbox, LangSmithSandbox, BaseSandbox, SandboxBackendProtocol,
  execute tool, upload_files, download_files, sandbox lifecycle, TTL, thread-scoped,
  assistant-scoped, sandbox as tool, agent in sandbox, secrets in sandbox, network exfiltration,
  HITL sandbox, blockNetwork, context injection, sandbox setup, sandbox provider.
  Requires deepagents>=0.5.0.
---

## Core Philosophy

Sandboxes are the **only real security boundary** in a "trust the LLM" harness. The official documentation carries a blunt warning: "Never put secrets inside a sandbox." The provider contract is minimal — implement `execute()` — and everything else (ls, read_file, write_file, edit_file, glob, grep) is built on top by `BaseSandbox`. Lifecycle and scoping decisions determine billing exposure: orphaned sandboxes on a per-minute provider will drain budget silently. Security decisions — network blocking, secret placement, HITL gating — must be made at design time, not discovered in production. For filesystem permissions (not sandboxing), see the `deepagents-filesystem` skill.

---

## Step 1 — Determine Context

| Signal | Sub-topic | Reference to load |
|---|---|---|
| Which provider to use, Modal/Daytona/Runloop/AgentCore/LangSmith, install/setup | Provider setup | `references/providers.md` |
| Thread-scoped vs assistant-scoped, TTL, orphaned sandboxes, `upload_files`, `download_files` | Lifecycle / scoping | `references/lifecycle.md` |
| "sandbox as tool" vs "agent in sandbox", two planes, when to use each | Integration patterns | `references/integration-patterns.md` |
| Secrets, network exfiltration, HITL, `blockNetwork`, context injection | Security model | `references/sandbox-security.md` |
| General "how does the sandbox work?" | All of the above | Load all four references |

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/providers.md` | All five providers, BaseSandbox, SandboxBackendProtocol, execute() contract | Provider selection or setup |
| `references/lifecycle.md` | Thread vs assistant scoping, TTL, get-or-create, file transfer APIs | Lifecycle questions; billing exposure; `upload_files`/`download_files` |
| `references/integration-patterns.md` | "Sandbox as tool" vs "agent in sandbox"; two planes of file access | Architecture pattern selection |
| `references/sandbox-security.md` | Secrets model, network exfiltration, HITL, context injection, output trust | Any security question about sandboxes |

---

## Step 3 — Implement

### Mandatory checklist for sandbox integration

| Concern | Requirement |
|---|---|
| Provider selection | Choose based on cloud affinity, billing model, and whether you need snapshotting |
| Secrets placement | Keep all secrets on the host side — never pass them as env vars or files into the sandbox |
| Network access | Block network in the sandbox if the agent should not exfiltrate data (`blockNetwork: true` on Modal, provider-specific equivalent on others) |
| Scoping decision | Default to thread-scoped; use assistant-scoped only if state must persist across conversations (and accept shared-state risk) |
| HITL on execute | Enable `interrupt_on={"execute": True}` if human review of shell commands is required |
| Lifecycle cleanup | Set a TTL; ensure sandbox cleanup on error paths — billable providers charge for idle sandboxes |
| Output trust | Treat all output from `execute` as untrusted input — it may contain prompt injection from files the agent processed |

### Minimal sandbox pattern

```python
from deepagents import create_deep_agent
from deepagents.backends import ModalSandbox  # or DaytonaSandbox, RunloopSandbox, etc.

sandbox = ModalSandbox(
    image="python:3.12-slim",
    block_network=True,   # recommended: prevent data exfiltration
)

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    backend=sandbox,
    interrupt_on={"execute": True},   # HITL on all shell commands
)
```

### Provider decision gate

```
Which sandbox provider?
  ├─ Already on Modal ecosystem         → ModalSandbox
  ├─ Need Daytona cloud dev environments → DaytonaSandbox
  ├─ Need Runloop managed execution      → RunloopSandbox
  ├─ Amazon / Bedrock environment        → AgentCoreSandbox
  └─ LangSmith-native (private beta)    → LangSmithSandbox

Need snapshotting (fast warm start)?
  └─ YES → ModalSandbox (snapshot support); check DaytonaSandbox docs
  └─ NO  → Any provider fits

Need free-tier / local dev without provider accounts?
  └─ Use StateBackend (no execute tool) for local dev; add sandbox for staging/prod
```

---

## Step 4 — Verify

```bash
# Confirm sandbox backend is accepted by create_deep_agent
uv run python -c "
from deepagents import create_deep_agent
from deepagents.backends import ModalSandbox   # requires modal installed

sandbox = ModalSandbox(image='python:3.12-slim')
agent = create_deep_agent(
    model='anthropic:claude-sonnet-4-6',
    backend=sandbox,
)
# execute tool should now be in the agent's tool set
tools = [t.name for t in agent.tools] if hasattr(agent, 'tools') else []
print('tools:', tools)
assert 'execute' in str(tools), 'execute tool not registered — check backend implements SandboxBackendProtocol'
print('execute tool registered ok')
"

# Verify file transfer round-trip (requires running sandbox)
uv run python -c "
import asyncio
from deepagents.backends import ModalSandbox

async def test():
    sandbox = ModalSandbox(image='python:3.12-slim')
    await sandbox.upload_files([('/tmp/test.txt', b'hello from host')])
    result = await sandbox.execute('cat /tmp/test.txt')
    print('execute output:', result)
    files = await sandbox.download_files(['/tmp/test.txt'])
    print('downloaded:', files)

asyncio.run(test())
"
```

---

## Reference Files

| File | Domain | Load when |
|---|---|---|
| [references/providers.md](references/providers.md) | BaseSandbox, SandboxBackendProtocol, all five providers, execute() contract | Provider selection or any "how do I set up a sandbox?" question |
| [references/lifecycle.md](references/lifecycle.md) | Thread vs assistant scoping, TTL, file transfer APIs, billing exposure | Lifecycle or scoping question; upload_files/download_files |
| [references/integration-patterns.md](references/integration-patterns.md) | "Sandbox as tool" vs "agent in sandbox"; two planes of file access | Architecture pattern question |
| [references/sandbox-security.md](references/sandbox-security.md) | Secrets model, network exfiltration, HITL, context injection, output trust | Any security question about what sandboxes do and do not protect against |

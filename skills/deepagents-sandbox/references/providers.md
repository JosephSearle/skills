# Sandbox Providers Reference — deepagents

> deepagents ≥0.5.0. All sandbox backends implement `SandboxBackendProtocol` so the `execute` tool is automatically added by `FilesystemMiddleware`.

---

## BaseSandbox and SandboxBackendProtocol

```python
from deepagents.backends import BaseSandbox
from deepagents.backends.protocols import SandboxBackendProtocol
```

**The only method a provider must implement is `execute(command: str) -> str`.**

`BaseSandbox` provides default implementations of all other filesystem operations (`ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`) on top of `execute()`. A custom provider only needs:

```python
class MyCustomSandbox(BaseSandbox):
    async def execute(self, command: str) -> str:
        # run command in your custom environment
        return stdout + stderr
```

`FilesystemMiddleware` checks for `SandboxBackendProtocol` at agent construction time. If the backend implements it, the `execute` tool is added; otherwise it is filtered out.

---

## Provider comparison

| Provider | Import | Cloud | Snapshotting | Notes |
|---|---|---|---|---|
| `ModalSandbox` | `deepagents.backends` | Modal cloud | Yes | Block network: `block_network=True` |
| `DaytonaSandbox` | `deepagents.backends` | Daytona | Check docs | Cloud dev environments |
| `RunloopSandbox` | `deepagents.backends` | Runloop | No | Managed execution |
| `AgentCoreSandbox` | `deepagents.backends` | Amazon / Bedrock | No | Use in AWS/Bedrock environments |
| `LangSmithSandbox` | `deepagents.backends` | LangSmith | N/A | **Private beta** — contact LangChain for access |

---

## ModalSandbox

```python
from deepagents.backends import ModalSandbox

sandbox = ModalSandbox(
    image="python:3.12-slim",        # Docker image for the sandbox
    block_network=True,               # recommended: prevent data exfiltration
    timeout=300,                      # seconds before auto-termination
    snapshot_name="my-snapshot",      # optional: restore from a pre-built snapshot
)
```

- Bills per second of sandbox runtime.
- `block_network=True` prevents the agent from making outbound HTTP requests inside the sandbox.
- Snapshot support: pre-install dependencies, snapshot, then restore in milliseconds for warm starts.
- Requires `modal` package: `uv add modal deepagents`.

---

## DaytonaSandbox

```python
from deepagents.backends import DaytonaSandbox

sandbox = DaytonaSandbox(
    workspace_id="my-workspace",      # Daytona workspace identifier
    api_key="DAYTONA_API_KEY",        # or set env var DAYTONA_API_KEY
)
```

- Daytona provides persistent cloud development environments.
- Used by Deep Agents Code (`dcode`) at scale for Terminal-Bench evaluations (40 concurrent trials).
- Requires `daytona-sdk` package.

---

## RunloopSandbox

```python
from deepagents.backends import RunloopSandbox

sandbox = RunloopSandbox(
    api_key="RUNLOOP_API_KEY",
)
```

- Managed ephemeral execution environments.
- Requires `runloop-api-client` package.

---

## AgentCoreSandbox

```python
from deepagents.backends import AgentCoreSandbox

sandbox = AgentCoreSandbox(
    session_id="my-session",
    region="us-east-1",
)
```

- Designed for Amazon Bedrock / AgentCore deployments.
- Use in AWS-native environments; Bedrock-specific tooling.

---

## LangSmithSandbox (private beta)

```python
from deepagents.backends import LangSmithSandbox

sandbox = LangSmithSandbox(
    project="my-langsmith-project",
    api_key="LANGSMITH_API_KEY",
)
```

- Currently in **private beta** — "LangSmith sandboxes are currently in private beta."
- Contact LangChain for access before building on this backend.
- API surface may change before GA.

---

## execute() output contract

All sandbox backends return from `execute()`:
- Combined stdout + stderr as a string
- Exit code embedded in the output (provider-specific format)
- A truncation notice if output exceeds the large-result threshold (auto-saved to `/large_tool_results/`)

The agent can call `read_file` on the saved path to retrieve the full output incrementally.

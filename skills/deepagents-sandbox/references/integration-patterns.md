# Sandbox Integration Patterns Reference — deepagents

---

## The two integration patterns

### Pattern A — "Sandbox as tool" (recommended)

The agent runs on the host; the sandbox is just a tool the agent calls via `execute`.

```
Host process
  └─ deepagents agent (LLM + tools)
       └─ execute("python script.py") → ModalSandbox (remote)
```

**Characteristics:**
- API keys and secrets stay on the host, never enter the sandbox.
- Billing: pay only per `execute` call (sandbox lifetime = duration of the call).
- Multiple sandboxes can run in parallel for different subagents.
- Easy to update: no image rebuild needed for agent logic changes.
- The agent's LLM context and state live on the host — faster, no sandbox overhead for reasoning.

```python
from deepagents import create_deep_agent
from deepagents.backends import ModalSandbox

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    tools=[my_host_tool],       # host-side tools can access secrets
    backend=ModalSandbox(image="python:3.12-slim", block_network=True),
    # execute tool is available for running code in the sandbox
    # my_host_tool runs on the host — secrets stay here
)
```

---

### Pattern B — "Agent in sandbox"

The entire agent (LLM calls, tools, state) runs inside the sandbox.

```
ModalSandbox (remote)
  └─ deepagents agent (LLM + tools)
       └─ host tools (via network)
```

**Characteristics:**
- Mirrors local development — easy to reproduce the prod environment locally.
- **Secrets must be injected into the sandbox** — significant security risk.
- Image rebuild needed when agent logic changes (slower iteration).
- Every LLM API call goes through the sandbox's network — network must be open or API endpoint allowed.
- Use only when the full agent stack must be isolated from the host for compliance reasons.

```python
# Pattern B: agent runs inside the sandbox
# Requires injecting ANTHROPIC_API_KEY into the sandbox environment
sandbox = ModalSandbox(
    image="my-agent-image:latest",
    env={"ANTHROPIC_API_KEY": os.environ["ANTHROPIC_API_KEY"]},  # ← secret inside sandbox
    # block_network=False required for LLM API calls
)
# Launch the agent inside the sandbox via execute()
```

---

## Comparison table

| Attribute | Pattern A (sandbox as tool) | Pattern B (agent in sandbox) |
|---|---|---|
| Secret placement | Host only ✓ | Inside sandbox ✗ |
| Network exposure | Blocked ✓ | Must be open ✗ |
| Billing | Per execute call ✓ | Full sandbox lifetime ✗ |
| Parallel execution | Easy (multiple sandboxes) ✓ | Complex ✗ |
| Image rebuild on logic change | Not needed ✓ | Required ✗ |
| Compliance isolation | Partial | Full |
| Recommended? | **Yes — default choice** | Only for compliance mandates |

---

## Two planes of file access

Both patterns involve two distinct planes for file access:

| Plane | Who uses it | API | When |
|---|---|---|---|
| **In-sandbox (agent tools)** | The LLM agent | `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute` | During agent task execution |
| **Host-side (application)** | Your Python application | `sandbox.upload_files(...)`, `sandbox.download_files(...)` | Before/after agent runs |

**The LLM cannot call `upload_files` or `download_files`** — those are application-level APIs, not model-visible tools. Only your code can use them to seed inputs or retrieve outputs.

---

## Parallel sandboxes with async subagents

Pattern A scales naturally with async subagents — each subagent gets its own sandbox:

```python
from deepagents import create_deep_agent
from deepagents.backends import ModalSandbox

def make_sandbox_backend(runtime):
    return ModalSandbox(
        image="python:3.12-slim",
        block_network=True,
        scope="thread",   # each subagent thread gets its own sandbox
    )

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    backend=make_sandbox_backend,   # factory called per-agent-instance
    subagents=[
        {"name": "coder", "description": "Writes and runs code"},
        {"name": "tester", "description": "Runs tests"},
    ],
)
# coder and tester get independent sandboxes — no shared state, no interference
```

The `backend` param accepts a factory function `(runtime) -> backend` — use this pattern to create per-instance sandboxes rather than sharing one across subagents.

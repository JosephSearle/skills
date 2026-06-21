---
name: deepagents-filesystem
version: 1.0.0
description: >
  Deep Agents filesystem layer — FilesystemMiddleware, FilesystemPermission, virtual_mode
  security model, file tools, large-result eviction, and multimodal file reads. Triggers on:
  FilesystemMiddleware, FilesystemPermission, virtual_mode, FilesystemBackend, root_dir,
  tool_token_limit_before_evict, read_file, write_file, edit_file, glob, grep, execute tool,
  SandboxBackendProtocol, file eviction, offload, multimodal read, path traversal, permissions,
  allow/deny paths, file offload, large tool results, image read, PDF read, audio read.
  Requires deepagents>=0.5.0.
---

## Core Philosophy

`FilesystemMiddleware` is the backbone of the deepagents harness — skills, memory, code execution, and context management all route through it. The single most dangerous misconception is that `FilesystemBackend(root_dir=..., virtual_mode=True)` provides sandboxing. It does not. `virtual_mode` is a path-traversal guard, not a process boundary. Treat the filesystem layer as a convenience interface and enforce real isolation at the sandbox (provider) level. A dedicated skill exists for sandbox setup: see `deepagents-sandbox`.

---

## Step 1 — Determine Context

Classify the request using the table below before loading any reference file.

| Signal | Sub-topic | Reference to load |
|---|---|---|
| `FilesystemPermission`, `permissions=`, allow/deny paths, deny write | Permissions model | `references/permissions.md` |
| `virtual_mode`, `root_dir`, path traversal, "is this secure?" | Virtual-mode security | `references/virtual-mode-security.md` |
| `tool_token_limit_before_evict`, large results, offload, eviction | Eviction / large results | `references/large-results.md` |
| `read_file` returning image/PDF/audio/video, multimodal content | Multimodal file reads | `references/large-results.md` |
| `edit_file`, `write_file`, `glob`, `grep`, `ls`, tool signatures, tool errors | File-tools reference | `references/file-tools.md` |
| `execute` tool missing or present, `SandboxBackendProtocol` | execute availability | `references/file-tools.md` + `references/virtual-mode-security.md` |
| General "how does the filesystem work?" overview | All of the above | Load all four references |

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/permissions.md` | `FilesystemPermission` dataclass, path validation, operation map, deny patterns | Any permissions question; `permissions=` param |
| `references/virtual-mode-security.md` | `virtual_mode` semantics, internal paths, security advice | Any security / isolation question; `root_dir`; `virtual_mode` |
| `references/file-tools.md` | All six tools + `execute`; signatures, gotchas, error conditions | Any file-tool question; `edit_file`/`grep`/`execute` errors |
| `references/large-results.md` | Eviction thresholds, offload, multimodal blocks | `tool_token_limit_before_evict`; large result handling; multimodal `read_file` |

---

## Step 3 — Implement

### Mandatory checklist for any filesystem integration

| Concern | Requirement |
|---|---|
| `virtual_mode` assumption | Never assume `virtual_mode=True` provides process isolation — it only blocks traversal |
| Permissions scope | Always pass `permissions=` if the agent should not write to certain paths; default is unrestricted write |
| `edit_file` pre-condition | Agent must call `read_file` on the target before `edit_file` — tool errors otherwise |
| Large outputs | If tool output can exceed ~80 KB, ensure the backend can persist offloaded results (avoid in-memory-only backends for production) |
| `execute` tool | Only present when the backend implements `SandboxBackendProtocol`; use `deepagents-sandbox` to configure a real provider |
| Model compatibility | Multimodal file reads require a multimodal model; audio/video support varies — detect from model docs before use |
| Secrets in files | Do not store API keys or credentials in files the agent can read; they will appear in tool results and model context |

### FilesystemMiddleware is not configured directly

`FilesystemMiddleware` is injected automatically by `create_deep_agent`. You configure it via:
- `backend=` — the storage backend (StateBackend, FilesystemBackend, CompositeBackend, or a sandbox backend)
- `permissions=` — list of `FilesystemPermission` objects
- HarnessProfile `excluded_tools` — to hide specific file tools from the model

To change `tool_token_limit_before_evict` (default 20 000 tokens) you must drop to `create_agent` and configure `FilesystemMiddleware` directly, or monkey-patch after construction. This is tracked in issue #2784.

### Minimal production pattern

```python
from deepagents import create_deep_agent, FilesystemPermission
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    backend=CompositeBackend(
        default=StateBackend(),
        routes={
            "/memories/": StoreBackend(namespace=lambda rt: (rt.server_info.user.identity,))
        },
    ),
    permissions=[
        # Block all writes under /policies/ — model can still read
        FilesystemPermission(
            operations=["write"],
            paths=["/policies/**"],
            mode="deny",
        ),
    ],
)
```

### Deny pattern decision gate

```
Need to restrict a path?
  └─ YES → Use FilesystemPermission(mode="deny", ...)
      └─ Block reads too?  → operations=["read", "write"]
      └─ Block writes only? → operations=["write"]
  └─ NO  → Omit permissions= (unrestricted by default)

Need real isolation (shell, network, process)?
  └─ YES → Use a sandbox backend — see deepagents-sandbox skill
  └─ NO  → FilesystemBackend(virtual_mode=True) is sufficient for path-traversal guard only
```

---

## Step 4 — Verify

```bash
# Confirm deepagents version supports FilesystemPermission (>=0.5.0)
uv run python -c "import deepagents; print(deepagents.__version__)"

# Confirm permissions are enforced
uv run python -c "
from deepagents import create_deep_agent, FilesystemPermission
from deepagents.backends import StateBackend

agent = create_deep_agent(
    model='anthropic:claude-sonnet-4-6',
    backend=StateBackend(),
    permissions=[FilesystemPermission(operations=['write'], paths=['/protected/**'], mode='deny')],
)
print('agent created ok — permissions registered')
"

# Confirm execute tool is absent without a sandbox backend
uv run python -c "
from deepagents import create_deep_agent
from deepagents.backends import StateBackend
agent = create_deep_agent(model='anthropic:claude-sonnet-4-6', backend=StateBackend())
tools = [t.name for t in agent.tools if hasattr(agent, 'tools')]
print('tools:', tools)
# execute should NOT appear — StateBackend does not implement SandboxBackendProtocol
"
```

---

## Reference Files

| File | Domain | Load when |
|---|---|---|
| [references/permissions.md](references/permissions.md) | FilesystemPermission dataclass, path validation, operation map, deny patterns, CompositeBackend routing | Any question about restricting file access |
| [references/virtual-mode-security.md](references/virtual-mode-security.md) | virtual_mode semantics, internal auto-written paths, security model limits | Any question about isolation, root_dir, or path traversal |
| [references/file-tools.md](references/file-tools.md) | ls, read_file, write_file, edit_file, glob, grep, execute — signatures, conditions, known gotchas | Any question about the file tools themselves |
| [references/large-results.md](references/large-results.md) | tool_token_limit_before_evict, TOOL_RESULT_TOKEN_LIMIT, offload behaviour, multimodal content blocks | Large output handling, eviction config, multimodal reads |

# Virtual-Mode Security Reference — deepagents FilesystemBackend

> Critical: `virtual_mode` is a path-traversal guard, NOT a sandbox. It provides no process isolation.

---

## FilesystemBackend modes

```python
from deepagents.backends import FilesystemBackend

# virtual_mode=False (the default): NO security
backend = FilesystemBackend(root_dir=".")          # equivalent: virtual_mode=False

# virtual_mode=True: path-traversal guard only
backend = FilesystemBackend(root_dir="/app/data", virtual_mode=True)
```

---

## What each mode does (and does not do)

| Property | `virtual_mode=False` (default) | `virtual_mode=True` |
|---|---|---|
| Respect `root_dir` as a boundary | No — absolute paths escape root_dir freely | Yes — all paths are resolved relative to `root_dir` |
| Block `..` traversal | No | Yes — `..` segments are rejected |
| Block `~` expansion | No | Yes — `~` is rejected |
| Block absolute paths outside `root_dir` | No | Yes |
| Prevent shell access (`execute` tool) | No | No |
| Provide process isolation | No | No |
| Prevent network access | No | No |
| Sandbox the LLM's actions | No | No |

**The official docs state explicitly:** "`virtual_mode=False` (the default) provides no security even with `root_dir` set." and `virtual_mode=True` "does not provide sandboxing or process isolation."

---

## Internal paths written automatically

The harness writes to these paths regardless of your `root_dir`:

| Path | Purpose | Written by |
|---|---|---|
| `/large_tool_results/` | Offloaded tool results exceeding `tool_token_limit_before_evict` | FilesystemMiddleware |
| `/conversation_history/` | Compacted conversation history (SummarizationMiddleware) | SummarizationMiddleware |

Do not write to or deny these paths — the harness depends on them. Do not expose them to users.

---

## Security decision table

| Goal | Correct approach |
|---|---|
| Prevent `../` escapes in user-supplied paths | `FilesystemBackend(virtual_mode=True)` |
| Prevent agent from writing to certain paths | `FilesystemPermission(mode="deny", ...)` — see `permissions.md` |
| Prevent agent from running arbitrary shell commands | Use a sandbox backend with controlled `execute` (see `deepagents-sandbox` skill) or `excluded_tools={"execute"}` in HarnessProfile |
| Prevent network exfiltration | Block network at sandbox/infrastructure level — deepagents cannot block it |
| Full process isolation | Use a real sandbox backend: `ModalSandbox`, `DaytonaSandbox`, etc. |

---

## Why the default is `virtual_mode=False`

Most production deployments use a sandbox backend (Modal, Daytona, etc.) that implements `SandboxBackendProtocol`. In those cases `virtual_mode` on a `FilesystemBackend` is irrelevant because file operations run inside the sandbox, not on the host. `virtual_mode=False` is the safe default for that common case — enabling it on top of a sandbox backend adds no security but could break path resolution.

---

## Gotchas

- `virtual_mode=True` does NOT prevent the agent from calling `execute` with `cd /etc && cat shadow` — it only guards the direct file-tool path arguments, not shell commands.
- Setting `root_dir` without `virtual_mode=True` provides zero confinement — the agent can read `/etc/passwd` regardless of what `root_dir` is set to.
- `FilesystemPermission` and `virtual_mode` are independent; use both for defence in depth on path-traversal AND operation restriction.

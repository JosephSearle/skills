# FilesystemPermission Reference — deepagents

> deepagents ≥0.5.0 required. `FilesystemPermission` lives in `deepagents` (top-level import).

---

## FilesystemPermission dataclass

```python
from deepagents import FilesystemPermission

@dataclass
class FilesystemPermission:
    operations: list[Literal["read", "write"]]
    paths: list[str]                             # glob patterns; must start with /
    mode: Literal["allow", "deny"] = "allow"
```

### Field rules

| Field | Type | Constraints |
|---|---|---|
| `operations` | `list[Literal["read", "write"]]` | Must contain at least one of `"read"` or `"write"` |
| `paths` | `list[str]` | Each path must start with `/`; `..` and `~` are rejected at validation time |
| `mode` | `"allow"` or `"deny"` | Default `"allow"` |

Validation runs at agent construction time — invalid paths raise `ValueError` before the first invoke.

---

## Default tool → operation mapping

The harness maps each file tool to one or more `operations`. Permissions are enforced against this map.

| Tool | Operation(s) checked |
|---|---|
| `ls` | `read` |
| `read_file` | `read` |
| `glob` | `read` |
| `grep` | `read` |
| `write_file` | `write` |
| `edit_file` | `write` |
| `execute` | _(no permission check — controlled by SandboxBackendProtocol)_ |

---

## Patterns

### Deny writes to a specific tree (most common)

```python
permissions=[
    FilesystemPermission(
        operations=["write"],
        paths=["/policies/**"],
        mode="deny",
    ),
]
```

### Deny all access to a secrets directory

```python
permissions=[
    FilesystemPermission(
        operations=["read", "write"],
        paths=["/secrets/**", "/credentials/**"],
        mode="deny",
    ),
]
```

### Allow writes only to a working directory

```python
permissions=[
    FilesystemPermission(operations=["write"], paths=["/**"], mode="deny"),      # deny all writes
    FilesystemPermission(operations=["write"], paths=["/workspace/**"], mode="allow"),  # re-allow workspace
]
# Evaluation order: allow rules checked first, then deny; last matching rule wins.
# Consult deepagents source for exact precedence if stacking many rules.
```

---

## CompositeBackend with route-level isolation

```python
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend

def make_backend(runtime):
    return CompositeBackend(
        default=StateBackend(runtime),
        routes={
            "/memories/": StoreBackend(
                runtime,
                namespace=lambda rt: (rt.server_info.user.identity,),
            ),
        },
    )

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    backend=make_backend,
    permissions=[
        FilesystemPermission(operations=["write"], paths=["/memories/**"], mode="allow"),
    ],
)
```

Routes are matched by path prefix; the most specific prefix wins. `StoreBackend` with a per-user namespace gives cross-thread, per-user persistent memory while keeping other paths in the ephemeral state backend.

---

## Common mistakes

| Mistake | Correct approach |
|---|---|
| Path without leading `/` — e.g. `"policies/**"` | Must start with `/` — use `"/policies/**"` |
| Using `..` in a path — e.g. `"/../etc/**"` | Rejected at validation — use absolute paths |
| Assuming `mode="allow"` allows *only* that path (allowlist) | `allow` is additive; use `deny` on `/**` then `allow` on specific paths to achieve a whitelist |
| Omitting `permissions=` and expecting write restriction | Default is unrestricted; you must explicitly pass permissions |

# Polyglot Limitations and Alternatives Reference

> Authority: [turborepo.dev/docs](https://turborepo.dev/docs), [github.com/vercel/turborepo/discussions/1077](https://github.com/vercel/turborepo/discussions/1077), and community practice (v2.x)

---

## What Turborepo does for Python

| Capability | Available? |
|-----------|-----------|
| Run Python scripts as tasks | ✅ Via `package.json` shims + `uv run` |
| Cache Python task outputs (coverage, generated files) | ✅ Declared `outputs` are cached |
| Cache Python task logs (pass/fail) | ✅ Always (if `inputs` is correct) |
| Run Python + JS tasks in parallel | ✅ |
| Topological ordering (Python dep on JS build) | ✅ Via `dependsOn` |
| Scope to changed packages with `--filter` | ✅ (file-level, not import-level) |

## What Turborepo does NOT do for Python

| Capability | Available? | Workaround |
|-----------|-----------|-----------|
| Python import-graph-aware affected detection | ❌ | Use `uv.lock` in `inputs` to approximate |
| Python virtual environment management | ❌ | `uv sync` in CI setup step |
| Python package installation | ❌ | `uv sync` in CI setup step |
| Python-aware dependency graphing | ❌ | Use uv workspaces |
| Detect that `py-common` change affects `agent` | ❌ (without file change) | Add `py-common` sources to `agent` `inputs` |

The core limitation: Turborepo determines "affected packages" by file changes, not by Python import analysis. If `packages/py-common/src/utils.py` changes, Turborepo will re-run tasks in `packages/py-common`, but it will only re-run `apps/agent` if you have explicitly added `py-common` source files to `apps/agent`'s `inputs` — or if `uv.lock` changed.

---

## Approximating affected detection for uv workspaces

If `apps/agent` depends on `packages/py-common` as a uv workspace member, any change to `py-common` will update `uv.lock` at the workspace root. If both packages' `inputs` include `uv.lock`, the change will cascade:

```jsonc
// turbo.json
{
  "tasks": {
    "test": {
      "inputs": [
        "src/**/*.py",
        "tests/**/*.py",
        "pyproject.toml",
        "../../uv.lock"   // root uv.lock — changes when any member dep changes
      ]
    }
  }
}
```

This is an approximation — it will bust `agent`'s cache when *any* uv workspace member changes, not just `py-common`. For a small workspace this is acceptable.

---

## Cross-language contract patterns

TypeScript types do not cross to Python and vice versa. Share API contracts via:

| Pattern | How | When |
|---------|-----|------|
| OpenAPI schema | Define in YAML/JSON at root; generate TS types with `openapi-typescript`, Pydantic models with `datamodel-code-generator` | REST APIs between NestJS and FastAPI |
| JSON Schema | Shared `.json` file; validate in both languages | Event payloads, configuration schemas |
| Duplicated models | Zod schema (TS) + Pydantic model (Python) maintained in parallel | Simpler; low overhead when contract changes rarely |
| Protobuf / gRPC | `.proto` files; generate TS and Python stubs | High-throughput internal services |

WRONG — importing TypeScript types in Python:
```python
# Not possible — TypeScript types don't exist at Python runtime
from "@repo/types" import User  # SyntaxError
```

CORRECT — shared Pydantic model mirroring the TypeScript interface:
```python
# packages/py-common/src/py_common/schemas/user.py
from pydantic import BaseModel

class User(BaseModel):
    id: str
    email: str
    role: str
```

---

## Alternatives for deeper Python integration

### Pants (pantsbuild.org)

First-class Python support with true import-graph-based affected detection. Analyses Python imports to know exactly which targets are affected by a change. Higher setup complexity than Turborepo but significantly more accurate for large Python codebases.

**Use when:** The repo has large Python codebases where false-positive cache busting is costly, or when Python import-level affected detection is required for CI efficiency.

### moon (moonrepo.dev)

Task runner with first-class Python support (via `python` platform). Supports affected detection, toolchain management, and Docker layer generation for Python. Simpler than Pants, more Python-aware than Turborepo.

**Use when:** Turborepo's JS-centricity is a friction point and the team wants a tool designed for polyglot from the start.

### pnpm workspaces + GitHub Actions matrix (Taskworld pattern)

Avoid a meta-runner entirely. Use pnpm workspaces for JS, uv for Python, and GitHub Actions job matrices to run tasks in parallel per-package. No shared task runner.

**Use when:** The team wants to avoid adding Turborepo as a dependency, or when JS and Python pipelines are sufficiently independent that unified task running provides little value.

---

## Decision guide

```
Is the repo primarily JS/TS with one or two Python services?
  └─ YES → Turborepo + uv shims (this pattern)

Are there 5+ Python packages with complex interdependencies?
  └─ YES → Evaluate moon or Pants

Does the team need Python import-graph-level affected detection in CI?
  └─ YES → Evaluate Pants

Are the JS and Python pipelines fully independent (no shared tasks)?
  └─ YES → pnpm workspaces + GitHub Actions matrix (skip Turborepo for Python)
```

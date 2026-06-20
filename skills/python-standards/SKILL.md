---
name: python-standards
description: >
  Apply Python 3.10+ senior engineering standards to a project.
  Triggers on: "set up a new Python project", "add uv to this repo", "configure Ruff",
  "which type checker should I use", "mypy vs pyright", "asyncio vs threading",
  "when to use ProcessPoolExecutor", "free-threaded Python", "python3.14t",
  "configure pytest", "Hypothesis property-based testing", "Google docstrings",
  "pyproject.toml template", "src layout", "add pre-commit hooks",
  "how should I structure my Python package", "idiomatic Python", "dataclass vs Pydantic".
---

## Core Philosophy

Modern Python senior engineering consolidates around a small, opinionated toolchain: **uv**
for environment and package management, **Ruff** for linting and formatting, the **two-tool
type-checking pattern** (pyright in editor, mypy in CI), **pytest + Hypothesis** for testing,
and **Google-style docstrings** rendered by mkdocstrings. Everything is declared in a single
`pyproject.toml` and enforced locally via pre-commit (Ruff only) and in CI (mypy + pytest).
The `src/` layout is the default for any installed package. Free-threaded Python (python3.14t)
is a viable production target for CPU-bound pure-Python workloads where the entire dependency
tree ships `cp314t` wheels.

---

## Step 1 — Determine Context

Classify the request into one of three modes before loading any reference:

| Intent signal | Mode |
|---|---|
| "new project", "set up from scratch", "bootstrap", `uv init` | **GREENFIELD** |
| "existing project", "add X to our repo", "retrofit", "migrate from pip/setup.py" | **RETROFIT** |
| Single specific question (type checker, concurrency primitive, a specific tool) | **SPECIFIC** |

Then detect two cross-cutting axes:

1. **Python version target** — what does `requires-python` say? If unspecified, default to `>=3.11`
   (gives TaskGroup, ExceptionGroup, Self, tomllib).
2. **Free-threading scope** — does the request mention `python3.14t`, GIL removal, CPU-bound
   parallel pure-Python? If yes, load `references/free-threading.md`.

---

## Step 2 — Load References

Load files from `references/` according to the table below. The first column is `toolchain.md`,
which is **always loaded** when the intent involves project structure, packaging, or tooling setup.

| Reference file | Load when |
|---|---|
| `toolchain.md` | GREENFIELD or RETROFIT; any question about pyproject.toml, uv, pre-commit, src layout |
| `ruff.md` | Any question about Ruff configuration, rule selection, ignores, formatters, docstring linting |
| `type-checking.md` | Any question about mypy, pyright, ty, Pyrefly, type annotations, type stubs, `py.typed` |
| `concurrency.md` | Any question about asyncio, threading, multiprocessing, TaskGroup, ThreadPoolExecutor |
| `free-threading.md` | Explicit mention of free-threading, GIL removal, python3.14t, PEP 703/779 |
| `testing.md` | Any question about pytest, Hypothesis, fixtures, coverage, CI test strategy |
| `idiomatic.md` | Any question about dataclasses vs attrs vs Pydantic, docstring style, stdlib patterns, idioms |

For GREENFIELD: load `toolchain.md` + `ruff.md` + `type-checking.md` + `testing.md` as the
baseline set. Add `concurrency.md`, `free-threading.md`, or `idiomatic.md` if those topics appear.

For RETROFIT: load `toolchain.md` first to understand the default target, then load the specific
reference for each tool being introduced.

For SPECIFIC: load only the one or two references that directly address the question.

---

## Step 3 — Apply Toolchain Defaults (GREENFIELD only)

When mode is GREENFIELD, generate these three artefacts from `references/toolchain.md`:

### 3.1 Bootstrap commands

```bash
uv init --lib --python 3.12 mypkg
cd mypkg
uv add --dev pytest pytest-cov pytest-asyncio hypothesis ruff mypy pre-commit
uv add --group docs mkdocs mkdocs-material 'mkdocstrings[python]'
touch src/mypkg/py.typed
uv run pre-commit install
```

### 3.2 `pyproject.toml`

Emit the full production template from `references/toolchain.md`. Substitute the actual
package name for `mypkg` throughout.

### 3.3 `.pre-commit-config.yaml`

Emit the full template from `references/toolchain.md` (file-hygiene hooks + ruff + ruff-format;
mypy stays in CI, not pre-commit).

### 3.4 Directory tree

Emit the production directory tree from `references/toolchain.md` with the actual package name.

---

## Step 4 — Answer Specific Questions / Generate Output

Apply the loaded references to the user's actual question. Two common cross-cutting decisions
deserve an explicit decision gate:

### Type-checker decision gate

From `references/type-checking.md`:
- **Default pairing:** pyright (editor) + mypy `--strict` (CI). This remains the 2026 default.
- **Use Pyrefly instead of pyright** if: codebase >100k LOC, or you want aggressive inference
  on unannotated code, or you use PyTorch/JAX and want tensor-shape types.
- **Use ty instead of pyright** if: codebase is partially typed and you need the gradual
  guarantee, or you want full Astral-stack coherence.
- **Do not drop mypy from CI** if you depend on `django-stubs`, `sqlalchemy[mypy]`, or
  `pydantic.mypy` — no other checker reproduces plugin-driven model typing at that fidelity.

### Concurrency axis decision gate

From `references/concurrency.md`:
- **I/O-bound + async-native libraries** → `asyncio` + `asyncio.TaskGroup` (3.11+)
- **I/O-bound + blocking libraries** (psycopg2, boto3, requests) → `ThreadPoolExecutor`
- **CPU-bound + standard GIL build** → `ProcessPoolExecutor`
- **CPU-bound + pure Python + all deps ship cp314t wheels** → `python3.14t` + `ThreadPoolExecutor`
- **Library code** → AnyIO (asyncio + Trio compatible)

---

## Step 5 — Write to Disk & Run Guidance

After generating any file, provide the exact shell commands to verify the setup:

```bash
# Install all deps from lockfile (CI reproducibility)
uv sync --frozen

# Lint (Ruff) — fast, runs in pre-commit too
uv run ruff check src/ tests/
uv run ruff format --check src/ tests/

# Type check (CI only — not pre-commit)
uv run mypy src/ tests/

# Tests with coverage
uv run pytest

# Free-threading verification (if python3.14t in scope)
uv run --python 3.14t python -c "import sys; print('GIL:', sys._is_gil_enabled())"
```

For RETROFIT, provide the staged adoption sequence:
1. Add Ruff with `select = ["E","F","I","UP","B","RUF"]` → fix or `# noqa` everything → merge.
2. Add `ruff format` in a separate commit (formatter diff is noisy).
3. Add quality rules (`C4, SIM, RET, PTH, TC, FURB`) one prefix at a time.
4. Add mypy in CI non-strict → add `strict = true` per module → promote to global strict.

---

## Reference Files

| File | Domain | Source |
|---|---|---|
| [references/toolchain.md](references/toolchain.md) | uv, pyproject.toml, pre-commit, src layout, `py.typed` | python-ruff.md §§1,3,4,6 |
| [references/ruff.md](references/ruff.md) | Ruff rule families, configuration, ignores | python-ruff.md §2 |
| [references/type-checking.md](references/type-checking.md) | mypy, pyright, ty, Pyrefly, 3.10+ typing features | python-type-checking.md |
| [references/concurrency.md](references/concurrency.md) | asyncio, TaskGroup, threading, multiprocessing, AnyIO | python-concurrency-model.md |
| [references/free-threading.md](references/free-threading.md) | PEP 703/779, python3.14t, GIL gotchas, thread safety | free-threaded-cpython-and-gil-removal.md |
| [references/testing.md](references/testing.md) | pytest, Hypothesis, coverage, CI strategy | python-ruff.md §§5,6 |
| [references/idiomatic.md](references/idiomatic.md) | dataclasses/attrs/Pydantic, docstrings, stdlib patterns | python-ruff.md §§7,8 + definitive-python-resource-reference.md |

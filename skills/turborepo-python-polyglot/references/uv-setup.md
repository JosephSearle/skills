# uv Setup Reference

> Authority: [docs.astral.sh/uv](https://docs.astral.sh/uv) (Astral, 2024–2026)

`uv` is a single Rust binary that replaces pip, pip-tools, virtualenv, pyenv, and pipx. It is the recommended Python toolchain for Turborepo polyglot monorepos due to its speed, lockfile support, and workspace feature.

---

## Installation

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or via Homebrew
brew install uv

# Verify
uv --version
```

`uv` manages its own Python installations — no separate `pyenv` required:
```bash
uv python install 3.12
uv python list
```

---

## Single Python package (`pyproject.toml`)

```toml
# apps/agent/pyproject.toml
[project]
name = "agent"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "langgraph>=0.2.0",
    "langchain-anthropic>=0.1.0",
    "pydantic>=2.0.0",
]

# PEP 735 dependency groups — never use [tool.uv.dev-dependencies]
[dependency-groups]
dev = [
    "ruff>=0.15.17",
    "pyright>=1.1.410",
    "pre-commit>=4.0.0",
]
test = [
    "pytest>=8.4.0",
    "pytest-asyncio>=1.4.0",
    "pytest-cov>=6.0.0",
    "hypothesis>=6.155.0",
]
eval = [
    "deepeval>=3.9.9",
    "ragas>=0.4.3",
]
observability = [
    "mlflow>=3.14.0",
]
ci = [{include-group = "dev"}, {include-group = "test"}]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

> **Never mix `[tool.uv.dev-dependencies]` with `[dependency-groups]`.** If both exist, `uv add --dev` keeps writing to the legacy table and the two sections diverge silently. Migrate fully to `[dependency-groups]` before wiring into Turborepo.

```bash
# Install all groups for local development
uv sync --all-groups

# Install only dev + test groups in CI
uv sync --group ci

# Add a runtime dep
uv add langgraph

# Add to a specific group
uv add --group dev pyright
uv add --group test pytest-xdist

# Run a command in the venv
uv run pytest -m "not eval"
uv run ruff check .
uv run pyright src/
```

---

## uv workspaces (multiple Python packages)

When the monorepo has multiple interdependent Python packages, use a uv workspace so they share one `uv.lock` at the monorepo root.

```toml
# Root pyproject.toml (at monorepo root or a Python workspace root)
[tool.uv.workspace]
members = ["apps/agent", "apps/ingestion", "packages/py-common"]

[dependency-groups]
dev = ["ruff>=0.15.17", "pyright>=1.1.410"]
test = ["pytest>=8.4.0", "pytest-asyncio>=1.4.0", "pytest-cov>=6.0.0"]
ci = [{include-group = "dev"}, {include-group = "test"}]
```

```toml
# packages/py-common/pyproject.toml
[project]
name = "py-common"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = []

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

```toml
# apps/agent/pyproject.toml
[project]
name = "agent"
requires-python = ">=3.12"
dependencies = [
    "py-common",           # workspace member — resolved locally
    "langgraph>=0.2.0",
]

[tool.uv.sources]
py-common = { workspace = true }
```

```bash
# Sync all groups for the entire uv workspace from the workspace root
uv sync --all-groups

# Sync only ci groups in CI
uv sync --group ci

# Run commands in a specific workspace member
uv run --package agent pytest -m "not eval"
```

---

## Ruff (lint + format)

```toml
# pyproject.toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "A", "C4", "PT"]
ignore = ["E501"]

[tool.ruff.format]
quote-style = "double"
```

```bash
uv run ruff check .        # lint
uv run ruff check . --fix  # auto-fix
uv run ruff format .       # format
```

---

## Pyright (type checking)

```toml
# pyproject.toml — configure here only, never in a pyrightconfig.json alongside it
[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "standard"
venvPath = "."
venv = ".venv"
```

```bash
uv run pyright src/
uv run pyright src/agent/  # specific path
```

Configure Pyright in `pyproject.toml` only — never create a `pyrightconfig.json` alongside it (they conflict). For LangChain/LangGraph codebases, `typeCheckingMode = "standard"` (not `"strict"`) avoids noise from partially-typed third-party packages. See `developer-experience/references/pyright.md` for the full pre-commit hook pattern and LangChain compatibility stubs.

---

## Version conflict strategy

If Team A needs `pydantic<2` and Team B needs `pydantic>=2`, a single uv workspace cannot satisfy both. Options:

| Approach | When to use |
|----------|------------|
| Upgrade all packages to the newer constraint | Preferred — unifies the workspace |
| Split into two uv workspaces within one monorepo | When upgrade is blocked by a vendor dep |
| Isolate conflicting app in a separate Docker image | When runtime isolation is needed regardless |

Two uv workspaces means two `uv.lock` files. Turborepo handles this transparently — each Python package's `inputs` in `turbo.json` points to its own `uv.lock`.

---

## CI flags

```bash
# CI: validate lockfile has not drifted (fails if uv.lock is out of date)
uv lock --frozen --check

# CI: install from lockfile exactly, only ci group (dev + test)
uv sync --frozen --group ci

# CI: avoid re-downloading packages (use cache)
uv sync --frozen --group ci --no-install-project
```

Set `UV_CACHE_DIR` in CI to point to a persistent cache directory for faster installs. Always run `uv lock --frozen --check` **before** `uv sync` in CI — it catches `uv.lock` drift before install begins rather than failing midway through dependency resolution.

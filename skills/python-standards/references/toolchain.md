# Toolchain Reference — uv, pyproject.toml, Pre-commit, Project Layout

## Default Decisions Quick-Reference

| Decision | Default | Why |
|---|---|---|
| Build backend | `hatchling>=1.27` | Pure-Python, PEP 517-compliant, no `setup.py` |
| Project metadata | `[project]` table (PEP 621) | Tool-agnostic, declarative, canonical |
| Dev deps | `[dependency-groups]` (PEP 735) | Not shipped to PyPI; multiple named groups; tool-agnostic |
| Layout | `src/<pkg>/` | Forces import resolution against the installed package |
| Linter / formatter | Ruff | One Rust binary replacing 5+ tools; aggressive parallelism |
| Type checker (CI) | mypy `strict = true` | Authoritative, supports per-module overrides, plugin ecosystem |
| Type checker (editor) | pyright `typeCheckingMode = "strict"` | Fastest live feedback; powers Pylance |
| Tests | pytest + Hypothesis | Parametrize + property-based; industry standard |
| Docstrings | Google convention | First-class mkdocstrings/Griffe support; matches `convention = "google"` |
| Coverage floor | `fail_under = 90` with branch coverage | High-quality projects |
| Python target | `requires-python = ">=3.11"` | TaskGroup, ExceptionGroup, Self, tomllib |

---

## Full Production `pyproject.toml`

```toml
# ============================================================================
# pyproject.toml — production template for a Python 3.11+ library
# Governed by: PEP 517 (build), PEP 518 (build-system), PEP 621 ([project]),
#              PEP 735 ([dependency-groups]), PEP 561 (py.typed)
# ============================================================================

[build-system]
requires      = ["hatchling>=1.27"]
build-backend = "hatchling.build"

# ---------------------------------------------------------------------------
# [project] (PEP 621) — canonical, static project metadata
# ---------------------------------------------------------------------------
[project]
name            = "mypkg"
version         = "0.1.0"
description     = "One-sentence summary that appears on PyPI."
readme          = "README.md"
requires-python = ">=3.11"
license         = "MIT"
license-files   = ["LICENSE"]
authors         = [{ name = "Jane Doe", email = "jane@example.com" }]
keywords        = ["example", "template"]
classifiers     = [
    "Development Status :: 4 - Beta",
    "Programming Language :: Python :: 3 :: Only",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Programming Language :: Python :: 3.13",
    "Programming Language :: Python :: 3.14",
    "Typing :: Typed",
]

# Runtime deps only. Pin a LOWER BOUND, never an upper bound.
dependencies = [
    "httpx>=0.28",
    "pydantic>=2.7",
]

# Optional extras ARE shipped to PyPI — user-facing optional features only.
[project.optional-dependencies]
cli = ["typer>=0.12"]

[project.urls]
Homepage      = "https://github.com/example/mypkg"
Documentation = "https://example.github.io/mypkg"
Issues        = "https://github.com/example/mypkg/issues"
Changelog     = "https://github.com/example/mypkg/blob/main/CHANGELOG.md"

[project.scripts]
mypkg = "mypkg.cli:main"

# ---------------------------------------------------------------------------
# [dependency-groups] (PEP 735, accepted October 2024) — NOT shipped to PyPI
# ---------------------------------------------------------------------------
[dependency-groups]
dev = [
    {include-group = "test"},
    {include-group = "lint"},
    {include-group = "docs"},
]
test = [
    "pytest>=8.3",
    "pytest-cov>=5.0",
    "pytest-xdist>=3.6",
    "pytest-asyncio>=1.0",
    "hypothesis>=6.112",
]
lint = [
    "ruff>=0.8",
    "mypy>=1.13",
    "pre-commit>=4.0",
]
docs = [
    "mkdocs>=1.6",
    "mkdocs-material>=9.5",
    "mkdocstrings[python]>=0.27",
]

[tool.hatch.build.targets.wheel]
packages = ["src/mypkg"]

# ---------------------------------------------------------------------------
# Ruff — see references/ruff.md for the full rule-set rationale
# ---------------------------------------------------------------------------
[tool.ruff]
target-version = "py311"
line-length    = 100
src            = ["src", "tests"]
extend-exclude = ["docs/_build", "build", "dist"]

[tool.ruff.lint]
select = [
    "E", "W", "F", "I", "UP", "B", "C4", "SIM", "RET", "PTH",
    "TC", "TID", "ISC", "ICN", "FA", "FURB", "PERF", "PIE", "PL",
    "RUF", "D",
    "S105", "S106", "S107", "S108", "S113",
    "S301", "S307", "S324", "S506", "S608",
]
ignore = ["COM812", "ISC001", "E501", "D203", "D213", "PLR0913"]
unfixable = ["F401"]

[tool.ruff.lint.pydocstyle]
convention = "google"

[tool.ruff.lint.flake8-tidy-imports]
ban-relative-imports = "all"

[tool.ruff.lint.flake8-type-checking]
runtime-evaluated-base-classes = ["pydantic.BaseModel"]

[tool.ruff.lint.isort]
known-first-party          = ["mypkg"]
combine-as-imports         = true
force-sort-within-sections = true
split-on-trailing-comma    = true

[tool.ruff.lint.pylint]
max-args = 8

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py"     = ["D", "S101", "S105", "S106", "PLR2004", "ANN"]
"src/*/__init__.py" = ["F401", "D104"]
"**/migrations/*"   = ["E501", "D"]
"*.pyi"             = ["D", "E501"]

[tool.ruff.format]
quote-style                = "double"
indent-style               = "space"
docstring-code-format      = true
docstring-code-line-length = 80
skip-magic-trailing-comma  = false

# ---------------------------------------------------------------------------
# mypy — run in CI only (not pre-commit). See references/type-checking.md
# ---------------------------------------------------------------------------
[tool.mypy]
python_version      = "3.11"
strict              = true
warn_unreachable    = true
warn_unused_configs = true
pretty              = true
show_error_codes    = true
show_error_context  = true
files               = ["src", "tests"]

[[tool.mypy.overrides]]
module = ["untyped_dep.*"]
ignore_missing_imports = true

[[tool.mypy.overrides]]
module = ["tests.*"]
disallow_untyped_defs       = false
disallow_incomplete_defs    = false
disallow_untyped_decorators = false

# ---------------------------------------------------------------------------
# pyright — editor type checker (strict). See references/type-checking.md
# ---------------------------------------------------------------------------
[tool.pyright]
include            = ["src", "tests"]
exclude            = ["**/__pycache__", "build", "dist"]
pythonVersion      = "3.11"
typeCheckingMode             = "strict"
reportMissingTypeStubs       = false
reportImplicitOverride       = "error"
reportUnnecessaryTypeIgnoreComment = "warning"

# ---------------------------------------------------------------------------
# pytest — see references/testing.md for fixture and parametrize patterns
# ---------------------------------------------------------------------------
[tool.pytest.ini_options]
minversion       = "8.0"
testpaths        = ["tests"]
pythonpath       = ["src"]
asyncio_mode     = "auto"
asyncio_default_fixture_loop_scope = "function"
addopts = [
    "-ra",
    "--strict-markers",
    "--strict-config",
    "--showlocals",
    "--tb=short",
    "--cov=mypkg",
    "--cov-report=term-missing",
    "--cov-report=xml",
    "--cov-branch",
    "--cov-fail-under=90",
]
markers = [
    "slow: marks tests as slow (deselect with -m 'not slow')",
    "integration: requires external services",
    "unit: pure-function tests",
]
filterwarnings = [
    "error",
    "ignore::DeprecationWarning:third_party_lib.*",
]

# ---------------------------------------------------------------------------
# coverage.py — 90% branch coverage floor
# ---------------------------------------------------------------------------
[tool.coverage.run]
source         = ["mypkg"]
branch         = true
parallel       = true
relative_files = true
omit = ["*/tests/*", "*/__main__.py", "*/_version.py"]

[tool.coverage.report]
fail_under   = 90
show_missing = true
skip_covered = false
precision    = 2
exclude_lines = [
    "pragma: no cover",
    "raise NotImplementedError",
    "if TYPE_CHECKING:",
    "if __name__ == .__main__.:",
    "@overload",
    "\\.\\.\\.",
]
```

---

## uv Workflow Commands

### Project lifecycle
```bash
# Bootstrap a library with src/ layout and py.typed marker
uv init --lib --python 3.12 mypkg && cd mypkg

# Add runtime deps (writes to [project.dependencies], updates uv.lock)
uv add 'httpx>=0.28' 'pydantic>=2.7'

# Add dev tools to the PEP 735 dev group (NOT shipped to PyPI)
uv add --dev pytest pytest-cov pytest-asyncio hypothesis ruff mypy pre-commit

# Add to a named group
uv add --group docs mkdocs mkdocs-material 'mkdocstrings[python]'

# Install everything from lockfile (creates .venv if missing)
uv sync

# CI — fail if lockfile would change
uv sync --frozen
```

### Run commands
```bash
uv run pytest                  # run tests inside the project venv
uv run ruff check src/         # lint
uv run mypy src/ tests/        # type check (CI only)
uv run pre-commit install      # install hooks once after cloning
```

### Python version management
```bash
uv python install 3.11 3.12 3.13 3.14
uv python pin 3.12             # write .python-version
uv python install 3.14t        # free-threaded build
uv run --python 3.14t python -c 'import sys; print(sys._is_gil_enabled())'
# → False
```

### Build and publish
```bash
uv build                       # produces dist/*.tar.gz and dist/*.whl
uv publish --token "$PYPI_TOKEN"
```

### `uv add` vs `uv pip install`

| `uv add pkg` | `uv pip install pkg` |
|---|---|
| Declarative — writes to `pyproject.toml`, updates `uv.lock`, installs | Imperative — installs into active venv only |
| DOES modify `pyproject.toml` | Does NOT modify `pyproject.toml` |
| Like `poetry add` | Like raw `pip install` |
| Normal project dependency management | Ad-hoc work, Dockerfiles, legacy scripts |

**RULE:** Use `uv add` 95% of the time. Reserve `uv pip` for Dockerfiles, raw requirements.txt replication, or ad-hoc exploration.

### What uv replaces

| Old tool | uv equivalent |
|---|---|
| `pip install` (in a project) | `uv add` / `uv sync` |
| `pip install` (ad-hoc) | `uv pip install` |
| `pip-compile` (pip-tools) | `uv lock` / `uv pip compile` |
| `virtualenv` / `python -m venv` | `uv venv` (auto-created by `uv sync`) |
| `pyenv install` | `uv python install` |
| `pipx install` / `pipx run` | `uv tool install` / `uvx` |
| `python -m build` | `uv build` |
| `twine upload` | `uv publish` |

---

## Pre-commit Configuration

```yaml
# .pre-commit-config.yaml
# Ruff + file-hygiene only. mypy stays in CI (not here — see below).
default_language_version:
  python: python3.12

repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-toml
      - id: check-added-large-files
        args: [--maxkb=500]
      - id: check-merge-conflict
      - id: check-case-conflict
      - id: debug-statements
      - id: mixed-line-ending
        args: [--fix=lf]

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.4
    hooks:
      - id: ruff
        args: [--fix, --exit-non-zero-on-fix]
      - id: ruff-format

ci:
  autofix_commit_msg: "[pre-commit.ci] auto fixes from pre-commit hooks"
  autofix_prs: true
  autoupdate_schedule: monthly
```

**RULE: Run mypy in CI, NOT in pre-commit.** Three reasons:
1. **Isolated-venv problem** — pre-commit runs mypy in an isolated venv with no access to your
   project's dependencies. You'd have to mirror every typed dep into `additional_dependencies:`,
   which drifts from the real `pyproject.toml`.
2. **Speed** — mypy on a 50k-line codebase takes 5–30 s even with the cache. Commits should be
   near-instant.
3. **Files vs project** — pre-commit passes only changed files; mypy needs the full project graph.

Recommended split:
- **pre-commit:** Ruff lint + format + file-hygiene. Fast, file-scoped, auto-fixable.
- **CI:** `uv run mypy src tests` + `uv run pytest --cov`.

---

## Production Directory Tree

```
mypkg/
├── .github/
│   └── workflows/
│       ├── ci.yml                      # lint + type + test on every push
│       └── publish.yml                 # build + uv publish on tag (OIDC)
├── .pre-commit-config.yaml
├── .python-version                     # written by `uv python pin`
├── .gitignore
├── pyproject.toml                      # single source of truth for all config
├── uv.lock                             # committed; cross-platform lockfile
├── README.md
├── LICENSE
├── CHANGELOG.md
├── CONTRIBUTING.md
├── docs/
│   ├── index.md
│   ├── reference/
│   └── mkdocs.yml
├── src/
│   └── mypkg/
│       ├── __init__.py                 # exports public API with explicit __all__
│       ├── py.typed                    # PEP 561 marker (empty file)
│       ├── cli.py
│       ├── core.py
│       ├── exceptions.py
│       └── _internal/                  # leading underscore = private
│           └── __init__.py
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── unit/
    │   ├── conftest.py
    │   └── test_core.py
    └── integration/
        ├── conftest.py
        └── test_cli.py
```

**Use `src/` layout if ANY of the following is true:** the project will be installed, has a
`tests/` directory, will be published to PyPI, or more than one person works on it. Without the
`src/` layout, `pytest` finds the *uninstalled* source instead of your installed package; tests
may pass that would fail for users.

---

## `__init__.py` Policy

```python
# src/mypkg/__init__.py
"""Public API for mypkg."""

from importlib.metadata import version as _version

from mypkg.core import Pipeline, Result
from mypkg.exceptions import MyPkgError, ValidationError

__version__ = _version("mypkg")

__all__ = [
    "MyPkgError",
    "Pipeline",
    "Result",
    "ValidationError",
    "__version__",
]
```

**RULES:**
- Export ONLY what's public. Everything else lives behind a leading underscore or in `_internal/`.
- Use an **explicit `__all__`** — without it, `from mypkg import *` exports every name and
  Ruff's `D104`/`F401` rules can't tell what is intentional re-export.
- **Don't** import everything in `__init__.py` if it triggers heavy side-effects (DB connections,
  model loading). Lazy-import in functions instead.

---

## `py.typed` Marker (PEP 561)

PEP 561: *"Package maintainers who wish to support type checking of their code MUST add a marker
file named `py.typed` to their package supporting typing."*

Setup:
1. Create `src/mypkg/py.typed` — an **empty file**.
2. With `hatchling`, the file inside `src/mypkg/` is included automatically.
3. Add `"Typing :: Typed"` to `[project].classifiers`.

**RULE:** Every library package you publish must ship a `py.typed` marker. Without it, mypy
users who install your library see `[import-untyped]` errors and must add per-module `ignore`.

---

## Where to Put What

| Item | Location |
|---|---|
| Type stubs for YOUR code | Inline in `.py` files; create `py.typed` |
| Type stubs for OTHER LIBS | `stubs/<libname>-stubs/`, configured via `MYPYPATH`/`stubPath` |
| Release / CI helper scripts | `scripts/` at repo root — NOT in `src/` |
| Tool config | `pyproject.toml` `[tool.*]`; fall back to dedicated files only if pyproject support is missing |
| Docs source | `docs/` |
| Examples | `examples/` (separately, not under `src/`) |

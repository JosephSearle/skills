---
name: developer-experience
description: >
  Set up or audit the Python developer-experience toolchain for agentcraft projects: uv, Ruff,
  Pyright, pre-commit, and IBM detect-secrets. Triggers on: uv, uv sync, uv run, uv lock,
  uv add, uv init, dependency-groups, PEP 735, Ruff, ruff check, ruff format, ruff lint,
  Pyright, pyright, type check, type checking, pre-commit, .pre-commit-config.yaml, detect-secrets,
  .secrets.baseline, pyproject.toml, lockfile, venv, virtualenv, CI setup, repo setup,
  ASYNC212, isort, black replacement, flake8 replacement, "set up linting", "configure CI",
  "set up pre-commit", "format code", "dependency management", "project setup".
---

## Core Philosophy

All tools in this stack are invoked via **`uv run <tool>`** — never via direct binary calls or
manually activated venvs. `uv` is the single source of truth for Python versions, environments,
and dependency resolution. The complete toolchain:

| Tool | Version | Role |
|---|---|---|
| uv | ≥ 0.11.22 | Package/venv/script runner; replaces pip, poetry, pyenv, virtualenv |
| Ruff | ≥ 0.15.17 | Linter + formatter; replaces Flake8, Black, isort, pyupgrade |
| Pyright | ≥ 1.1.410 | Static type checker; run via `uv run pyright` (local hook only) |
| pre-commit | ≥ 4.0.0 | Git hook runner; lock all hook revs; CI backstop via `--all-files` |
| IBM detect-secrets | ≥ 0.13.1+ibm | Secret scanning; LLM-codebase false-positive management |

The golden rule: **CI runs `uvx pre-commit run --all-files`** as the backstop. Agent coding tools
bypass hooks with `--no-verify` — do not rely on the local git hook alone.

---

## Step 1 — Determine Context

| Intent | Signals | Action |
|---|---|---|
| **GREENFIELD** | "new project", "set up tooling", "initialise repo" | Load all references; emit full `pyproject.toml` + `.pre-commit-config.yaml` |
| **ADD TOOL** | "add Ruff", "add type checking", "add pre-commit" | Load only the relevant reference; emit targeted config block |
| **AUDIT** | "review config", "check our tooling", "is this correct?" | Load all references; check each section against standards; flag deviations |
| **FIX** | "Ruff error", "Pyright failing", "pre-commit hook fails", "secrets baseline" | Load the specific reference for the failing tool |

---

## Step 2 — Load References

| Reference file | Load when |
|---|---|
| `references/uv.md` | Any dependency management, lockfile, venv, CI setup, monorepo/workspace question |
| `references/ruff.md` | Any lint, format, rule configuration, per-file ignore, ASYNC rule question |
| `references/pyright.md` | Any type checking, pyrightconfig, venv wiring, strict mode question |
| `references/pre-commit.md` | Any hook config, `.pre-commit-config.yaml`, detect-secrets, CI backstop question |

For GREENFIELD: load all four references and emit the complete setup.

---

## Step 3 — Apply Patterns

### Dependency groups (PEP 735)

Always use `[dependency-groups]` — do **not** use the legacy `[tool.uv.dev-dependencies]` table:

```toml
[dependency-groups]
dev = [
  "ruff>=0.15.17",
  "pyright>=1.1.410",
  "pre-commit>=4.0.0",
  "detect-secrets>=0.13.1",
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

[tool.uv]
required-version = ">=0.11.22"
```

Use `include-group` for group composition:
```toml
[dependency-groups]
ci = [{include-group = "dev"}, {include-group = "test"}]
```

### Ruff configuration

```toml
[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "ASYNC", "SIM", "PTH", "RUF", "PT"]
ignore = []

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "PLR2004"]   # allow assert and magic values in tests
"**/prompts/**" = ["E501"]         # allow long lines in prompt files

[tool.ruff.format]
# same defaults as Black
```

### Pyright configuration

```toml
[tool.pyright]
pythonVersion = "3.11"
venvPath = "."
venv = ".venv"
typeCheckingMode = "standard"      # use "basic" for legacy code; "strict" only for core src/
```

Never have both `[tool.pyright]` in `pyproject.toml` AND a `pyrightconfig.json` — `pyrightconfig.json`
wins and will conflict. Delete `pyrightconfig.json` if it exists.

### Which tool for which check?

| Check | Tool |
|---|---|
| Import order | Ruff `I` rules (isort replacement) |
| Code style / formatting | `ruff format` (Black replacement) |
| Bug-prone patterns | Ruff `B` (bugbear) |
| Async blocking I/O in agent nodes | Ruff `ASYNC212` — fix the code, not the rule |
| Type correctness | Pyright (`uv run pyright`) |
| Secrets in commits | detect-secrets |

---

## Step 4 — Output & Verification

After writing config, provide these verification commands:

```bash
# Install dev group
uv sync --group dev

# Run Ruff
uv run ruff check src/ tests/ --fix
uv run ruff format src/ tests/

# Run Pyright
uv run pyright src/

# Initialise detect-secrets baseline (first time only)
uv run detect-secrets scan \
  --exclude-files 'tests/fixtures/.*' \
  --exclude-files 'examples/.*' \
  > .secrets.baseline
uv run detect-secrets audit .secrets.baseline   # mark true/false positives interactively
git add .secrets.baseline

# Run pre-commit on all files
uvx pre-commit run --all-files
```

---

## Reference Files

| File | Domain |
|---|---|
| [references/uv.md](references/uv.md) | Dependency groups, lockfile, CI integration, workspace monorepo |
| [references/ruff.md](references/ruff.md) | Rule sets, per-file ignores, ASYNC212, upgrade gotchas |
| [references/pyright.md](references/pyright.md) | Config, venv wiring, strict-mode caveats, Pydantic/LangChain notes |
| [references/pre-commit.md](references/pre-commit.md) | Full `.pre-commit-config.yaml` template, hook order, detect-secrets setup |

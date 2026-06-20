# uv Reference

**Version**: ≥ 0.11.22 (GHSA-pjjw-68hj-v9mw fixed in 0.11.x — do not pin below this)

## Core commands

```bash
uv init --lib myproject        # src-layout project with pyproject.toml
uv init --package myproject    # installable package (adds [project] metadata)
uv add langchain-core          # add runtime dep + update uv.lock
uv add --group dev ruff        # add to a dependency-group
uv sync                        # install all groups; creates .venv if absent
uv sync --group test           # install only the test group (+ default deps)
uv lock                        # regenerate uv.lock without installing
uv run pytest                  # auto-syncs, then runs in project venv
uv run python -c "..."         # run arbitrary python in project venv
uvx pre-commit run --all-files # run a tool from a temp venv (no install needed)
```

## Dependency groups (PEP 735) — canonical pattern

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
ci = [{include-group = "dev"}, {include-group = "test"}]
```

Never mix `[tool.uv.dev-dependencies]` with `[dependency-groups]`. If both exist,
`uv add --dev` keeps writing to the legacy table. Migrate fully to `[dependency-groups]`.

## Enforce minimum uv version in CI

```toml
[tool.uv]
required-version = ">=0.11.22"
```

## Lockfile

- `uv.lock` is cross-platform and universal — commit it.
- Regenerate: `uv lock` (after `pyproject.toml` edits) or `uv lock --upgrade-package ruff`.
- The `uv-lock` pre-commit hook fails if `uv.lock` is out of date.

## GitHub Actions

```yaml
- uses: astral-sh/setup-uv@v6
  with:
    version: ">=0.11.22"
    enable-cache: true

- run: uv sync --group ci
- run: uv run pytest -x -q
- run: uvx pre-commit run --all-files
```

## Workspace / monorepo

```toml
# Root pyproject.toml
[tool.uv.workspace]
members = ["packages/*", "agents/*"]
```

Members share a single `uv.lock`; each has its own `pyproject.toml`.
Run member commands with `uv run --package <member-name> <command>`.

## Gotchas

- Version drift: `uv.lock` pin vs `rev` in `.pre-commit-config.yaml` — run `pre-commit autoupdate` on a schedule.
- `uv run` auto-syncs before execution — no need for manual `uv sync` in scripts.
- `uvx` creates a temporary isolated venv; use it for one-off tools (pre-commit, mkdocs).

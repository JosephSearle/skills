# Python Tasks in Turborepo Reference

> Authority: [turborepo.dev/docs](https://turborepo.dev/docs) and maintainer guidance in [github.com/vercel/turborepo/discussions/1077](https://github.com/vercel/turborepo/discussions/1077) (v2.x)

---

## The `package.json` shim

Every Python directory that Turborepo should orchestrate needs a `package.json` with `name` and `scripts`. This file contains no JavaScript — it is purely a Turborepo entry point.

```json
{
  "name": "@repo/agent",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "lint": "uv run ruff check .",
    "format": "uv run ruff format .",
    "check-types": "uv run pyright src/",
    "test": "uv run pytest -m \"not eval\"",
    "test:eval": "uv run pytest -m eval",
    "test:cov": "uv run pytest -m \"not eval\" --cov=src --cov-report=xml",
    "dev": "uv run langgraph dev",
    "build": "echo 'no build step' && exit 0"
  }
}
```

- Do **not** add `dependencies` or `devDependencies` — Python deps live in `pyproject.toml`
- The `build` script must exist if `turbo.json` declares a `build` task (return 0 to be a no-op)
- Script names must match the task names declared in `turbo.json`
- `test` excludes `@pytest.mark.eval` tests — those are slow, costly LLM calls not suitable for standard CI. `test:eval` runs them in isolation (scheduled nightly or pre-release gate). See `testing-foundations` skill for the marker configuration in `pyproject.toml`.

---

## Turborepo task configuration

```jsonc
// turbo.json
{
  // MLflow and API key env vars must be declared here for Turborepo to forward them
  // to Python processes. Without globalEnv, these vars are stripped from the task
  // environment and MLflow silently falls back to local SQLite tracking.
  "globalEnv": [
    "MLFLOW_TRACKING_URI",
    "MLFLOW_EXPERIMENT_NAME",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY"
  ],
  "tasks": {
    "lint": {
      "outputs": [],
      "inputs": [
        "**/*.py",
        "pyproject.toml"
      ]
    },
    "format": {
      "outputs": [],
      "cache": false
    },
    "check-types": {
      "dependsOn": ["^check-types"],
      "outputs": [],
      "inputs": [
        "**/*.py",
        "pyproject.toml",
        "uv.lock"
      ]
    },
    "test": {
      "outputs": ["coverage/**", ".coverage", "coverage.xml"],
      "inputs": [
        "src/**/*.py",
        "tests/**/*.py",
        "pyproject.toml",
        "uv.lock"
      ]
    },
    // Eval tests are never cached — results depend on live LLM responses
    "test:eval": {
      "cache": false,
      "outputs": ["eval-results/**"],
      "inputs": [
        "src/**/*.py",
        "tests/**/*.py",
        "pyproject.toml",
        "uv.lock"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

**`inputs` is critical for Python.** Without explicit `inputs`, Turborepo hashes all git-tracked files in the package directory — including test output files, coverage reports, and `.pyc` cache. Explicit globs keep the hash stable and the cache valid.

WRONG — test task with no inputs (hashes everything including generated files):
```jsonc
{
  "tasks": {
    "test": {
      "outputs": ["coverage/**"]
    }
  }
}
```

CORRECT — explicit Python source globs + dep files:
```jsonc
{
  "tasks": {
    "test": {
      "outputs": ["coverage/**", "coverage.xml"],
      "inputs": [
        "src/**/*.py",
        "tests/**/*.py",
        "pyproject.toml",
        "uv.lock"
      ]
    }
  }
}
```

---

## `pnpm-workspace.yaml` inclusion

Turborepo discovers Python packages via `pnpm-workspace.yaml`. If Python apps are under `apps/`, they are automatically included:

```yaml
packages:
  - "apps/*"   # includes apps/agent, apps/ingestion, etc.
  - "packages/*"
```

If Python apps are in a dedicated directory:
```yaml
packages:
  - "apps/*"
  - "agents/*"   # explicitly include Python agent directory
  - "packages/*"
```

---

## Running tasks

```bash
# Run tests for all packages (JS + Python)
turbo run test

# Run tests for only the Python agent
turbo run test --filter=@repo/agent

# Run lint across the entire monorepo
turbo run lint

# Run the agent in dev mode
turbo watch dev --filter=@repo/agent
```

---

## CI configuration

```yaml
# GitHub Actions — standard CI job (runs on every PR/push)
- name: Install pnpm
  uses: pnpm/action-setup@v4

- name: Install Node deps
  run: pnpm install --frozen-lockfile

- name: Install uv
  uses: astral-sh/setup-uv@v4
  with:
    version: ">=0.11.22"

- name: Validate Python lockfile
  run: uv lock --frozen --check   # fails if uv.lock has drifted from pyproject.toml

- name: Sync Python deps (ci group only)
  run: uv sync --frozen --group ci

- name: Run all tasks
  run: pnpm turbo run lint check-types test
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}
    MLFLOW_TRACKING_URI: ${{ secrets.MLFLOW_TRACKING_URI }}
    MLFLOW_EXPERIMENT_NAME: ${{ vars.MLFLOW_EXPERIMENT_NAME }}
```

```yaml
# GitHub Actions — eval gate job (runs on schedule or pre-release only)
- name: Sync eval deps
  run: uv sync --frozen --group eval --group observability

- name: Run eval tests
  run: pnpm turbo run test:eval --filter=@repo/agent
  env:
    MLFLOW_TRACKING_URI: ${{ secrets.MLFLOW_TRACKING_URI }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Both `pnpm install` (for JS) and `uv sync` (for Python) must run before `turbo run`. Turborepo does not run either installer for you. Run `uv lock --frozen --check` before `uv sync` — it catches lockfile drift before install begins rather than failing midway through resolution.

---

## Per-package turbo.json for Python

If a Python package has different task requirements, override via a per-package `turbo.json`:

```jsonc
// apps/agent/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "test": {
      "outputs": ["coverage/**", "coverage.xml", ".coverage"],
      "inputs": [
        "src/**/*.py",
        "tests/**/*.py",
        "pyproject.toml",
        "uv.lock",
        "langgraph.json"
      ]
    }
  }
}
```

`extends: ["//"]` inherits the root config and this override adds `langgraph.json` to the test inputs.

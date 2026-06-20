---
name: turborepo-python-polyglot
description: >
  Wire an existing Python application into a JS/TS Turborepo monorepo for unified task
  running and caching. Use when an existing Python service (LangChain, LangGraph,
  FastAPI, or any Python app) needs to participate in turbo run alongside JS/TS packages,
  or when wiring ruff/pyright/pytest as turbo tasks, including a Python package in
  pnpm-workspace.yaml, configuring Turborepo caching for Python tasks, or understanding
  what Turborepo can and cannot do for Python. Triggers on: Python app in a Turborepo,
  package.json shim for Python, uv in Turborepo, "turbo run test for Python", polyglot
  monorepo, Python and TypeScript in same repo, making Python compatible with Turborepo.
  Not for creating new Python projects, pure JS/TS monorepos, general turbo.json task
  config, or pnpm workspaces — use turborepo-core, turborepo-pnpm-workspaces, or the
  specific framework skills for those.
---

# turborepo-python-polyglot

This skill wires an **existing** Python project into a Turborepo monorepo. It does not create Python projects — use your Python tooling (uv, poetry, etc.) to initialise the project first, then use this skill to make it visible to Turborepo.

Turborepo can orchestrate Python tasks alongside JavaScript — but not through native Python support. Python integration is a **community-established pattern** (not an official feature) using a thin `package.json` shim that wraps `uv run` commands. Turborepo gives you unified task running and caching across both languages; it does **not** manage Python dependencies, virtual environments, or Python-aware affected detection.

State this limitation clearly before adopting this pattern for a team. For monorepos requiring deep Python correctness (import-graph-aware affected detection, true Python dependency management), evaluate Pants or moon instead.

---

## Core Philosophy

**Turborepo is JS-centric for discovery, agnostic about task contents.** To make a Python directory visible to Turborepo: (1) include it in `pnpm-workspace.yaml`, and (2) add a `package.json` with `name` and `scripts`. Turborepo then treats those scripts as tasks and caches them like any other.

**Two parallel package managers, one task runner.** The monorepo has both `pnpm-lock.yaml` (for JS/TS) and `uv.lock` (for Python). Turborepo runs tasks from both; it does not merge the two dependency systems.

**Python types do not cross to TypeScript.** Cross-language contracts (e.g. NestJS API ↔ Python agent) must be shared via OpenAPI schemas, JSON Schema files, or manually duplicated Zod + Pydantic models.

---

## Step 1 — Detect compatibility gaps

Confirm the Python project exists and identify what's missing for Turborepo compatibility:

```
Does the Python app have a pyproject.toml?
  └─ NO  → this skill doesn't apply; initialise the Python project first with uv/poetry
  └─ YES → proceed

Does pyproject.toml use [dependency-groups] (PEP 735)?
  └─ Uses [tool.uv.dev-dependencies] instead
       → migrate to [dependency-groups] before wiring into Turborepo
         (see developer-experience/references/uv.md for the canonical format)
  └─ Already uses [dependency-groups] → proceed

Is the Python app directory listed in pnpm-workspace.yaml (directly or via glob)?
  └─ NO  → add it (Step 3)
  └─ YES → proceed

Does the Python app directory have a package.json shim?
  └─ NO  → create a shim (Step 3)
  └─ YES → inspect scripts; are they calling uv run? → proceed

Does turbo.json have tasks for lint/test/check-types?
  └─ NO  → add Python task config (Step 3)
  └─ YES → confirm inputs include pyproject.toml and uv.lock
           confirm test task uses -m "not eval" (excludes LLM eval tests)
           confirm globalEnv includes MLFLOW_TRACKING_URI
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Setting up uv, pyproject.toml, or uv workspaces
  │    → load references/uv-setup.md
  ├─ Wiring Python tasks (lint/test/check-types) into Turborepo
  │    → load references/python-tasks.md
  └─ Understanding limitations or evaluating alternatives
       → load references/polyglot-limitations.md
```

---

## Step 3 — Execute

### Declare the Python directory in `pnpm-workspace.yaml`

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
  # Python apps with package.json shims are automatically included via apps/*
```

If your Python apps are in a dedicated directory (e.g. `agents/`), add it explicitly:
```yaml
packages:
  - "apps/*"
  - "agents/*"
  - "packages/*"
```

### The `package.json` shim

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
    "dev": "uv run langgraph dev",
    "build": "echo 'no build step for Python' && exit 0"
  }
}
```

No JS `dependencies` or `devDependencies` — this file exists solely to give Turborepo a task entry point. `test` excludes `@pytest.mark.eval` tests; run `test:eval` on a schedule or pre-release gate only.

### `turbo.json` task configuration for Python

```jsonc
{
  "globalEnv": [
    "MLFLOW_TRACKING_URI",
    "MLFLOW_EXPERIMENT_NAME",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY"
  ],
  "tasks": {
    "lint": {
      "outputs": []
    },
    "format": {
      "outputs": [],
      "cache": false
    },
    "check-types": {
      "dependsOn": ["^check-types"],
      "outputs": []
    },
    "test": {
      "outputs": ["coverage/**", ".coverage"],
      "inputs": [
        "src/**/*.py",
        "tests/**/*.py",
        "pyproject.toml",
        "uv.lock"
      ]
    },
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

Adding `pyproject.toml` and `uv.lock` to `inputs` ensures dependency changes bust the test cache. MLflow env vars in `globalEnv` are forwarded to all Python processes — without this, MLflow silently falls back to local SQLite tracking. `test:eval` is never cached (`cache: false`) because results depend on live LLM responses.

---

## Step 4 — Validate

- [ ] Python app directory is listed in `pnpm-workspace.yaml` (directly or via glob)
- [ ] `package.json` shim exists with `name` and `scripts` fields
- [ ] `pyproject.toml` uses `[dependency-groups]` (PEP 735), not `[tool.uv.dev-dependencies]`
- [ ] `pyproject.toml` exists with Python deps managed by uv
- [ ] `turbo run lint check-types test` reaches the Python packages and runs without error
- [ ] `turbo.json` `test` task uses `-m "not eval"` to exclude LLM evaluation tests
- [ ] `turbo.json` `globalEnv` includes `MLFLOW_TRACKING_URI` and `MLFLOW_EXPERIMENT_NAME`
- [ ] `turbo.json` `test` task `inputs` includes `src/**/*.py`, `tests/**/*.py`, `pyproject.toml`, and `uv.lock`
- [ ] CI runs `uv lock --frozen --check` before `uv sync` to validate the lockfile
- [ ] `uv.lock` is committed (required for reproducible builds)
- [ ] No attempt to import Python types directly in TypeScript (cross-language contracts use OpenAPI or duplicated models)

---

## Reference Files

- [references/uv-setup.md](references/uv-setup.md) — `uv` installation, `pyproject.toml` structure with PEP 735 `[dependency-groups]`, uv workspaces for multiple Python packages, Ruff and Pyright setup, version conflict strategy. **Load when setting up or configuring Python tooling.**
- [references/python-tasks.md](references/python-tasks.md) — Canonical `package.json` shim, full `turbo.json` task config with inputs/outputs, CI flags (`--frozen`, `--no-project`), caching Python tasks. **Load when wiring Python tasks into Turborepo.**
- [references/polyglot-limitations.md](references/polyglot-limitations.md) — What Turborepo does and does not do for Python, cross-language contract patterns, alternatives (Pants, moon, Taskworld pattern). **Load when evaluating the approach or explaining limitations.**

---

## Source Documentation

All content is grounded in [turborepo.dev/docs](https://turborepo.dev/docs), [docs.astral.sh/uv](https://docs.astral.sh/uv), maintainer guidance from [github.com/vercel/turborepo/discussions/1077](https://github.com/vercel/turborepo/discussions/1077) (Python in Turborepo), and community patterns from [rdrn.me/postmodern-python](https://rdrn.me/postmodern-python/) (v2.x).

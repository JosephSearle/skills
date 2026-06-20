# turbo.json Configuration Reference

> Authority: [turborepo.dev/docs/reference/configuration](https://turborepo.dev/docs/reference/configuration) (v2.x)

Turborepo v2 uses `"tasks"` as the top-level key. `"pipeline"` was removed in v2.0 (June 2024) and the validator rejects it silently — this is the most common misconfiguration.

---

## Schema overview

```jsonc
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "<task-name>": {
      "dependsOn": [],
      "outputs": [],
      "inputs": [],
      "cache": true,
      "persistent": false,
      "interruptible": false,
      "env": [],
      "globalEnv": [],
      "passThroughEnv": []
    }
  },
  "globalEnv": [],
  "globalDependencies": [],
  "ui": "tui"
}
```

---

## `dependsOn`

Controls execution ordering.

| Value | Meaning |
|-------|---------|
| `"^build"` | Run this task's `build` in all **topological dependencies** first (dep packages) |
| `"build"` | Run `build` in the **same package** before this task |
| `"web#build"` | Run `build` in the specific `web` package first |
| `[]` (empty) | No ordering; tasks can run in any order or in parallel |

WRONG:
```jsonc
// v1 — rejected by v2 schema validator
{
  "pipeline": {
    "build": { "dependsOn": ["^build"] }
  }
}
```

CORRECT:
```jsonc
{
  "tasks": {
    "build": { "dependsOn": ["^build"] }
  }
}
```

---

## `outputs`

File globs to cache after the task runs. **No `outputs` = no file caching** (only logs are replayed on cache hit).

```jsonc
{
  "tasks": {
    "build": {
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "test": {
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    }
  }
}
```

Use `!` to exclude sub-paths from caching (Next.js build cache should not be stored in Turborepo cache).

---

## `inputs`

File globs that contribute to the cache hash. Defaults to all git-tracked files in the package. Use `$TURBO_DEFAULT$` to extend rather than replace the default.

```jsonc
{
  "tasks": {
    "build": {
      "inputs": ["$TURBO_DEFAULT$", "!README.md"]
    },
    "test": {
      "inputs": ["src/**", "tests/**", "pyproject.toml", "uv.lock"]
    }
  }
}
```

Add `.env` files to `inputs` explicitly — they are not auto-included:
```jsonc
{
  "tasks": {
    "build": {
      "inputs": ["$TURBO_DEFAULT$", ".env", ".env.local"]
    }
  }
}
```

---

## `cache`

Set `false` for tasks that must always re-run (e.g. `dev`, `start`). Default is `true`.

```jsonc
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## `persistent` and `interruptible`

`persistent: true` marks long-running processes (dev servers, `tsc --watch`). Turborepo will not allow other tasks to depend on a persistent task.

`interruptible: true` is used with `turbo watch`: when a dependency changes, Turborepo sends SIGTERM and restarts the task. For tools without built-in watch modes.

```jsonc
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "codegen": {
      "interruptible": true
    }
  }
}
```

---

## `env`, `globalEnv`, `passThroughEnv`

| Key | Scope | Effect on cache |
|-----|-------|----------------|
| `env` (per-task) | Hashed per-task | Value changes bust that task's cache |
| `globalEnv` (root) | Hashed for all tasks | Value changes bust every task |
| `passThroughEnv` | Passed through | Does NOT contribute to hash |

WRONG — env var read in code but not declared:
```jsonc
// Database URL read in build, not declared → poisoned cache
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
  }
}
```

CORRECT:
```jsonc
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "env": ["DATABASE_URL", "NODE_ENV"]
    }
  }
}
```

Use `eslint-config-turbo`'s `turbo/no-undeclared-env-vars` rule to lint this automatically.

---

## Per-package `turbo.json`

Packages can have their own `turbo.json` to extend or override the root:

```jsonc
// packages/ui/turbo.json
{
  "extends": ["//"],
  "tasks": {
    "build": {
      "outputs": ["dist/**", "src/**/*.css.js"]
    }
  }
}
```

`extends: ["//"]` inherits from the root. Array fields **replace** root values by default. Use `$TURBO_EXTENDS$` to append instead:

```jsonc
{
  "tasks": {
    "build": {
      "outputs": ["$TURBO_EXTENDS$", "src/**/*.css.js"]
    }
  }
}
```

---

## Root-level tasks (`//#task`)

Tasks scoped to the workspace root (not any package). Use only when the task genuinely cannot live in a package.

```jsonc
{
  "tasks": {
    "//#typecheck": {
      "outputs": []
    }
  }
}
```

---

## v1 → v2 breaking changes cheatsheet

| v1 | v2 | Notes |
|----|----|-------|
| `"pipeline"` key | `"tasks"` key | Validator rejects `pipeline` |
| `--ignore` flag | `--filter` flag | `--ignore` removed |
| `$VAR` in `dependsOn` | `"env": ["VAR"]` | Env-var syntax in dependsOn removed |
| `globalDotEnv`/`dotEnv` | `"inputs": [".env"]` | dotEnv keys removed |
| `outputMode` | `outputLogs` | Renamed |
| Opt-in strict env mode | Strict env mode default | v2 default; no opt-out |

Run `npx @turbo/codemod migrate` to automate the migration.

---

## Common misconfigs table

| Misconfiguration | Symptom | Fix |
|-----------------|---------|-----|
| Missing `outputs` | Task runs but no file cache; logs-only replay | Add `"outputs": ["dist/**"]` |
| Env var not in `env` | Cache returns stale build with wrong env values | Add var to `"env"` |
| `.env` not in `inputs` | `.env` change doesn't bust cache | Add `".env"` to `"inputs"` |
| `persistent` task depended on | `turbo` errors on startup | Nothing may `dependsOn` a persistent task |
| `"pipeline"` key used | Schema validation error | Rename to `"tasks"` |
| Broad `globalDependencies` | Universal cache miss on any root file change | Tighten globs or move files |
| `^build` vs `build` confusion | Task runs before deps build | Use `^build` for cross-package ordering |

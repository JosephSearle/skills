# turbo watch Reference

> Authority: [turborepo.dev/docs/reference/watch](https://turborepo.dev/docs/reference/watch) and [turborepo.dev/docs/crafting-your-repository/developing-applications](https://turborepo.dev/docs/crafting-your-repository/developing-applications) (v2.x)

`turbo watch` is a dependency-aware file watcher, stable since Turborepo 2.0. It replaces the pattern of running multiple `--watch` processes in separate terminals.

---

## `turbo run` vs `turbo watch`

| | `turbo run` | `turbo watch` |
|--|-------------|--------------|
| Execution | Once per task graph | Continuously, re-runs on file changes |
| Cache | Yes | Only for non-persistent tasks |
| Dev servers | Must use `persistent: true` | Same |
| Use case | CI, one-off builds | Local development |

---

## `persistent: true`

Mark long-running processes that never exit (dev servers, `tsc --watch`, `vite dev`). Turborepo will:
- Start them and keep them running
- Prevent any task from declaring a `dependsOn` them (would deadlock)
- Not wait for them to exit before the run is considered "started"

```jsonc
// turbo.json
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

```jsonc
// apps/web/package.json
{
  "scripts": {
    "dev": "next dev"
  }
}
```

WRONG — task depending on a persistent task:
```jsonc
{
  "tasks": {
    "test:e2e": {
      "dependsOn": ["dev"]  // dev is persistent — turbo will reject this
    }
  }
}
```

---

## `interruptible: true`

For tasks that **don't** have a built-in watch mode but need to restart when dependencies change. When `turbo watch` detects a change, it sends SIGTERM to the running process and re-runs the task.

```jsonc
{
  "tasks": {
    "codegen": {
      "interruptible": true,
      "outputs": ["generated/**"]
    }
  }
}
```

---

## Dependency re-runs

When `turbo watch` is running and you edit a file in `@repo/ui`:

1. Turborepo re-runs the changed task in `@repo/ui` (e.g. `build`)
2. Turborepo then re-runs tasks in any package that **depends on** `@repo/ui` (e.g. `apps/web` `build`)
3. Each affected persistent process is notified (HMR, if the framework supports it)

This replaces manually restarting downstream processes after editing shared packages.

---

## Infinite loop risk

If a task writes files that are **git-tracked** and those files are in the task's `inputs`, `turbo watch` will loop infinitely: the task writes → inputs change → task re-runs → task writes again.

Fix: either exclude the generated files from git tracking (`.gitignore`) or exclude them from `inputs`:

```jsonc
{
  "tasks": {
    "codegen": {
      "inputs": ["$TURBO_DEFAULT$", "!generated/**"],
      "outputs": ["generated/**"],
      "interruptible": true
    }
  }
}
```

---

## Recommended `dev` task pattern

```jsonc
// Root turbo.json
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^build"]
    }
  }
}
```

```jsonc
// Root package.json
{
  "scripts": {
    "dev": "turbo watch dev"
  }
}
```

This ensures shared packages are built once before dev servers start, then `turbo watch` handles incremental rebuilds.

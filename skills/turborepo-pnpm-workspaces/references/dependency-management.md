# Dependency Management Reference

> Authority: [turborepo.dev/docs/crafting-your-repository/managing-dependencies](https://turborepo.dev/docs/crafting-your-repository/managing-dependencies) and [pnpm.io/workspaces](https://pnpm.io/workspaces) (v2.x)

---

## Peer dependencies in shared UI packages

Shared component libraries (e.g. `@repo/ui`) should declare framework dependencies as `peerDependencies` — not `dependencies`. This prevents duplicate React instances (a common React error) and lets each consuming app provide the correct version.

```json
// packages/ui/package.json
{
  "name": "@repo/ui",
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  }
}
```

The `devDependencies` entry provides the version used for local development and testing; `peerDependencies` declares the contract. Consuming apps install `react` themselves.

---

## Root vs per-package installs

| Dependency type | Where to install | Command |
|----------------|-----------------|---------|
| App-specific runtime dep | In the app package | `pnpm add react --filter=@repo/web` |
| Shared UI library dep | `peerDependencies` in the library, `devDependencies` for dev | (see above) |
| Repo-wide tooling (turbo, husky, changesets) | Workspace root `-w` | `pnpm add -D turbo -w` |
| Linting/testing config | In the `tooling/*` package that exports it | `pnpm add -D eslint --filter=@repo/eslint-config` |

WRONG — all deps at root:
```bash
pnpm add react react-dom next -w   # makes react a root dep, bleeds into all packages
```

CORRECT — app-specific:
```bash
pnpm add react react-dom next --filter=@repo/web
```

---

## Overrides for version conflicts

When two packages require incompatible versions of the same dep, use pnpm overrides to force a resolution:

```json
// Root package.json
{
  "pnpm": {
    "overrides": {
      "semver": "^7.5.4"
    }
  }
}
```

Use sparingly — overrides can cause subtle breakage if the forced version is incompatible with a transitive consumer.

---

## Circular dependency detection and resolution

Turborepo treats circular dependencies as fatal errors with no bypass flag.

**Detection:**
```bash
pnpm ls --recursive 2>&1 | grep -i circular
# or
turbo run build  # will error with "cyclic dependency detected"
```

**Common causes:**

| Cause | Example | Fix |
|-------|---------|-----|
| Co-located test imports sibling as devDep | `packages/a` test imports `packages/b`, `packages/b` imports `packages/a` | Extract shared test fixtures to `packages/test-utils` |
| Config packages reference each other | `@repo/eslint-config` imports `@repo/typescript-config` which imports `@repo/eslint-config` | Remove the circular import; config packages must not depend on each other |
| Shared code split across two packages that import each other | `@repo/auth` imports `@repo/database`, `@repo/database` imports `@repo/auth` | Extract the shared primitive (e.g. user types) to a third `@repo/types` package |

---

## Checking what's installed

```bash
# List all packages in the workspace
pnpm ls --recursive --depth=0

# Show dependency tree for a specific package
pnpm ls --filter=@repo/web --depth=3

# Check for outdated deps
pnpm outdated --recursive

# Audit for vulnerabilities
pnpm audit --recursive
```

---

## Phantom dependency prevention

pnpm's strict `node_modules` structure (symlinked, not hoisted flat) means packages can only import deps they explicitly declare. A package that works in npm may silently fail with pnpm if it relied on a hoisted dep.

If a package errors with "cannot find module X" and X is not in its `package.json`, add X as an explicit dep:
```bash
pnpm add X --filter=@repo/affected-package
```

Do not hoist the dep to root to work around this — that defeats the strictness.

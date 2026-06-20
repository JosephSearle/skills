---
name: turborepo-pnpm-workspaces
description: >
  Configure and manage pnpm workspaces in a Turborepo monorepo. Use when setting up
  pnpm-workspace.yaml, using the workspace:* protocol for internal packages, configuring
  pnpm catalogs to share dependency versions, managing where dependencies are installed,
  resolving hoisting issues, or debugging circular dependency errors. Triggers on:
  pnpm-workspace.yaml, workspace:* protocol, pnpm catalogs, catalog: references,
  dependency deduplication, "install deps in monorepo", peer dependencies in shared
  packages, or circular dependency errors. Not for turbo.json task configuration,
  TypeScript compiler setup, Next.js or NestJS framework config — use turborepo-core,
  turborepo-typescript, turborepo-nextjs, or turborepo-nestjs for those.
---

# turborepo-pnpm-workspaces

pnpm is the recommended package manager for Turborepo monorepos. Its content-addressed store deduplicates packages across the entire machine, its strict symlinked `node_modules` prevents phantom dependency access, and `pnpm-workspace.yaml` gives Turborepo the package graph it needs to build the task execution order.

---

## Core Philosophy

**Install dependencies in the package that uses them, not the root.** Putting everything in the workspace root makes every package implicitly depend on every dependency — defeating the purpose of a monorepo and poisoning Turborepo's cache. The root `package.json` should contain only `devDependencies` that truly apply to the entire repo (e.g. turbo itself, husky).

**Never use `../` to reference another package's code.** Add it as a dependency (`workspace:*`) and import it by name instead.

**Circular dependencies are fatal.** Turborepo has no flag to bypass them; the only fix is restructuring the dependency graph.

---

## Step 1 — Detect workspace configuration state

Check the workspace configuration:

```
Does pnpm-workspace.yaml exist at the repo root?
  └─ NO  → create pnpm-workspace.yaml (go to Step 3, setup mode)
  └─ YES
       Does root package.json have "private": true?
         └─ NO  → add it (publishable root is a misconfiguration)
       Does root package.json have "packageManager" field?
         └─ NO  → add it (required by Turborepo v2)
       Load references/workspace-setup.md and proceed to Step 2
```

---

## Step 2 — Load reference files

Select reference files based on what the user needs:

```
What is the primary task?
  ├─ Setting up workspace layout or adding new packages
  │    → load references/workspace-setup.md
  ├─ Sharing a dependency version across the workspace
  │    → load references/catalogs.md
  └─ Managing dependencies (peer deps, installs, circulars, conflicts)
       → load references/dependency-management.md
```

---

## Step 3 — Execute

### Setup mode

**`pnpm-workspace.yaml`** declares which directories are packages:

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
```

**Root `package.json`** must be private and declare the package manager:

```json
{
  "name": "my-monorepo",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo watch dev",
    "lint": "turbo run lint",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.9.18"
  }
}
```

### Adding a dependency to a specific package

WRONG — installing in root:
```bash
pnpm add react -w        # -w = workspace root; wrong for app-specific deps
```

CORRECT — installing in the package that uses it:
```bash
pnpm add react --filter=@repo/web
```

### Referencing an internal package

WRONG — relative path import:
```json
{
  "dependencies": {
    "@repo/ui": "../../packages/ui"
  }
}
```

CORRECT — workspace protocol:
```json
{
  "dependencies": {
    "@repo/ui": "workspace:*"
  }
}
```

`workspace:*` is rewritten to the concrete version on publish (via `pnpm publish` or Changesets).

---

## Step 4 — Validate

- [ ] `pnpm-workspace.yaml` exists at root and lists all package directories
- [ ] Root `package.json` has `"private": true`
- [ ] Root `package.json` has `"packageManager": "pnpm@<version>"`
- [ ] All internal packages use `"workspace:*"` (or `"workspace:^"` for range) in `dependencies`
- [ ] No package uses `"../path/to/other"` to reference a sibling
- [ ] `pnpm-lock.yaml` is committed (required for Turborepo to build the package graph)
- [ ] No circular dependencies (run `pnpm ls --recursive` and look for "circular" warnings)

---

## Reference Files

- [references/workspace-setup.md](references/workspace-setup.md) — `pnpm-workspace.yaml` syntax, directory conventions, `workspace:*` protocol, `packageManager` field, monorepo bootstrapping commands. **Load when setting up or restructuring the workspace.**
- [references/catalogs.md](references/catalogs.md) — pnpm catalogs for shared dependency version management: `catalog:` and named `catalogs:`, when to use vs `workspace:*`. **Load when managing shared external dependency versions.**
- [references/dependency-management.md](references/dependency-management.md) — Peer dependency patterns for shared UI packages, install commands, override strategies, circular dependency detection and resolution. **Load when managing dependencies or debugging dep errors.**

---

## Source Documentation

All content is grounded in [pnpm.io/workspaces](https://pnpm.io/workspaces), [pnpm.io/catalogs](https://pnpm.io/catalogs), and [turborepo.dev/docs/crafting-your-repository/managing-dependencies](https://turborepo.dev/docs/crafting-your-repository/managing-dependencies) (v2.x).

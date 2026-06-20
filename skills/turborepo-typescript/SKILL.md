---
name: turborepo-typescript
description: >
  Configure TypeScript in a Turborepo monorepo: shared tsconfig packages, internal
  package compilation strategy selection (JIT vs compiled vs transit), TypeScript
  project references decision, Node subpath imports, and shared type packages. Use
  when creating @repo/typescript-config, deciding how to structure a shared package,
  adding a @repo/types package, or debugging TypeScript errors caused by the wrong
  internal package strategy. Triggers on: tsconfig sharing, @repo/typescript-config,
  JIT vs compiled packages, transpilePackages, composite: true decision, subpath
  imports, #internal paths, shared types, internal package exports, "go to definition
  doesn't work". Not for turbo.json task config, pnpm workspace setup, Next.js-specific
  transpilePackages, or NestJS build setup — use turborepo-core,
  turborepo-pnpm-workspaces, turborepo-nextjs, or turborepo-nestjs for those.
---

# turborepo-typescript

TypeScript in a Turborepo monorepo has one decision that dominates everything else: which **internal package strategy** to use for each shared package. Get this wrong and you'll hit either "cannot find module" errors in production (JIT used with a Node server) or unnecessary build steps that break incremental compilation.

---

## Core Philosophy

**Three strategies, not one.** Turborepo documents three ways to structure a TypeScript package: Just-in-Time (JIT), Compiled, and Transit Node. They are not interchangeable — the right choice depends on who consumes the package and how they build.

**TypeScript Project References are not recommended.** The official Turborepo team position ([Jared Palmer, 2024](https://turborepo.com/blog/you-might-not-need-typescript-project-references)): project references add another layer of configuration and create a redundant caching layer alongside Turborepo's own. Use internal packages instead.

**`tsserver` cross-package navigation** works best when JIT packages export `.ts` source directly — editors resolve types without a build step. Compiled packages require either a build step or `sourceRoot` / declaration maps for "go to definition" to work.

---

## Step 1 — Detect existing TypeScript structure

```
Does packages/typescript-config (or tooling/typescript-config) exist?
  └─ NO  → create @repo/typescript-config (go to Step 3, tsconfig mode)
  └─ YES → load references/tsconfig-patterns.md and proceed

For each shared package, determine its current strategy:
  - Exports .ts files directly (no build step) → JIT
  - Builds to dist/, has "exports" field pointing to dist/ → Compiled
  - Re-exports from another package → Transit Node
  - Has tsconfig.json with "composite: true" → Project References (not recommended)
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Choosing a strategy for a new or existing internal package
  │    → load references/internal-packages.md (always)
  ├─ Creating or updating @repo/typescript-config
  │    → load references/tsconfig-patterns.md
  └─ Both
       → load both reference files
```

---

## Step 3 — Execute

### Strategy selection

Use this decision table before creating or converting any internal package:

| Who consumes the package? | Build tool | Recommended strategy |
|--------------------------|------------|---------------------|
| Next.js app | Webpack/Turbopack (bundles deps) | JIT |
| Vite app | Vite (bundles deps) | JIT |
| NestJS app | `tsc` (does NOT bundle) | Compiled |
| Another shared package | Depends on its consumers | Match the consumer's constraint |
| CLI tool | `tsc` or `tsup` | Compiled |

See `references/internal-packages.md` for full strategy documentation.

### Create `@repo/typescript-config`

```bash
mkdir -p tooling/typescript-config
cd tooling/typescript-config
```

```json
// tooling/typescript-config/package.json
{
  "name": "@repo/typescript-config",
  "version": "0.0.0",
  "private": true,
  "files": ["*.json"],
  "license": "MIT"
}
```

Create `base.json`, then framework-specific variants. See `references/tsconfig-patterns.md` for the recommended compiler options.

Packages extend the config:
```json
// apps/web/tsconfig.json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src/**/*", "next-env.d.ts"]
}
```

### Add type-check as a Turborepo task

```jsonc
// turbo.json
{
  "tasks": {
    "check-types": {
      "dependsOn": ["^check-types"]
    }
  }
}
```

```json
// Every package's package.json
{
  "scripts": {
    "check-types": "tsc --noEmit"
  }
}
```

Config-only packages (like `@repo/typescript-config`) need no `check-types` script.

---

## Step 4 — Validate

- [ ] `@repo/typescript-config` exists and exports at least `base.json`
- [ ] All packages extend from `@repo/typescript-config`, not from each other
- [ ] JIT packages do NOT have `"composite": true` in tsconfig
- [ ] JIT packages do NOT use `"paths"` in tsconfig — use Node subpath `imports` instead
- [ ] Compiled packages have `"exports"` field in `package.json` pointing to `dist/`
- [ ] NestJS apps and Node CLI tools do NOT consume JIT packages (use compiled)
- [ ] `check-types` task exists in `turbo.json` with `"dependsOn": ["^check-types"]`

---

## Reference Files

- [references/internal-packages.md](references/internal-packages.md) — JIT, Compiled, and Transit Node strategies with a decision table, `package.json` and `tsconfig.json` examples for each, Node subpath imports, and cross-language type contracts. **Load for any package strategy decision.**
- [references/tsconfig-patterns.md](references/tsconfig-patterns.md) — `@repo/typescript-config` structure, `base.json` compiler options, framework-specific variants (`nextjs.json`, `nestjs.json`, `react-library.json`), and when `composite: true` is correct. **Load when creating or auditing tsconfig packages.**

---

## Source Documentation

All content is grounded in [turborepo.dev/docs/guides/tools/typescript](https://turbo.build/repo/docs/guides/tools/typescript), [turborepo.dev/docs/core-concepts/internal-packages](https://turborepo.dev/docs/core-concepts/internal-packages), and [turborepo.com/blog/you-might-not-need-typescript-project-references](https://turborepo.com/blog/you-might-not-need-typescript-project-references) (v2.x).

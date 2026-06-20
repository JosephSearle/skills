---
name: turborepo-nestjs
description: >
  Configure a NestJS service inside a Turborepo monorepo. Use when setting up nest
  build in a monorepo, fixing "cannot find module" errors caused by JIT internal
  packages imported by a NestJS service, converting internal packages from JIT to
  compiled, wiring @repo/database or @repo/auth shared packages, configuring
  turbo prune for Docker multi-stage builds, or adding a Prisma db:generate task.
  Triggers on: NestJS in a monorepo, nest build with workspace packages, compiled
  vs JIT for NestJS, tsup for NestJS, turbo prune Docker, Prisma in a monorepo,
  @repo/database NestJS, "cannot find module at runtime in NestJS". Not for general
  turbo.json config, pnpm workspaces, Next.js apps, or Python — use turborepo-core,
  turborepo-pnpm-workspaces, turborepo-nextjs, or turborepo-python-polyglot for those.
---

# turborepo-nestjs

NestJS services have a critical incompatibility with the JIT internal package pattern that works seamlessly for Next.js. `nest build` uses `tsc` under the hood, and **`tsc` does not bundle workspace dependencies** — it only compiles TypeScript to JavaScript. A JIT package imported by a NestJS service will be absent from `dist/` at runtime, causing a "cannot find module" error that only surfaces in production, not during development.

---

## Core Philosophy

**Always use Compiled internal packages with NestJS.** The JIT pattern (exporting `.ts` source) is incompatible with `tsc`-built Node servers. Every internal package consumed by a NestJS service must be either: (a) compiled to `dist/` before the NestJS build, or (b) bundled into the NestJS output via `tsup`. There are no exceptions.

**Use Vitest.** `@nestjs/testing`'s `Test.createTestingModule` creates a NestJS DI context and is compatible with any test runner. Swap Jest spy APIs for `vi.*` equivalents from Vitest. See `references/compiled-packages.md` and `turborepo-core/references/tooling-standards.md` for the Vitest setup pattern.

---

## Step 1 — Detect NestJS build setup

```
Inspect apps/api/package.json:
  └─ Does "build" use "nest build"?
       └─ YES → check internal package strategy (Step below)
       └─ NO and uses "tsup" → already using bundler; verify config

For each internal package imported by apps/api:
  └─ Does its package.json "exports" point to .ts/.tsx files?
       └─ YES → JIT package; incompatible with NestJS tsc build → convert to Compiled
       └─ NO  → Compiled or already dist/ → safe
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Fixing "cannot find module" or converting JIT → compiled packages
  │    → load references/compiled-packages.md (always for NestJS setup)
  ├─ Building a Docker image for the NestJS service
  │    → load references/docker-prune.md
  └─ Setting up Prisma with NestJS in a monorepo
       → load references/prisma-setup.md
```

---

## Step 3 — Execute

### Canonical NestJS app setup in turbo.json

```jsonc
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "outputs": ["coverage/**"]
    },
    "test:e2e": {
      "outputs": []
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    }
  }
}
```

### Canonical NestJS `apps/api/package.json`

```json
{
  "name": "@repo/api",
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "test": "vitest run",
    "test:e2e": "vitest run --config vitest-e2e.config.ts",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@repo/database": "workspace:*",
    "@repo/auth": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@repo/typescript-config": "workspace:*",
    "vitest": "catalog:",
    "@vitest/coverage-v8": "catalog:",
    "typescript": "catalog:"
  }
}
```

### Convert a JIT package to Compiled for NestJS

See `references/compiled-packages.md` for the full migration. Short form:

1. Add a `build` script to the package (`"build": "tsc"` or `"build": "tsup ./src/index.ts"`)
2. Update `package.json` `exports` to point to `dist/` output
3. Add `"outputs": ["dist/**"]` to `turbo.json` for that package's `build` task
4. Confirm `apps/api` `turbo.json` `build` has `"dependsOn": ["^build"]` so the package builds first

---

## Step 4 — Validate

- [ ] No internal package consumed by `apps/api` exports `.ts`/`.tsx` source (all must be Compiled)
- [ ] `apps/api/package.json` `build` uses `nest build` or `tsup`
- [ ] `apps/api` `turbo.json` (or root) has `"build": { "dependsOn": ["^build"] }`
- [ ] Each internal package has a `build` task and `"outputs": ["dist/**"]` in turbo.json
- [ ] If using Prisma: `db:generate` task exists and `build` depends on it
- [ ] Vitest config exists (`vitest.config.ts`) with `environment: "node"`; `vi.*` spy APIs replace Jest's `jest.*`
- [ ] Docker: `turbo prune api --docker` is used in Dockerfile, not a full COPY

---

## Reference Files

- [references/compiled-packages.md](references/compiled-packages.md) — Why JIT fails for `tsc`-built Node servers, two fix approaches (compile to `dist/` vs tsup bundling), turbo.json wiring, Docker workaround. **Always load for NestJS internal package setup.**
- [references/docker-prune.md](references/docker-prune.md) — `turbo prune api --docker` output structure, canonical 4-stage Dockerfile for NestJS + pnpm, Prisma considerations, non-root user, `pnpm deploy` vs `turbo prune`. **Load for Docker/production build setup.**
- [references/prisma-setup.md](references/prisma-setup.md) — `db:generate` task, `@repo/database` wrapper pattern, making `build` depend on `db:generate`, Prisma binary targets for Docker. **Load when using Prisma in a NestJS monorepo.**

---

## Source Documentation

All content is grounded in [turborepo.dev/docs/guides/tools/docker](https://turborepo.dev/docs/guides/tools/docker), [turborepo.dev/docs/core-concepts/internal-packages](https://turborepo.dev/docs/core-concepts/internal-packages), and the [vercel/turborepo Discussion #4509](https://github.com/vercel/turborepo/discussions/4509) (NestJS + workspace packages, the canonical community reference for this problem).

---
name: turborepo-core
description: >
  Configure and operate a Turborepo v2 monorepo build system. Use when working with
  turbo.json task definitions (tasks, dependsOn, outputs, inputs, env, cache),
  running turbo run or turbo watch, applying --filter or --affected for targeted
  execution, choosing an internal package strategy, or migrating from v1 to v2
  (pipeline→tasks). Triggers on: turbo.json configuration, task orchestration,
  dependsOn setup, caching debug, --filter syntax, monorepo pipeline setup, turbo
  watch, turbo gen, turbo boundaries, or "why is my cache missing". Not for pnpm
  workspace setup, shared tsconfig packages, Next.js-specific config, NestJS-specific
  config, Python polyglot monorepos, or Docker/production build optimisation — use the
  turborepo-pnpm-workspaces, turborepo-typescript, turborepo-nextjs, turborepo-nestjs,
  or turborepo-python-polyglot skills for those.
---

# turborepo-core

Turborepo v2 is a high-performance build system for JavaScript and TypeScript monorepos. It orchestrates tasks across packages in topological order, caches outputs by content hash, and replays results when nothing has changed — turning slow CI pipelines into near-instant ones.

---

## Core Philosophy

**Package-task-first.** Task logic lives in each package's `package.json` `scripts`; `turbo.json` at the root only declares the orchestration graph (ordering, caching, env). Root-level tasks (`//#task`) exist only for things that genuinely cannot live in a package.

**`turbo run` in scripts; bare `turbo` only in terminals.** CI pipelines and `package.json` scripts must use `turbo run <task>` explicitly — the bare alias is for human convenience only.

**The single biggest footgun in v2:** Turborepo 2.0 (shipped June 4, 2024) renamed the top-level `pipeline` key in `turbo.json` to `tasks`. The v2 schema validator rejects `pipeline` with no warning beyond a parse error. Every pre-2024 tutorial, blog post, and Stack Overflow answer is wrong on this point. Migrate with `npx @turbo/codemod migrate`.

---

## Step 1 — Detect version and configuration state

Check the installed Turborepo version and the shape of the existing `turbo.json`:

```
Does turbo.json exist?
  └─ NO → scaffold a new turbo.json (go to Step 3, configure mode)
  └─ YES
       Does it contain a "pipeline" key?
         └─ YES → v1 config detected; flag for migration (go to Step 3, migrate mode)
         └─ NO
              Does it contain a "tasks" key?
                └─ YES → v2 config; proceed to Step 2
                └─ NO  → empty or schema-only config; proceed to Step 2
```

Check version via `package.json` `packageManager` field (e.g. `"turbo": "^2.9.18"`) or `node_modules/.bin/turbo --version`. Pin to the v2 line; `$TURBO_JIT$` and Boundaries are still pre-release / experimental.

---

## Step 2 — Load reference files

Select reference files based on what the user needs:

```
What is the primary task?
  ├─ Configure turbo.json tasks, inputs, outputs, env
  │    → load references/configuration.md (always)
  ├─ Debug a cache miss or investigate cache behaviour
  │    → load references/caching.md
  ├─ Run only affected/changed packages
  │    → load references/filtering.md
  ├─ Set up turbo watch for development
  │    → load references/watch.md
  ├─ Configure Biome, Vitest, tsc --noEmit, or detect-secrets
  │    → load references/tooling-standards.md
  ├─ Scaffold new packages or generators
  │    → load references/generators.md
  └─ Enforce package isolation rules
       → load references/boundaries.md (note: experimental as of v2.4)
```

For migration tasks, load `references/configuration.md`; the WRONG/CORRECT pairs there cover the full v1→v2 diff.

---

## Step 3 — Execute

### Configure mode

Build or repair `turbo.json` following the schema in `references/configuration.md`. Key decisions:

| Need | Key to use | Notes |
|------|-----------|-------|
| Run a task after its deps build | `dependsOn: ["^build"]` | `^` = topological (dependencies first) |
| Run task after another in same pkg | `dependsOn: ["lint"]` | No `^` = same-package ordering |
| Run task after a specific pkg's task | `dependsOn: ["web#build"]` | Cross-package dependency |
| Cache file artifacts | `outputs: ["dist/**"]` | Omitting outputs = logs-only cache |
| Mark long-running process | `persistent: true` | Prevents anything depending on it |
| Pass env var into cache hash | `env: ["MY_VAR"]` | Per-task |
| Pass env var through without hashing | `passThroughEnv: ["CI"]` | Does not bust cache |
| Skip caching for dev task | `cache: false` | Always re-run |

### Migrate mode (v1 → v2)

1. Run `npx @turbo/codemod migrate` — handles `pipeline`→`tasks`, removed keys, strict env mode.
2. Verify: `turbo.json` must have `"tasks"` not `"pipeline"`.
3. Remove any `$VAR` syntax from `dependsOn`/`globalDependencies` — move to `env`/`globalEnv`.
4. Remove `globalDotEnv`/`dotEnv` — add `.env` paths to `inputs` instead.
5. Remove `--ignore` flag usage — replace with `--filter`.
6. Note: in v2 the workspace root is an **implicit dependency of all packages**; keep root source minimal to avoid universal cache misses.

### Debug-cache mode

When a task is not hitting cache, check in this order:

```
1. Is "outputs" declared? Missing outputs = no file caching, only log replay.
2. Are all relevant env vars in "env" or "globalEnv"?
   → Missing env var = cache miss on every run with that var set differently.
3. Are .env files listed in "inputs"?
   → .env not in inputs = .env changes don't bust the cache (stale reads).
4. Has a globalDependencies file changed?
   → Root changes are an implicit dep of every package in v2.
5. Is there a remote cache configured?
   → Without remote cache, CI always starts cold.
```

### Filter mode

Apply `--filter` to scope execution. See `references/filtering.md` for full syntax. Common forms:

```bash
turbo run build --filter=@repo/ui          # one package
turbo run build --filter=@repo/ui...       # package + its dependencies
turbo run build --filter=...@repo/ui       # package + its dependents
turbo run build --filter=[origin/main]     # packages changed vs main
turbo run build --affected                 # v2 flag; same as [origin/main] SCM detection
```

---

## Step 4 — Validate

Before finishing, confirm:

- [ ] `turbo.json` uses `"tasks"` not `"pipeline"`
- [ ] Every task that produces files has `"outputs"` declared (even `["dist/**"]`)
- [ ] Every env var read by task code is listed in `"env"` or `"globalEnv"` (no Biome equivalent for `eslint-config-turbo`'s rule — use `turbo run --summarize` to audit, or `@t3-oss/env-*` for runtime validation)
- [ ] `detect-secrets scan --baseline .secrets.baseline` passes in CI (see `references/tooling-standards.md`)
- [ ] `lefthook.yml` exists at repo root with `biome-check` and `detect-secrets` pre-commit commands; `"prepare": "lefthook install"` in root `package.json`
- [ ] Long-running dev processes have `"persistent": true`
- [ ] No task depends on a persistent task (Turborepo rejects this)
- [ ] `.env` files consumed at build time are listed in `"inputs"`
- [ ] `turbo run` (not bare `turbo`) is used in all `package.json` scripts and CI commands

---

## Reference Files

- [references/configuration.md](references/configuration.md) — Complete `turbo.json` schema for v2: all task keys, per-package overrides, WRONG/CORRECT anti-pattern pairs. **Load for any configuration task.**
- [references/caching.md](references/caching.md) — How the content-hash cache works, Vercel Remote Cache setup, self-hosted alternatives, cache-poisoning mitigations, common misconfigs. **Load when debugging cache misses or setting up remote caching.**
- [references/filtering.md](references/filtering.md) — Full `--filter` syntax, `--affected` flag, SCM-based filtering, `turbo query affected`. **Load when scoping task execution.**
- [references/watch.md](references/watch.md) — `turbo watch` dependency-aware watcher, `persistent` vs `interruptible`, development workflow patterns. **Load when setting up watch mode.**
- [references/generators.md](references/generators.md) — `turbo gen workspace`, custom Plop generators, `@turbo/gen` types. **Load when scaffolding new packages.**
- [references/tooling-standards.md](references/tooling-standards.md) — Standard monorepo toolchain: Biome (linting + formatting, replaces eslint + prettier), Vitest (testing), tsc --noEmit (type checking), IBM detect-secrets (credential scanning), Lefthook (global pre-commit hooks). **Load when setting up or auditing tooling.**
- [references/boundaries.md](references/boundaries.md) — `turbo boundaries` tag-based isolation rules (experimental, v2.4+). **Load when enforcing package-level access control.**

---

## Source Documentation

All content is grounded in [turborepo.dev/docs](https://turborepo.dev/docs) (v2.x). The [Turborepo 2.0 release blog](https://turborepo.dev/blog/turbo-2-0) is the authoritative source for all v1→v2 breaking changes.

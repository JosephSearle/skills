---
name: apicraft-project-setup
description: >
  Bootstraps a new NestJS 11 project to a production-ready baseline in one pass.
  Covers: nest new --strict, global ValidationPipe config, @nestjs/config with
  Zod/Joi boot-time validation, Biome with NestJS-specific config, Husky + lint-staged,
  tsc --noEmit as a mandatory CI gate, and Vitest with the SWC transformer. Requires
  apicraft-context to be loaded first.
  Triggers on: "start a new project", "bootstrap", "set up NestJS", "new API",
  "project scaffolding", "nest new", "initial setup", "project structure",
  "from scratch", "greenfield".
  Not for feature modules or specific patterns — use apicraft-architecture for structure,
  apicraft-security for auth/authz setup.
version: 1.0.0
---

## Core Philosophy

A NestJS project that isn't production-ready from day one accumulates debt that's painful to retrofit. The 30-minute bootstrap in this skill covers the 10 Pareto practices from `apicraft-context` that cost the most to add later: global `ValidationPipe`, structured logging, config validation, Biome, and Vitest with SWC. These are not optional polish — they're the foundation every other skill in this plugin builds on.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ Scaffolding from scratch → load references/bootstrap.md (start here)
  ├─ Adding config validation to existing project → load references/bootstrap.md §Config validation
  ├─ Setting up Biome / linting → load references/biome-swc.md, then see apicraft-code-quality
  ├─ Setting up Vitest → load references/biome-swc.md, then see apicraft-testing
  └─ Adding Helmet / CORS / throttler → load references/bootstrap.md §Security baseline
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| `nest new`, ValidationPipe, config validation, security baseline | `references/bootstrap.md` |
| Biome + Husky setup, `tsc --noEmit`, Vitest SWC cross-reference | `references/biome-swc.md` |

## Step 3 — Execute

### 1. Scaffold

```bash
npm install -g @nestjs/cli
nest new my-api --strict --package-manager npm
cd my-api
```

### 2. Install production dependencies

```bash
# Config validation
npm install @nestjs/config zod

# Security
npm install @nestjs/throttler helmet

# Logging
npm install nestjs-pino pino-http pino-pretty

# Health checks
npm install @nestjs/terminus

# Validation
npm install class-validator class-transformer
```

### 3. Install dev dependencies

```bash
# Testing
npm install --save-dev vitest unplugin-swc @swc/core @swc/helpers @nestjs/testing supertest

# Code quality
npm install --save-dev @biomejs/biome husky lint-staged
```

### 4. Configure the application (see reference files for complete code)

- Global `ValidationPipe` → `references/bootstrap.md`
- `@nestjs/config` with Zod schema → `references/bootstrap.md`
- Helmet + CORS → `references/bootstrap.md`
- Biome `biome.json` → `apicraft-code-quality/references/biome-config.md`
- Vitest + SWC → `apicraft-testing/references/vitest-swc.md`

> 💡 **Senior insight:** Wire config validation that crashes the app on missing env *before* writing any business logic. It's a 10-minute investment that prevents production incidents where the app boots successfully but silently falls back to undefined config values — which you won't discover until a request hits the broken code path.

→ See `apicraft-testing` for full Vitest + SWC setup (vitest-swc.md is the canonical source).
→ See `apicraft-code-quality` for the full `biome.json` template (biome-config.md is the canonical source).

## Step 4 — Validate

- [ ] `nest new` run with `--strict`
- [ ] `ValidationPipe` registered globally in `main.ts` with all 4 options
- [ ] `@nestjs/config` module imported with `isGlobal: true`
- [ ] Config schema validation crashes the app on missing required env
- [ ] `biome.json` present with `"useImportType": "off"`
- [ ] `.swcrc` present with `decoratorMetadata: true`
- [ ] `vitest.config.ts` uses `swc.vite()` plugin
- [ ] Husky pre-commit hook runs `lint-staged`
- [ ] `tsc --noEmit` runs as a CI step
- [ ] `enableShutdownHooks()` called in `main.ts`

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/bootstrap.md` | `nest new`, ValidationPipe, config validation, security baseline | Bootstrapping or adding core config |
| `references/biome-swc.md` | Husky, lint-staged, `tsc --noEmit`, cross-refs to canonical sources | Toolchain setup |

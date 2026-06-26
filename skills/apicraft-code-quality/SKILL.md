---
name: apicraft-code-quality
description: >
  Code quality toolchain for NestJS TypeScript projects: Biome setup with the
  mandatory NestJS-specific useImportType:off config, TypeScript strict mode,
  tsc --noEmit as a CI gate, Husky + lint-staged pre-commit hooks, naming conventions,
  and dependency management with Renovate/Dependabot. Requires apicraft-context
  to be loaded first.
  Triggers on: "code quality", "linting", "Biome", "formatting", "TypeScript strict",
  "Husky", "pre-commit", "naming conventions", "lint-staged", "ESLint", "Prettier",
  "useImportType", "biomejs", "biome.json".
  Not for test configuration — use apicraft-testing.
version: 1.0.0
---

## Core Philosophy

Biome replaces the entire ESLint + Prettier stack with a single Rust binary that is 10–25x faster. The one mandatory NestJS-specific change is disabling `useImportType` — Biome incorrectly flags class imports as type-only when decorator metadata turns those imports into runtime values. This is a known open issue (biomejs/biome #5305), and `"off"` is the official Biome documentation recommendation. Combined with `tsc --noEmit` in CI, Biome + TypeScript strict mode covers the entire quality surface.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ Setting up Biome from scratch → load references/biome-config.md
  ├─ Migrating from ESLint + Prettier → load references/biome-config.md §Migration
  ├─ TypeScript strict mode / tsconfig settings → load references/typescript-config.md
  ├─ Setting up pre-commit hooks → load references/biome-config.md §Husky
  └─ Naming conventions for files/classes → load references/typescript-config.md §Naming
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| Biome install, `biome.json` template, Husky + lint-staged, migration | `references/biome-config.md` |
| TypeScript strict mode, `tsconfig.json` settings, naming conventions, Renovate | `references/typescript-config.md` |

## Step 3 — Execute

### Install Biome

```bash
npm install --save-dev @biomejs/biome
npx @biomejs/biome init
```

Then replace the generated `biome.json` with the NestJS template from `references/biome-config.md`.

### The critical NestJS config

```json
"style": {
  "useImportType": "off"
}
```

This single setting is non-negotiable for NestJS projects. Without it, Biome adds `import type` to class imports that are used as decorator metadata, breaking the DI container at runtime.

> ⚠️ **Gotcha:** The `useImportType` false positive affects any import used in a decorator position — `@Module({ imports: [SomeModule] })`, `@InjectRepository(UserEntity)`, `@Injectable()` on a class with typed constructor params. Biome cannot statically detect decorator metadata dependencies.

> 💡 **Senior insight:** Biome v2 (June 2025, codename Biotype) added type-aware linting rules (e.g., `noFloatingPromises`) at ~85% coverage of `@typescript-eslint`. The remaining 15% is caught by `tsc --noEmit` in CI. Running both gives 100% coverage without the performance penalty of the full TypeScript compiler in the hot loop.

→ See `references/biome-config.md` for the complete production `biome.json`.
→ See `apicraft-project-setup` for how these tools are wired together in a new project bootstrap.

## Step 4 — Validate

- [ ] `biome.json` has `"useImportType": "off"` under `style`
- [ ] `biome check .` passes with zero errors
- [ ] `tsc --noEmit` passes in CI
- [ ] Husky pre-commit hook runs `biome check --write` on staged `.ts` files
- [ ] `"strict": true` in `tsconfig.json` with `noFallthroughCasesInSwitch` and `noImplicitReturns`
- [ ] File names follow `kebab-case.type.ts` convention

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/biome-config.md` | Biome install, `biome.json` template, Husky, migration | Biome setup or migration |
| `references/typescript-config.md` | TypeScript strict mode, naming, Renovate | TypeScript config or conventions |

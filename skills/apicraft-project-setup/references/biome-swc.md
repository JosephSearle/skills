# Toolchain Setup — Biome, Husky, lint-staged, tsc

**Authority:** biomejs.dev, docs.nestjs.com/fundamentals/testing

---

## Quick Reference

| Tool | Setup source | Location |
|------|-------------|----------|
| `biome.json` template | apicraft-code-quality | `skills/apicraft-code-quality/references/biome-config.md` |
| `vitest.config.ts` + `.swcrc` | apicraft-testing | `skills/apicraft-testing/references/vitest-swc.md` |

→ Do not duplicate those files here. Read them from the canonical sources.

---

## Husky + lint-staged

```bash
npm install --save-dev husky lint-staged
npx husky init
```

`.husky/pre-commit`:

```bash
#!/bin/sh
npx lint-staged
```

`package.json`:

```json
{
  "lint-staged": {
    "*.ts": ["biome check --write --no-errors-on-unmatched"]
  }
}
```

This runs Biome check + auto-fix on staged TypeScript files only. Typical execution time: ~0.3s.

---

## tsc --noEmit as Mandatory CI Gate

Biome covers ~85% of type-aware linting. `tsc --noEmit` catches the remaining 15% (complex generics, conditional types, assignability across complex intersections).

```json
{
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

CI pipeline step order (see `apicraft-devops` for the full pipeline):

```
biome check → tsc --noEmit → vitest unit → vitest integration → E2E → build
```

Never skip `tsc --noEmit`. It's the fastest way to catch type errors before they reach production.

---

## Recommended package.json scripts

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "type-check": "tsc --noEmit",
    "test": "vitest run --exclude '**/__integration__/**' --exclude 'test/**'",
    "test:watch": "vitest --exclude '**/__integration__/**'",
    "test:integration": "vitest run --include 'src/**/__integration__/**'",
    "test:e2e": "vitest run --include 'test/**'",
    "test:cov": "vitest run --coverage"
  }
}
```

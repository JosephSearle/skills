# Vitest + SWC Setup for NestJS

**Authority:** vitest.dev/guide/comparisons, docs.nestjs.com/fundamentals/testing

---

## Why Vitest over Jest

| Dimension | Vitest | Jest |
|-----------|--------|------|
| Speed | 2–5x faster (native ESM, esbuild/Rollup) | Slower (Babel transform) |
| TypeScript | Built-in, zero config | Requires `ts-jest` |
| API compatibility | 95%+ Jest API (`describe`/`it`/`expect`/`vi.mock` mirror `jest.mock`) | — |
| Memory under long integration suites | Fewer issues | OOM issues common |
| NestJS docs position | "Framework is test-runner agnostic" | Default in NestJS docs examples |

---

## Mandatory SWC Transformer

> ⚠️ **Gotcha:** Vitest's default esbuild transformer strips TypeScript decorator metadata. NestJS's DI system requires `emitDecoratorMetadata` at runtime to resolve constructor parameter types. Without SWC, providers resolve but DI fails silently — you get `undefined` instead of injected services.

**Install:**

```bash
npm install --save-dev vitest unplugin-swc @swc/core @swc/helpers
```

**`vitest.config.ts`:**

```typescript
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // required for NestJS DI state isolation
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/*.spec.ts', '**/__integration__/**', 'test/**'],
    },
  },
  plugins: [swc.vite()],
});
```

**`.swcrc`** (required — Vitest won't pick up `tsconfig.json` decorator settings):

```json
{
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "decorators": true
    },
    "transform": {
      "legacyDecorator": true,
      "decoratorMetadata": true
    }
  }
}
```

**`package.json` test scripts:**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "test:integration": "vitest run --include '**/__integration__/**'",
    "test:e2e": "vitest run --include 'test/**'"
  }
}
```

---

## vi.mock() Hoisting Gotcha

> ⚠️ **Gotcha:** Unlike Jest, Vitest hoists `vi.mock()` calls to the top of the file — before any `const`/`let`/`var` declarations are initialized. If your mock factory references a `const` defined later in the file, it hits a temporal dead zone error at runtime.

**WRONG:**

```typescript
const mockService = { findOne: vi.fn() }; // declared after vi.mock() hoisting

vi.mock('./users.service', () => ({
  UsersService: vi.fn().mockImplementation(() => mockService), // ReferenceError!
}));
```

**CORRECT — use `vi.hoisted()`:**

```typescript
const { mockService } = vi.hoisted(() => ({
  mockService: { findOne: vi.fn() },
}));

vi.mock('./users.service', () => ({
  UsersService: vi.fn().mockImplementation(() => mockService),
}));
```

`vi.hoisted()` runs at the same time as `vi.mock()` factory evaluation, before the rest of the file initializes. Values returned from `vi.hoisted()` are safe to reference inside `vi.mock()` factories.

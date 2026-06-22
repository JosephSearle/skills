# Vitest + Carbon Setup Reference

> Authority: [vitest.dev/config](https://vitest.dev/config/) and [vitest.dev/guide/environment](https://vitest.dev/guide/environment)

Full configuration for Vitest with React Testing Library and Carbon components.

---

## Required packages

```bash
npm install --save-dev \
  vitest \
  @vitejs/plugin-react \
  @testing-library/react \
  @testing-library/user-event \
  @testing-library/jest-dom \
  jsdom \
  @vitest/coverage-v8
```

---

## vitest.config.ts

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    include: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'test/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        '.next/',
        'test/',
        '**/*.stories.*',
        'vitest.config.ts',
        'next.config.js',
        'tailwind.config.js',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

## test/setup.ts — complete polyfill file

```ts
import '@testing-library/jest-dom'

// ── Carbon requires ResizeObserver ────────────────────────────────────────────
// jsdom does not implement ResizeObserver. Without this stub, Carbon
// component tests throw "ResizeObserver is not defined".
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// ── Carbon uses matchMedia for responsive behaviour ───────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// ── IntersectionObserver (used by Carbon Modal and Tooltip) ───────────────────
global.IntersectionObserver = class IntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  root = null
  rootMargin = ''
  thresholds = []
  takeRecords(): IntersectionObserverEntry[] { return [] }
}
```

---

## TypeScript globals configuration

Ensure `test/setup.ts` types are available in test files. In `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["**/*.ts", "**/*.tsx", "test/setup.ts"]
}
```

Or in each test file (if not using `globals: true`):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
```

---

## Test file naming convention

| Type | File pattern | Location |
|------|-------------|----------|
| Unit / component | `*.test.tsx` | Alongside the component |
| Integration | `*.test.ts` | `test/integration/` |
| E2E | `*.spec.ts` | `test/e2e/` |

Example:
```
app/components/ChatInput.tsx
app/components/ChatInput.test.tsx    ← unit test
test/integration/chat-flow.test.ts   ← integration test
test/e2e/chat.spec.ts                ← Playwright E2E
```

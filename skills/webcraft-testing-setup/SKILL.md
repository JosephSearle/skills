---
name: webcraft-testing-setup
description: >
  Configure Vitest, React Testing Library, and Playwright for a Carbon Next.js app.
  Covers the jsdom ResizeObserver polyfill (required for Carbon), Carbon component
  query patterns, AI SDK useChat mocking for streaming tests, and Playwright config
  targeting OpenShift staging. Maintains cross-repo consistency with the MCP server
  repo (Vitest). Requires webcraft-tooling-setup.
  Triggers on: "set up testing", "Vitest Carbon", "React Testing Library", "Playwright",
  "component tests Carbon", "ResizeObserver jsdom", "mock useChat", "Carbon unit tests",
  "Playwright OpenShift staging", "test setup Next.js". Not for Storybook setup —
  use webcraft-tooling-setup for that.
---

# webcraft-testing-setup

Carbon components use `ResizeObserver` internally. jsdom (the browser environment used by Vitest) does not implement `ResizeObserver`. Without a polyfill, every Carbon component test throws `ResizeObserver is not defined` and fails. This is the single most common Carbon testing gotcha — fix it once in `test/setup.ts` and forget about it.

---

## Core Philosophy

**Polyfill before you test.** The `test/setup.ts` file runs before every test file. Put the `ResizeObserver` polyfill there. Put `@testing-library/jest-dom` matchers there. Do not add per-file setup — centralise it.

**Test behaviour, not implementation.** Carbon components have complex internal DOM structures. Query them via accessible roles and labels (`getByRole`, `getByLabelText`), not by class names or data-testid. This aligns with how screen readers and real users interact with the components, and it survives Carbon internal DOM changes between versions.

---

## Step 1 — Detect existing setup

```
Check package.json devDependencies:
  └─ Is vitest installed?
       └─ NO → install testing stack (Step 3 — Install)

Check root directory:
  └─ Does vitest.config.ts exist?
       └─ NO → create it (Step 3 — Vitest config)

Check test/ directory:
  └─ Does test/setup.ts exist?
       └─ NO → create it (Step 3 — Setup file)
       └─ YES → confirm ResizeObserver polyfill is present

Check package.json:
  └─ Does it have playwright installed?
       └─ NO and E2E tests needed → install (Step 3 — Playwright)
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Installing and configuring Vitest and RTL
  │    → load references/vitest-carbon-setup.md
  ├─ Writing tests for Carbon components
  │    → load references/carbon-testing-patterns.md
  ├─ Mocking the AI SDK useChat hook for chat UI tests
  │    → load references/ai-sdk-mocking.md
  └─ Setting up Playwright for E2E against OpenShift staging
       → load references/playwright-config.md
```

---

## Step 3 — Execute

### Install

```bash
npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

For E2E:
```bash
npm install --save-dev @playwright/test
npx playwright install
```

### vitest.config.ts

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules/', '.next/', 'test/', '**/*.stories.*', 'vitest.config.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### test/setup.ts (the critical file)

```ts
// test/setup.ts
import '@testing-library/jest-dom'

// Carbon uses ResizeObserver internally — jsdom doesn't implement it
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Carbon uses matchMedia — jsdom doesn't implement it
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
```

### package.json scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test"
  }
}
```

---

## Step 4 — Validate

- [ ] `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` in devDependencies
- [ ] `vitest.config.ts` has `environment: 'jsdom'` and `setupFiles: ['./test/setup.ts']`
- [ ] `test/setup.ts` has `ResizeObserver` stub and `matchMedia` stub
- [ ] `test/setup.ts` imports `@testing-library/jest-dom`
- [ ] `npm run test:run` passes on a clean project with no test files (exits 0)
- [ ] At least one Carbon component test uses `getByRole` or `getByLabelText` (not class names)
- [ ] AI SDK mock (`vi.mock('ai/react', ...)`) used in chat component tests
- [ ] Playwright config has `baseURL` set via env var, not hardcoded
- [ ] `npx playwright install` has been run (browser binaries present)

---

## Reference Files

- [references/vitest-carbon-setup.md](references/vitest-carbon-setup.md) — Full vitest.config.ts, setup.ts polyfills, coverage config, TypeScript path aliases. **Load for Vitest configuration.**
- [references/carbon-testing-patterns.md](references/carbon-testing-patterns.md) — RTL query patterns for Carbon inputs, buttons, modals, selects; firing events; async patterns. **Load when writing Carbon component tests.**
- [references/ai-sdk-mocking.md](references/ai-sdk-mocking.md) — `vi.mock('ai/react')` pattern, streaming simulation, tool invocation mocking. **Load when testing chat UI components.**
- [references/playwright-config.md](references/playwright-config.md) — Playwright config for OpenShift staging, env-based baseURL, auth setup, test structure. **Load for E2E setup.**

---

## Source Documentation

All content is grounded in [vitest.dev](https://vitest.dev/), [testing-library.com/docs/react-testing-library/intro](https://testing-library.com/docs/react-testing-library/intro/), [playwright.dev](https://playwright.dev/), and [carbondesignsystem.com/developing/testing](https://carbondesignsystem.com/developing/testing/).

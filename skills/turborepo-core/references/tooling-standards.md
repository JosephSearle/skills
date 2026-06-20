# Tooling Standards Reference

> Authority: [biomejs.dev/docs](https://biomejs.dev/docs), [vitest.dev](https://vitest.dev), [github.com/IBM/detect-secrets](https://github.com/IBM/detect-secrets), [evilmartians.com/lefthook](https://evilmartians.com/opensource/lefthook), [turborepo.dev/docs](https://turborepo.dev/docs) (v2.x)

The standard toolchain for all TypeScript/JavaScript packages in a Turborepo monorepo:

| Concern | Tool | Replaces |
|---------|------|---------|
| Linting + formatting | **Biome** (Rust binary) | eslint + prettier |
| Testing | **Vitest** | Jest / ts-jest |
| Type checking | **tsc --noEmit** | (unchanged) |
| Secret scanning | **IBM detect-secrets** | manual review |
| Pre-commit hooks | **Lefthook** (Go binary) | husky + lint-staged |

---

## Biome (linting + formatting)

Biome is a single Rust binary providing fast linting and formatting. It replaces the `eslint` + `prettier` stack with zero config required for most monorepos.

### Installation

```bash
# Install at repo root (shared across all packages)
pnpm add -D @biomejs/biome --filter=@repo/root

# Or install per-package
pnpm add -D @biomejs/biome --filter=@repo/ui
```

For a monorepo, install once at root and share the config via `biome.json`:

```bash
pnpm dlx @biomejs/biome init
```

### `biome.json` (monorepo root)

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "ignore": ["**/node_modules", "**/dist", "**/.next", "**/coverage"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  }
}
```

### Package-level scripts

All packages share the same script names; the root `biome.json` is discovered automatically:

```json
{
  "scripts": {
    "lint": "biome lint .",
    "lint:fix": "biome lint . --write",
    "format": "biome format . --write",
    "check": "biome check .",
    "check:fix": "biome check . --write"
  }
}
```

`biome check` runs both lint and format in a single pass — prefer it in CI. Use `biome lint` if you only need linting.

### turbo.json task config for Biome

```jsonc
{
  "tasks": {
    "lint": {
      "outputs": []
    },
    "format": {
      "outputs": [],
      "cache": false
    },
    "check": {
      "outputs": []
    }
  }
}
```

`format` must have `cache: false` — it mutates files and replaying a cached no-op is misleading. For CI, run `biome check --reporter=github` (outputs GitHub Actions annotations).

### Biome vs `eslint-config-turbo`

`eslint-config-turbo`'s `turbo/no-undeclared-env-vars` rule (static analysis of `process.env` access vs `turbo.json` `env` declarations) does not have a Biome equivalent. Two alternatives:

1. **`turbo run --summarize`** — generates a run summary including all env vars resolved per task; use this to audit missing declarations manually.
2. **`@t3-oss/env-*` runtime validation** — `createEnv` throws at startup if any declared var is missing; treat the thrown error as the signal that `turbo.json` is incomplete.

---

## Vitest (testing)

Vitest is the standard test runner for all TypeScript/JavaScript packages. It shares the Vite config, runs in the same process, and has a Jest-compatible API making migration straightforward.

### Installation

```bash
pnpm add -D vitest @vitest/coverage-v8 --filter=@repo/web
```

### `vitest.config.ts`

```ts
// packages/ui/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",  // or "jsdom" for browser-like environments
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
});
```

For React component testing, set `environment: "jsdom"` and install `@testing-library/react` + `@vitejs/plugin-react`.

### Package-level scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage"
  }
}
```

`vitest run` is a single pass (no watch); `vitest` enters watch mode. Always use `vitest run` in CI and Turborepo tasks.

### turbo.json task config for Vitest

```jsonc
{
  "tasks": {
    "test": {
      "outputs": ["coverage/**"],
      "inputs": [
        "src/**/*.ts",
        "src/**/*.tsx",
        "tests/**/*.ts",
        "tests/**/*.tsx",
        "vitest.config.ts"
      ]
    },
    "test:cov": {
      "outputs": ["coverage/**"],
      "inputs": [
        "src/**/*.ts",
        "src/**/*.tsx",
        "tests/**/*.ts"
      ]
    }
  }
}
```

### NestJS + Vitest

`@nestjs/testing`'s `Test.createTestingModule` creates a NestJS application context; it is compatible with any test runner. Replace jest spy APIs with `vi` equivalents:

```ts
// WRONG (Jest)
import { jest } from "@jest/globals";
const spy = jest.fn();

// CORRECT (Vitest)
import { vi } from "vitest";
const spy = vi.fn();
```

Install Vitest in a NestJS app:
```bash
pnpm add -D vitest @vitest/coverage-v8 --filter=@repo/api
```

```ts
// apps/api/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
```

---

## tsc --noEmit (type checking)

Full type checking for TypeScript applications uses `tsc --noEmit` — it type-checks without emitting output files, making it suitable as a Turborepo task separate from the build step.

```json
{
  "scripts": {
    "check-types": "tsc --noEmit"
  }
}
```

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

`dependsOn: ["^check-types"]` ensures internal packages are type-checked before their consumers — type errors in a shared package surface in the right place, not as cascading import errors in the app.

Config-only packages (e.g. `@repo/typescript-config`) do not need a `check-types` script.

---

## Global pre-commit hooks (Lefthook)

Lefthook is a Go binary pre-commit hook manager with no Node.js runtime dependency. It runs hooks in parallel, operates on staged files via `{staged_files}`, and installs via a single command. Configure it once at the monorepo root — it applies globally across all packages.

### Installation

```bash
# Install as a root devDependency (pnpm runs the postinstall hook automatically)
pnpm add -D lefthook --save-dev -W

# Initialise — creates lefthook.yml and installs git hooks
pnpm lefthook install
```

Add to root `package.json` so `pnpm install` always (re-)installs hooks:

```json
{
  "scripts": {
    "prepare": "lefthook install"
  }
}
```

### `lefthook.yml` (monorepo root)

```yaml
pre-commit:
  parallel: true
  commands:
    biome-check:
      glob: "*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc}"
      run: pnpm biome check --no-errors-on-unmatched {staged_files}

    detect-secrets:
      run: detect-secrets-hook --baseline .secrets.baseline {staged_files}

commit-msg:
  commands:
    conventional-commits:
      run: >
        echo "{1}" | grep -qP
        "^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\(.+\))?: .{1,72}"
        || (echo "Commit message must follow Conventional Commits spec" && exit 1)
```

**Why `parallel: true`:** Biome and detect-secrets are independent — running them concurrently keeps the hook under 1 second for typical staged sets.

**`{staged_files}`:** Lefthook substitutes this with the list of currently staged file paths, so hooks only run against what's being committed, not the entire repository.

**`glob` filter on biome-check:** Prevents Biome from being invoked with `.py`, `.md`, or other file types it does not handle. Lefthook applies the glob as a pre-filter before passing `{staged_files}` to the command.

### Skipping hooks when needed

```bash
# Skip all hooks for this commit (use sparingly)
LEFTHOOK=0 git commit -m "wip: skip hooks"

# Skip a specific hook
LEFTHOOK_EXCLUDE=detect-secrets git commit -m "wip"
```

### CI enforcement

Lefthook hooks are local-only — they do not run in CI. Replicate the checks as CI steps:

```yaml
# .github/workflows/ci.yml
- name: Biome check
  run: pnpm biome check .

- name: Secret scan
  run: detect-secrets scan --baseline .secrets.baseline --only-allowlisted
```

---

## IBM detect-secrets (credential leak prevention)

`detect-secrets` is a Python tool that scans for high-entropy strings and known credential patterns. It uses a baseline file to track known false positives, making it suitable for CI without constant noise.

### Installation

```bash
# Requires Python 3 (install via uv or pip)
pip install detect-secrets

# Or with uv (preferred)
uv tool install detect-secrets
```

### Create the baseline

Run this once at monorepo root. The baseline captures all currently-known secrets (expected to be zero in a clean repo — add exclusions for any false positives):

```bash
detect-secrets scan > .secrets.baseline
```

Commit `.secrets.baseline` — it tracks known false positives so future scans can ignore them.

### Pre-commit hook

The `detect-secrets` pre-commit command is declared in the global `lefthook.yml` (see the **Global pre-commit hooks** section above) — no additional config needed here.

### CI verification

Run as a separate step (not a Turborepo task — detect-secrets scans the entire repo, not per-package):

```yaml
# .github/workflows/security.yml
- name: Check for new secrets
  run: detect-secrets scan --baseline .secrets.baseline --only-allowlisted
```

This fails the CI run if any new secrets are found that are not in the baseline.

### Auditing false positives

When `detect-secrets scan` flags something that is not a real secret, add it to the baseline:

```bash
# Interactively audit flagged items
detect-secrets audit .secrets.baseline

# Or regenerate baseline after reviewing
detect-secrets scan > .secrets.baseline
```

WRONG — committing secrets directly and relying on `detect-secrets` to catch them later:
```bash
# This pattern means a secret is already in git history even if detect-secrets catches it
git add .env && git commit -m "add env vars"
```

CORRECT — detect-secrets runs as a pre-commit hook, blocking the commit before it happens:
```bash
# lefthook pre-commit fires before git allows the commit
git add .env && git commit -m "add env vars"
# → detect-secrets-hook: Potential secrets detected. Commit blocked.
```

If a secret is accidentally committed, use `git filter-repo` to purge it from history — rotating the credential is also required.

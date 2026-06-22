---
name: webcraft-tooling-setup
description: >
  Configure developer tooling for a Carbon Next.js project: Biome (lint + format
  replacing ESLint + Prettier), pre-commit hooks (Biome + tsc + detect-secrets),
  and Storybook 8 with Carbon theme support and Vitest integration.
  Maintains cross-repo consistency with the MCP server repo (Biome) and agents repo
  (pre-commit, detect-secrets).
  Triggers on: "set up Biome", "configure pre-commit", "lint TypeScript", "detect-secrets frontend",
  "replace ESLint Prettier", "set up Storybook Carbon", "configure linting", "Biome Next.js",
  "pre-commit hooks Next.js". Not for test runner setup — use webcraft-testing-setup for that.
---

# webcraft-tooling-setup

Three tools define the developer experience for this stack: **Biome** replaces ESLint + Prettier as a single binary for linting and formatting; **pre-commit** enforces Biome + TypeScript checks + secret scanning before every commit; **Storybook** provides isolated Carbon component development. Each is chosen for cross-repo consistency — Biome aligns with the MCP server repo, pre-commit + detect-secrets align with the agents repo.

---

## Core Philosophy

**One binary, zero config drift.** Biome runs lint and format in a single `npx biome check --apply`. There is no ESLint, no Prettier, no `.eslintrc`, no `.prettierrc`. One `biome.json` configures both. This eliminates the ESLint/Prettier conflict problem (formatter changes breaking lint rules) and the config-drift problem (different settings in different repos).

**Pre-commit gates are not optional.** The `detect-secrets` hook prevents API keys, tokens, and credentials from entering the repository. This is especially important for a team that handles LangGraph backend tokens, MLflow credentials, and OpenShift secrets. The pre-commit config in this repo must mirror the agents repo's baseline.

---

## Step 1 — Detect existing setup

```
Check package.json devDependencies:
  └─ Is @biomejs/biome installed?
       └─ NO → install and configure (Step 3 — Biome)

Check root directory:
  └─ Does biome.json exist?
       └─ NO → create it (Step 3 — Biome)

Check root directory:
  └─ Does .pre-commit-config.yaml exist?
       └─ NO → create it (Step 3 — Pre-commit)

Check root directory:
  └─ Does .secrets.baseline exist?
       └─ NO → initialise it (Step 3 — Pre-commit)

Check root directory:
  └─ Does .storybook/ exist?
       └─ NO and team needs isolated component dev → initialise Storybook (Step 3 — Storybook)
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Setting up or configuring Biome
  │    → load references/biome-config.md
  ├─ Setting up pre-commit hooks or detect-secrets
  │    → load references/precommit-config.md
  └─ Setting up or configuring Storybook with Carbon
       → load references/storybook-setup.md
```

---

## Step 3 — Execute

### Biome

```bash
npm install --save-dev @biomejs/biome
npx biome init
```

Replace the generated `biome.json` with the project-standard config:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "a11y": { "recommended": true }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "always"
    },
    "parser": {
      "unsafeParameterDecoratorsEnabled": true
    }
  },
  "files": {
    "ignore": [
      ".next/**",
      "node_modules/**",
      "*.generated.*",
      "storybook-static/**"
    ]
  }
}
```

The `a11y` ruleset is critical for Carbon — it enforces ARIA attributes that Carbon's component API expects to be populated correctly (e.g., `labelText` on `TextInput`, `aria-label` on icon buttons).

Add scripts to `package.json`:

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --apply .",
    "format": "biome format --write .",
    "check-types": "tsc --noEmit"
  }
}
```

### Pre-commit

Install pre-commit (requires Python):

```bash
pip install pre-commit detect-secrets
```

Create `.pre-commit-config.yaml` in the project root:

```yaml
repos:
  - repo: local
    hooks:
      - id: biome
        name: Biome lint and format
        entry: npx biome check --apply
        language: system
        types: [javascript, jsx, ts, tsx]
        pass_filenames: true

      - id: tsc
        name: TypeScript type check
        entry: npx tsc --noEmit
        language: system
        pass_filenames: false

      - id: detect-secrets
        name: detect-secrets
        entry: detect-secrets-hook
        language: python
        args: ['--baseline', '.secrets.baseline']
        types: [text]
```

Initialise the secrets baseline (run once):

```bash
detect-secrets scan > .secrets.baseline
git add .secrets.baseline
```

Install the hooks:

```bash
pre-commit install
```

---

## Step 4 — Validate

- [ ] `@biomejs/biome` is in `package.json` devDependencies
- [ ] `biome.json` exists at project root with `a11y.recommended: true`
- [ ] `npm run lint` exits 0 on a clean project
- [ ] `.pre-commit-config.yaml` exists with biome, tsc, and detect-secrets hooks
- [ ] `.secrets.baseline` exists and is committed
- [ ] `pre-commit install` has been run (`.git/hooks/pre-commit` exists)
- [ ] `pre-commit run --all-files` passes on a clean project
- [ ] No `.eslintrc`, `.prettierrc`, or `eslint.config.js` files exist (Biome replaces them)
- [ ] If Storybook: `.storybook/main.ts` exists with `@storybook/nextjs` framework

---

## Reference Files

- [references/biome-config.md](references/biome-config.md) — Full `biome.json` reference, `a11y` rule rationale, `files.ignore` patterns, migration from ESLint + Prettier. **Load for Biome setup or config questions.**
- [references/precommit-config.md](references/precommit-config.md) — `.pre-commit-config.yaml` structure, detect-secrets baseline workflow, hook execution order. **Load for pre-commit or secret scanning setup.**
- [references/storybook-setup.md](references/storybook-setup.md) — Storybook 8 init, Carbon theme decorator, Vitest story-as-test integration, addon configuration. **Load when setting up Storybook.**

---

## Source Documentation

All content is grounded in [biomejs.dev](https://biomejs.dev/), [pre-commit.com](https://pre-commit.com/), [storybook.js.org/docs](https://storybook.js.org/docs), [github.com/Yelp/detect-secrets](https://github.com/Yelp/detect-secrets), and [storybook.js.org/docs/writing-tests/vitest-plugin](https://storybook.js.org/docs/writing-tests/vitest-plugin).

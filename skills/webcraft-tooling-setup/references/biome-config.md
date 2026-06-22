# Biome Configuration Reference

> Authority: [biomejs.dev/guides/getting-started](https://biomejs.dev/guides/getting-started/) and [biomejs.dev/linter/rules](https://biomejs.dev/linter/rules/)

Biome is a single binary that replaces ESLint + Prettier. One config file (`biome.json`) covers both linting and formatting.

---

## Installation

```bash
npm install --save-dev @biomejs/biome
npx biome init
```

`biome init` generates a minimal `biome.json`. Replace it with the project-standard config below.

---

## Full biome.json for Carbon Next.js

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
      "a11y": { "recommended": true },
      "complexity": {
        "noExcessiveCognitiveComplexity": "warn"
      },
      "correctness": {
        "useExhaustiveDependencies": "warn"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "always",
      "bracketSameLine": false
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
      "storybook-static/**",
      ".storybook/**"
    ]
  },
  "overrides": [
    {
      "include": ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"
          }
        }
      }
    }
  ]
}
```

---

## Why a11y rules matter for Carbon

Carbon components expect specific ARIA attributes populated by the consuming code. The `a11y.recommended` ruleset catches common misuse:

| Biome rule | What it catches | Carbon context |
|------------|----------------|----------------|
| `a11y/useAltText` | Missing `alt` on images | Carbon `ImageWithCaption` |
| `a11y/noAriaHiddenOnFocusable` | `aria-hidden` on focusable elements | Carbon icon buttons |
| `a11y/useButtonType` | Buttons without explicit `type` | Carbon `Button` in forms |
| `a11y/useLabelForAriaLabel` | Interactive elements missing labels | Carbon `IconButton` (needs `label` prop) |

---

## Migration from ESLint + Prettier

Remove these packages completely — Biome replaces all of them:

```bash
npm uninstall eslint prettier eslint-config-next @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react eslint-plugin-react-hooks eslint-config-prettier
```

Delete these config files:
```
.eslintrc.js / .eslintrc.json / .eslintrc.cjs / eslint.config.js
.prettierrc / .prettierrc.json / prettier.config.js
```

Update `package.json` scripts:

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

WRONG — keeping ESLint alongside Biome:
```json
{
  "scripts": {
    "lint": "eslint . && biome check ."
  }
}
```

CORRECT:
```json
{
  "scripts": {
    "lint": "biome check ."
  }
}
```

---

## VSCode integration

Install the [Biome VSCode extension](https://biomejs.dev/guides/editors/first-party-extensions/) for in-editor diagnostics and format-on-save:

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

---

## CI usage

```bash
# Check only (no fix) — use in CI
npx biome ci .

# Fix and write — use locally
npx biome check --apply .
```

`biome ci` exits non-zero if any file needs formatting or has lint errors, without modifying files.

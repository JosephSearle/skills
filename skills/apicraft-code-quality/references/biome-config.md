# Biome Configuration for NestJS

**Authority:** biomejs.dev/blog/biome-v2, biomejs.dev/linter/rules/use-import-type, github.com/biomejs/biome/discussions/5305

---

## Install

```bash
npm install --save-dev @biomejs/biome
npx @biomejs/biome init
```

Replace the generated file with the NestJS-specific template below.

---

## Production biome.json Template

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "useExhaustiveDependencies": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noFloatingPromises": "error"
      },
      "style": {
        "useImportType": "off"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      "coverage",
      "*.d.ts"
    ]
  }
}
```

### Why `useImportType: "off"` is mandatory

Biome's `useImportType` rule adds `import type` to imports it detects as type-only. In NestJS, class imports used in:
- `@Module({ imports: [SomeModule], providers: [SomeService] })`
- `@InjectRepository(UserEntity)`
- Constructor parameter types for DI: `constructor(private readonly usersService: UsersService)`

...are NOT type-only — they are runtime values required by `emitDecoratorMetadata`. Biome cannot detect this statically. Adding `import type` to these imports causes the DI container to receive `undefined` at runtime.

**Known open issue:** biomejs/biome #5305. The `"off"` workaround is the official Biome documentation recommendation.

---

## Husky + lint-staged Setup

```bash
npm install --save-dev husky lint-staged
npx husky init
```

`.husky/pre-commit`:

```bash
#!/bin/sh
npx lint-staged
```

`package.json` lint-staged config:

```json
{
  "lint-staged": {
    "*.ts": ["biome check --write --no-errors-on-unmatched"]
  }
}
```

> 💡 **Senior insight:** `biome check --write` on staged files takes ~0.3s for most projects. The old ESLint + Prettier stack on the same files typically takes 20–30s. This difference determines whether developers disable the pre-commit hook.

---

## Biome v2 Type-Aware Rules

Biome v2 (June 2025, codename Biotype) added type-aware linting rules without invoking the TypeScript compiler. Key rules now available:

- `noFloatingPromises` — catches unhandled promises
- Type-aware rules cover ~85% of `@typescript-eslint`'s coverage

The remaining ~15% is caught by `tsc --noEmit` in CI. Both are needed for full coverage.

---

## Migration from ESLint + Prettier

```bash
# Migrate ESLint config → biome.json (writes equivalent rules)
npx @biomejs/biome migrate eslint --write

# Migrate Prettier config → biome.json formatter settings
npx @biomejs/biome migrate prettier --write

# Auto-fix all formatting
npx @biomejs/biome check --write .

# Commit as a formatting-only change (separate from feature work)
git commit -m "chore: migrate from ESLint+Prettier to Biome"
```

After migration, **always add `"useImportType": "off"`** to the migrated config — ESLint didn't have this rule so the migration won't include it.

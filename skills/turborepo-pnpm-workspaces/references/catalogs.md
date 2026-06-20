# pnpm Catalogs Reference

> Authority: [pnpm.io/catalogs](https://pnpm.io/catalogs) (added in pnpm v9.5.0, July 2024)

pnpm catalogs define version ranges as named constants in `pnpm-workspace.yaml`. Packages reference them with `"catalog:"` instead of a version string. This ensures one version across the entire workspace and reduces merge conflicts when upgrading shared deps.

---

## Why catalogs

Without catalogs, the same dependency version is declared in every `package.json` that uses it. When upgrading (e.g. React 18 → 19), every file must be updated, and merge conflicts are frequent. Catalogs centralise version declarations.

WRONG — version repeated in every package:
```json
// apps/web/package.json
{ "dependencies": { "react": "^18.3.1" } }

// apps/admin/package.json
{ "dependencies": { "react": "^18.3.1" } }

// packages/ui/package.json
{ "peerDependencies": { "react": "^18.3.1" } }
```

CORRECT — version declared once:
```yaml
# pnpm-workspace.yaml
catalog:
  react: ^18.3.1
```
```json
// apps/web/package.json
{ "dependencies": { "react": "catalog:" } }

// apps/admin/package.json
{ "dependencies": { "react": "catalog:" } }

// packages/ui/package.json
{ "peerDependencies": { "react": "catalog:" } }
```

---

## Default catalog

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"

catalog:
  react: ^18.3.1
  react-dom: ^18.3.1
  typescript: ^5.5.4
  zod: ^3.23.8
  "@types/react": ^18.3.5
  "@types/node": ^22.0.0
```

Reference the default catalog with just `"catalog:"`:
```json
{ "dependencies": { "react": "catalog:", "zod": "catalog:" } }
```

---

## Named catalogs

Use named catalogs to group versions by concern:

```yaml
# pnpm-workspace.yaml
catalogs:
  react18:
    react: ^18.3.1
    react-dom: ^18.3.1
  react19:
    react: ^19.0.0
    react-dom: ^19.0.0
  testing:
    vitest: ^2.0.0
    "@testing-library/react": ^16.0.0
    "@testing-library/user-event": ^14.5.0
```

Reference named catalogs with `"catalog:<name>"`:
```json
{
  "dependencies": { "react": "catalog:react18" },
  "devDependencies": { "vitest": "catalog:testing" }
}
```

---

## Catalogs vs `workspace:*`

| Use case | Protocol |
|----------|---------|
| Internal package dependency | `workspace:*` |
| Shared external dependency version | `catalog:` |

Never use `catalog:` for internal packages — they must use `workspace:*` to get local-disk resolution.

---

## Upgrading a catalog dep

```bash
# Update a catalog dep interactively
pnpm update react --interactive

# Or edit pnpm-workspace.yaml directly and run pnpm install
```

Because the version is declared once, a single edit upgrades every package simultaneously. pnpm regenerates `pnpm-lock.yaml` to reflect the new resolved version.

---

## `catalog:` is stripped on publish

Like `workspace:*`, pnpm rewrites `"catalog:"` references to concrete version strings when publishing a package to the registry. Consumers of published packages never see `"catalog:"` in the resolved `package.json`.

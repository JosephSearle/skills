# Turborepo Filtering Reference

> Authority: [turborepo.dev/docs/crafting-your-repository/running-tasks#using-filters](https://turborepo.dev/docs/crafting-your-repository/running-tasks) (v2.x)

`--filter` scopes which packages Turborepo runs tasks for. Multiple `--filter` flags are ANDed.

---

## Filter syntax

| Pattern | Meaning |
|---------|---------|
| `@repo/ui` | Exactly the `@repo/ui` package |
| `@repo/ui...` | `@repo/ui` plus all of its **dependencies** |
| `...@repo/ui` | `@repo/ui` plus all of its **dependents** (packages that import it) |
| `...@repo/ui...` | `@repo/ui` plus dependencies AND dependents |
| `!@repo/storybook` | Exclude `@repo/storybook` |
| `./apps/*` | All packages in the `apps/` directory |
| `[origin/main]` | Packages with changes since `origin/main` |
| `[HEAD^1]` | Packages changed in the last commit |
| `[main...feature]` | Packages changed between `main` and `feature` branches |

---

## Common patterns

```bash
# Run build for one package only
turbo run build --filter=@repo/ui

# Run build for a package and everything that depends on it
# (useful: rebuild downstream apps when a shared package changes)
turbo run build --filter=...@repo/ui

# Run tests only for packages changed vs main
turbo run test --filter=[origin/main]

# Run build for everything EXCEPT storybook
turbo run build --filter=!@repo/storybook

# Combine: changed packages and their dependents
turbo run test --filter=[origin/main]...
```

---

## `--affected` flag (v2)

Shorthand for `--filter=[origin/main]` with automatic branch detection. Replaces the deprecated `turbo-ignore` utility.

```bash
turbo run build --affected
```

Turborepo determines the base branch from git and runs only the packages that have changed. In CI, set `TURBO_SCM_BASE` to override the comparison base:

```bash
TURBO_SCM_BASE=origin/main turbo run build --affected
```

---

## `turbo query affected`

Returns a JSON list of affected packages for scripting:

```bash
turbo query affected --output=json
# [{"name": "@repo/ui", "path": "packages/ui"}, ...]
```

Use in CI to make decisions (e.g. skip deploy if only docs changed).

---

## Deprecated: `turbo-ignore`

`turbo-ignore` (a separate CLI that exits with code 1 if changes are detected) is deprecated in v2. Replace with `--affected` or `turbo query affected`.

WRONG (v1 pattern):
```bash
npx turbo-ignore @repo/web && exit 0
turbo run build --filter=@repo/web
```

CORRECT (v2):
```bash
turbo run build --affected
```

---

## Notes

- `--filter` values are matched against the `name` field in each package's `package.json`, not the directory path (except `./path/*` glob forms).
- SCM filters (`[origin/main]`) require a git remote to be set; they fail gracefully in untracked directories.
- `--affected` compares against the default branch detected from `origin/HEAD`; override with `TURBO_SCM_BASE` in CI.

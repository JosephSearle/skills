# pnpm Workspace Setup Reference

> Authority: [pnpm.io/workspaces](https://pnpm.io/workspaces) and [turborepo.dev/docs/crafting-your-repository/structuring-a-repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) (v2.x)

---

## Recommended directory layout

```
my-monorepo/
├── apps/                   # Deployable apps and services
│   ├── web/                # Next.js frontend
│   └── api/                # NestJS backend
├── packages/               # Shared libraries and runtime code
│   ├── ui/                 # Component library
│   ├── database/           # Prisma/Drizzle client wrapper
│   └── types/              # Shared TypeScript types
├── tooling/                # Cross-cutting dev config (not runtime code)
│   ├── eslint-config/
│   ├── typescript-config/
│   └── prettier-config/
├── pnpm-workspace.yaml
├── package.json            # private: true, packageManager field
├── turbo.json
└── pnpm-lock.yaml          # Must be committed
```

The `tooling/` pattern (from t3-oss/create-t3-turbo) separates shared dev configuration from shared runtime code. This is optional but strongly recommended for larger repos.

---

## `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
```

Globs are relative to the file's location (repo root). Each matched directory becomes a workspace package. For Python apps added to the workspace, include their directories here too:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"
  # Python apps with package.json shims:
  - "agents/*"
```

---

## Root `package.json`

```json
{
  "name": "my-monorepo",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo watch dev",
    "lint": "turbo run lint",
    "check-types": "turbo run check-types",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.9.18"
  }
}
```

`"private": true` prevents accidental publishing of the root. `"packageManager"` is required by Turborepo v2 and also enables Corepack.

---

## `workspace:*` protocol

Internal packages are referenced with the `workspace:` protocol. pnpm resolves them to local disk instead of the registry.

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/database": "workspace:*"
  }
}
```

| Protocol | Meaning |
|----------|---------|
| `workspace:*` | Any version; rewritten to exact version on publish |
| `workspace:^` | Same major; rewritten to `^x.y.z` on publish |
| `workspace:~` | Same minor; rewritten to `~x.y.z` on publish |

For internal packages that are never published, `workspace:*` is always correct.

---

## Install commands

```bash
# Install all workspace packages
pnpm install

# Add external dep to a specific package
pnpm add react --filter=@repo/web
pnpm add -D typescript --filter=@repo/ui

# Add an internal dep
pnpm add @repo/ui --filter=@repo/web
# (pnpm resolves workspace:* automatically when the package exists locally)

# Add to workspace root (only for repo-wide tooling)
pnpm add -D turbo -w

# Remove a dep
pnpm remove lodash --filter=@repo/web

# Update a dep across all packages
pnpm update react --recursive
```

---

## Bootstrapping a new repo

```bash
# 1. Create root
mkdir my-monorepo && cd my-monorepo
pnpm init

# 2. Create workspace structure
mkdir -p apps packages tooling

# 3. Create pnpm-workspace.yaml
echo 'packages:
  - "apps/*"
  - "packages/*"
  - "tooling/*"' > pnpm-workspace.yaml

# 4. Set root package.json as private
# (edit package.json to add "private": true)

# 5. Init turbo
pnpm dlx create-turbo@latest .
# or add manually: pnpm add -D turbo -w

# 6. Add first app
pnpm turbo gen workspace --name @repo/web --location apps/web
```

---

## Lockfile and graph

`pnpm-lock.yaml` **must be committed**. Turborepo reads the lockfile to build the package dependency graph — the graph drives task execution order. Without a committed lockfile, `turbo run` cannot determine which packages depend on which.

If the lockfile is out of date, run `pnpm install` and commit the updated file.

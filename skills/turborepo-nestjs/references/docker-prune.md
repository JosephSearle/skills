# turbo prune Docker Reference (NestJS)

> Authority: [turborepo.dev/docs/guides/tools/docker](https://turborepo.dev/docs/guides/tools/docker) and [turborepo.dev/docs/reference/prune](https://turbo.build/repo/docs/reference/prune) (v2.x)

---

## What `turbo prune` emits

```bash
turbo prune api --docker
```

Produces `out/` with two subdirectories:

| Path | Contents | Purpose |
|------|---------|---------|
| `out/json/` | `package.json` files for `api` + all its internal deps + pruned `pnpm-lock.yaml` | Install layer (cached by Docker when deps don't change) |
| `out/full/` | Full source of `api` + source of its internal deps only | Build layer |

The pruned lockfile contains only the packages needed by the app, dramatically reducing install time in CI.

---

## Multi-stage Dockerfile for NestJS + pnpm

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable pnpm

# 1. Prune to a minimal subset
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune api --docker

# 2. Install dependencies (separate layer — cached until deps change)
FROM base AS installer
WORKDIR /app

# Restore pruned package.jsons and lockfile
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --prefer-offline

# 3. Build
FROM installer AS builder
WORKDIR /app

# Restore full source
COPY --from=pruner /app/out/full/ .

# Generate Prisma client if used (before build)
RUN pnpm --filter=@repo/database db:generate

# Build internal deps, then the api
RUN pnpm turbo run build --filter=api

# 4. Run — minimal image
FROM node:22-alpine AS runner
WORKDIR /app

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
USER nestjs

# Copy only the compiled output and node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

**Notes:**
- `corepack enable pnpm` activates pnpm without a separate install step
- `--frozen-lockfile` ensures CI uses exact versions from `pnpm-lock.yaml`
- `--prefer-offline` uses the pnpm store cache when possible
- The runner stage copies only `dist/` and `node_modules/` — source files are excluded

---

## Prisma in the Dockerfile

Prisma requires the correct binary target for the runtime OS. Set it in `packages/database/prisma/schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-arm64-openssl-3.0.x"]
}
```

The `linux-musl-*` target is for Alpine Linux (musl libc). Match the OpenSSL version to the Alpine release:

```dockerfile
# Alpine 3.18+ uses OpenSSL 3.x
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
```

---

## `turbo prune` vs `pnpm deploy`

| | `turbo prune --docker` | `pnpm deploy` |
|--|----------------------|--------------|
| Output | `out/json/` + `out/full/` for separate Dockerfile layers | Single self-contained package dir |
| Internal deps | Included as buildable source | Hard-linked; pre-built |
| Layer caching | Excellent (install layer cached independently) | Single layer |
| Use case | Multi-stage Docker with build step inside container | Lambda, single-package deploy without build step |

For NestJS: prefer `turbo prune --docker`. The separate install and build layers mean `pnpm install` only re-runs when dependencies change, not on every source change.

---

## Image size

Without pruning: full monorepo `node_modules` (often 600–900 MB) is COPY'd into the image.

With `turbo prune --docker`: only the pruned `node_modules` (typically 60–80% smaller) is installed in the image. Combined with a minimal runner stage that copies only `dist/`, final images are typically 150–300 MB for a NestJS service.

# Next.js Standalone Docker Reference

> Authority: [turborepo.dev/docs/guides/tools/docker](https://turborepo.dev/docs/guides/tools/docker) and [nextjs.org/docs/app/api-reference/config/next-config-js/output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) (v2.x)

---

## `output: "standalone"` in a monorepo

Next.js `output: "standalone"` traces file dependencies and emits a minimal production bundle. In a monorepo, it must know the root so it can trace into shared `packages/`:

```ts
// apps/web/next.config.ts
import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@repo/ui"],
};

export default nextConfig;
```

WRONG — `outputFileTracingRoot` pointing to app dir (default):
```ts
// Missing outputFileTracingRoot entirely in a monorepo
const nextConfig: NextConfig = { output: "standalone" };
// Result: shared packages are not traced → missing modules at runtime
```

CORRECT — pointing to the monorepo root:
```ts
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
};
```

---

## `turbo prune` Docker workflow for Next.js

`turbo prune` generates a pruned subset of the monorepo containing only the `web` app and its internal dependencies — dramatically reducing Docker context and image size.

```bash
# Emits:
# out/json/  → package.jsons + pruned lockfile (install layer)
# out/full/  → full source of web + its internal deps only (build layer)
turbo prune web --docker
```

---

## Multi-stage Dockerfile

```dockerfile
FROM node:22-alpine AS base

# 1. Prune
FROM base AS pruner
WORKDIR /app
RUN corepack enable
COPY . .
RUN npx turbo prune web --docker

# 2. Install dependencies
FROM base AS installer
WORKDIR /app
RUN corepack enable

# Install deps from pruned lockfile (cached layer)
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# 3. Build
FROM installer AS builder
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=web

# 4. Run
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
```

**Key paths in the runner stage:**
- `standalone/` contains the minimal Node server (`server.js`) and all traced files
- `static/` and `public/` must be copied alongside `standalone/` — they are not included automatically
- The `server.js` path inside `standalone/` mirrors the app path within the monorepo (`apps/web/server.js`)

---

## `turbo prune` vs `pnpm deploy`

| | `turbo prune --docker` | `pnpm deploy` |
|--|----------------------|--------------|
| Output | `out/json/` + `out/full/` for Dockerfile layers | Single self-contained package dir |
| Internal deps | Included as full source | Hard-linked from store |
| Build step | Runs in Docker after COPY | Not included |
| Use case | Multi-stage Dockerfile | Single-package deployment or Lambda |

`turbo prune` is the recommended approach for Next.js containers — it integrates naturally with Docker layer caching. `pnpm deploy` is better for single-service Lambda or edge deployments.

---

## Image size optimisation

A typical reduction from `turbo prune` + `output: "standalone"`:

1. Without prune: full monorepo `node_modules` (~800 MB) in image
2. With prune only: pruned `node_modules` (~200 MB)
3. With prune + standalone: only traced files (~50–100 MB)

The `standalone` output includes only the files Node actually needs at runtime, traced via `@vercel/nft`.

# Internal Package Strategies Reference

> Authority: [turborepo.dev/docs/core-concepts/internal-packages](https://turborepo.dev/docs/core-concepts/internal-packages) (v2.x)

Turborepo defines three strategies for structuring shared TypeScript packages. Choosing the wrong one causes build failures or "cannot find module" errors in production.

---

## Strategy comparison

| Strategy | Source format | Build step | Cacheable | Works with Next.js | Works with NestJS/`tsc` |
|----------|--------------|------------|-----------|-------------------|------------------------|
| JIT (Just-in-Time) | `.ts` exported directly | None | No (consumer builds it) | ✅ (needs `transpilePackages`) | ❌ (tsc doesn't bundle) |
| Compiled | Built to `dist/*.js` + `.d.ts` | `tsc` or `tsup` | ✅ | ✅ | ✅ |
| Transit Node | Re-exports from another package | None | No | ✅ | ✅ (if re-exporting compiled) |

---

## JIT (Just-in-Time)

The consumer's bundler compiles the package's TypeScript source at build time. No separate `build` step required. Ideal for packages consumed by bundler-based apps (Next.js, Vite).

```json
// packages/ui/package.json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./button": "./src/button.tsx",
    "./card": "./src/card.tsx"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "react": "catalog:",
    "typescript": "catalog:"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  }
}
```

```json
// packages/ui/tsconfig.json
{
  "extends": "@repo/typescript-config/react-library.json",
  "include": ["src/**/*"]
}
```

**No `build` script.** The consuming app's bundler handles compilation. The Turborepo cache hash still covers the source files — editing `@repo/ui` will invalidate the consuming app's build cache.

**Next.js requires `transpilePackages`** for every JIT package:
```ts
// apps/web/next.config.ts
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/utils"],
};
```

**NestJS incompatibility.** `tsc` does not bundle workspace dependencies. A JIT package imported by a NestJS service will produce a runtime "cannot find module" error. Use Compiled strategy instead.

---

## Compiled

The package builds to `dist/` before consumers run. Independently cacheable by Turborepo — a cache hit means the consumer builds faster because it reads pre-compiled JS and `.d.ts` files.

```json
// packages/database/package.json
{
  "name": "@repo/database",
  "version": "0.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "check-types": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "catalog:"
  }
}
```

```jsonc
// packages/database/tsconfig.json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"]
}
```

```jsonc
// turbo.json — ensures @repo/database builds before consumers
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

`declarationMap: true` enables "go to definition" in editors to jump to the `.ts` source rather than the `.d.ts` file.

**Alternative: tsup for bundled output (recommended for NestJS):**
```bash
pnpm add -D tsup --filter=@repo/database
```
```json
{
  "scripts": {
    "build": "tsc --noEmit && tsup ./src/index.ts"
  }
}
```
```ts
// packages/database/tsup.config.ts
import { defineConfig } from "tsup";
export default defineConfig({ entry: ["src/index.ts"], format: ["cjs", "esm"], dts: true });
```

---

## Transit Node

A thin re-export package that forwards from another package. Useful for creating aliased or scoped exports without duplication.

```json
// packages/config-utils/package.json
{
  "name": "@repo/config-utils",
  "exports": {
    "./env": "./src/env.ts"
  }
}
```

```ts
// packages/config-utils/src/env.ts
export { createEnv } from "@t3-oss/env-nextjs";
```

Transit packages have no build step of their own. If they re-export from a JIT package, the same JIT constraints apply to their consumers.

---

## Node subpath imports (JIT alternative to `paths`)

JIT packages cannot use `compilerOptions.paths` (it's a compile-time transformation, invisible at runtime). Use Node's `imports` field in `package.json` instead:

```json
// packages/utils/package.json
{
  "imports": {
    "#utils/*": "./src/*.ts"
  }
}
```

```ts
// Inside the package
import { formatDate } from "#utils/date";
```

This is resolved natively by Node and TypeScript (with `moduleResolution: "NodeNext"`). It works for JIT and compiled packages alike.

---

## Shared types package

For types shared across multiple packages (and potentially across languages):

```json
// packages/types/package.json
{
  "name": "@repo/types",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  }
}
```

```ts
// packages/types/src/index.ts
export type { User, Organisation, Role } from "./user";
export type { ApiResponse, PaginatedResponse } from "./api";
```

This is a JIT package — no build step, types-only. Consumers import directly:
```ts
import type { User } from "@repo/types";
```

**Cross-language contracts (TypeScript ↔ Python):** TypeScript types do not cross language boundaries. Share contracts via:
1. OpenAPI schema → generate TypeScript types with `openapi-typescript` and Pydantic models with `datamodel-code-generator`
2. JSON Schema shared file
3. Duplicate Zod schema (TS) and Pydantic model (Python) maintained manually

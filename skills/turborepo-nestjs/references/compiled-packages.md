# Compiled Packages for NestJS Reference

> Authority: [turborepo.dev/docs/core-concepts/internal-packages](https://turborepo.dev/docs/core-concepts/internal-packages) and [github.com/vercel/turborepo/discussions/4509](https://github.com/vercel/turborepo/discussions/4509) (v2.x)

---

## Why JIT fails for NestJS

`nest build` runs `tsc` to compile the service's TypeScript to JavaScript in `dist/`. TypeScript's compiler **does not bundle** — it transpiles files individually. When a NestJS service imports `@repo/database` (a JIT package exporting `.ts` source), `tsc` compiles the import statement but leaves the resolved path pointing to the JIT source. At runtime, Node looks for `@repo/database` in `node_modules`, finds a `package.json` `exports` field pointing to `.ts` source, and throws:

```
Error: Cannot find module '@repo/database'
```

This only surfaces at runtime (or in the Docker container), not during development with `nest start --watch` (which uses `ts-node` / SWC and handles TypeScript source natively).

WRONG — JIT package imported by NestJS:
```json
// packages/database/package.json
{
  "exports": {
    ".": "./src/index.ts"   // JIT: exports TypeScript source
  }
}
```

CORRECT — Compiled package consumed by NestJS:
```json
// packages/database/package.json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

---

## Fix A: Compile the internal package to `dist/`

The standard approach. Add a `build` script to the package and update its exports.

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
  "extends": "@repo/typescript-config/node.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

Wire the Turborepo cache:
```jsonc
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

`dependsOn: ["^build"]` ensures `@repo/database` is compiled before `apps/api` builds.

---

## Fix B: Bundle with tsup

`tsup` bundles TypeScript into a single output file, inlining workspace dependencies. This is the recommended approach when you want to avoid managing the `dist/` compilation step for each shared package.

```bash
pnpm add -D tsup --filter=@repo/api
```

Switch `apps/api/package.json` `build` script:
```json
{
  "scripts": {
    "build": "tsc --noEmit && tsup ./src/main.ts",
    "dev": "nest start --watch"
  }
}
```

```ts
// apps/api/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  target: "node20",
  bundle: true,
  external: ["@nestjs/microservices", "@nestjs/websockets"],
  noExternal: ["@repo/database", "@repo/auth"],
});
```

`noExternal` inlines the specified workspace packages into the bundle. The `external` list excludes NestJS optional deps that are not always installed.

tsup approach trade-off: faster to set up per package, but produces a single bundled file that is harder to debug in production.

---

## Fix C: Build deps first in Docker (workaround)

For Docker builds where you cannot change the NestJS app's build command, build internal package dependencies separately before the app build:

```bash
# In Dockerfile or CI — builds @repo/database and @repo/auth first
turbo run build --filter=api^...
# Then build the api itself
turbo run build --filter=api
```

`--filter=api^...` means "all packages that `api` depends on" — it builds the entire dep graph except `api` itself.

This is a workaround, not a permanent fix — prefer Fix A or B to ensure local development and CI are consistent.

---

## Converting an existing JIT package

1. Add `"build": "tsc"` to `package.json` scripts
2. Add `tsconfig.json` with `"outDir": "dist"` and `"declaration": true`
3. Update `exports` to point to `dist/` (see Fix A above)
4. Add `"outputs": ["dist/**"]` to turbo.json `build` task
5. Add the package to `.gitignore` for `dist/`:
   ```gitignore
   packages/database/dist/
   packages/auth/dist/
   ```
6. Run `pnpm turbo run build --filter=@repo/database` to verify
7. Confirm `apps/api` starts and finds the module

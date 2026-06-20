# transpilePackages Reference

> Authority: [nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages) and [nextjs.org/blog/next-13-1](https://nextjs.org/blog/next-13-1) (stable since Dec 22, 2022)

`transpilePackages` tells Next.js's bundler to transpile TypeScript/JSX source from specific packages — required for all JIT internal packages. It replaces the third-party `next-transpile-modules` package, which should be removed if present.

---

## When it is required

| Package type | Exports | Needs `transpilePackages`? |
|-------------|---------|--------------------------|
| JIT | `.ts` / `.tsx` source files | **Yes** |
| Compiled | `dist/*.js` + `.d.ts` | No |
| Transit Node (re-exporting JIT) | `.ts` source | **Yes** |
| Transit Node (re-exporting compiled) | `dist/*.js` | No |

If you are unsure: check the `exports` field in the package's `package.json`. If any value ends in `.ts` or `.tsx`, the package needs `transpilePackages`.

---

## Configuration

```ts
// apps/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@repo/ui",
    "@repo/utils",
    "@repo/validators",
  ],
};

export default nextConfig;
```

WRONG — missing `transpilePackages`:
```ts
// apps/web/next.config.ts
const nextConfig = {};
export default nextConfig;

// Result: SyntaxError: Unexpected token during build
// (webpack encounters .tsx it wasn't told to transpile)
```

CORRECT:
```ts
const nextConfig: NextConfig = {
  transpilePackages: ["@repo/ui"],
};
```

---

## Per-path exports for `@repo/ui`

Prefer per-path `exports` over a barrel `index.ts` for component libraries. This enables tree-shaking and clean import paths.

```json
// packages/ui/package.json
{
  "name": "@repo/ui",
  "exports": {
    "./button": "./src/button.tsx",
    "./card": "./src/card.tsx",
    "./input": "./src/input.tsx",
    "./dialog": "./src/dialog.tsx"
  }
}
```

Consuming app:
```tsx
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
```

WRONG — barrel export that bundles everything:
```json
{
  "exports": {
    ".": "./src/index.ts"
  }
}
```

CORRECT — per-component paths for Next.js:
```json
{
  "exports": {
    "./button": "./src/button.tsx"
  }
}
```

If a barrel `index.ts` is needed for compatibility, add it as an additional export path rather than the only one.

---

## Multiple Next.js apps

Each app must declare its own `transpilePackages`. There is no shared config for this — it is per-app.

```ts
// apps/web/next.config.ts
const nextConfig: NextConfig = { transpilePackages: ["@repo/ui"] };

// apps/admin/next.config.ts
const nextConfig: NextConfig = { transpilePackages: ["@repo/ui", "@repo/admin-ui"] };
```

---

## Removing `next-transpile-modules`

If the project uses the legacy `next-transpile-modules` package:

```bash
pnpm remove next-transpile-modules --filter=@repo/web
```

```ts
// Before (legacy)
const withTM = require("next-transpile-modules")(["@repo/ui"]);
module.exports = withTM({});

// After (built-in)
const nextConfig: NextConfig = { transpilePackages: ["@repo/ui"] };
export default nextConfig;
```

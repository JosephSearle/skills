# Next.js Environment Variable Configuration Reference

> Authority: [turborepo.dev/docs/crafting-your-repository/using-environment-variables](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables) and [github.com/t3-oss/t3-env](https://github.com/t3-oss/t3-env) (v2.x)

---

## Framework Inference for `NEXT_PUBLIC_*`

Turborepo detects Next.js apps and **automatically includes all `NEXT_PUBLIC_*` environment variables in the cache hash** — no manual listing in `turbo.json` `env` required.

WRONG — manually listing `NEXT_PUBLIC_*` vars (redundant):
```jsonc
{
  "tasks": {
    "build": {
      "env": ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_NAME"]
    }
  }
}
```

CORRECT — `NEXT_PUBLIC_*` vars are auto-hashed by Framework Inference:
```jsonc
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    }
  }
}
```

Framework Inference is active when `next` is present in `dependencies` or `devDependencies`.

---

## Server-side env vars still need explicit declaration

Environment variables used server-side (not prefixed `NEXT_PUBLIC_`) must be declared manually to be included in the cache hash:

```jsonc
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"],
      "env": [
        "DATABASE_URL",
        "AUTH_SECRET",
        "STRIPE_SECRET_KEY"
      ]
    }
  }
}
```

Missing a server env var from `turbo.json` `env` means the cache can return a stale build that was compiled with a different `DATABASE_URL`.

---

## Type-safe env with `@t3-oss/env-nextjs`

Use `createEnv` from `@t3-oss/env-nextjs` for runtime validation and full TypeScript inference:

```bash
pnpm add @t3-oss/env-nextjs zod --filter=@repo/web
```

```ts
// apps/web/src/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "test", "production"]),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});
```

- `server` vars: server-only, never exposed to client
- `client` vars: must be prefixed `NEXT_PUBLIC_` — enforced by the library
- `runtimeEnv`: explicit mapping prevents accidental `process.env` calls from being tree-shaken

Import `env` anywhere in the app:
```ts
import { env } from "~/env";
const db = createClient(env.DATABASE_URL);
```

The app throws at startup (not silently at runtime) if any declared var is missing or invalid.

---

## Auditing undeclared env vars (Biome stack)

`eslint-config-turbo`'s `turbo/no-undeclared-env-vars` rule has no Biome equivalent. When using Biome for linting, use these two strategies instead:

**Option 1 — `turbo run --summarize`**

```bash
turbo run build --summarize
```

Generates `.turbo/runs/<id>.json` listing every resolved env var per task. Diff against your `turbo.json` `env` declarations to find gaps.

**Option 2 — `@t3-oss/env-nextjs` runtime validation**

`createEnv` throws at startup if any declared var is missing or invalid. Configure it for every `process.env` access in the app (see the type-safe env pattern above). If `turbo.json` is missing a var, the app throws on first run in CI — the error message names the missing variable.

Neither option is as early as a static lint rule, but together they cover the failure mode: `--summarize` catches it in CI pre-deploy, `createEnv` catches it at process start.

---

## `.env` files and caching

`.env` files are not automatically included in Turborepo's cache hash. Add them to `inputs`:

```jsonc
{
  "tasks": {
    "build": {
      "inputs": ["$TURBO_DEFAULT$", ".env", ".env.local", ".env.production"]
    }
  }
}
```

This ensures a change to `.env` busts the build cache. Without this, the old cached output (built with the previous `.env`) is replayed on the next run.

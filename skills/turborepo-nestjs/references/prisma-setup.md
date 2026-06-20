# Prisma Setup in a NestJS Turborepo Reference

> Authority: [turborepo.dev/docs/crafting-your-repository/configuring-tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks) and [prisma.io/docs](https://www.prisma.io/docs) (v2.x)

---

## `@repo/database` wrapper pattern

Create a dedicated package that wraps the Prisma client. NestJS services import the wrapper, not Prisma directly. This ensures one client instance across the monorepo and keeps the Prisma schema in one location.

```
packages/database/
├── package.json
├── tsconfig.json
├── prisma/
│   └── schema.prisma
└── src/
    └── index.ts        # Exports the Prisma client
```

```ts
// packages/database/src/index.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export { PrismaClient } from "@prisma/client";
export * from "@prisma/client";
```

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
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/client": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "prisma": "catalog:",
    "typescript": "catalog:"
  }
}
```

---

## `db:generate` as a Turborepo task

Prisma generates its client to `node_modules/@prisma/client` based on `schema.prisma`. This generation must happen before any `build` that imports from `@repo/database`. Wire it as a Turborepo task:

```jsonc
// turbo.json
{
  "tasks": {
    "db:generate": {
      "cache": false
    },
    "build": {
      "dependsOn": ["^build", "db:generate"],
      "outputs": ["dist/**"]
    }
  }
}
```

`"dependsOn": ["^build", "db:generate"]` means:
- `^build` — all dependency packages build first (cross-package, topological)
- `db:generate` — `db:generate` in the **same package** runs before `build`

WRONG — build without db:generate dependency:
```jsonc
{
  "tasks": {
    "build": { "dependsOn": ["^build"] }
  }
}
// Result: Prisma client missing → TypeScript error or runtime failure
```

CORRECT:
```jsonc
{
  "tasks": {
    "build": {
      "dependsOn": ["^build", "db:generate"],
      "outputs": ["dist/**"]
    }
  }
}
```

The `db:generate` task has `"cache": false` because it generates into `node_modules` (not a package output), so Turborepo cannot cache it meaningfully.

---

## Consuming `@repo/database` in NestJS

```ts
// apps/api/src/app.module.ts
import { Module } from "@nestjs/common";
import { db } from "@repo/database";

@Module({
  providers: [
    {
      provide: "PRISMA_CLIENT",
      useValue: db,
    },
  ],
  exports: ["PRISMA_CLIENT"],
})
export class DatabaseModule {}
```

Or as a NestJS service:

```ts
// apps/api/src/database/database.service.ts
import { Injectable, OnModuleInit } from "@nestjs/common";
import { db } from "@repo/database";

@Injectable()
export class DatabaseService implements OnModuleInit {
  async onModuleInit() {
    await db.$connect();
  }
}
```

---

## Migrations in CI

```bash
# Run pending migrations (destructive; use in staging/prod with care)
pnpm --filter=@repo/database db:migrate

# Push schema without migration history (local dev / preview envs)
pnpm --filter=@repo/database db:push
```

In CI pipelines, run `db:generate` before the build step to ensure the Prisma client is up to date:

```yaml
# GitHub Actions example
- name: Generate Prisma client
  run: pnpm turbo run db:generate

- name: Build
  run: pnpm turbo run build
```

---

## Binary targets for Docker (Alpine)

In `schema.prisma`, add the Alpine binary target alongside `native`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

Run `db:generate` after adding the target to download the Alpine binary. Include it in the Docker build (see `references/docker-prune.md`).

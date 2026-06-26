---
name: apicraft-orm-prisma
description: >
  Prisma ORM patterns for NestJS: PrismaService provider setup, the critical
  prisma migrate dev vs migrate deploy distinction (the most common production
  incident), N+1 prevention, $transaction usage, soft deletes, audit trails via
  Prisma Client extensions, and unit testing with Vitest. Requires apicraft-context
  to be loaded first.
  Triggers on: "Prisma", "prisma migrate", "PrismaService", "prisma transaction",
  "schema.prisma", "prisma client", "P2002", "P2003", "prisma extension",
  "prisma mock", "prisma soft delete", "prisma N+1".
  Not for TypeORM — use apicraft-orm-typeorm. Not for MikroORM — use apicraft-orm-mikroorm.
version: 1.0.0
---

## Core Philosophy

Prisma's best-in-class type safety and DX come with one sharp edge: the migration CLI has two commands with completely different semantics that look similar. `prisma migrate dev` creates migrations, regenerates the client, and runs against the dev database. `prisma migrate deploy` applies existing migrations without touching the client. Running `migrate dev` in CI/CD is a production incident — it may create a spurious migration from local schema drift and apply it to the production database.

## Step 1 — Detect context

Load `apicraft-context` first. Confirm ORM is Prisma. Identify what the user needs:

```
What is the task?
  ├─ Setting up PrismaService → load references/prisma-patterns.md §PrismaService
  ├─ Running migrations in CI/CD → load references/prisma-patterns.md §Migrations
  ├─ N+1 query problems → load references/prisma-patterns.md §N+1 prevention
  ├─ Transactions → load references/prisma-patterns.md §Transactions
  ├─ Soft deletes / audit trails → load references/prisma-patterns.md §Soft deletes
  └─ Unit testing with mocks → load references/prisma-patterns.md §Testing
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| All Prisma + NestJS patterns | `references/prisma-patterns.md` |

## Step 3 — Execute

> ⚠️ **Gotcha — the #1 Prisma production incident:** Never run `prisma migrate dev` in CI/CD or production. It generates a new migration from local schema drift, which can be destructive when run against the production database.

```
Development workflow:
  1. Edit schema.prisma
  2. npx prisma migrate dev --name <migration-name>   ← creates + applies + regenerates client
  3. Commit migration file to git

CI/CD / Production:
  4. npx prisma migrate deploy   ← applies existing migrations ONLY; does not regenerate client
  5. npx prisma generate         ← regenerates client from schema (run in build step)
```

→ See `references/prisma-patterns.md` for `PrismaService` setup, N+1 prevention, transactions, and testing patterns.

## Step 4 — Validate

- [ ] `PrismaService` extends `PrismaClient`, implements `OnModuleInit` and `OnModuleDestroy`
- [ ] CI/CD runs `prisma migrate deploy`, not `prisma migrate dev`
- [ ] Queries use `select` to fetch only needed fields (not `findUnique` returning all columns)
- [ ] `$transaction` used for atomic multi-table operations
- [ ] `deletedAt` column present for soft-deleted models; all queries filter `where: { deletedAt: null }`
- [ ] Prisma 7 projects set `moduleFormat = "cjs"` in `schema.prisma` generator block

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/prisma-patterns.md` | PrismaService, migrations, N+1, transactions, soft deletes, testing | Any Prisma task |

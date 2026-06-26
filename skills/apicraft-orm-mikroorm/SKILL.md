---
name: apicraft-orm-mikroorm
description: >
  MikroORM patterns for NestJS: the mandatory RequestContext setup (what breaks without
  it), EntityManager vs Repository pattern, Unit of Work and Identity Map benefits,
  em.flush() batching, migration CLI, and enableShutdownHooks() dependency. Requires
  apicraft-context to be loaded first.
  Triggers on: "MikroORM", "EntityManager", "em.flush", "RequestContext",
  "Identity Map", "Unit of Work", "@CreateRequestContext", "MikroOrmMiddleware",
  "mikro-orm", "@mikro-orm/nestjs".
  Not for Prisma — use apicraft-orm-prisma. Not for TypeORM — use apicraft-orm-typeorm.
version: 1.0.0
---

## Core Philosophy

MikroORM's EntityManager is stateful — it maintains an identity map and unit of work per request. If two concurrent requests share the same EntityManager instance, they share the same identity map, which means one request can see (or corrupt) another request's uncommitted changes. The `RequestContext` middleware that forks the EntityManager per request is not optional — it's the foundational correctness requirement. Every MikroORM + NestJS project must set it up before writing any ORM code.

## Step 1 — Detect context

Load `apicraft-context` first. Confirm ORM is MikroORM. Identify what the user needs:

```
What is the task?
  ├─ Setting up MikroORM + NestJS → load references/mikroorm-patterns.md §Setup
  ├─ RequestContext not set up (requests sharing state) → load references/mikroorm-patterns.md §RequestContext
  ├─ Unit of Work / em.flush() → load references/mikroorm-patterns.md §Unit of Work
  ├─ Transactions → load references/mikroorm-patterns.md §Transactions
  ├─ Running migrations → load references/mikroorm-patterns.md §Migrations
  └─ Graceful shutdown → load references/mikroorm-patterns.md §Shutdown
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| All MikroORM + NestJS patterns | `references/mikroorm-patterns.md` |

## Step 3 — Execute

> ⚠️ **Gotcha — critical correctness bug:** Without `RequestContext`, every request shares the same EntityManager instance. The EM's identity map then contains entities from all concurrent requests, which can cause:
> - Returning stale data from a previous request's identity map
> - Flushing changes from request A during request B's transaction
> - Test isolation failures — state leaks between test cases
>
> Set up `RequestContext` before writing any other ORM code.

Two options — choose one:

**Option A — Middleware (recommended for standard HTTP apps):**

```typescript
// app.module.ts
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RequestContext } from '@mikro-orm/core';

@Module({
  imports: [MikroOrmModule.forRoot()],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MikroOrmMiddleware).forRoutes('*');
  }
}
```

**Option B — @CreateRequestContext decorator (for specific providers):**

```typescript
@Injectable()
export class UsersService {
  constructor(private readonly em: EntityManager) {}

  @CreateRequestContext()
  async findAll(): Promise<User[]> {
    return this.em.findAll(User);
  }
}
```

→ See `references/mikroorm-patterns.md` for complete setup, Unit of Work patterns, and migration CLI.

## Step 4 — Validate

- [ ] `MikroOrmMiddleware` applied to all routes OR `@CreateRequestContext()` on all public methods
- [ ] `em.flush()` called once at the end of each operation (not after every change)
- [ ] `enableShutdownHooks()` called in `main.ts` (MikroORM relies on it to close connections)
- [ ] Transactions use `em.transactional()` or `em.begin()`/`em.commit()`/`em.rollback()`

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/mikroorm-patterns.md` | RequestContext, EntityManager, Unit of Work, migrations, shutdown | Any MikroORM task |

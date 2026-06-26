# MikroORM Patterns for NestJS

**Authority:** mikro-orm.io/docs/usage-with-nestjs

---

## Module Setup

```bash
npm install @mikro-orm/core @mikro-orm/nestjs @mikro-orm/postgresql
```

```typescript
// app.module.ts
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        driver: PostgreSqlDriver,
        clientUrl: configService.get<string>('DATABASE_URL'),
        entities: ['dist/**/*.entity.js'],
        entitiesTs: ['src/**/*.entity.ts'],
        migrations: {
          path: 'dist/migrations',
          pathTs: 'src/migrations',
        },
        debug: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // MANDATORY: fork the EntityManager per request
    consumer.apply(MikroOrmMiddleware).forRoutes('*');
  }
}
```

---

## RequestContext — The Mandatory Setup

> ⚠️ **Gotcha — critical correctness bug:** MikroORM's EntityManager is stateful. Without `RequestContext`, all HTTP requests share the same EM instance and the same identity map. This causes:
> - Stale data served from a previous request's cache
> - Cross-request state contamination under concurrent load
> - Unpredictable behavior under any test that creates multiple requests

**Option A — Middleware (covers all routes automatically):**

```typescript
// Already shown above in AppModule setup
consumer.apply(MikroOrmMiddleware).forRoutes('*');
```

**Option B — @CreateRequestContext decorator (explicit, per-method):**

Use when middleware isn't available (e.g., gRPC handlers, CLI commands, BullMQ workers):

```typescript
import { CreateRequestContext } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/core';

@Injectable()
export class UsersSyncWorker {
  constructor(
    private readonly orm: MikroORM,
    private readonly em: EntityManager,
  ) {}

  @CreateRequestContext()
  async syncUsers(): Promise<void> {
    const users = await this.em.findAll(User);
    // Each call to syncUsers() gets a fresh forked EntityManager
  }
}
```

Note: `@CreateRequestContext()` requires injecting `MikroORM` (not just `EntityManager`) — it uses the `orm` instance to fork a new context.

---

## EntityManager vs Repository

Both access data; Repository is a scoped wrapper around EntityManager for a specific entity.

```typescript
// Using EntityManager directly
@Injectable()
export class UsersService {
  constructor(private readonly em: EntityManager) {}

  async findById(id: string): Promise<User | null> {
    return this.em.findOne(User, { id });
  }

  async findAll(): Promise<User[]> {
    return this.em.findAll(User, { orderBy: { createdAt: 'DESC' } });
  }
}

// Using Repository (preferred for single-entity access)
@Injectable()
export class UsersRepository extends EntityRepository<User> {
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }
}
```

Register in module:

```typescript
@Module({
  imports: [MikroOrmModule.forFeature([User])],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
```

---

## Unit of Work and em.flush()

The Unit of Work pattern tracks all entity changes within a request and flushes them in a single transaction when `em.flush()` is called. This minimizes round-trips and batches inserts/updates.

```typescript
// WRONG — calling flush after each change (defeats batching)
await this.em.persistAndFlush(order);         // DB write 1
await this.em.persistAndFlush(orderItem1);    // DB write 2
await this.em.persistAndFlush(orderItem2);    // DB write 3

// CORRECT — persist all changes, flush once
this.em.persist(order);       // registers change, no DB write
this.em.persist(orderItem1);  // registers change
this.em.persist(orderItem2);  // registers change
await this.em.flush();        // single transaction: INSERTs order + items
```

**Identity Map:** Once an entity is loaded, subsequent finds for the same ID return the cached instance — no second DB query. Mutations to the cached entity are tracked automatically.

---

## Transactions

```typescript
// Option 1: em.transactional() — wraps in a transaction automatically
await this.em.transactional(async (em) => {
  const order = em.create(Order, { userId, total });
  const item = em.create(OrderItem, { orderId: order.id, productId, quantity });
  // flush happens automatically at the end of the transaction
});

// Option 2: manual transaction
await this.em.begin();
try {
  this.em.persist(order);
  this.em.persist(item);
  await this.em.flush();
  await this.em.commit();
} catch (err) {
  await this.em.rollback();
  throw err;
}
```

---

## Migrations

```bash
# Generate migration from entity changes
npx mikro-orm migration:create --name AddUserRefreshToken

# Apply pending migrations (CI/CD)
npx mikro-orm migration:up

# Rollback last migration
npx mikro-orm migration:down
```

---

## Graceful Shutdown

> ⚠️ **Gotcha:** MikroORM relies on NestJS's `onModuleDestroy` lifecycle hook to close database connections cleanly. Without `enableShutdownHooks()`, connections may not be released during SIGTERM, causing connection pool exhaustion on the next deploy.

```typescript
// main.ts
app.enableShutdownHooks();
```

→ See `apicraft-devops` for the full graceful shutdown setup including SIGTERM handling.

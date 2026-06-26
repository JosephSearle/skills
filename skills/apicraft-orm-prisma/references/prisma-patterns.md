# Prisma Patterns for NestJS

**Authority:** prisma.io/docs, docs.nestjs.com/recipes/prisma

---

## PrismaService

```typescript
// prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

// prisma.module.ts
import { Module, Global } from '@nestjs/common';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Import `PrismaModule` in `AppModule`. Mark it `@Global()` so every feature module can inject `PrismaService` without importing `PrismaModule` explicitly.

---

## Migration Commands — The Critical Distinction

| Command | When to use | What it does |
|---------|-------------|--------------|
| `prisma migrate dev` | Local development only | Creates migration file, applies it, regenerates Prisma client |
| `prisma migrate deploy` | CI/CD and production | Applies pending migrations only; does NOT create migrations or regenerate client |
| `prisma generate` | CI build step | Regenerates Prisma client from schema.prisma without touching migrations |

> ⚠️ **Gotcha — production incident:** `prisma migrate dev` detects drift between your local schema and the database, creates a migration to fix it, and applies it. If run against production, this migration may be destructive (dropping columns, changing types). Always use `prisma migrate deploy` in CI/CD.

CI/CD script:

```bash
# In your deployment pipeline (before starting the app)
npx prisma migrate deploy
npx prisma generate  # only needed if not committed to the build artifact
```

---

## N+1 Prevention

N+1 occurs when you load a list of records and then query related records one-by-one for each.

```typescript
// WRONG — N+1: loads 100 posts, then runs 100 separate author queries
const posts = await prisma.post.findMany();
for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } });
}

// CORRECT — include fetches authors in one join query
const posts = await prisma.post.findMany({
  include: {
    author: {
      select: { id: true, name: true, email: true }, // only needed fields
    },
  },
});
```

**Select only needed fields — not the entire record:**

```typescript
// WRONG — fetches password hash, refresh token, etc.
const user = await prisma.user.findUnique({ where: { id } });

// CORRECT
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    name: true,
    createdAt: true,
    // password, refreshToken are NOT selected
  },
});
```

---

## Transactions

Use `$transaction` for operations that must succeed or fail atomically:

```typescript
// Interactive transaction (access multiple models in sequence)
const [order, inventory] = await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({
    data: { userId, status: 'PENDING', total },
  });

  await tx.inventory.update({
    where: { productId },
    data: { quantity: { decrement: quantity } },
  });

  return [order, inventory];
});

// Batch transaction (fire-and-forget multiple operations)
await prisma.$transaction([
  prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } }),
  prisma.auditLog.create({ data: { userId: id, action: 'LOGIN' } }),
]);
```

---

## Soft Deletes via Prisma Client Extensions

```typescript
// Add deletedAt to your schema
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  deletedAt DateTime?
}
```

```typescript
// prisma.service.ts — extend PrismaClient to auto-filter soft-deleted records
const prismaWithSoftDelete = new PrismaClient().$extends({
  query: {
    user: {
      findUnique: ({ args, query }) => {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
      findMany: ({ args, query }) => {
        args.where = { ...args.where, deletedAt: null };
        return query(args);
      },
    },
  },
});

// Soft delete — never call prisma.user.delete() for soft-deleted entities
async softDelete(id: string): Promise<void> {
  await this.prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
```

---

## Unit Testing with Vitest

```bash
npm install --save-dev jest-mock-extended
```

```typescript
import { createMock, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// jest-mock-extended works with Vitest — the API mirrors vi.fn()
describe('UsersRepository', () => {
  let repository: UsersRepository;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(async () => {
    prismaMock = createMock<PrismaClient>();

    const module = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    repository = module.get<UsersRepository>(UsersRepository);
  });

  it('finds a user by email', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'test@example.com',
      name: 'Test',
      createdAt: new Date(),
      deletedAt: null,
    } as any);

    const user = await repository.findByEmail('test@example.com');
    expect(user?.email).toBe('test@example.com');
  });
});
```

---

## Prisma 7 + NestJS CommonJS

> ⚠️ **Gotcha:** Prisma 7 ships as ESM by default. NestJS uses CommonJS. If you see `ERR_REQUIRE_ESM` after upgrading to Prisma 7, add `moduleFormat = "cjs"` to the generator block in `schema.prisma`:

```prisma
generator client {
  provider     = "prisma-client-js"
  moduleFormat = "cjs"
}
```

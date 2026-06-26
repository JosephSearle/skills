---
name: apicraft-orm-typeorm
description: >
  TypeORM patterns for NestJS: Data Mapper pattern (always preferred over Active
  Record), @InjectRepository, DataSource/EntityManager for transactions, QueryBuilder,
  the synchronize:true production hazard, migration CLI workflow, Subscribers for
  audit trails, and Vitest mocking with getRepositoryToken. Requires apicraft-context
  to be loaded first.
  Triggers on: "TypeORM", "@Entity", "@InjectRepository", "TypeORM migration",
  "QueryBuilder", "TypeORM subscriber", "DataSource", "EntityManager", "synchronize",
  "typeorm migration:run", "getRepositoryToken".
  Not for Prisma — use apicraft-orm-prisma. Not for MikroORM — use apicraft-orm-mikroorm.
version: 1.0.0
---

## Core Philosophy

TypeORM's `synchronize: true` option drops and recreates columns to match your entity definitions. In development, this is convenient. In production, it can silently drop a column that has data in it. The schema migration workflow (generate + review + deploy) exists for this reason. The Data Mapper pattern exists for a different reason: Active Record couples business logic to the ORM, making the service layer untestable without the database. Data Mapper keeps the entity as a plain data structure and the repository as the data-access layer — the seam where you inject mocks.

## Step 1 — Detect context

Load `apicraft-context` first. Confirm ORM is TypeORM. Identify what the user needs:

```
What is the task?
  ├─ Setting up TypeORM module → load references/typeorm-patterns.md §Setup
  ├─ Writing a repository → load references/typeorm-patterns.md §Data Mapper
  ├─ Transactions → load references/typeorm-patterns.md §Transactions
  ├─ Complex queries → load references/typeorm-patterns.md §QueryBuilder
  ├─ Running migrations → load references/typeorm-patterns.md §Migrations
  ├─ Audit trails → load references/typeorm-patterns.md §Subscribers
  └─ Unit testing → load references/typeorm-patterns.md §Testing
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| All TypeORM + NestJS patterns | `references/typeorm-patterns.md` |

## Step 3 — Execute

> ⚠️ **Gotcha — the #1 TypeORM production hazard:** `synchronize: true` in production will alter the database schema to match your entities. It can drop columns that exist in the database but not in your current entity definition. Never use `synchronize: true` in production.

```typescript
// WRONG — synchronize: true in production
TypeOrmModule.forRoot({
  type: 'postgres',
  synchronize: true,  // NEVER in production — can drop columns with data
  entities: [User],
})

// CORRECT — synchronize only in test environments
TypeOrmModule.forRoot({
  type: 'postgres',
  synchronize: configService.get('NODE_ENV') === 'test', // test only
  entities: [User],
  migrations: ['dist/migrations/*.js'],
  migrationsRun: false, // run migrations explicitly in CI, not at app startup
})
```

→ See `references/typeorm-patterns.md` for Data Mapper pattern, transactions, QueryBuilder, and testing patterns.

## Step 4 — Validate

- [ ] `synchronize: false` (or limited to `test` env) in all non-test environments
- [ ] Repositories use Data Mapper pattern (`@InjectRepository`)
- [ ] Transactions use `DataSource.createQueryRunner()` or `EntityManager`
- [ ] Complex queries use QueryBuilder (not string interpolation into raw queries)
- [ ] Migrations generated, reviewed, and committed before deployment
- [ ] `migration:run` is a discrete CI/CD step, not `migrationsRun: true` at startup

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/typeorm-patterns.md` | Data Mapper, transactions, QueryBuilder, migrations, subscribers, testing | Any TypeORM task |

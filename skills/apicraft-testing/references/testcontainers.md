# Testcontainers for Integration Tests

**Authority:** testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs

---

## Core Pattern: Once Per Suite

> ⚠️ **Gotcha:** Starting a Testcontainer in `beforeEach` creates a new Docker container before every test — this takes 5–15 seconds per test and makes integration suites extremely slow. Start the container once in `beforeAll` and share it across all tests in the file.

```typescript
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

describe('UsersRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;

  // Increase timeout — container startup takes 10–30s on first pull
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('testdb')
      .withUsername('test')
      .withPassword('test')
      .start();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getFirstMappedPort(),
          database: container.getDatabase(),
          username: container.getUsername(),
          password: container.getPassword(),
          entities: [User],
          synchronize: true, // acceptable in tests — never in production
        }),
        TypeOrmModule.forFeature([User]),
      ],
      providers: [UsersRepository],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  }, 60_000); // 60s timeout for container pull + startup

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  it('persists and retrieves a user', async () => {
    const repo = app.get(UsersRepository);
    const user = await repo.create({ email: 'test@example.com', password: 'hashed' });
    const found = await repo.findById(user.id);
    expect(found?.email).toBe('test@example.com');
  });
});
```

---

## vitest.config.ts Timeout Configuration

Testcontainers need extended timeouts in the Vitest config:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60_000,     // 60s for individual tests in integration suites
    hookTimeout: 60_000,     // 60s for beforeAll/afterAll hooks
    // ...
  },
});
```

Or use a separate config for integration tests:

```typescript
// vitest.integration.config.ts
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/**/__integration__/**/*.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
```

---

## Redis Container

```typescript
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';

let redisContainer: StartedRedisContainer;

beforeAll(async () => {
  redisContainer = await new RedisContainer('redis:7-alpine').start();
  process.env.REDIS_URL = redisContainer.getConnectionUrl();
}, 30_000);

afterAll(async () => {
  await redisContainer.stop();
});
```

---

## Sharing a Container Across Multiple Test Files

For large integration suites, start the container in a global setup file:

```typescript
// test/setup/global-setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';

export default async function setup() {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();

  process.env.TEST_DB_HOST = container.getHost();
  process.env.TEST_DB_PORT = String(container.getFirstMappedPort());
  process.env.TEST_DB_NAME = container.getDatabase();
  process.env.TEST_DB_USER = container.getUsername();
  process.env.TEST_DB_PASS = container.getPassword();

  // Store reference for teardown
  (globalThis as unknown as Record<string, unknown>).__pg_container__ = container;
}

export async function teardown() {
  const container = (globalThis as unknown as Record<string, unknown>).__pg_container__;
  if (container) await (container as { stop: () => Promise<void> }).stop();
}
```

```typescript
// vitest.integration.config.ts
export default defineConfig({
  test: {
    globalSetup: ['test/setup/global-setup.ts'],
    // ...
  },
});
```

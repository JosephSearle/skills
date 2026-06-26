# Test Patterns — Unit, Integration, E2E

**Authority:** docs.nestjs.com/fundamentals/testing

---

## Directory Layout

```
src/
  users/
    users.service.ts
    users.service.spec.ts          ← unit test (co-located)
    users.controller.spec.ts       ← unit test
    __integration__/
      users.repository.spec.ts     ← integration test (real DB)
test/
  users.e2e-spec.ts                ← E2E test (full HTTP)
```

Run layers separately in CI:

```bash
# Fast unit-only (CI fast lane)
vitest run --exclude '**/__integration__/**' --exclude 'test/**'

# Integration (needs Docker/Testcontainers)
vitest run --include 'src/**/__integration__/**'

# E2E
vitest run --include 'test/**'
```

---

## Unit Test Pattern

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockUsersRepository = {
    findOne: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: 'UsersRepository', // or getRepositoryToken(User) for TypeORM
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('findOne', () => {
    it('returns user when found', async () => {
      mockUsersRepository.findOne.mockResolvedValue({ id: '1', email: 'a@b.com' });
      const result = await service.findOne('1');
      expect(result.email).toBe('a@b.com');
    });

    it('throws NotFoundException when not found', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
```

---

## APP_GUARD Override Pattern

> ⚠️ **Gotcha:** Guards registered via `APP_GUARD: useClass` at the module level cannot be overridden with `overrideGuard()` in tests. You must register them as `useExisting` to make them overridable.

**WRONG — guard registered with `useClass`:**

```typescript
// app.module.ts — this breaks test overrides
{ provide: APP_GUARD, useClass: JwtAuthGuard }
```

**CORRECT — register with `useExisting`:**

```typescript
// app.module.ts
@Module({
  providers: [
    JwtAuthGuard,
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
  ],
})
```

**In tests — override the guard:**

```typescript
const module = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideGuard(JwtAuthGuard)
  .useValue({ canActivate: () => true }) // bypass auth in tests
  .compile();
```

---

## E2E with Supertest

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /users returns 201 with valid payload', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'test@example.com', password: 'securepassword' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body).not.toHaveProperty('password');
      });
  });
});
```

---

## Coverage Target

**Target: ≥ 80% branch coverage on business logic files** (services, guards, pipes, filters).

Chasing 100% is low-value — test the branches that matter (happy path, expected failures, edge cases). Controller tests add little value if there's 100% service coverage. Infrastructure code (migration files, config files) should be excluded.

```typescript
// vitest.config.ts — exclude non-business-logic files
coverage: {
  exclude: [
    '**/*.spec.ts',
    '**/__integration__/**',
    'test/**',
    'src/migrations/**',
    'src/**/*.module.ts',
    'src/main.ts',
  ],
  thresholds: {
    branches: 80,
  },
}
```

---

## Advanced Testing Tools

| Tool | Purpose | Use when |
|------|---------|----------|
| `fishery` | Factory pattern for test fixtures | Complex object graphs with sensible defaults |
| `@golevelup/ts-vitest` | Typed mock creation (`createMock<UsersService>()`) | Mocking NestJS services with full type safety |
| Pact | Consumer-driven contract testing | Microservices with separate teams |
| k6 / Artillery | Load testing | Validating performance targets before release |
| Stryker | Mutation testing (supports Vitest) | Verifying test suite quality — catches untested branches |

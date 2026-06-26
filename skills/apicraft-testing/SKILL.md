---
name: apicraft-testing
description: >
  Full testing strategy for NestJS APIs: Vitest over Jest rationale, mandatory SWC
  transformer setup, the vi.mock() hoisting gotcha, test pyramid with directory layout,
  Testcontainers for integration tests, E2E with Supertest, APP_GUARD override pattern,
  coverage targets, and advanced tooling (Pact, k6, Stryker, fishery). Requires
  apicraft-context to be loaded first.
  Triggers on: "testing", "Vitest", "unit test", "integration test", "E2E",
  "Testcontainers", "Supertest", "test setup", "mocking", "coverage", "SWC transformer",
  "vi.mock", "vi.hoisted", "APP_GUARD", "fishery", "test pyramid".
  Not for load testing setup beyond the tool recommendation — use k6/Artillery docs directly.
version: 1.0.0
---

## Core Philosophy

NestJS's DI system depends on TypeScript decorator metadata (`emitDecoratorMetadata`), which Vitest's default esbuild transformer doesn't support. Every NestJS + Vitest project must swap in the SWC transformer — without it, DI works in production but silently fails in tests. The SWC config is the first thing to set up, before writing a single test.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ Setting up Vitest from scratch → load references/vitest-swc.md (start here)
  ├─ Writing unit tests for services/guards/pipes → load references/test-patterns.md
  ├─ Setting up integration tests with real DB → load references/testcontainers.md
  ├─ Writing E2E tests → load references/test-patterns.md §E2E with Supertest
  ├─ vi.mock() not working as expected → load references/vitest-swc.md §vi.mock hoisting
  └─ Global guards blocking tests → load references/test-patterns.md §APP_GUARD override
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| Vitest + SWC installation, `vitest.config.ts`, `.swcrc`, `vi.mock()` gotcha | `references/vitest-swc.md` |
| Unit tests, E2E, directory layout, coverage, `APP_GUARD` override, fixture tools | `references/test-patterns.md` |
| Testcontainers once-per-suite setup, dynamic ports, timeout config | `references/testcontainers.md` |

## Step 3 — Execute

### Test pyramid

| Layer | Tool | Database | Directory |
|-------|------|----------|-----------|
| Unit | Vitest | Mocked | `src/**/*.spec.ts` (co-located) |
| Integration | Vitest + Testcontainers | Real Postgres/Redis in Docker | `src/**/__integration__/*.spec.ts` |
| E2E | Vitest + Supertest | Real (shared with integration) | `test/*.e2e-spec.ts` |

Run unit tests alone in CI fast lane:

```bash
vitest run --exclude '**/__integration__/**' --exclude 'test/**'
```

> 💡 **Senior insight:** Integration tests hit a real database — this is the only layer that catches N+1 queries, migration regressions, and constraint violations. Mocking the DB in unit tests is fast but gives false confidence about ORM query correctness.

### Basic unit test pattern

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';

describe('UsersService', () => {
  let service: UsersService;
  const mockRepository = {
    findOne: vi.fn(),
    save: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => vi.clearAllMocks());

  it('should throw NotFoundException when user does not exist', async () => {
    mockRepository.findOne.mockResolvedValue(null);
    await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
  });
});
```

→ See `references/vitest-swc.md` for the mandatory SWC setup before any tests can run.
→ See `references/testcontainers.md` for integration test database setup.

## Step 4 — Validate

- [ ] `vitest.config.ts` uses `swc.vite()` plugin
- [ ] `.swcrc` has `legacyDecorator: true` and `decoratorMetadata: true`
- [ ] Unit tests co-located as `*.spec.ts`, integration in `__integration__/`, E2E in `test/`
- [ ] Testcontainers started in `beforeAll`, not `beforeEach`
- [ ] Global guards in tests registered as `useExisting`, not `useClass`
- [ ] Coverage ≥ 80% branch coverage on business logic files
- [ ] `vi.mock()` factories don't reference `const` declared outside `vi.hoisted()`

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/vitest-swc.md` | Vitest + SWC setup, `vi.mock()` hoisting gotcha | Any Vitest/NestJS project setup |
| `references/test-patterns.md` | Unit/E2E patterns, directory layout, APP_GUARD override, coverage, fixtures | Writing tests |
| `references/testcontainers.md` | Testcontainers once-per-suite, dynamic ports | Integration tests with real DB |

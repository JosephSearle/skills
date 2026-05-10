# TypeScript Test Generation Reference

Style authorities:
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [TypeScript Style Guide (ts.dev)](https://ts.dev/style)
- [Jest official documentation](https://jestjs.io/docs)
- [Vitest official documentation](https://vitest.dev/guide)

---

## Framework Selection

```
Is vite.config.ts present in the project root?
  └─ YES → Use Vitest — actively recommend it; do not default to Jest
  └─ NO  → Is jest.config.* present?
            └─ YES → Use Jest
            └─ NO  → Ask: "No test framework configured — use Jest or Vitest?"
```

Jest and Vitest have nearly identical test syntax (`describe`, `it`, `expect`, lifecycle hooks).
Differences are called out explicitly in this reference where they exist.

---

## File & Naming Conventions

| Element | Convention |
|---|---|
| Test files | `<module>.test.ts` or `<module>.spec.ts` |
| Location | Colocated with source, or in `__tests__/` — always match the project's existing convention |
| `.spec.ts` suffix | Standard in Angular and NestJS ecosystems |

---

## Test Structure

Use `describe` to mirror the structure of the module under test. Use `it` for individual cases —
it reads naturally as "it should…". `test` is functionally identical; use whichever is already
established in the project.

```typescript
import { formatCurrency } from './currency';

describe('formatCurrency', () => {
  it('should format positive amounts with two decimal places', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('should return $0.00 for a zero amount', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should throw RangeError for negative amounts', () => {
    expect(() => formatCurrency(-1)).toThrow(RangeError);
  });
});
```

---

## Typed Mocks

Always type mock return values. Untyped mocks silently drift from the real implementation when
types change — the test continues to pass while the mock lies about the shape of the real API.

```typescript
// jest.fn with explicit generics
const mockFindUser = jest.fn<Promise<User>, [number]>();
mockFindUser.mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@example.com' });

// Typed cast from jest.mocked (preferred for mocked imports)
import { fetchUser } from './userApi';
jest.mock('./userApi');
const mockFetchUser = jest.mocked(fetchUser);
mockFetchUser.mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@example.com' });
```

For Vitest, use `vi.fn()` with the same generic form:
```typescript
import { vi } from 'vitest';

const mockFindUser = vi.fn<[number], Promise<User>>();
mockFindUser.mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@example.com' });
```

---

## Module Mocking

`jest.mock()` is auto-hoisted to the top of the file. Use it for replacing an entire module
import. Prefer `jest.spyOn()` when only one method on an object needs mocking — it is less
invasive and preserves the rest of the real implementation.

```typescript
// Full module mock
jest.mock('./emailService');
import { sendEmail } from './emailService';

describe('UserRegistration', () => {
  it('should send welcome email after successful registration', async () => {
    const mockSend = jest.mocked(sendEmail);
    mockSend.mockResolvedValue(undefined);

    await registerUser({ email: 'alice@example.com', password: 'secret' });

    expect(mockSend).toHaveBeenCalledWith(
      'alice@example.com',
      expect.stringContaining('Welcome'),
    );
  });
});
```

```typescript
// Partial mock with spyOn — preferred when only one method needs controlling
const spy = jest.spyOn(userService, 'findById');
spy.mockResolvedValue({ id: 1, name: 'Alice', email: 'alice@example.com' });
```

---

## Test Lifecycle

Prefer `beforeEach`/`afterEach` over `beforeAll`/`afterAll` — per-test setup maximises isolation.

```typescript
describe('OrderService', () => {
  let service: OrderService;
  let mockRepo: jest.Mocked<OrderRepository>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<OrderRepository>;
    service = new OrderService(mockRepo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
```

Use `beforeAll`/`afterAll` only for expensive one-time setup that genuinely cannot be reset
between tests (e.g. starting a test server, opening a database connection).

---

## Readonly Fixtures

Test fixtures that should not be mutated must be declared `readonly`. This prevents accidental
state leakage across tests — a mutated fixture in one test producing a false positive or failure
in another is a silent bug.

```typescript
// Scalar fixtures — use as const
const TEST_USER = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
} as const;

// Array fixtures — use as const
const VALID_EMAILS = ['alice@example.com', 'user+tag@domain.org'] as const;
```

For mutable fixtures that must be reset between tests, construct them inside `beforeEach` — never
declare them at module scope without `as const`.

---

## Parameterized Tests

Use `it.each` / `test.each` for multi-case data-driven tests. Never write multiple near-identical
test functions when a parameterized form is available.

```typescript
describe('isValidEmail', () => {
  it.each([
    ['alice@example.com', true],
    ['not-an-email', false],
    ['', false],
    ['@example.com', false],
    ['user+tag@domain.org', true],
  ])('should return %s for input "%s"', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });
});
```

Tagged template literal form for better readability:
```typescript
it.each`
  input                  | expected
  ${'alice@example.com'} | ${true}
  ${'not-an-email'}      | ${false}
  ${''}                  | ${false}
`('should return $expected for "$input"', ({ input, expected }: { input: string; expected: boolean }) => {
  expect(isValidEmail(input)).toBe(expected);
});
```

---

## Async Tests

Always use `async/await`. Never return a promise from a test without `await` — unhandled promise
rejections are not guaranteed to fail the test in all Jest configurations.

```typescript
it('should return user data for a valid ID', async () => {
  const user = await userService.findById(1);

  expect(user.name).toBe('Alice');
  expect(user.email).toBe('alice@example.com');
});

it('should throw NotFoundError for an unknown ID', async () => {
  await expect(userService.findById(999)).rejects.toThrow(NotFoundError);
});
```

---

## Snapshot Testing

Snapshot tests capture serialized output and fail when it changes. Use them for outputs where
structural change is the signal — not as a substitute for explicit assertions.

```typescript
it('should render the user card with the correct structure', () => {
  const output = renderUserCard({ name: 'Alice', role: 'Admin' });
  expect(output).toMatchSnapshot();
});
```

**When snapshots are appropriate:**
- Serializable outputs: API response shapes, rendered template strings, CLI output
- Detecting unintended structural changes across refactors

**Anti-patterns to avoid:**
- Snapshotting large objects where most fields are irrelevant to the test concern
- Using snapshots as a substitute for explicit `expect(x).toBe(y)` assertions
- Blindly running `jest --updateSnapshot` without reviewing every diff
- More than ~10% of the test suite being snapshot-based

Snapshots must be committed to source control and reviewed in PR diffs like any other test.

---

## Integration Tests

For HTTP API integration tests without a running server, use `supertest`:

```typescript
import request from 'supertest';
import { app } from '../app';

describe('POST /users', () => {
  it('should create a user and return 201 with the new user ID', async () => {
    const response = await request(app)
      .post('/users')
      .send({ name: 'Alice', email: 'alice@example.com' })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe('Alice');
  });

  it('should return 400 when email is missing', async () => {
    await request(app)
      .post('/users')
      .send({ name: 'Alice' })
      .expect(400);
  });
});
```

Separate integration tests from unit tests with a dedicated config file:

```typescript
// jest.integration.config.ts
import type { Config } from 'jest';
import baseConfig from './jest.config';

const config: Config = {
  ...baseConfig,
  testMatch: ['**/*.integration.test.ts'],
  setupFilesAfterFramework: ['./tests/integration/setup.ts'],
};

export default config;
```

**NestJS projects** — use the testing module for DI wiring in integration tests:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

describe('UsersController (integration)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });
});
```

---

## TypeScript Compilation During Tests

**ts-jest** transpiles TypeScript and performs type-checking at test run time. Use it when you
want Jest to surface type errors in tests, not just runtime errors.

**Babel** (via `babel-jest`) transpiles TypeScript but does not type-check. Tests run faster but
type errors are silent until `tsc` is run separately.

Default recommendation: use `ts-jest` unless build time is a significant concern.

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};

export default config;
```

---

## Coverage Configuration

Configure coverage thresholds in `jest.config.ts` to enforce minimums as a CI gate. Tests pass
but the coverage command exits non-zero if any threshold is breached.

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/index.ts',
  ],
};

export default config;
```

For Vitest, configure thresholds in `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/index.ts'],
    },
  },
});
```

---

## Benchmarking (Vitest)

Use `vitest bench` for microbenchmarks in Vitest projects. Benchmarks live in `.bench.ts` files
or alongside tests. V8 JIT warmup is significant — Vitest bench handles warmup automatically.

```typescript
import { bench, describe } from 'vitest';
import { sortAscending } from './sort';

describe('sortAscending', () => {
  bench('1000 items already sorted', () => {
    const data = Array.from({ length: 1000 }, (_, i) => i);
    sortAscending(data);
  });

  bench('1000 items reverse sorted', () => {
    const data = Array.from({ length: 1000 }, (_, i) => 1000 - i);
    sortAscending(data);
  });
});
```

Run benchmarks:
```bash
vitest bench
```

Report ops/sec with margin of error — not raw milliseconds. A 5% difference without a confidence
interval is not a meaningful result.

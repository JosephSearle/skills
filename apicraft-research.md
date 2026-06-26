# APICraft Reference: What Makes a Production-Grade NestJS TypeScript API "Gold Standard"

**Version context:** NestJS 11 (released 2025-01-16; current package @nestjs/core 11.1.27). Requires **Node.js ≥ v20** (v18 support dropped — security EOL April 30, 2025); defaults to **Express v5 / Fastify v5**. NestJS v10/v11 differences flagged inline as **[v11]**.

---

## The Pareto 20%: Practices Covering 80% of Production Value

Before the deep dive, these are the highest-leverage practices. A senior who only had time for these would still ship a defensible API:

1. **Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`** — single highest-value line; defeats mass-assignment (OWASP API3:2023) and gives typed DTOs.
2. **Object-level authorization on every record fetch** (defeats BOLA, OWASP API1:2023). Never trust an ID from the request.
3. **Global exception filter emitting RFC 9457 problem+json**, never leaking stack traces in production.
4. **Structured JSON logging (Pino) with a correlation ID via AsyncLocalStorage**, with PII/secret redaction.
5. **Separation of concerns: Controller → Service → Repository → Entity**, keep singleton (DEFAULT) provider scope.
6. **`@nestjs/throttler` rate limiting + Helmet + strict CORS** at the edge.
7. **`@nestjs/config` with schema validation (Zod/Joi)** that fails fast on boot.
8. **Health checks (`@nestjs/terminus`) + `enableShutdownHooks()`** for zero-downtime deploys.
9. **Test pyramid: many fast unit tests (Vitest), integration tests against a real DB via Testcontainers, a few E2E with Supertest.**
10. **Multi-stage Docker build, non-root user, `prisma migrate deploy` (not `dev`) in CI/CD.**

---

## 1. NestJS Architecture Patterns

**Feature-based modular architecture.** Organize by domain feature (`users/`, `orders/`), each a `@Module` exporting only its public providers. Enforces domain boundaries and keeps modules independently scalable.

**Clean Architecture / DDD.** Layer the domain (entities, value objects), application (use-cases/services), and infrastructure (repositories, ORM). The repository pattern is the seam: services depend on a repository *interface*, infrastructure provides the ORM-backed implementation — making services unit-testable without a database.

**Repository pattern & testability.** With `@InjectRepository` (TypeORM) or a `PrismaService` wrapper, swap a mock in tests via `overrideProvider().useValue(mock)`.

**CQRS with `@nestjs/cqrs`.** Separates Commands (state change) from Queries (reads) and Events. Routes via constructor-name reflection to `@CommandHandler`-decorated providers. **Senior tradeoff:** CQRS adds significant boilerplate and hurts more than it helps below ~10k req/day or for teams new to DDD. Use CQRS *without* event sourcing as the pragmatic default; event sourcing adds schema-evolution pain and projection-rebuild complexity. **[v11]** Supports request-scoped providers and strongly-typed commands/events/queries.

**Request lifecycle (from docs.nestjs.com/faq/request-lifecycle):**
`Middleware → Guards → Interceptors (pre) → Pipes → Controller → Interceptors (post) → Exception Filters`

Key subtleties:
- Guards run **after all middleware but before any interceptor or pipe**.
- Interceptors resolve **first-in/last-out** on the return path.
- Pipes run last-to-first across parameters (query → params → body).
- **Filters resolve lowest-level-first** (route → controller → global) — the *opposite* of guards/interceptors/pipes which resolve global-first.
- Filters only fire on **uncaught** exceptions; a try/catch swallows them.

**When to use each NestJS primitive:**

| Primitive | Purpose | Example |
|-----------|---------|---------|
| Middleware | Raw req/res access before routing | Logging, body parsing |
| Guard | Authorization decision (`CanActivate`) | JWT auth, RBAC |
| Interceptor | Wrap req/response on both paths | Response transform, caching, timing |
| Pipe | Validate + transform arguments | `ValidationPipe`, `ParseIntPipe` |
| Filter | Catch exceptions, format error responses | RFC 9457 global filter |

**Module boundaries & `forwardRef`.** Circular dependencies require `forwardRef(() => OtherModule)`. `forwardRef` is a code smell — extract the shared dependency or use an event bus.

**Provider scope:**
- **DEFAULT (singleton)** — one instance for app lifetime; most performant; use for nearly everything.
- **REQUEST** — scope "bubbles up" — any provider injecting a request-scoped provider becomes request-scoped. Prefer `AsyncLocalStorage`/`nestjs-cls` for context propagation.
- **TRANSIENT** — fresh instance per consumer; for stateful helpers that must not be shared.

---

## 2. Security — OWASP API Security Top 10 (2023) mapped to NestJS

The 2023 OWASP API Security Top 10 (owasp.org/API-Security):

| # | Risk | NestJS Countermeasure |
|---|------|----------------------|
| API1 | BOLA | Per-record ownership check in service/guard |
| API2 | Broken Authentication | `@nestjs/jwt` + Passport, rotating refresh tokens |
| API3 | Broken Object Property Level Authorization | `ValidationPipe` whitelist + Response DTOs + `@Exclude` |
| API4 | Unrestricted Resource Consumption | `@nestjs/throttler` with Redis storage |
| API5 | Broken Function Level Authorization | `@Roles()` decorator + `RolesGuard` + CASL |
| API6 | Unrestricted Business Flow Access | Business-logic guards, CAPTCHA on sensitive flows |
| API7 | SSRF | URL allowlisting, block RFC1918/169.254.x.x |
| API8 | Security Misconfiguration | Helmet, strict CORS, disable stack traces in prod |
| API9 | Improper Inventory Management | URI versioning, retire old versions, secure Swagger |
| API10 | Unsafe Consumption of APIs | Validate/sanitize all third-party responses |

**Key senior notes:**

- **BOLA** (#1 since 2019, ~40% of API attacks): a route-level RBAC guard does NOT prevent it — per-record ownership check is required. Automated scanners cannot catch BOLA; manual two-account testing needed.
- **Token storage:** prefer HttpOnly+Secure cookies over localStorage to eliminate XSS token theft.
- **Refresh tokens must rotate** — a stolen refresh token dies on next legitimate use.
- **API4 distributed rate limiting:** in-memory `@nestjs/throttler` default doesn't share state across instances — use Redis storage provider.
- **SQL injection:** Prisma, TypeORM, and MikroORM parameterize by default. Raw escape hatches (`$queryRawUnsafe`, TypeORM `query()` with string interpolation) reintroduce injection.
- **Secret management:** `@nestjs/config` with Joi/Zod validation schema — app refuses to boot on missing env.

---

## 3. ORM Patterns — Prisma, TypeORM, MikroORM

### Prisma
- **Schema-first.** Define models in `schema.prisma`.
- **Critical migration distinction:** `prisma migrate dev` (development — generates + applies + regenerates client) vs `prisma migrate deploy` (CI/CD production — applies existing migrations only). **Never** run `migrate dev` in production — a classic incident.
- **PrismaService:** extend `PrismaClient`, implement `OnModuleInit` (`$connect`) and `OnModuleDestroy` (`$disconnect`); export from a `PrismaModule`.
- **N+1 prevention:** use `include`/`select`; select only needed fields.
- **Soft deletes / audit trails** via `deletedAt` column + Prisma Client extensions.
- **Unit testing:** `jest-mock-extended` or `prisma-mock`.
- **[Prisma 7]** Ships as ESM by default; with NestJS CommonJS set `moduleFormat = "cjs"` in the generator.

### TypeORM
- Prefer **Data Mapper** pattern over Active Record for testability.
- **Never** use `synchronize: true` in production (can drop columns).
- Inject `DataSource`/`EntityManager` for transactions.
- **QueryBuilder** for complex queries; **Subscribers/listeners** for audit trails.
- **Unit testing:** mock repos with `getRepositoryToken(Entity)` + mock value.

### MikroORM
- **Data Mapper, Unit of Work, Identity Map** patterns. `@mikro-orm/nestjs` is a community package.
- **RequestContext is mandatory:** EM is stateful — fork it per request via middleware or `@CreateRequestContext`. Failing to do this causes requests to share identity maps — a serious correctness bug.
- **Unit of Work:** auto-batches changes, flushes in one transaction on `em.flush()`, minimizing round-trips.
- Relies on `enableShutdownHooks()` to close connections cleanly.

**Choosing:**
- **Prisma** — best DX/type-safety; greenfield projects.
- **TypeORM** — most mature/ecosystem; teams familiar with Active Record.
- **MikroORM** — true Unit-of-Work/Identity-Map semantics; complex domain models.

---

## 4. REST API Design Standards

- **Resource naming:** plural nouns (`/users`, `/orders/{id}/items`), no verbs, lowercase, hyphenated.
- **HTTP status codes (senior nuances):**
  - `400` malformed request / `422` valid JSON but semantic validation fails
  - `401` = "who are you?" / `403` = "I know who you are, no"
  - To avoid leaking resource existence, some APIs return `404` instead of `403`
  - `201` always includes a `Location` header pointing to the new resource
- **Pagination:**
  - **Cursor/keyset** (`WHERE (created_at, id) < (?, ?)`) — 17x speedup on 1M+ row PostgreSQL datasets; stable under writes; no random access; no total count. Use for large, fast-changing data and public APIs.
  - **Offset** (`LIMIT/OFFSET`) — simple, supports random page access and total counts; degrades badly at depth (page 10k of a 10M-row table = 8.2s). Use for small/static datasets and admin UIs.
- **Filtering/sorting/searching:** whitelist allowed fields to prevent unindexed scans.
- **API versioning:** URI (`/v1/`) is most visible, cache-friendly, and easiest to test. Header/Media-Type versioning is cleaner URLs but harder to test.
- **Envelope pattern:** consistent `{ data, meta }` for lists; `meta` carries pagination tokens/counts.
- **Idempotency keys:** `Idempotency-Key` header for POST/PUT operations that must not double-execute (payments). Store first response, replay on retry.
- **PATCH semantics:** JSON Merge Patch is the pragmatic default.
- **Error format:** RFC 9457 Problem Details — see §8.

---

## 5. gRPC with NestJS

- **Transport setup:** `@nestjs/microservices` with `Transport.GRPC`; underlying `@grpc/grpc-js` + `@grpc/proto-loader`. Can run alongside HTTP in the same app (hybrid application pattern).
- **Proto design best practices:** versioned package names (`com.company.user.v1`), explicit field numbers, `optional` for nullable fields, reuse `google.protobuf.Timestamp`/`Empty`.
- **Code generation:** `ts-proto` with `nestJs=true` option for typed NestJS-compatible interfaces.
- **Streaming:** all via RxJS `Observable` — server-streaming, client-streaming, bidirectional.
- **Error handling:** throw `RpcException` with gRPC status codes. Use `nestjs-grpc-exceptions` (`GrpcServerExceptionFilter` + `GrpcToHttpInterceptor`) to translate codes on gateway services.
- **gRPC vs REST decision:**
  - gRPC: internal service-to-service, binary/HTTP2, low latency, strong contracts, streaming.
  - REST: public/browser-facing APIs, broad tooling, human readability.
- **gRPC-Web:** browsers cannot speak raw gRPC — requires a proxy (Envoy).
- **Health checks:** standard gRPC health-checking protocol; `@grpc/reflection` enables grpcurl introspection without `.proto` files.

---

## 6. Testing Strategy

**Pyramid:** many fast unit tests → fewer integration tests → minimal E2E tests.

| Layer | Tool | What to test | Database |
|-------|------|-------------|----------|
| Unit | Vitest | Services, guards, pipes, filters in isolation | Mocked |
| Integration | Vitest + Testcontainers | Real DB queries, module wiring | Real Postgres/Redis in Docker |
| E2E | Vitest + Supertest | Full HTTP request lifecycle | Real (shared with integration) |

**Why Vitest over Jest for NestJS.** Vitest is 2–5x faster than Jest (native ESM, esbuild/Rollup bundler vs Babel), has a Jest-compatible API (95%+ migration compatibility — `describe`/`it`/`expect`/`vi.mock` mirror `jest.mock`), ships built-in TypeScript support without `ts-jest`, and produces far fewer memory issues under long-running integration suites. NestJS docs are explicit that the framework is agnostic to test runner: *"you can use any testing framework that you like."*

**Critical NestJS gotcha — SWC transformer required.** Vitest's default esbuild transformer does **not** support decorator metadata (`emitDecoratorMetadata`), which NestJS's DI system depends on. You must swap in SWC:

```bash
npm install --save-dev vitest unplugin-swc @swc/core @swc/helpers
```

```typescript
// vitest.config.ts
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
  },
  plugins: [swc.vite()],
});
```

```json
// .swcrc — required for NestJS decorators
{
  "jsc": {
    "parser": { "syntax": "typescript", "decorators": true },
    "transform": {
      "legacyDecorator": true,
      "decoratorMetadata": true
    }
  }
}
```

**`vi.mock()` hoisting caveat.** Unlike Jest, Vitest hoists `vi.mock()` calls to the top of the file before variable initialization. If your mock factory references a `const` defined later in the same file, it hits a temporal dead zone error. Fix: use `vi.hoisted()` to declare values that need to be available when the mock factory runs.

**Key practices:**
- `Test.createTestingModule` with `overrideProvider().useValue(mock)` for unit tests — identical API to Jest.
- Start Testcontainers **once per suite** (`beforeAll`), not per file — pass dynamic host/port into env; increase Vitest timeout (`testTimeout` in `vitest.config.ts`).
- A globally-bound guard registered via `APP_GUARD: useClass` must be re-registered as `useExisting` to be overridable in tests.
- Co-locate unit tests with source files (`users.service.spec.ts`); put integration tests in `src/modules/__integration__/` and E2E in `test/`; run separately in CI: `vitest run --exclude '**/__integration__/**'` for fast unit-only runs.
- Coverage target: ≥80% branch coverage of business logic. Chasing 100% is low-value.
- **Contract testing:** Pact for consumer-driven contracts.
- **Load testing:** k6 or Artillery.
- **Mutation testing:** Stryker (supports Vitest).
- **Fixtures:** `fishery` for factory pattern; `@golevelup/ts-vitest` for typed mocks.

---

## 7. Validation and DTOs

**Global `ValidationPipe` config (gold standard):**
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // strip unknown properties
  forbidNonWhitelisted: true,   // reject unknown properties with 400
  transform: true,              // instantiate typed DTOs
  transformOptions: { enableImplicitConversion: true }, // query param typing
}));
```

**Key `class-validator` decorators:** `@IsString`, `@IsInt`, `@IsNumber`, `@IsBoolean`, `@IsEmail`, `@IsUUID`, `@IsEnum`, `@IsNotEmpty`, `@IsOptional`, `@MinLength`/`@MaxLength`, `@Min`/`@Max`, `@Matches`, `@IsArray`, `@ArrayMinSize`, `@ValidateNested`, `@IsDate`, `@IsUrl`.

**Key `class-transformer` decorators:** `@Exclude()` (hide from serialization), `@Expose()` (include/rename), `@Transform()` (custom mapping), `@Type()` (required for nested object/array validation).

**Senior pattern — Request vs Response DTOs:**
```
CreateUserDto   (input: validated, no password in response)
UserResponseDto (output: @Exclude() on password, @Expose() on public fields)
```
Never return entities directly. Map to response DTOs — defeats API3 over-exposure.

---

## 8. Error Handling

**RFC 9457 Problem Details** (`application/problem+json`, obsoletes RFC 7807):
```json
{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "The email field must be a valid email address.",
  "instance": "/api/v1/users",
  "errors": [{ "field": "email", "message": "Must be a valid email" }]
}
```

**Exception hierarchy:**
```
AppException
  ├── DomainException      (business-rule violations → 409/422)
  └── InfrastructureException (DB/network failures → 500)
```

**[v11]** `IntrinsicException` lets you throw exceptions the framework won't auto-log (useful for expected control-flow exceptions).

**Non-negotiables:**
- Never leak stack traces in production — sanitized body to client, full detail to logs.
- DB constraint violations (Prisma `P2002`/`P2003`, Postgres `23505`/`23503`) → translate to `409 Conflict` / `422`, never surface raw driver errors.
- Attach a request correlation ID to every error response so client-facing errors map to server logs.

---

## 9. Observability and Logging

**Logging — Pino vs Winston:**
- **Pino** (`nestjs-pino`): non-blocking async writes via worker thread, deferred JSON serialization, built-in redaction. Best for high-throughput APIs.
- **Winston:** more transports/flexibility. Use when you need many custom transports.
- **[v11]** Built-in `ConsoleLogger` now supports `json: true` — adequate for simpler apps.

**Correlation ID propagation:**
`nestjs-pino` uses `pino-http` to create a child logger per request in AsyncLocalStorage, stamping `req.id` on every log line across guards → services → repositories — without threading it through function arguments. Prefer `nestjs-cls` over REQUEST scope.

**Health checks (`@nestjs/terminus`):**
- **Liveness** endpoint: process is up.
- **Readiness** endpoint: DB/dependencies reachable — returns `503` when a dependency is down, stops load balancer routing.

**Metrics:** Prometheus via `@willsoto/nestjs-prometheus`.

**Distributed tracing:** OpenTelemetry with `TraceIdRatioBasedSampler(0.1)`, batch span processors; filter out `/health`/static requests to control cost.

**What NOT to log:** passwords, tokens, full auth headers, cookies, PII — configure redaction once in the Pino config.

---

## 10. Performance

- **Caching:** `@nestjs/cache-manager` with Redis store; `CacheInterceptor` for GET responses or manual `cacheManager.get/set`. **[v11]** Uses `cache-manager` v6 (Keyv-based).
- **DB connection pooling:** tune pool size per instance count (Prisma `connection_limit`, TypeORM `extra.max`).
- **Response compression:** `compression` middleware (Express) / `@fastify/compress`.
- **Fastify adapter:** 2–3x throughput on JSON-heavy endpoints vs Express. **Senior caveat:** for most APIs the bottleneck is the DB — switch adapters only when load testing confirms the framework (not the DB) is the constraint.
- **Lazy-loading modules:** `LazyModuleLoader` for large apps / serverless cold-start sensitivity.
- **Background jobs:** `@nestjs/bullmq` (BullMQ over Redis); handle SIGTERM for graceful worker shutdown.
- **Streaming large responses:** `StreamableFile` / Node streams instead of buffering entire payloads.

---

## 11. API Documentation

**`@nestjs/swagger` setup:**
```typescript
const config = new DocumentBuilder()
  .setTitle('API')
  .setDescription('...')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);
```

**Key decorators:** `@ApiTags`, `@ApiProperty`/`@ApiPropertyOptional` (with `example`/`description`), `@ApiResponse`/`@ApiOkResponse`/`@ApiCreatedResponse`, `@ApiBearerAuth`, `@ApiOperation`.

**Versioning mechanics** (`docs.nestjs.com/techniques/versioning`): `app.enableVersioning({ type: VersioningType.URI })` adds a `/v1/` prefix. Apply `@Version('1')` per route or `@Controller({ version: '1' })` per controller. If versioning is enabled but a route has no version, requests return 404. Highest-matching-version selection from a CUSTOM extractor array is unreliable on the Express adapter (works on Fastify).

**Production notes:**
- Protect or disable the Swagger route in production — exposed Swagger aids attackers (OWASP API9).
- Use the swagger CLI plugin to infer schema from TypeScript types, reducing `@ApiProperty()` duplication and drift.
- Empty DTO schemas in Swagger usually mean missing `@ApiProperty()` decorators.

---

## 12. DevOps and CI/CD

**Multi-stage Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
RUN addgroup -S nestjs && adduser -S nestjs -G nestjs
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER nestjs
CMD ["node", "dist/main"]
```

**CI/CD pipeline:**
```
lint (biome check) → type-check (tsc --noEmit) → unit tests → integration tests (Testcontainers) → E2E → build → security scan → deploy
```

**Graceful shutdown:**
- `app.enableShutdownHooks()` (disabled by default).
- On SIGTERM: `onModuleDestroy → beforeApplicationShutdown → onApplicationShutdown`.
- **Docker gotcha:** Node as PID 1 ignores default-action signals — use `docker run --init` or Tini.
- `nestjs-graceful-shutdown` (http-terminator) handles lingering keep-alive connections.
- **[v11]** Termination hook order was reversed.

**DB migrations:** run `prisma migrate deploy` (or TypeORM `migration:run`) as a discrete deploy step — **never** `prisma migrate dev` in production.

---

## 13. Code Quality

### Biome (replaces ESLint + Prettier)

Biome is a Rust-based toolchain handling formatting (Prettier), linting (ESLint), and import sorting in a single binary with zero peer dependencies — one package, one `biome.json`. It is **10–25x faster** than the ESLint+Prettier stack.

**Biome v2** (June 2025, codename Biotype) added type-aware linting without invoking the TypeScript compiler — `noFloatingPromises` and similar rules now work at ~85% of `@typescript-eslint` coverage.

**Bootstrap:**
```bash
npm install --save-dev @biomejs/biome
npx @biomejs/biome init
```

**NestJS-specific required config** — Biome's `useImportType` rule produces false positives on NestJS because it cannot detect that decorator metadata turns a type import into a runtime value. This rule **must be disabled** in every NestJS project:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "style": {
        "useImportType": "off"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  }
}
```

**Remaining gap:** Biome covers ~85% of `@typescript-eslint`'s type-aware rules. The missing ~15% is covered by `tsc --noEmit` in CI — which **must always run as a mandatory CI gate**.

**Migrating an existing project:**
```bash
npx @biomejs/biome migrate eslint --write
npx @biomejs/biome migrate prettier --write
npx @biomejs/biome check --write .
# Commit as a formatting-only change
```

### Other code quality practices

- **TypeScript strict mode:** `"strict": true`; add `noFallthroughCasesInSwitch`, `noImplicitReturns`. Scaffold with `nest new --strict`.
- **Husky pre-commit + lint-staged:** run `biome check --write` on staged `.ts` files (~0.3s vs ~28s for the old ESLint stack).
- **SonarQube/CodeClimate:** track code smells, duplication, and coverage trends in CI.
- **Naming conventions:** files `kebab-case.type.ts` (`users.service.ts`, `create-user.dto.ts`, `roles.guard.ts`); classes `PascalCase`. The Nest CLI (`nest g`) enforces these.
- **Dependency management:** Renovate/Dependabot for safe, incremental updates; audit breaking changes before bumping majors.

---

## Recommendations (Staged)

**Stage 1 — Foundation (day one for any new API)**
Global `ValidationPipe`, RFC 9457 exception filter, `@nestjs/config` with schema validation, Pino logging + correlation ID, Helmet, strict CORS, `@nestjs/throttler`, Controller→Service→Repository layering, Biome config with `useImportType: off`, Husky/lint-staged, CI with Biome + `tsc --noEmit` + Vitest unit tests.

**Stage 2 — Production-readiness**
`@nestjs/terminus` liveness/readiness + `enableShutdownHooks()`, multi-stage Dockerfile (node:20-alpine, non-root, Tini), Testcontainers integration tests, per-record authorization on every resource route, refresh-token rotation, separate Response DTOs, migrations via `migrate deploy` as a discrete deploy job.

**Stage 3 — Scale / hardening**
Redis caching + Redis-backed throttler storage, OpenTelemetry tracing with sampling, Prometheus metrics, BullMQ for async work, cursor pagination for >100k row lists. Switch to Fastify only if load testing proves the framework (not DB) is the bottleneck. Adopt CQRS only if read/write models genuinely diverge.

---

## Caveats

- **Benchmarks are directional.** Fastify 2–3x throughput, 17x cursor-pagination speedup, Biome 10–25x speed — all vary by workload and hardware.
- **"BOLA = 40% of attacks"** is contested; Wallarm's 2026 analysis attributes 52% of 2025 incidents to broken auth. Both risks are critical regardless of the exact percentage.
- **Biome `useImportType` + NestJS decorators** is a known open issue (biomejs/biome #5305). The `"off"` workaround is the current official Biome documentation recommendation.
- **Biome type-aware gap:** ~15% of `@typescript-eslint` type-aware edge cases not caught. `tsc --noEmit` in CI compensates.
- **Third-party packages** (`@mikro-orm/nestjs`, `nestjs-pino`, `nestjs-grpc-exceptions`, `nestjs-graceful-shutdown`, `@willsoto/nestjs-prometheus`) are community-maintained — vet maintenance status before adopting.

---

## Source Quality Scores

*(10 = official docs/standards; 8–9 = vendor/maintainer blogs; 6–7 = established engineering blogs; 4–5 = community posts)*

| Section | Source | Score |
|---------|--------|-------|
| Architecture (§1) | docs.nestjs.com (lifecycle, scopes, CQRS, testing) | 10 |
| Architecture (§1) | trilon.io (NestJS consultancy) | 9 |
| Security (§2) | owasp.org/API-Security 2023 | 10 |
| Security (§2) | cloudflare.com, veracode.com, salt.security | 7–8 |
| Security (§2) | StackHawk, Wallarm (breach stats) | 6–7 |
| ORM (§3) | prisma.io/docs, mikro-orm.io, docs.nestjs.com | 10 |
| ORM (§3) | logrocket.com "Comparing 4 NestJS ORMs" | 7 |
| REST Design (§4) | rfc-editor.org (RFC 9457) | 10 |
| REST Design (§4) | swagger.io, axway.com (problem details) | 7–8 |
| REST Design (§4) | milanjovanovic.tech, designgurus.substack.com (pagination) | 6–7 |
| gRPC (§5) | docs.nestjs.com/microservices/grpc | 10 |
| gRPC (§5) | deepwiki (nestjs/nest), dev.to (grpc errors) | 5–7 |
| Testing (§6) | docs.nestjs.com/fundamentals/testing | 10 |
| Testing (§6) | vitest.dev/guide/comparisons (official Vitest docs) | 10 |
| Testing (§6) | blog.ablo.ai (NestJS Jest→Vitest migration, SWC config) | 7 |
| Testing (§6) | ecosire.com (Vitest NestJS 2026 guide, 1300+ tests) | 7 |
| Testing (§6) | blockydevs.com, arg-software (Testcontainers) | 6–7 |
| Validation/Errors (§7–8) | docs.nestjs.com/techniques/validation | 10 |
| Errors (§8) | rfc-editor.org (RFC 9457), swagger.io | 9–10 |
| Observability (§9) | docs.nestjs.com (terminus, logger) | 10 |
| Observability (§9) | last9.io (OpenTelemetry), wanago.io | 6–7 |
| Performance (§10) | docs.nestjs.com/techniques/performance | 10 |
| Performance (§10) | wfnext.com, scalablebackend.com (benchmarks) | 6–7 |
| Docs/DevOps (§11–12) | docs.nestjs.com (swagger, versioning, lifecycle) | 10 |
| Code Quality / Biome (§13) | biomejs.dev/blog/biome-v2 (official release notes) | 10 |
| Code Quality / Biome (§13) | biomejs.dev/linter/rules/use-import-type (official docs) | 10 |
| Code Quality / Biome (§13) | github.com/biomejs/biome/discussions/5305 (official tracker) | 9 |
| Code Quality / Biome (§13) | betterstack.com (Biome vs ESLint deep dive) | 7 |
| Code Quality / Biome (§13) | pockit.tools, peal.dev, devtoolbox.blog (community comparisons) | 5–6 |
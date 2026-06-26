---
name: apicraft-context
description: >
  Shared reference card loaded before every other apicraft-* skill. Establishes
  NestJS 11 version context, canonical toolchain decisions (Biome, Vitest, SWC),
  ORM detection from package.json, and the top-10 Pareto practices every production
  NestJS API must implement. Not a task-execution skill — it provides context
  that other apicraft-* skills depend on.
  Triggers on: any apicraft-* skill trigger; "NestJS version", "what version of NestJS".
version: 1.0.0
---

## NestJS 11 Version Context

**Required Node.js:** ≥ 20 (v18 dropped — security EOL April 30, 2025)
**Default HTTP adapter:** Express v5 (Fastify v5 also supported)
**Package:** `@nestjs/core` 11.x (released 2025-01-16)

### Key v11 changes

| Change | Impact |
|--------|--------|
| `IntrinsicException` | Throw exceptions the framework won't auto-log — for expected control-flow exceptions |
| Termination hook order reversed | `onModuleDestroy → beforeApplicationShutdown → onApplicationShutdown` (opposite of v10) |
| `cache-manager` v6 (Keyv-based) | `@nestjs/cache-manager` now uses Keyv; Redis store config has changed |
| CQRS request-scoped providers | `@nestjs/cqrs` supports request-scoped providers and strongly-typed commands/events/queries |
| `ConsoleLogger` `json: true` | Built-in logger now supports JSON output — adequate for simple apps |

---

## Canonical Toolchain

| Tool | Replaces | Rationale |
|------|----------|-----------|
| **Biome** | ESLint + Prettier | Rust-based, 10–25x faster; single binary with linting, formatting, import sorting; v2 adds type-aware rules |
| **Vitest** | Jest | 2–5x faster (native ESM, esbuild/Rollup); Jest-compatible API (95%+ compat); built-in TypeScript support without `ts-jest` |
| **SWC transformer** | esbuild (Vitest default) | Vitest's default esbuild does NOT support `emitDecoratorMetadata`; NestJS DI silently breaks without SWC |
| **`tsc --noEmit` CI gate** | Relying on Biome alone | Biome v2 covers ~85% of `@typescript-eslint` type-aware rules; `tsc` catches the remaining 15% |

---

## ORM Detection

Read `package.json` dependencies to identify the ORM in use:

```
prisma or @prisma/client    → ORM: Prisma
typeorm or @nestjs/typeorm  → ORM: TypeORM
@mikro-orm/core             → ORM: MikroORM
```

If multiple ORMs are present or none is found, ask: **"Which ORM is this project using: Prisma, TypeORM, or MikroORM?"**

Cache the answer as "ORM in use: [Prisma | TypeORM | MikroORM]" for the session. Load the matching `apicraft-orm-*` skill when ORM-specific patterns are needed.

---

## The 10 Pareto Practices

A production NestJS API must implement all ten. Skills cover each in depth — this card gives the quick-reference.

| # | Practice | Primary skill |
|---|----------|--------------|
| 1 | `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` — defeats mass-assignment (OWASP API3) | `apicraft-validation` |
| 2 | Object-level authorization on every record fetch (defeats BOLA, OWASP API1) | `apicraft-security` |
| 3 | Global exception filter emitting RFC 9457 `problem+json`, no stack traces in production | `apicraft-error-handling` |
| 4 | Structured JSON logging (Pino) with correlation ID via AsyncLocalStorage + PII redaction | `apicraft-observability` |
| 5 | Controller → Service → Repository → Entity separation; singleton provider scope | `apicraft-architecture` |
| 6 | `@nestjs/throttler` rate limiting + Helmet + strict CORS | `apicraft-security` |
| 7 | `@nestjs/config` with Zod/Joi schema validation — crashes on missing env at boot | `apicraft-project-setup` |
| 8 | Health checks (`@nestjs/terminus`) + `enableShutdownHooks()` for zero-downtime deploys | `apicraft-observability` |
| 9 | Test pyramid: Vitest unit tests, Testcontainers integration tests, Supertest E2E | `apicraft-testing` |
| 10 | Multi-stage Docker build, non-root user, `prisma migrate deploy` (not `dev`) in CI/CD | `apicraft-devops` |

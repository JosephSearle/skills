---
name: apicraft-architecture
description: >
  Feature-based modular architecture, Clean Architecture / DDD layering,
  Controller→Service→Repository→Entity separation, when to use each NestJS
  primitive (Guard, Interceptor, Pipe, Filter, Middleware), the full request
  lifecycle, provider scope decisions, module boundary rules, forwardRef as a
  design smell, and the CQRS decision tree. Requires apicraft-context to be
  loaded first.
  Triggers on: "scaffold a module", "how should I structure", "what pattern should I use",
  "set up a new feature", "is this the right architecture", "module structure",
  "feature module", "Guard vs Interceptor", "provider scope", "forwardRef", "CQRS",
  "request lifecycle", "DDD", "Clean Architecture", "repository pattern".
  Not for security implementation — use apicraft-security. Not for ORM-specific
  patterns — use the relevant apicraft-orm-* skill.
version: 1.0.0
---

## Core Philosophy

NestJS's primitives (Guards, Interceptors, Pipes, Filters) map directly to concerns in the request lifecycle. The most common senior error is reaching for the wrong primitive — adding auth logic in middleware instead of a Guard, doing response transformation in a service instead of an Interceptor. Understanding the lifecycle order is not trivia; it determines whether your code runs at all and in what context. Feature-based modules enforce domain boundaries that prevent the "service soup" that kills NestJS apps at scale.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ Scaffolding a new feature module → load references/primitives.md §Module structure
  ├─ Choosing between Guard/Interceptor/Pipe/Filter → load references/primitives.md §Primitive decision
  ├─ Understanding request lifecycle order → load references/request-lifecycle.md
  ├─ Deciding on provider scope → load references/primitives.md §Provider scope
  ├─ Evaluating CQRS adoption → load references/cqrs.md
  └─ forwardRef usage → load references/primitives.md §Module boundaries
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| Request lifecycle order, gotchas (filter resolution order, etc.) | `references/request-lifecycle.md` |
| Primitive decision table, provider scope, module boundaries, forwardRef | `references/primitives.md` |
| CQRS decision tree, event sourcing tradeoffs | `references/cqrs.md` |

## Step 3 — Execute

### Feature-based module structure

```
src/
  users/                        ← domain feature module
    dto/
      create-user.dto.ts
      update-user.dto.ts
      user-response.dto.ts
    entities/
      user.entity.ts            ← DB representation (ORM entity)
    users.controller.ts         ← HTTP transport layer only
    users.service.ts            ← business logic
    users.repository.ts         ← data access abstraction
    users.module.ts
    users.controller.spec.ts
    users.service.spec.ts
  orders/                       ← another domain feature
    ...
  common/                       ← shared non-feature code
    filters/
    guards/
    interceptors/
    pipes/
    decorators/
  config/
  app.module.ts
  main.ts
```

### Layer responsibilities

| Layer | Class | Responsibility | Must NOT |
|-------|-------|---------------|----------|
| Controller | `UsersController` | Parse HTTP request, delegate to service, return HTTP response | Contain business logic |
| Service | `UsersService` | Business logic, orchestration, call repository | Know about HTTP or ORM details |
| Repository | `UsersRepository` | Data access, ORM queries | Contain business logic |
| Entity | `User` | Database shape (columns, relations) | Contain business logic |

> 💡 **Senior insight:** The repository layer is the seam for testability. If `UsersService` calls `UsersRepository` through an interface, unit tests inject a mock repository. If the service imports TypeORM/Prisma directly, the test is forced to mock the entire ORM.

### Module anatomy

```typescript
// users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // only export what other modules actually need
})
export class UsersModule {}
```

Export the minimum necessary. Exporting `UsersRepository` from `UsersModule` means other modules can bypass the service layer — don't do it.

→ See `references/request-lifecycle.md` for the pipeline order every NestJS developer needs to know.
→ See `references/primitives.md` for the primitive decision table.
→ See `apicraft-security` for Guard patterns (JWT auth, RBAC, BOLA checks).

## Step 4 — Validate

- [ ] Feature organized into domain module directories (not by type)
- [ ] Controllers contain no business logic — only HTTP parsing + service delegation
- [ ] Services depend on repository interface, not ORM directly
- [ ] Module exports are minimal (only what other modules need)
- [ ] No `forwardRef` — if present, extract the shared dependency into its own module
- [ ] Provider scope is DEFAULT (singleton) unless there's an explicit reason for REQUEST/TRANSIENT

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/request-lifecycle.md` | Pipeline order, execution gotchas | Understanding execution flow |
| `references/primitives.md` | Guard/Interceptor/Pipe/Filter decision, provider scope, forwardRef | Choosing primitives or scope |
| `references/cqrs.md` | CQRS adoption criteria, event sourcing tradeoffs | Evaluating CQRS |

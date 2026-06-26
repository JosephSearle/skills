# NestJS Primitives, Provider Scope, and Module Boundaries

**Authority:** docs.nestjs.com/guards, docs.nestjs.com/interceptors, docs.nestjs.com/pipes

---

## Primitive Decision Table

| Primitive | Purpose | When to use | When NOT to use |
|-----------|---------|-------------|-----------------|
| **Middleware** | Raw `req`/`res` before routing | Logging, body parsing, CORS, session | Authorization (use Guard); response transform (use Interceptor) |
| **Guard** | Authorization: `CanActivate` → `boolean` | JWT auth, RBAC, per-record ownership | Validation (use Pipe); response modification (use Interceptor) |
| **Interceptor** | Wrap handler on entry AND exit path | Response transform, caching, timing, retry | Authorization (use Guard); error handling (use Filter) |
| **Pipe** | Validate + transform route arguments | `ValidationPipe`, `ParseIntPipe`, `ParseUUIDPipe` | Auth decisions (use Guard); global response transform (use Interceptor) |
| **Filter** | Catch uncaught exceptions → format error response | Global RFC 9457 error format, translating DB errors | Request validation (use Pipe); authorization (use Guard) |

---

## Provider Scope

| Scope | Lifetime | Performance | Use when |
|-------|----------|-------------|----------|
| **DEFAULT (singleton)** | One instance for app lifetime | Best — no allocation per request | 99% of cases: services, repositories, guards |
| **REQUEST** | New instance per HTTP request | Expensive — scope "bubbles up" through the DI graph | Request-specific state that can't use `AsyncLocalStorage` |
| **TRANSIENT** | New instance per consumer injection | Moderate — per-consumer allocation | Stateful helpers that must not share state between injectors |

> ⚠️ **Gotcha — REQUEST scope bubbles up:** If Provider A is REQUEST-scoped, any Provider B that injects A also becomes REQUEST-scoped automatically. This can propagate through the entire dependency graph unexpectedly. Prefer `AsyncLocalStorage` (via `nestjs-cls`) for request-scoped context propagation — it doesn't affect provider scope.

> 💡 **Senior insight:** REQUEST scope is almost always the wrong solution. The need for "request-scoped state" is usually the need to propagate a value (user ID, trace ID) through the call stack — and `AsyncLocalStorage` does that without making your entire service graph request-scoped.

---

## Module Boundaries

### Feature module — export only what other modules need

```typescript
@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // NOT UsersRepository — keep data access internal
})
export class UsersModule {}
```

### Global module — for truly cross-cutting providers

```typescript
@Global()
@Module({
  providers: [ClsService, ConfigService],
  exports: [ClsService, ConfigService],
})
export class CoreModule {}
```

Use `@Global()` sparingly — it bypasses module boundary enforcement and makes dependencies implicit.

---

## forwardRef — a Design Smell

`forwardRef` resolves circular dependencies between modules or providers:

```typescript
// Module A imports Module B, Module B imports Module A
@Module({
  imports: [forwardRef(() => OrdersModule)],
})
export class UsersModule {}
```

> ⚠️ **Gotcha:** `forwardRef` is a code smell. Circular dependencies mean your module boundary design is wrong. Two modules that depend on each other should be restructured: extract the shared dependency into a third module, or use an event bus (`@nestjs/cqrs` EventBus, or NestJS event emitter) to decouple them.

**How to fix circular deps:**

1. Extract the shared logic into a third module (`SharedModule`, `CoreModule`)
2. Use an event bus — module A emits an event, module B handles it; neither imports the other
3. Use `REQUEST`-scoped injection with `@Inject(forwardRef(() => SomeService))` as a last resort — but prefer the structural fix

# NestJS Request Lifecycle

**Authority:** docs.nestjs.com/faq/request-lifecycle

---

## The Pipeline

```
Incoming Request
      │
      ▼
  Middleware          ← raw req/res access; runs before routing
      │
      ▼
    Guards            ← authorization decision (CanActivate)
      │
      ▼
 Interceptors (pre)   ← wrap the handler on the way in
      │
      ▼
    Pipes             ← validate + transform arguments
      │
      ▼
  Controller Handler  ← route handler method executes
      │
      ▼
 Interceptors (post)  ← wrap the handler on the way out
      │
      ▼
Exception Filters     ← catch uncaught exceptions, format error response
      │
      ▼
  HTTP Response
```

---

## Execution Order Rules

**Global vs controller vs route registration order:**

Guards, Interceptors, Pipes: **global → controller → route** (outermost-first on entry)

Filters: **route → controller → global** (innermost-first — the OPPOSITE of all other primitives)

> ⚠️ **Gotcha:** Exception filters resolve in the reverse order from guards/interceptors/pipes. A global filter catches exceptions not caught by a route-level filter. This surprises most developers who assume all primitives follow the same resolution order.

---

## Detailed Gotchas

| Primitive | Gotcha |
|-----------|--------|
| **Guards** | Run AFTER all middleware but BEFORE any interceptor or pipe. If you need `req.user` in a Guard, make sure your auth middleware has already run (or use a Guard itself to set `req.user`). |
| **Interceptors** | Resolve first-in/last-out on the return path — like a stack. The outermost interceptor wraps the inner ones. Good for response transformation, caching, and timing. |
| **Pipes** | Run last-to-first across parameters: query params → path params → body. The validation result is what the controller receives; the guard already ran. |
| **Filters** | Only fire on **uncaught** exceptions. A `try/catch` in the handler that swallows the error bypasses the filter entirely — the response will be empty or hang. Always re-throw or convert to a typed `HttpException`. |
| **Middleware** | Has access to raw `req`/`res` before NestJS routing resolves the handler. Cannot access route metadata (decorators). Use for cross-cutting concerns that don't need `@SetMetadata`. |

---

## Registration Scope

Each primitive can be registered at three scopes. Registration order within each scope follows the order of the array:

```typescript
// Global (app-wide, registered in main.ts or via APP_* tokens)
app.useGlobalGuards(new JwtAuthGuard());
app.useGlobalInterceptors(new LoggingInterceptor());
app.useGlobalPipes(new ValidationPipe({ ... }));
app.useGlobalFilters(new AllExceptionsFilter());

// Via APP_* tokens (DI available inside the class — preferred for production)
{ provide: APP_GUARD, useExisting: JwtAuthGuard }
{ provide: APP_INTERCEPTOR, useClass: LoggingInterceptor }
{ provide: APP_PIPE, useClass: ValidationPipe }
{ provide: APP_FILTER, useClass: AllExceptionsFilter }

// Controller-level (decorator on @Controller)
@UseGuards(RolesGuard)
@UseInterceptors(CacheInterceptor)

// Route-level (decorator on the method)
@UseGuards(OwnershipGuard)
@UsePipes(new ParseIntPipe())
```

> ⚠️ **Gotcha:** `useGlobalGuards()` / `useGlobalFilters()` do NOT go through the NestJS DI container. You cannot inject services into primitives registered this way. Use `APP_GUARD` / `APP_FILTER` tokens instead when the primitive needs access to a service (e.g., `ClsService`, `JwtService`).

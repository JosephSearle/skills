---
name: apicraft-error-handling
description: >
  Global exception filter, RFC 9457 Problem Details error format, NestJS exception
  hierarchy, correlation ID attachment, and safe production error responses for NestJS
  APIs. Covers DB constraint violation translation, the IntrinsicException v11 pattern,
  and the non-negotiable rule of never leaking stack traces in production. Requires
  apicraft-context to be loaded first.
  Triggers on: "error handling", "exception filter", "problem details", "RFC 7807",
  "RFC 9457", "exception hierarchy", "error response format", "stack trace", "P2002",
  "P2003", "23505", "IntrinsicException", "AppException", "DomainException".
  Not for input validation errors — use apicraft-validation.
version: 1.0.0
---

## Core Philosophy

Every unhandled exception that escapes a NestJS handler should produce an RFC 9457 `application/problem+json` response with a correlation ID and no stack trace. The most dangerous default is NestJS's built-in exception filter, which includes the stack trace in development and a generic message in production — neither format is useful to clients, and the dev format is actively harmful if it leaks. A global exception filter that owns the entire error surface gives you control.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ Set up the global exception filter → load references/problem-details.md
  ├─ Model the exception hierarchy → load references/exception-hierarchy.md
  ├─ Translate DB constraint errors (P2002, 23505) → load references/problem-details.md §DB violations
  ├─ Use v11 IntrinsicException → load references/exception-hierarchy.md §IntrinsicException
  └─ Attach correlation IDs to errors → load references/problem-details.md §Correlation ID
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| RFC 9457 filter implementation, DB violation translation, correlation ID | `references/problem-details.md` |
| Exception class hierarchy, IntrinsicException, non-negotiables | `references/exception-hierarchy.md` |

## Step 3 — Execute

### RFC 9457 error format

```json
{
  "type": "https://api.example.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "The email field must be a valid email address.",
  "instance": "/api/v1/users",
  "traceId": "abc123def456",
  "errors": [{ "field": "email", "message": "Must be a valid email" }]
}
```

Register the global exception filter in `main.ts`:

```typescript
import { HttpAdapterHost } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
  await app.listen(3000);
}
```

> ⚠️ **Gotcha:** Filters only catch **uncaught** exceptions. A `try/catch` that swallows an error without re-throwing will bypass the global filter — the response will be empty or hang. Always re-throw or convert to a typed exception.

> 💡 **Senior insight:** Register the filter via `APP_FILTER` token instead of `useGlobalFilters` if you need DI inside the filter (e.g., to inject a logger or `ClsService` for the correlation ID). `useGlobalFilters` doesn't go through the DI container.

→ See `references/problem-details.md` for the complete filter implementation.
→ See `apicraft-observability` for correlation ID setup with `nestjs-pino` and `nestjs-cls`.

## Step 4 — Validate

- [ ] Global exception filter registered (not relying on NestJS default filter)
- [ ] All responses use `application/problem+json` content type
- [ ] Stack traces never appear in production responses
- [ ] DB constraint violations (P2002, 23505) return 409, not 500
- [ ] Every error response includes a correlation/trace ID
- [ ] Exception hierarchy uses typed exceptions (`DomainException`, `InfrastructureException`)

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/problem-details.md` | RFC 9457 filter, DB violation translation, correlation IDs | Setting up error responses |
| `references/exception-hierarchy.md` | Exception classes, IntrinsicException, non-negotiables | Modelling domain/infra exceptions |

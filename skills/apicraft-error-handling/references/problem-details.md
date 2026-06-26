# RFC 9457 Problem Details — NestJS Implementation

**Authority:** rfc-editor.org/rfc/rfc9457 (obsoletes RFC 7807)

---

## RFC 9457 Shape

```json
{
  "type": "https://api.example.com/errors/resource-not-found",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "User with id 'abc-123' does not exist.",
  "instance": "/api/v1/users/abc-123",
  "traceId": "abc123def456789"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | URI identifying the error type; must be dereferenceable to human-readable docs |
| `title` | Yes | Short, human-readable summary of the error type |
| `status` | Yes | HTTP status code (mirrors the response status) |
| `detail` | No | Human-readable explanation of this specific occurrence |
| `instance` | No | URI of the specific request that caused the error |
| `traceId` | No | Correlation/trace ID for cross-referencing with server logs (custom extension) |

---

## Global Exception Filter — Complete Implementation

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail: string | undefined;
    let extensions: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        const res = response as Record<string, unknown>;
        title = (res['error'] as string | undefined) ?? exception.message;
        detail = Array.isArray(res['message'])
          ? (res['message'] as string[]).join('; ')
          : (res['message'] as string | undefined);
        if (Array.isArray(res['message'])) {
          extensions['errors'] = res['message'];
        }
      } else {
        title = response as string;
      }
    } else if (exception instanceof Error) {
      // Log the real error but sanitize the response
      this.logger.error(exception.message, exception.stack);
      detail = undefined; // never leak internal error details in production
    }

    const traceId = request.headers['x-trace-id'] as string | undefined;

    const body: Record<string, unknown> = {
      type: `https://api.example.com/errors/${title.toLowerCase().replace(/\s+/g, '-')}`,
      title,
      status,
      instance: request.url,
      ...(detail && { detail }),
      ...(traceId && { traceId }),
      ...extensions,
    };

    httpAdapter.reply(ctx.getResponse<Response>(), body, status);
  }
}
```

Register in `main.ts` — use `APP_FILTER` if you need DI inside the filter:

```typescript
// Option A: useGlobalFilters (no DI inside filter)
const httpAdapterHost = app.get(HttpAdapterHost);
app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

// Option B: APP_FILTER token (DI available — inject Logger, ClsService, etc.)
// In AppModule providers:
{ provide: APP_FILTER, useClass: AllExceptionsFilter }
```

---

## Correlation ID Attachment

Use `nestjs-cls` to propagate a request-scoped trace ID through the call stack without polluting function signatures:

```typescript
import { ClsModule } from 'nestjs-cls';
import { v4 as uuidv4 } from 'uuid';

// In AppModule imports:
ClsModule.forRoot({
  middleware: {
    mount: true,
    generateId: true,
    idGenerator: (req: Request) =>
      (req.headers['x-trace-id'] as string) ?? uuidv4(),
  },
}),
```

Read in the filter:

```typescript
import { ClsService } from 'nestjs-cls';

// Inject in APP_FILTER version:
constructor(
  private readonly httpAdapterHost: HttpAdapterHost,
  private readonly cls: ClsService,
) {}

// In catch():
const traceId = this.cls.getId();
```

---

## DB Constraint Violation Translation

Never surface raw driver errors. Translate to meaningful HTTP responses.

### Prisma

```typescript
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

function handlePrismaError(error: PrismaClientKnownRequestError): HttpException {
  switch (error.code) {
    case 'P2002': {
      const fields = (error.meta?.['target'] as string[] | undefined)?.join(', ');
      return new ConflictException(`A record with this ${fields ?? 'value'} already exists`);
    }
    case 'P2003': {
      return new UnprocessableEntityException('Related record does not exist');
    }
    case 'P2025': {
      return new NotFoundException('Record not found');
    }
    default:
      throw error; // re-throw — unhandled Prisma codes become 500
  }
}
```

Catch in the global filter or in a dedicated Prisma exception layer:

```typescript
if (exception instanceof PrismaClientKnownRequestError) {
  const httpException = handlePrismaError(exception);
  // ... format as problem+json
}
```

### PostgreSQL (TypeORM / MikroORM raw driver errors)

```typescript
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

if (exception instanceof QueryFailedError) {
  const pgError = exception as unknown as { code: string };
  if (pgError.code === PG_UNIQUE_VIOLATION) {
    throw new ConflictException('A record with this value already exists');
  }
  if (pgError.code === PG_FOREIGN_KEY_VIOLATION) {
    throw new UnprocessableEntityException('Related record does not exist');
  }
}
```

# Exception Hierarchy

**Authority:** docs.nestjs.com/exception-filters

---

## Exception Class Hierarchy

```
AppException (base)
  ├── DomainException      → business-rule violations → 409 Conflict / 422 Unprocessable
  └── InfrastructureException → DB/network/external service failures → 500
```

### AppException (base)

```typescript
import { HttpException } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    message: string,
    status: number,
    public readonly code?: string,
  ) {
    super({ message, code }, status);
  }
}
```

### DomainException (business rule violations)

Use for expected, user-actionable errors: duplicate data, invalid state transitions, business rule violations.

```typescript
import { HttpStatus } from '@nestjs/common';

export class DomainException extends AppException {
  constructor(message: string, code?: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY, code);
  }
}

export class ConflictDomainException extends AppException {
  constructor(message: string, code?: string) {
    super(message, HttpStatus.CONFLICT, code);
  }
}
```

Usage in service layer:

```typescript
async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
  const existing = await this.usersRepository.findByEmail(dto.email);
  if (existing) {
    throw new ConflictDomainException('A user with this email already exists', 'USER_EMAIL_CONFLICT');
  }
  // ...
}
```

### InfrastructureException (DB/network failures)

Use for unexpected, non-user-actionable failures. Log with full context; return a sanitized 500 to the client.

```typescript
export class InfrastructureException extends AppException {
  constructor(message: string, public readonly cause?: Error) {
    super(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
```

---

## IntrinsicException (NestJS v11)

`IntrinsicException` lets you throw exceptions that the NestJS framework will NOT auto-log. Use for expected control-flow exceptions (e.g., breaking out of a stream) that would pollute error logs if auto-logged.

```typescript
import { IntrinsicException } from '@nestjs/core';

// The framework logs all unhandled exceptions — except IntrinsicException subclasses
export class ExpectedAbortException extends IntrinsicException {
  constructor(reason: string) {
    super(reason);
  }
}
```

This is a v11 addition. In v10, you had to suppress auto-logging via a custom logger filter.

---

## Non-Negotiables

1. **Never leak stack traces in production.** Set `NODE_ENV=production` and sanitize the response body in the exception filter. Full stack trace goes to the logger only.

2. **Sanitize internal error messages.** `InfrastructureException` should return `"An unexpected error occurred"` to clients, not the raw Prisma error or database message.

3. **Log with context, respond with correlation ID.** The client gets a `traceId`; the server logs include the full exception with that same ID. Support connects the two.

4. **DB constraint violations are not 500s.** A `P2002` (unique constraint violation) is a 409. Treating it as 500 makes it look like a system fault when it's a user error.

5. **Typed exceptions over raw `HttpException`.** Using `DomainException` and `InfrastructureException` makes intent visible and enables type-safe handling in the global filter.

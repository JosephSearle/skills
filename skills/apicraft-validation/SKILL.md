---
name: apicraft-validation
description: >
  DTOs, input validation, and response serialization for NestJS APIs. Covers the
  global ValidationPipe production config, the full class-validator and
  class-transformer decorator sets, Request vs Response DTO separation (the
  pattern that defeats OWASP API3 over-exposure), nested object validation, and
  custom validators. Requires apicraft-context to be loaded first.
  Triggers on: "DTO", "validation", "class-validator", "class-transformer",
  "ValidationPipe", "input validation", "request body", "response serialization",
  "whitelist", "forbidNonWhitelisted", "transform", "@IsString", "@Exclude", "@Type".
  Not for error response formatting — use apicraft-error-handling.
version: 1.0.0
---

## Core Philosophy

Validation is the single highest-leverage security control in a NestJS API. A correctly configured `ValidationPipe` with DTO whitelisting defeats mass-assignment (OWASP API3:2023) automatically. The common senior mistake is configuring `ValidationPipe` correctly but then returning entities directly — undoing the protection by exposing every field on the entity. Request DTOs validate input; Response DTOs control output. They are separate classes for separate purposes.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ Setting up ValidationPipe globally → load references/dto-patterns.md §Global ValidationPipe
  ├─ Writing a DTO with class-validator → load references/dto-patterns.md §Decorator reference
  ├─ Nested object validation failing → load references/dto-patterns.md §Nested validation gotcha
  ├─ Hiding fields from response / response serialization → load references/dto-patterns.md §Response DTOs
  └─ Custom business-rule validation → load references/custom-validators.md
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| ValidationPipe config, class-validator, class-transformer, DTO separation | `references/dto-patterns.md` |
| Custom `@ValidatorConstraint` validators, Swagger alignment | `references/custom-validators.md` |

## Step 3 — Execute

### Global ValidationPipe

Register once in `main.ts`. This is the canonical production config:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // strip unknown properties before they reach the handler
      forbidNonWhitelisted: true,   // reject request with 400 if unknown properties are present
      transform: true,              // instantiate typed DTOs (not plain JS objects)
      transformOptions: {
        enableImplicitConversion: true, // coerce query param strings to number/boolean via @Type
      },
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

> ⚠️ **Gotcha:** `transform: true` alone doesn't coerce query param strings. Add `enableImplicitConversion: true` to handle `?page=1` arriving as a string and mapping to a `number` field.

### Request vs Response DTO separation

> 💡 **Senior insight:** The most common API3 (Broken Object Property Level Authorization) bug is returning a TypeORM/Prisma entity directly from a controller. The entity has a `password` hash, `refreshToken`, internal flags — all exposed. Separate DTOs fix this structurally, not via ad-hoc field omission.

```typescript
// CREATE request DTO — validates inbound data
export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

// RESPONSE DTO — controls what leaves the API
import { Exclude, Expose } from 'class-transformer';

@Exclude()  // exclude everything by default
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  email: string;

  // password is NOT @Expose() — never returned

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
```

Enable `ClassSerializerInterceptor` globally to apply `@Exclude`/`@Expose`:

```typescript
import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

In the controller:

```typescript
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
  const user = await this.usersService.findOne(id);
  return new UserResponseDto(user);
}
```

→ See `apicraft-error-handling` for how to format error responses.
→ See `apicraft-security` for per-record ownership checks (BOLA) that go beyond DTO whitelisting.

## Step 4 — Validate

- [ ] `ValidationPipe` registered globally in `main.ts` with all four options
- [ ] Every inbound route has a typed DTO decorated with `class-validator` decorators
- [ ] No route handler returns an entity directly — mapped to a Response DTO
- [ ] `ClassSerializerInterceptor` registered globally
- [ ] Nested objects use `@ValidateNested()` + `@Type(() => NestedDto)`
- [ ] Custom validators implement `ValidatorConstraintInterface`

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/dto-patterns.md` | ValidationPipe, class-validator, class-transformer, DTO separation | Always for validation tasks |
| `references/custom-validators.md` | `@ValidatorConstraint`, Swagger CLI plugin alignment | Custom business-rule validation needed |

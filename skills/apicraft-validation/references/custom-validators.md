# Custom Validators and Swagger Alignment

**Authority:** docs.nestjs.com/techniques/validation#custom-validation-decorators

---

## Custom Validator with @ValidatorConstraint

Use `@ValidatorConstraint` to encode business rules that built-in decorators can't express:

```typescript
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Injectable } from '@nestjs/common';

// Mark as Injectable so NestJS can inject services into it
@ValidatorConstraint({ name: 'isUniqueEmail', async: true })
@Injectable()
export class IsUniqueEmailConstraint implements ValidatorConstraintInterface {
  constructor(private readonly usersService: UsersService) {}

  async validate(email: string, _args: ValidationArguments): Promise<boolean> {
    const existing = await this.usersService.findByEmail(email);
    return !existing;
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'Email $value is already in use';
  }
}

// Convenience decorator wrapping the constraint
export function IsUniqueEmail(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsUniqueEmailConstraint,
    });
  };
}
```

Register the constraint in the module so NestJS can inject dependencies into it:

```typescript
import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { useContainer } from 'class-validator';

@Module({
  providers: [
    IsUniqueEmailConstraint,
    {
      provide: APP_PIPE,
      useFactory: (moduleRef) => {
        const pipe = new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        });
        useContainer(moduleRef, { fallbackOnErrors: true });
        return pipe;
      },
    },
  ],
})
export class AppModule {}
```

> ⚠️ **Gotcha:** `useContainer(app.select(AppModule), { fallbackOnErrors: true })` must be called after `NestFactory.create()` and before `app.listen()` when using `useGlobalPipes`. Without it, the DI container isn't available and async validators that inject services will throw.

Use the custom decorator in a DTO:

```typescript
export class CreateUserDto {
  @IsEmail()
  @IsUniqueEmail({ message: 'This email is already registered' })
  email: string;
}
```

---

## Cross-Field Validation

For validators that compare multiple fields (e.g., `password === confirmPassword`):

```typescript
@ValidatorConstraint({ name: 'matchesField' })
export class MatchesFieldConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints as [string];
    const relatedValue = (args.object as Record<string, unknown>)[relatedPropertyName];
    return value === relatedValue;
  }

  defaultMessage(args: ValidationArguments): string {
    const [relatedPropertyName] = args.constraints as [string];
    return `${args.property} must match ${relatedPropertyName}`;
  }
}

export function MatchesField(property: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [property],
      validator: MatchesFieldConstraint,
    });
  };
}

// Usage
export class ChangePasswordDto {
  @IsString() @MinLength(8) password: string;
  @MatchesField('password') confirmPassword: string;
}
```

---

## Swagger CLI Plugin Alignment

The `@nestjs/swagger` CLI plugin infers schema from TypeScript types, reducing the need to duplicate `@ApiProperty()` on every DTO field.

Enable in `nest-cli.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": true,
          "introspectComments": true
        }
      }
    ]
  }
}
```

With `classValidatorShim: true`, the plugin reads `class-validator` decorators and automatically maps them to Swagger constraints (e.g., `@MinLength(2)` → `minLength: 2` in the schema).

> ⚠️ **Gotcha:** Empty DTO schemas in the Swagger UI mean the plugin isn't running, or the DTO file isn't being picked up. Check that the file uses `export class` (not interfaces) and that `nest build` (not `ts-node` directly) is used.

→ See `apicraft-documentation` for full Swagger/OpenAPI setup including CLI plugin configuration.

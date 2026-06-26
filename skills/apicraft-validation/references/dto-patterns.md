# DTO Patterns — class-validator, class-transformer, ValidationPipe

**Authority:** docs.nestjs.com/techniques/validation

---

## Global ValidationPipe — Option Breakdown

```typescript
new ValidationPipe({
  whitelist: true,              // strips unknown properties — not just ignores them
  forbidNonWhitelisted: true,   // returns 400 if unknown properties are present
  transform: true,              // instantiates typed DTO classes (not plain objects)
  transformOptions: {
    enableImplicitConversion: true,
  },
})
```

| Option | What it does | Without it |
|--------|-------------|------------|
| `whitelist: true` | Strips properties not decorated with a class-validator decorator | Unknown props silently pass through to handler — mass-assignment risk |
| `forbidNonWhitelisted: true` | Returns 400 if the request contains properties not in the DTO | Without `whitelist`, unknown props are ignored; this makes them an error |
| `transform: true` | Instantiates the DTO class (so `instanceof CreateUserDto` works, and class methods are available) | `req.body` is a plain `{}` — no class methods, no `@Transform` applied |
| `enableImplicitConversion: true` | Coerces `"1"` → `1`, `"true"` → `true` for query params by inspecting the TypeScript type | Query string numbers arrive as strings and fail `@IsInt()` |

---

## class-validator Decorator Reference

```typescript
import {
  IsString, IsInt, IsNumber, IsBoolean, IsEmail, IsUUID, IsEnum,
  IsNotEmpty, IsOptional, MinLength, MaxLength, Min, Max,
  Matches, IsArray, ArrayMinSize, ValidateNested, IsDate, IsUrl,
  IsIn, IsDefined, IsPositive,
} from 'class-validator';
```

| Decorator | Use case |
|-----------|----------|
| `@IsString()` | Validates primitive string |
| `@IsInt()` | Integer — fails on floats |
| `@IsNumber()` | Number (int or float) |
| `@IsBoolean()` | Boolean |
| `@IsEmail()` | RFC 5322 email |
| `@IsUUID('4')` | UUID v4 |
| `@IsEnum(MyEnum)` | Enum member |
| `@IsNotEmpty()` | Non-empty string / non-null |
| `@IsOptional()` | Skip validation if value is `undefined` or `null` |
| `@MinLength(n)` / `@MaxLength(n)` | String length bounds |
| `@Min(n)` / `@Max(n)` | Numeric bounds |
| `@Matches(/regex/)` | Regex match |
| `@IsArray()` | Array type |
| `@ArrayMinSize(n)` | Minimum array length |
| `@ValidateNested({ each: true })` | Validate nested object(s) |
| `@IsDate()` | Date object |
| `@IsUrl()` | Valid URL |
| `@IsPositive()` | `> 0` |

---

## class-transformer Decorator Reference

```typescript
import { Exclude, Expose, Transform, Type } from 'class-transformer';
```

| Decorator | Use case |
|-----------|----------|
| `@Exclude()` | Exclude property from serialization (on class → excludes all; on property → excludes that property) |
| `@Expose()` | Include property when class has `@Exclude()` |
| `@Transform(({ value }) => ...)` | Custom value mapping during serialization/deserialization |
| `@Type(() => NestedClass)` | Tell class-transformer which class to instantiate for a nested object |

---

## Nested Object Validation

> ⚠️ **Gotcha:** `@ValidateNested()` alone does NOT validate nested objects. Without `@Type(() => NestedDto)`, class-transformer doesn't know what class to instantiate, so the nested object stays a plain `{}` and `class-validator` skips it silently.

```typescript
// WRONG — nested validation silently skipped
export class CreateOrderDto {
  @ValidateNested()
  address: AddressDto;
}

// CORRECT
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}

// For arrays of nested objects
export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
```

---

## Request vs Response DTO Pattern

Never return an entity directly. Always map to a Response DTO.

```typescript
// Entity (database representation)
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  password: string;  // hashed

  @Column({ nullable: true })
  refreshToken: string;

  @CreateDateColumn()
  createdAt: Date;
}

// Request DTO (inbound)
export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

// Response DTO (outbound) — only expose safe fields
@Exclude()
export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  createdAt: Date;

  // password and refreshToken are NOT @Expose() — they never appear in responses

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
```

Service layer maps entity → response DTO:

```typescript
async create(dto: CreateUserDto): Promise<UserResponseDto> {
  const user = await this.usersRepository.save({
    email: dto.email,
    password: await bcrypt.hash(dto.password, 12),
  });
  return new UserResponseDto(user);
}
```

---

## Update DTO with Partial Validation

Use `PartialType` from `@nestjs/mapped-types` to make all fields optional for PATCH:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

`PartialType` applies `@IsOptional()` to all inherited properties — avoiding manual duplication.

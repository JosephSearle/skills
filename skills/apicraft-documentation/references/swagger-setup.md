# Swagger / OpenAPI Setup

**Authority:** docs.nestjs.com/openapi/introduction

---

## Install

```bash
npm install @nestjs/swagger
```

---

## Setup in main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';

  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('My API')
      .setDescription('API documentation')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth', // reference name for @ApiBearerAuth('JWT-auth')
      )
      .addServer('http://localhost:3000', 'Local')
      .addServer('https://staging.api.example.com', 'Staging')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  await app.listen(3000);
}
```

> ⚠️ **Gotcha:** Swagger UI in production is OWASP API9 — it documents every endpoint, parameter, and auth scheme, giving attackers a complete map. Conditionally disable as shown above. If you need Swagger in staging, protect it with HTTP Basic Auth or an IP allowlist.

---

## Decorator Quick-Reference

| Decorator | Where | Purpose |
|-----------|-------|---------|
| `@ApiTags('users')` | Controller | Groups routes in Swagger UI |
| `@ApiOperation({ summary: '...' })` | Method | Documents the route purpose |
| `@ApiProperty({ example: 'test@example.com' })` | DTO property | Documents request/response fields |
| `@ApiPropertyOptional({ example: 'John' })` | DTO property | Optional field with example |
| `@ApiResponse({ status: 201, type: UserResponseDto })` | Method | Documents a specific status code |
| `@ApiOkResponse({ type: UserResponseDto })` | Method | 200 response shorthand |
| `@ApiCreatedResponse({ type: UserResponseDto })` | Method | 201 response shorthand |
| `@ApiNotFoundResponse({ description: 'User not found' })` | Method | 404 response |
| `@ApiBearerAuth('JWT-auth')` | Method or Controller | Marks route as requiring JWT |
| `@ApiBody({ type: CreateUserDto })` | Method | Documents request body |
| `@ApiParam({ name: 'id', type: 'string', format: 'uuid' })` | Method | Documents path param |
| `@ApiQuery({ name: 'cursor', required: false })` | Method | Documents query param |

```typescript
@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller({ version: '1', path: 'users' })
export class UsersController {
  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiBody({ type: CreateUserDto })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> { ... }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> { ... }
}
```

---

## Swagger CLI Plugin

The CLI plugin reads TypeScript types and `class-validator` decorators to auto-infer `@ApiProperty()` — reducing duplication and preventing drift between validation and documentation.

`nest-cli.json`:

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

With `classValidatorShim: true`:
- `@IsString()` → `type: string` in Swagger schema
- `@IsEmail()` → `format: email`
- `@MinLength(8)` → `minLength: 8`
- `@IsOptional()` → `required: false`

> ⚠️ **Gotcha:** Empty DTO schemas in Swagger UI mean the plugin isn't running. Check that:
> 1. `nest-cli.json` has the plugin config
> 2. You're using `nest build` (not `tsc` directly or `ts-node`)
> 3. DTOs use `export class` (not interfaces — interfaces aren't emitted to JS)

---

## Generating OpenAPI JSON

Export the spec to a file for client generation, contract testing, or CI validation:

```typescript
// scripts/generate-openapi.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';

async function generateSpec() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  writeFileSync('./openapi.json', JSON.stringify(document, null, 2));

  await app.close();
}

generateSpec();
```

Add to CI to validate the spec hasn't changed unexpectedly (OpenAPI contract testing).

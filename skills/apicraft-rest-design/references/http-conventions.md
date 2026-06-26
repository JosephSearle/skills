# HTTP Conventions for REST APIs

**Authority:** rfc-editor.org (RFC 9457, RFC 7231, RFC 7807)

---

## Resource Naming

| Rule | CORRECT | WRONG |
|------|---------|-------|
| Plural nouns | `/users`, `/orders` | `/user`, `/order` |
| No verbs | `/orders/{id}/cancel` (PATCH) | `/cancelOrder/{id}` |
| Lowercase + hyphenated | `/product-categories` | `/ProductCategories`, `/product_categories` |
| Nested resources | `/orders/{orderId}/items/{itemId}` | `/getOrderItem?orderId=x&itemId=y` |

---

## HTTP Status Code Decision Table

| Status | Meaning | When to use |
|--------|---------|-------------|
| `200 OK` | Successful GET, PUT, PATCH | General success with body |
| `201 Created` | Resource created | POST that creates a resource; include `Location` header |
| `204 No Content` | Success, no body | DELETE, or PUT/PATCH when no response body needed |
| `207 Multi-Status` | Bulk operation with mixed results | POST to `/users/batch` where some succeed and some fail |
| `400 Bad Request` | Malformed request | Unparseable JSON, missing required header, syntax error |
| `401 Unauthorized` | Missing/invalid auth credentials | No `Authorization` header, expired token |
| `403 Forbidden` | Authenticated but not authorized | Valid JWT but lacks the required role/permission |
| `404 Not Found` | Resource doesn't exist | Also use instead of 403 for sensitive resources (avoids existence leak) |
| `409 Conflict` | State conflict | Duplicate resource, optimistic lock failure |
| `422 Unprocessable Entity` | Valid syntax, invalid semantics | Business rule validation failure, `class-validator` rejection |
| `429 Too Many Requests` | Rate limit exceeded | `@nestjs/throttler` response |
| `500 Internal Server Error` | Unexpected server error | Catch-all for unhandled exceptions |
| `503 Service Unavailable` | Dependency down | Health check readiness endpoint when DB unreachable |

### 401 vs 403 — the security distinction

- `401 Unauthorized` — "Prove who you are" — the request lacks authentication. Per RFC 7235, must include `WWW-Authenticate` response header.
- `403 Forbidden` — "I know who you are, access denied" — the request is authenticated but the user lacks permission.

Returning `403` when the user is unauthenticated is a common error that confuses clients.

### 201 Created — Location header is required

```typescript
@Post()
@HttpCode(201)
async create(
  @Body() dto: CreateUserDto,
  @Res({ passthrough: true }) response: Response,
): Promise<UserResponseDto> {
  const user = await this.usersService.create(dto);
  response.setHeader('Location', `/v1/users/${user.id}`);
  return new UserResponseDto(user);
}
```

### 207 Multi-Status — bulk operations

```typescript
// POST /users/batch
interface BatchResult {
  id: string;
  status: 'created' | 'failed';
  error?: string;
}

@Post('batch')
@HttpCode(207)
async createBatch(@Body() dto: BatchCreateUsersDto): Promise<BatchResult[]> {
  return Promise.all(
    dto.users.map(async (userDto) => {
      try {
        const user = await this.usersService.create(userDto);
        return { id: user.id, status: 'created' as const };
      } catch (error) {
        return { id: userDto.email, status: 'failed' as const, error: error.message };
      }
    }),
  );
}
```

---

## PATCH Semantics — JSON Merge Patch

PATCH updates only the fields provided. `null` means "clear this field". Absent means "leave unchanged".

```typescript
// JSON Merge Patch (RFC 7396) — the pragmatic default
// PATCH /users/123
// Body: { "name": "New Name" }  ← only name changes; email, password unchanged

@Patch(':id')
async update(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdateUserDto,  // PartialType(CreateUserDto) — all fields optional
): Promise<UserResponseDto> {
  return this.usersService.update(id, dto);
}
```

---

## Idempotency Keys

Prevent double-execution of non-idempotent operations (payments, order creation):

```typescript
// Client sends: POST /orders with header: Idempotency-Key: <uuid>
// Server stores first response and replays it on retry

@Post()
async create(
  @Body() dto: CreateOrderDto,
  @Headers('idempotency-key') idempotencyKey: string | undefined,
): Promise<OrderResponseDto> {
  if (idempotencyKey) {
    const cached = await this.idempotencyService.get(idempotencyKey);
    if (cached) return cached; // replay stored response
  }

  const order = await this.ordersService.create(dto);
  const response = new OrderResponseDto(order);

  if (idempotencyKey) {
    await this.idempotencyService.set(idempotencyKey, response, 86400); // 24h TTL
  }

  return response;
}
```

---

## API Versioning

| Strategy | URL shape | Cache-friendly | Easy to test | NestJS support |
|----------|-----------|---------------|--------------|----------------|
| URI versioning | `/v1/users` | Yes | Yes (browser, curl) | Full |
| Header versioning | `Accept-Version: 1` | No | Requires custom headers | Full |
| Media-Type versioning | `Accept: application/vnd.api+json;version=1` | No | Complex | Full |

**URI versioning is the default recommendation.** Most visible, easiest to test, cache-friendly.

```typescript
// main.ts
import { VersioningType } from '@nestjs/common';
app.enableVersioning({ type: VersioningType.URI });

// Controller — version at class level
@Controller({ version: '1', path: 'users' })
export class UsersV1Controller {}

// Or at route level
@Get(':id')
@Version('1')
async findOne() {}

// Routes without @Version() return 404 when versioning is enabled
```

> ⚠️ **Gotcha:** When `enableVersioning()` is active, any route without a `@Version()` decorator (or `VERSION_NEUTRAL`) returns 404. Add `@Version(VERSION_NEUTRAL)` to health check and metadata routes that should be accessible without a version prefix.

→ See `apicraft-documentation` for full versioning mechanics including the Fastify vs Express CUSTOM extractor caveat.

# API Versioning Mechanics

**Authority:** docs.nestjs.com/techniques/versioning

---

## Versioning Strategy Comparison

| Strategy | URL shape | Cache-friendly | Easy to test | NestJS support | Recommendation |
|----------|-----------|---------------|--------------|----------------|----------------|
| URI versioning | `/v1/users` | ✅ Yes | ✅ Browser, curl | Full | **Default — use this** |
| Header versioning | `Accept-Version: 1` | ❌ No | Requires custom header tooling | Full | Use only when clean URLs required |
| Media-Type versioning | `Accept: application/vnd.api+json;version=1` | ❌ No | Complex | Full | REST purist choice; harder to use |
| Custom extractor | Any scheme | Varies | Varies | Full | Advanced only |

---

## URI Versioning Setup

```typescript
// main.ts
import { VersioningType, VERSION_NEUTRAL } from '@nestjs/common';

app.enableVersioning({
  type: VersioningType.URI,
  // Optional: set a default version (applied when no @Version() decorator present)
  // defaultVersion: '1',
});
```

> ⚠️ **Gotcha:** If `enableVersioning()` is active WITHOUT `defaultVersion`, any route that lacks `@Version()` returns `404`. This catches health checks, metrics, and unversioned legacy routes. You have two options:
> 1. Add `@Version(VERSION_NEUTRAL)` to infrastructure routes
> 2. Set `defaultVersion: '1'` — but this silently routes unversioned requests to v1, which may surprise future maintainers

---

## Route-Level Versioning

```typescript
// Version on the controller (all routes in this controller are v1)
@Controller({ version: '1', path: 'users' })
export class UsersV1Controller {}

// Version on a specific route
@Controller('users')
export class UsersController {
  @Get(':id')
  @Version('1')
  findOneV1(@Param('id') id: string) { ... }

  @Get(':id')
  @Version('2')
  findOneV2(@Param('id') id: string) { ... } // different implementation for v2
}

// Multiple versions served by the same handler
@Get(':id')
@Version(['1', '2'])
findOne(@Param('id') id: string) { ... }
```

---

## VERSION_NEUTRAL — Routes Without a Version Prefix

Apply `VERSION_NEUTRAL` to routes that must be accessible without a version prefix:

```typescript
import { VERSION_NEUTRAL } from '@nestjs/common';

@Controller('health')
@Version(VERSION_NEUTRAL)
export class HealthController {
  @Get('live')
  live() { ... }      // accessible at /health/live (no /v1/ prefix)

  @Get('ready')
  ready() { ... }
}
```

Also useful for: `/metrics`, `/.well-known/`, `openapi.json` export endpoints.

---

## CUSTOM Version Extractor Caveat

> ⚠️ **Gotcha:** The CUSTOM versioning type with a highest-matching-version selection algorithm is unreliable on the **Express adapter** when multiple versions are in an array. It works correctly on **Fastify**. If you need complex version selection logic (e.g., "use the highest version ≤ requested"), use the Fastify adapter for that specific use case.

---

## Header Versioning

```typescript
app.enableVersioning({
  type: VersioningType.HEADER,
  header: 'Accept-Version',
});
```

Client sends: `Accept-Version: 1`

---

## Media-Type Versioning

```typescript
app.enableVersioning({
  type: VersioningType.MEDIA_TYPE,
  key: 'v=', // extracted from Accept: application/json;v=1
});
```

Client sends: `Accept: application/json;v=1`

---

## AsyncAPI for Event-Driven APIs

If your NestJS app exposes event-driven endpoints (WebSockets, Kafka consumers), AsyncAPI provides the documentation standard equivalent to OpenAPI for REST:

```bash
npm install @asyncapi/nestjs-asyncapi
```

AsyncAPI documents: channels (topics), message schemas, bindings (Kafka, WebSocket), and operation IDs. It's the right tool when your "API" is a set of events, not HTTP endpoints.

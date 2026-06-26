---
name: apicraft-documentation
description: >
  Swagger/OpenAPI documentation with @nestjs/swagger: full setup, decorator quick-ref,
  CLI plugin for reducing @ApiProperty duplication, protecting the Swagger UI in
  production (OWASP API9), API versioning mechanics (VersioningType.URI, @Version(),
  VERSION_NEUTRAL), and the Fastify vs Express caveat on CUSTOM version extractors.
  Requires apicraft-context to be loaded first.
  Triggers on: "Swagger", "OpenAPI", "API docs", "documentation", "versioning",
  "@ApiProperty", "SwaggerModule", "@ApiTags", "@ApiBearerAuth", "API versioning",
  "enableVersioning", "VERSION_NEUTRAL", "Swagger UI", "openapi.json".
  Not for error format — use apicraft-error-handling. Not for gRPC service definition — use
  apicraft-grpc.
version: 1.0.0
---

## Core Philosophy

Swagger documentation and API versioning are the two "future-you" investments in API design. Swagger serves as the live contract between your API and its clients — and it's also an attack surface (OWASP API9). Versioning strategy is a day-one decision; retrofitting URI versioning into an existing API is painful. Both deserve careful setup at project bootstrap, not as afterthoughts.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ Setting up Swagger → load references/swagger-setup.md
  ├─ Missing @ApiProperty on DTO fields → load references/swagger-setup.md §CLI plugin
  ├─ Swagger UI in production → load references/swagger-setup.md §Production security
  ├─ API versioning setup → load references/versioning.md
  ├─ Routes returning 404 after enableVersioning → load references/versioning.md §Version gotchas
  └─ CUSTOM version extractor → load references/versioning.md §CUSTOM extractor caveat
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| Full Swagger/OpenAPI setup, decorator reference, CLI plugin, production security | `references/swagger-setup.md` |
| `enableVersioning`, `@Version()`, `VERSION_NEUTRAL`, Express vs Fastify caveat | `references/versioning.md` |

## Step 3 — Execute

> ⚠️ **Gotcha:** Exposed Swagger UI in production is OWASP API9 (Improper Inventory Management). The endpoint documents every route, parameter, and auth scheme — giving attackers a complete target list. Protect or disable it in production.

> ⚠️ **Gotcha:** When `enableVersioning()` is active, any route without a `@Version()` decorator (or `VERSION_NEUTRAL`) returns 404 — including health checks, metrics, and other infrastructure routes that shouldn't be versioned. Apply `@Version(VERSION_NEUTRAL)` to those routes.

→ See `references/swagger-setup.md` for the complete Swagger setup and decorator table.
→ See `references/versioning.md` for versioning mechanics and the CUSTOM extractor caveat.
→ See `apicraft-validation` for the Swagger CLI plugin's dependency on `@ApiProperty` and `class-validator`.

## Step 4 — Validate

- [ ] `SwaggerModule.setup()` called in `main.ts`
- [ ] Swagger UI disabled or protected behind auth in production
- [ ] `@nestjs/swagger` CLI plugin enabled in `nest-cli.json`
- [ ] `@ApiTags()` applied to all controllers
- [ ] `@ApiBearerAuth()` applied to all authenticated routes
- [ ] `enableVersioning()` called in `main.ts` before `listen()`
- [ ] Infrastructure routes (`/health`, `/metrics`) decorated with `@Version(VERSION_NEUTRAL)`
- [ ] Swagger `addServer()` configured for staging/production base URLs

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/swagger-setup.md` | Swagger setup, decorators, CLI plugin, production | Swagger/OpenAPI documentation |
| `references/versioning.md` | API versioning mechanics, VERSION_NEUTRAL, CUSTOM caveat | API versioning |

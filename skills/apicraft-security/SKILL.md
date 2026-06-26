---
name: apicraft-security
description: >
  OWASP API Security Top 10 (2023) mapped to NestJS implementations with code for
  the non-obvious countermeasures. Emphasis on BOLA (why route-level RBAC is not
  enough), JWT refresh token rotation, Redis-backed distributed rate limiting,
  Helmet + CORS configuration, and secret management with @nestjs/config. Requires
  apicraft-context to be loaded first.
  Triggers on: "how do I secure", "authentication", "authorization", "rate limiting",
  "OWASP", "JWT", "RBAC", "guards", "helmet", "CORS", "BOLA", "broken auth",
  "refresh token", "secret management", "per-record ownership", "mass assignment".
  Not for DTO validation — use apicraft-validation. Not for error response format — use
  apicraft-error-handling.
version: 1.0.0
---

## Core Philosophy

BOLA (Broken Object-Level Authorization) has been the #1 OWASP API risk since 2019 because it can't be fixed by a framework feature — it requires a manual ownership check on every record fetch. A route-level `@Roles('admin')` guard controls whether a user can call the endpoint, not whether the record they're requesting belongs to them. These are different checks. Both are required. Most NestJS apps implement only the first.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ OWASP overview / security audit → load references/owasp-api-top10.md
  ├─ JWT authentication setup → load references/authentication.md
  ├─ Per-record authorization / BOLA prevention → load references/authorization.md
  ├─ RBAC / roles → load references/authorization.md §RBAC
  ├─ Rate limiting with Redis → load references/owasp-api-top10.md §API4
  └─ Secret management / config validation → see apicraft-project-setup §Config validation
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| Full OWASP API Top 10 mapped to NestJS, Helmet, CORS, throttler | `references/owasp-api-top10.md` |
| JWT setup, refresh token rotation, token storage | `references/authentication.md` |
| BOLA per-record check, RBAC with @Roles(), CASL | `references/authorization.md` |

## Step 3 — Execute

### The check every record-fetch route must have

```typescript
// WRONG — only checks role, not record ownership
@Get(':id')
@Roles('user')
@UseGuards(JwtAuthGuard, RolesGuard)
async findOne(@Param('id') id: string): Promise<UserResponseDto> {
  return this.usersService.findOne(id); // user can fetch ANY user's record!
}

// CORRECT — role check + ownership check
@Get(':id')
@UseGuards(JwtAuthGuard)
async findOne(
  @Param('id', ParseUUIDPipe) id: string,
  @CurrentUser() currentUser: JwtPayload,
): Promise<UserResponseDto> {
  const user = await this.usersService.findOne(id);
  if (user.id !== currentUser.sub && !currentUser.roles.includes('admin')) {
    throw new ForbiddenException();
  }
  return new UserResponseDto(user);
}
```

> ⚠️ **Gotcha:** Automated scanners cannot catch BOLA. It requires manual two-account testing: create two accounts, use account A's token to request account B's resource. If it succeeds, BOLA is present.

> 💡 **Senior insight:** The ownership check belongs in the **service layer**, not the controller. Controllers are thin. The service has access to the repository and can load the record and check ownership atomically. A guard cannot do this without making a second DB call.

→ See `references/owasp-api-top10.md` for the complete OWASP API Top 10 mapping.
→ See `references/authentication.md` for JWT setup.
→ See `apicraft-validation` for `ValidationPipe` whitelisting (defeats API3 mass-assignment).

## Step 4 — Validate

- [ ] Every record-fetch route has a per-record ownership check (not just a role check)
- [ ] JWT access tokens have short TTL (≤15 min)
- [ ] Refresh tokens rotate on use (stolen token dies on next legitimate use)
- [ ] Refresh tokens stored in HttpOnly + Secure cookies
- [ ] Throttler uses Redis storage provider for multi-instance deployments
- [ ] Helmet applied globally in `main.ts`
- [ ] CORS `origin` is an allowlist, not `*`
- [ ] Secret management uses `@nestjs/config` with Zod/Joi schema (crashes on missing env)

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/owasp-api-top10.md` | Full OWASP Top 10 mapping, Helmet, CORS, throttler | Security audit or overview |
| `references/authentication.md` | JWT, Passport, refresh token rotation | Auth setup |
| `references/authorization.md` | BOLA per-record check, RBAC, CASL | Authorization patterns |

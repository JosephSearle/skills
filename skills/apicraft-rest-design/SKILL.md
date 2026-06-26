---
name: apicraft-rest-design
description: >
  REST API design standards for NestJS: resource naming, HTTP status code decision
  table (401 vs 403, 400 vs 422, 207 multi-status), cursor vs offset pagination
  decision rule with performance data, filtering/sorting query param whitelisting,
  API versioning strategy comparison and NestJS enableVersioning mechanics, PATCH
  semantics, idempotency keys, and the RFC 9457 Problem Details error format.
  Requires apicraft-context to be loaded first.
  Triggers on: "API design", "REST conventions", "status codes", "pagination",
  "versioning", "PATCH", "error format", "idempotency", "cursor pagination",
  "offset pagination", "resource naming", "URI versioning", "enableVersioning".
  Not for gRPC design — use apicraft-grpc. Not for error filter implementation — use
  apicraft-error-handling.
version: 1.0.0
---

## Core Philosophy

REST design decisions compound — a wrong status code, no versioning strategy, or offset pagination on a growing dataset become expensive to fix later. The decisions in this skill are not aesthetic preferences: `401` vs `403` has security implications (one reveals resource existence), cursor pagination is a 17x performance difference at scale, and RFC 9457 is a standard that external clients can program against.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ HTTP status codes and naming → load references/http-conventions.md
  ├─ Pagination strategy → load references/pagination.md
  ├─ API versioning setup → load references/http-conventions.md §Versioning
  ├─ Error format → cross-ref apicraft-error-handling/references/problem-details.md
  └─ Filtering / sorting params → load references/pagination.md §Filtering
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| Resource naming, status codes, versioning, PATCH, idempotency keys | `references/http-conventions.md` |
| Cursor vs offset pagination decision, filtering/sorting whitelisting | `references/pagination.md` |

## Step 3 — Execute

### Status code quick-reference

```
400 Bad Request        — malformed request (syntax error, unparseable JSON)
401 Unauthorized       — "who are you?" — missing or invalid auth credentials
403 Forbidden          — "I know who you are, no" — authenticated but not authorized
404 Not Found          — resource doesn't exist (also use for 403 on sensitive resources)
409 Conflict           — state conflict (duplicate resource, optimistic lock failure)
422 Unprocessable      — valid JSON/syntax but semantic validation failed
201 Created            — include Location header pointing to new resource
207 Multi-Status       — bulk operations where individual items may succeed or fail
```

> ⚠️ **Gotcha:** `401` must include a `WWW-Authenticate` header per RFC 7235. NestJS's built-in `UnauthorizedException` doesn't add this header — add it manually or via Passport.

> 💡 **Senior insight:** When deciding between `403 Forbidden` and `404 Not Found` for a record the user doesn't own: prefer `404`. `403` tells the caller "this resource exists, you just can't access it" — leaking existence. `404` is the safer default for sensitive resources.

→ See `apicraft-error-handling` for RFC 9457 error format implementation.
→ See `references/pagination.md` for cursor vs offset pagination decision.
→ See `apicraft-documentation` for API versioning mechanics with `@nestjs/swagger`.

## Step 4 — Validate

- [ ] Resources use plural nouns (`/users`, `/orders/{id}/items`)
- [ ] No verbs in resource paths (not `/getUser`, `/createOrder`)
- [ ] `201` responses include `Location` header
- [ ] Bulk operations use `207 Multi-Status`
- [ ] Pagination uses cursor for collections >100k rows or high-write datasets
- [ ] Query param filtering uses a whitelist (not arbitrary field names passed to the ORM)
- [ ] URI versioning enabled with `app.enableVersioning()`
- [ ] PATCH uses JSON Merge Patch semantics

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/http-conventions.md` | Resource naming, status codes, versioning, PATCH, idempotency | HTTP conventions questions |
| `references/pagination.md` | Cursor vs offset decision, query param whitelisting | Implementing pagination or filtering |

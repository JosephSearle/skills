# NestJS Security Controls Reference

This reference is loaded only when a NestJS project is detected. It documents NestJS runtime security
controls to **cite as mitigations** inside the generated threat model. These are not documentation
structure standards — they describe what the application already does (or should do) so that the
threat model accurately reflects the project's security posture.

---

## Helmet — HTTP Security Headers

NestJS integrates with the `helmet` package to set security-relevant HTTP response headers.

```typescript
import helmet from 'helmet';
app.use(helmet());
```

**Headers set by default Helmet configuration:**

| Header | Purpose |
|--------|---------|
| `Content-Security-Policy` | Restricts resource loading origins |
| `X-Content-Type-Options: nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options: SAMEORIGIN` | Clickjacking protection |
| `Strict-Transport-Security` | Forces HTTPS for future requests |
| `X-XSS-Protection: 0` | Disables legacy XSS filter (CSP is the modern control) |
| `Referrer-Policy` | Controls referrer header exposure |

**Threat model citation format:** "HTTP security headers enforced via `helmet` middleware (Content-Security-Policy, HSTS, X-Frame-Options)."

---

## CORS — Cross-Origin Resource Sharing

NestJS `enableCors()` controls which origins can call the MCP server's HTTP endpoints.

```typescript
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
```

**Threat model citation format:** "CORS enforced with an explicit `origin` allowlist; wildcard (`*`) origins are forbidden in production."

**Security note to document:** For MCP Streamable HTTP transport, the `Origin` header must also be validated server-side to defend against DNS rebinding attacks (see `mcp-security-hardener` skill).

---

## CSRF Protection

For session-cookie-based flows (not token-based OAuth 2.1):

```typescript
import * as csurf from 'csurf';
app.use(csurf({ cookie: true }));
```

**Threat model citation format:** "CSRF protection via double-submit cookie pattern for non-OAuth endpoints."

**Note:** When using OAuth 2.1 Bearer tokens (stateless), CSRF is not applicable to the API layer. Document which endpoints use cookies and which use Bearer tokens.

---

## Rate Limiting — @nestjs/throttler

NestJS `@nestjs/throttler` provides configurable rate limiting per IP or per token.

```typescript
ThrottlerModule.forRoot([{
  name: 'short',
  ttl: 1000,     // 1 second window
  limit: 10,     // 10 requests per window
}, {
  name: 'long',
  ttl: 60000,    // 1 minute window
  limit: 100,    // 100 requests per minute
}])
```

For multi-instance deployments, use `ThrottlerStorageRedisService` to share rate-limit state across pods.

**Threat model citation format:** "Per-IP and per-token rate limiting via `@nestjs/throttler` with Redis-backed shared state for multi-instance deployments; limits: 10 req/s short window, 100 req/min long window."

**Threat it mitigates:** ASI04 (Resource Exhaustion), tool-call amplification attacks.

---

## ValidationPipe — Input Validation

NestJS `ValidationPipe` with `class-validator` and `class-transformer` validates and sanitises all incoming request payloads.

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,       // strip unknown properties
  forbidNonWhitelisted: true,  // reject requests with unknown properties
  transform: true,       // auto-transform to DTO types
  disableErrorMessages: process.env.NODE_ENV === 'production', // don't leak validation details
}));
```

**Threat model citation format:** "All tool inputs validated via `ValidationPipe` with `whitelist: true` (unknown properties stripped) and strict DTO schemas."

**Threat it mitigates:** LLM01 (Prompt Injection via malformed inputs), tool poisoning via injected tool arguments.

---

## Exception Filters — Error Channel Isolation

NestJS exception filters prevent internal error details from leaking to clients in production:

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    // Never expose exception.message in production
    response.status(status).json({ statusCode: status, message: 'Internal server error' });
  }
}
```

**Threat model citation format:** "Production error responses are sanitised via a global exception filter; internal stack traces and error messages are never returned to clients."

---

## Guard Layer — Authentication and Authorisation

NestJS Guards implement the authentication and authorisation layer for MCP tool endpoints:

```typescript
@UseGuards(TechzoneAuthGuard, CaslAbilityGuard)
@Tool('my-tool')
async myTool(@ToolInput() input: MyToolInputDto) { ... }
```

**Threat model citation format:** "All MCP tool endpoints protected by JWT authentication guard (validates `aud` claim, `exp`, `iss`) followed by CASL authorisation guard (validates per-tool role/scope requirements)."

**Threat it mitigates:** LLM06 (Excessive Agency), confused-deputy attacks, MCP token passthrough.

For full OAuth 2.1 / JWT guard implementation details, see the `mcp-auth-guardian` skill.

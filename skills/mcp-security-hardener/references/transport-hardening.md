# Transport Hardening Reference

## Host and Origin Header Validation

Skipping Host/Origin validation enables DNS rebinding attacks: a malicious web page registers a domain that resolves to `127.0.0.1`, then makes requests to the local MCP server, bypassing same-origin policy. The browser sends the page's origin in the `Origin` header and the MCP domain in the `Host` header — if neither is checked, the attack succeeds.

### NestJS Middleware Implementation

```ts
// src/mcp/middleware/host-validator.middleware.ts
import { Injectable, NestMiddleware, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HostValidatorMiddleware implements NestMiddleware {
  private readonly allowedHosts: string[];
  private readonly allowedOrigins: string[];

  constructor() {
    this.allowedHosts = (process.env.CORS_ALLOWED_HOSTS ?? '')
      .split(',').map(h => h.trim()).filter(Boolean);
    this.allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',').map(o => o.trim()).filter(Boolean);
  }

  use(req: Request, _res: Response, next: NextFunction) {
    const host   = req.headers.host;
    const origin = req.headers.origin;

    // Host header check — always present in HTTP/1.1 and HTTP/2
    if (host && this.allowedHosts.length > 0 && !this.allowedHosts.some(h => host.startsWith(h))) {
      throw new BadRequestException(`Host header '${host}' not in allowlist`);
    }

    // Origin check — present on cross-origin requests (browsers always send it)
    if (origin && this.allowedOrigins.length > 0 && !this.allowedOrigins.includes(origin)) {
      throw new ForbiddenException(`Origin '${origin}' not in allowlist`);
    }

    next();
  }
}
```

Register in `AppModule`:
```ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(HostValidatorMiddleware)
      .forRoutes('/mcp');  // apply to MCP endpoint only
  }
}
```

---

## Binding Address

```ts
// Development — loopback only
await app.listen(3000, '127.0.0.1');

// Production — all interfaces (behind reverse proxy)
await app.listen(3000, '0.0.0.0');
```

If binding to `0.0.0.0` in production, the reverse proxy (Nginx, Caddy, AWS ALB) MUST validate the `Host` header before forwarding. Do not rely on the application alone.

For containerised deployments (Docker, Kubernetes), binding to `0.0.0.0` is normal — the container network provides isolation. The Host validation middleware adds defence-in-depth.

---

## HTTPS and HSTS

```ts
// In main.ts — add HSTS header globally
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

Rules:
- Production MCP servers MUST use HTTPS (OAuth 2.1 §1.5).
- `localhost` redirects are an exception — HTTP is acceptable for loopback.
- TLS termination at the load balancer is fine — HSTS is set by the app, not TLS layer.

---

## CORS Configuration

```ts
// In main.ts
app.enableCors({
  origin: (origin, callback) => {
    const allowed = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) ?? [];
    // Requests with no Origin (server-to-server, curl) are allowed
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS origin not allowed: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id', 'Last-Event-ID'],
  exposedHeaders: ['Mcp-Session-Id'],
  credentials: true,
  maxAge: 86400,  // preflight cache: 24 hours
});
```

Never use:
```ts
app.enableCors({ origin: '*' });  // allows any website to call your API
```

`Vary: Origin` is set automatically by NestJS when using a function origin.

---

## Security Headers Checklist

Add via a global interceptor or Helmet:

```ts
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: false,  // MCP serves JSON, not HTML
  crossOriginEmbedderPolicy: false,
}));
```

Minimum headers for an MCP API server:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`

# JWT Guard Reference

## Guard Pattern with @nestjs/passport + passport-jwt

```ts
// src/mcp/guards/jwt.guard.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  handleRequest(err: unknown, user: unknown) {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or missing bearer token');
    }
    return user;
  }
}
```

```ts
// src/mcp/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: cfg.getOrThrow('JWKS_URI'),  // e.g. https://auth.example.com/.well-known/jwks.json
      }),
      algorithms: ['RS256', 'ES256'],
      audience: cfg.getOrThrow('MCP_RESOURCE_URI'),  // MUST check aud
      issuer: cfg.getOrThrow('JWT_ISSUER'),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    return {
      sub:    payload.sub,
      scopes: (payload.scope ?? '').split(' ').filter(Boolean),
      roles:  payload.roles ?? [],
      email:  payload.email,
    };
  }
}

interface JwtPayload {
  sub: string;
  scope?: string;
  roles?: string[];
  email?: string;
  aud: string | string[];
  iss: string;
  exp: number;
}

export interface RequestUser {
  sub: string;
  scopes: string[];
  roles: string[];
  email?: string;
}
```

---

## JWKS Rotation Handling

`jwks-rsa` (used by `passportJwtSecret`) handles key rotation automatically:
- Caches keys with a configurable TTL (`jwksRequestsPerMinute: 5` prevents hammering the JWKS endpoint).
- On cache miss for a new key ID (`kid`), refetches automatically.

No manual key rotation logic needed. Ensure `JWKS_URI` returns all active signing keys.

---

## Populating request.user

After validation, `request.user` is the `RequestUser` object returned by `validate()`. Access it in tools via the `Context`:

```ts
@Tool({ name: 'orders_list', ... })
async listOrders(args: ..., ctx: Context) {
  const user = ctx.request?.user as RequestUser;
  // user.sub, user.scopes, user.roles available
}
```

Or inject via NestJS `ExecutionContext` in a guard subclass.

---

## aud Claim Validation

`passport-jwt` checks `audience` automatically when set in the strategy options.

Manual verification (if not using passport-jwt):
```ts
import { verify } from 'jsonwebtoken';

const payload = verify(token, signingKey, {
  algorithms: ['RS256'],
  audience: process.env.MCP_RESOURCE_URI,   // must be exact match or array member
  issuer:   process.env.JWT_ISSUER,
});
```

If `aud` does not match `MCP_RESOURCE_URI`, verification throws `JsonWebTokenError` → return 401.

---

## API Key Guard (Alternative)

For server-to-server use where OAuth is unnecessary:

```ts
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly redis: Redis) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['x-api-key'];
    if (!key) return false;
    const userId = await this.redis.get(`apikey:${key}`);
    if (!userId) return false;
    req.user = { sub: userId, scopes: [], roles: [] };
    return true;
  }
}
```

API keys should be stored as hashed values in Redis. Rotate by invalidating the old hash.

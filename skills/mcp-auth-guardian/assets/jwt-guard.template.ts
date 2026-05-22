// Targets: @nestjs/passport ^10.x, passport-jwt ^4.x, jwks-rsa ^3.x
// Replace <PLACEHOLDER> values before use.
// Copy to: src/mcp/guards/jwt.guard.ts  +  src/mcp/strategies/jwt.strategy.ts

// ─── jwt.guard.ts ─────────────────────────────────────────────────────────────
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

// ─── jwt.strategy.ts ──────────────────────────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

export interface RequestUser {
  sub: string;
  scopes: string[];
  roles: string[];
  email?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // JWKS-based key resolution — handles key rotation automatically
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: cfg.getOrThrow<string>('JWKS_URI'),
        // e.g. https://auth.example.com/.well-known/jwks.json
        //      https://login.microsoftonline.com/<tenant>/discovery/v2.0/keys
        //      https://<tenant>.auth0.com/.well-known/jwks.json
      }),

      algorithms: ['RS256', 'ES256'],

      // aud MUST be checked — prevents confused-deputy token replay
      audience: cfg.getOrThrow<string>('MCP_RESOURCE_URI'),

      // issuer validation
      issuer: cfg.getOrThrow<string>('JWT_ISSUER'),
    });
  }

  async validate(payload: Record<string, unknown>): Promise<RequestUser> {
    const sub    = payload['sub'] as string;
    const scope  = (payload['scope'] as string | undefined) ?? '';
    const roles  = (payload['roles'] as string[] | undefined) ?? [];
    const email  = payload['email'] as string | undefined;

    return {
      sub,
      scopes: scope.split(' ').filter(Boolean),
      roles,
      email,
    };
  }
}

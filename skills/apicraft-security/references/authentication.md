# Authentication — JWT and Refresh Tokens

**Authority:** docs.nestjs.com/security/authentication

---

## JWT Setup with @nestjs/jwt + Passport

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install --save-dev @types/passport-jwt
```

```typescript
// auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' }, // short TTL — critical
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```

```typescript
// jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;     // user ID
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    return payload; // returned value is set as req.user
  }
}
```

---

## Refresh Token Rotation

Access tokens have a short TTL (≤15 minutes). Refresh tokens have a longer TTL (7–30 days) and **rotate on every use** — a stolen refresh token dies the moment the legitimate user makes the next request.

```typescript
// auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );

    // Store hashed refresh token — never store raw tokens
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersRepository.updateRefreshToken(user.id, hashedRefreshToken);

    return { accessToken, refreshToken };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user?.refreshToken) throw new ForbiddenException('Access Denied');

    const tokenMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenMatch) throw new ForbiddenException('Access Denied');

    // ROTATION: invalidate current token before issuing new pair
    const tokens = await this.login(user);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.usersRepository.updateRefreshToken(userId, null);
  }
}
```

---

## Token Storage: HttpOnly + Secure Cookies

Storing tokens in `localStorage` exposes them to XSS attacks. HttpOnly cookies cannot be accessed by JavaScript.

```typescript
// auth.controller.ts
@Post('login')
async login(
  @Body() loginDto: LoginDto,
  @Res({ passthrough: true }) response: Response,
): Promise<{ accessToken: string }> {
  const user = await this.authService.validateUser(loginDto);
  const tokens = await this.authService.login(user);

  // Store refresh token in HttpOnly cookie — JS cannot read this
  response.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: true,           // HTTPS only
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/auth/refresh',  // only sent to the refresh endpoint
  });

  // Return access token in response body — client stores in memory (NOT localStorage)
  return { accessToken: tokens.accessToken };
}
```

| Storage | XSS resistant | CSRF risk | Recommendation |
|---------|--------------|-----------|----------------|
| `localStorage` | No | No | Never for tokens |
| `sessionStorage` | No | No | Never for tokens |
| HttpOnly cookie | Yes | Yes (mitigate with `sameSite: 'strict'`) | Preferred |
| In-memory (JS variable) | Yes | No | Good for access tokens (lost on page refresh) |

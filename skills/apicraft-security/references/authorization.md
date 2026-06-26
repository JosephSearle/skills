# Authorization — BOLA, RBAC, CASL

**Authority:** docs.nestjs.com/security/authorization, owasp.org/API-Security

---

## Per-Record Ownership Check (Defeats BOLA)

BOLA (API1:2023) occurs when an endpoint accepts a resource ID from the request but doesn't verify the requesting user owns that resource.

**The correct pattern — ownership check in the service layer:**

```typescript
// users.service.ts
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findOne(id: string, requestingUser: JwtPayload): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    // BOLA check — does this user have permission to see this record?
    const isOwner = user.id === requestingUser.sub;
    const isAdmin = requestingUser.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      // Return 404 (not 403) to avoid leaking resource existence
      throw new NotFoundException(`User ${id} not found`);
    }

    return new UserResponseDto(user);
  }
}
```

> ⚠️ **Gotcha:** Returning `403 Forbidden` instead of `404 Not Found` confirms to an attacker that the resource exists — they just can't access it. For sensitive resources, always return `404` to avoid confirming existence.

> 💡 **Senior insight:** BOLA cannot be prevented by a route-level `@Roles()` guard. The guard controls whether the user can call the endpoint; it does not control whether the specific record they're requesting belongs to them. Both checks are required: function-level authorization (can this user call this endpoint?) AND object-level authorization (does this user own this specific record?).

---

## RBAC with @Roles() Decorator

```typescript
// roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
```

Usage:

```typescript
@Get('admin/users')
@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
async getAllUsers(): Promise<UserResponseDto[]> {
  return this.usersService.findAll();
}
```

---

## @CurrentUser Decorator

Avoid repeating `@Req() req: Request` and accessing `req.user` in every controller. Create a parameter decorator:

```typescript
// current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
```

Usage in controllers:

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
  return this.usersService.findOne(user.sub, user);
}
```

---

## CASL for Complex Permission Models

Use CASL when RBAC becomes insufficient — when permissions depend on resource attributes (e.g., "user can only edit their own posts" AND "moderators can edit any post in their assigned categories").

```bash
npm install @casl/ability @casl/nestjs
```

```typescript
// ability.factory.ts
import { AbilityBuilder, createMongoAbility } from '@casl/ability';

export type AppAbility = ReturnType<typeof createMongoAbility>;

@Injectable()
export class AbilityFactory {
  createForUser(user: JwtPayload): AppAbility {
    const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

    if (user.roles.includes('admin')) {
      can('manage', 'all');
    } else {
      can('read', 'Post');
      can(['update', 'delete'], 'Post', { authorId: user.sub }); // own posts only
      cannot('delete', 'Post', { published: true }); // can't delete published posts
    }

    return build();
  }
}
```

CASL is a community package — vet its maintenance status before adopting in a new project.

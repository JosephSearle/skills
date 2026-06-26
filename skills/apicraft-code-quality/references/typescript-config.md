# TypeScript Configuration and Naming Conventions

**Authority:** docs.nestjs.com (nest new --strict), typescriptlang.org/tsconfig

---

## TypeScript Strict Mode

Bootstrap with strict mode:

```bash
nest new my-api --strict
```

Resulting `tsconfig.json` additions:

```json
{
  "compilerOptions": {
    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true,
    "strictNullChecks": true,
    "noImplicitAny": true
  }
}
```

| Flag | What it catches |
|------|----------------|
| `strict: true` | Enables all strict type checks (includes `strictNullChecks`, `noImplicitAny`) |
| `noFallthroughCasesInSwitch` | Prevents accidental case fall-through in switch statements |
| `noImplicitReturns` | Functions must explicitly return on all code paths |
| `noUncheckedIndexedAccess` | Array/object index access returns `T | undefined` |

---

## tsc --noEmit as CI Gate

Biome v2 covers ~85% of `@typescript-eslint`'s type-aware rules. The remaining 15% (complex generic type errors, conditional type inference issues) is caught only by the TypeScript compiler.

Add to CI pipeline:

```yaml
# GitHub Actions example
- name: Type check
  run: npx tsc --noEmit
```

Add to `package.json`:

```json
{
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

`--noEmit` runs the full type-check without writing any output files — fast and pure.

---

## Naming Conventions

NestJS CLI (`nest g`) enforces these conventions automatically. Follow them in manually created files.

| Artifact | Convention | Example |
|----------|-----------|---------|
| File | `kebab-case.type.ts` | `users.service.ts`, `create-user.dto.ts`, `roles.guard.ts` |
| Class | `PascalCase` | `UsersService`, `CreateUserDto`, `RolesGuard` |
| Interface | `PascalCase` (no `I` prefix) | `UsersRepository`, `PaginationOptions` |
| Enum | `PascalCase` | `UserRole`, `OrderStatus` |
| Constant | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Method | `camelCase` | `findByEmail`, `validateToken` |
| Private field | `camelCase` (no `_` prefix) | `private readonly logger: Logger` |

**Type suffixes used by NestJS conventions:**

| Suffix | Example |
|--------|---------|
| `.module.ts` | `users.module.ts` |
| `.controller.ts` | `users.controller.ts` |
| `.service.ts` | `users.service.ts` |
| `.repository.ts` | `users.repository.ts` |
| `.dto.ts` | `create-user.dto.ts` |
| `.entity.ts` | `user.entity.ts` |
| `.guard.ts` | `jwt-auth.guard.ts` |
| `.interceptor.ts` | `logging.interceptor.ts` |
| `.pipe.ts` | `parse-uuid.pipe.ts` |
| `.filter.ts` | `all-exceptions.filter.ts` |
| `.decorator.ts` | `current-user.decorator.ts` |
| `.spec.ts` | `users.service.spec.ts` |

---

## Dependency Management

Use **Renovate** (preferred) or **Dependabot** for automated dependency updates.

Renovate strategy for NestJS projects:
- Pin `@nestjs/*` packages to the same minor version (patch updates auto-merge, minor updates create PRs)
- Group `class-validator` and `class-transformer` updates together — they must stay compatible
- Group Prisma packages together (`prisma`, `@prisma/client`)
- Audit breaking changes before bumping major versions

`.renovaterc.json`:

```json
{
  "extends": ["config:recommended"],
  "packageRules": [
    {
      "matchPackagePrefixes": ["@nestjs/"],
      "groupName": "NestJS packages"
    },
    {
      "matchPackageNames": ["class-validator", "class-transformer"],
      "groupName": "class-validator/transformer"
    }
  ]
}
```

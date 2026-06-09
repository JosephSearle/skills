# NestJS Module Architecture — ArchUnitTS Rule Patterns

**Applies when:** `@nestjs/core` or `@nestjs/common` detected in `package.json` dependencies.

---

## Key Context

NestJS's DI module system (`@Module()`) encapsulates providers at runtime — but it is NOT statically enforced at build time. Static imports between feature module files can bypass the module boundary entirely. ArchUnitTS fills this gap by enforcing folder-level boundaries at compile time.

ArchUnitTS has **no decorator or annotation awareness** — it cannot introspect `@Injectable()`, `@Module()`, `@Controller()`, or `@Inject()`. All enforcement is folder/file-path based.

---

## Common NestJS Project Layouts

### Modular by Feature (most common)

```
src/
  modules/
    orders/         ← feature module
      orders.module.ts
      orders.controller.ts
      orders.service.ts
      orders.repository.ts
    billing/        ← feature module
    users/          ← feature module
  shared/           ← cross-cutting utilities (allowed everywhere)
  main.ts
  app.module.ts
```

### Clean Architecture + NestJS

```
src/
  domain/
  application/
    modules/
      orders/
      billing/
  infrastructure/
    modules/
      database/
      http/
```

---

## Required Rules

### 1. Feature modules must not depend on each other's internals

```ts
it('orders module must not depend on billing module internals', async () => {
  const rule = projectFiles()
    .inFolder('src/modules/orders/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/modules/billing/**');
  await expect(rule).toPassAsync();
});
```

Generate one rule per feature-module pair where cross-dependency is undesired. For N modules, this can be expressed with a loop:

```ts
const featureModules = ['orders', 'billing', 'users', 'products'];

for (const moduleA of featureModules) {
  for (const moduleB of featureModules) {
    if (moduleA === moduleB) continue;
    it(`${moduleA} must not depend on ${moduleB}`, async () => {
      const rule = projectFiles()
        .inFolder(`src/modules/${moduleA}/**`)
        .shouldNot()
        .dependOnFiles()
        .inFolder(`src/modules/${moduleB}/**`);
      await expect(rule).toPassAsync();
    });
  }
}
```

> Performance note: with many modules this approaches O(n²). If the test suite becomes slow, use a single `rule.check()` and bucket violations (see archunitts-api.md performance section).

### 2. Domain must not import NestJS framework

```ts
it('domain layer must not depend on NestJS', async () => {
  const rule = projectFiles()
    .inFolder('src/domain/**')
    .shouldNot()
    .dependOnFiles()
    .matchingPattern('**/node_modules/@nestjs/**');
  await expect(rule).toPassAsync();
});
```

### 3. Shared utilities must not import feature modules

```ts
it('shared must not depend on feature modules', async () => {
  const rule = projectFiles()
    .inFolder('src/shared/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/modules/**');
  await expect(rule).toPassAsync();
});
```

### 4. No cycles

```ts
it('src has no dependency cycles', async () => {
  const rule = projectFiles()
    .inFolder('src/**')
    .should()
    .haveNoCycles();
  await expect(rule).toPassAsync();
});
```

---

## Custom Rule: Detect Field Injection (NestJS Anti-Pattern)

Constructor injection is preferred over `@Inject()` field injection in NestJS. A custom `FileInfo` rule can scan file content for the pattern:

```ts
import { projectFiles, FileInfo } from 'archunit';

const noPropertyInjection = (file: FileInfo): boolean => {
  // Flag @Inject() on a property (not in a constructor parameter position)
  // This is a heuristic — refine the regex for your codebase
  return !/@Inject\(\)\s+(?!.*constructor)/m.test(file.content);
};

it('services should use constructor injection, not property injection', async () => {
  const rule = projectFiles()
    .inFolder('src/**')
    .withName('*.service.ts')
    .should()
    .adhereTo(noPropertyInjection, 'prefer constructor injection over @Inject() on properties');
  await expect(rule).toPassAsync({ allowEmptyTests: false });
});
```

---

## Recommended Metrics Rules

### Service cohesion

```ts
it('NestJS services should be cohesive', async () => {
  const rule = metrics()
    .inFolder('src/**')
    .forClassesMatching(/Service$/)
    .lcom()
    .lcom96b()
    .shouldBeBelow(0.6);
  await expect(rule).toPassAsync();
});
```

### Controller size limit

```ts
it('controllers should not be too large', async () => {
  const rule = metrics()
    .inFolder('src/**')
    .forClassesMatching(/Controller$/)
    .count()
    .linesOfCode()
    .shouldBeBelow(200);
  await expect(rule).toPassAsync();
});
```

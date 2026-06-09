# Hexagonal Architecture (Ports and Adapters) — ArchUnitTS Rule Patterns

**Applies when:** `src/core/` or `src/ports/` + `src/adapters/` detected, or docs/ADRs explicitly describe hexagonal / ports-and-adapters architecture.

---

## Layer Model

```
Secondary Adapters  (DB, external APIs, messaging — implement driven ports)
     │ depends on ▼
Driven Ports        (repository interfaces, event publisher interfaces)
     │ depends on ▼
Core / Domain       (domain logic, entities, use cases, domain services)
     │ depends on ▼
Driving Ports       (use case interfaces, application service interfaces)
     │ depends on ▲
Primary Adapters    (HTTP controllers, CLI handlers, message consumers)
```

**The rule**: core depends on nothing outside itself. All framework and infrastructure code lives in adapters. Ports are the only crossing point.

---

## Required Rules

### 1. Core must not depend on adapters

```ts
it('core must not depend on adapters', async () => {
  const rule = projectFiles()
    .inFolder('src/core/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/adapters/**');
  await expect(rule).toPassAsync();
});
```

### 2. Core must not import any external framework

```ts
it('core must be framework-agnostic', async () => {
  const rule = projectFiles()
    .inFolder('src/core/**')
    .shouldNot()
    .dependOnFiles()
    .matchingPattern('**/node_modules/**');
  // Allow known exceptions via the except option if needed:
  // .inFolder('src/core/**', { except: { inPath: 'src/core/shared/zod.ts' } })
  await expect(rule).toPassAsync();
});
```

### 3. Adapters must not depend on each other directly

```ts
it('adapters must not cross-depend', async () => {
  const rule = projectFiles()
    .inFolder('src/adapters/primary/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/adapters/secondary/**');
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

## Recommended Metrics Rules

### Ports should be thin interfaces (small LOC)

```ts
it('ports should be small (interfaces, not implementations)', async () => {
  const rule = metrics()
    .inFolder('src/ports/**')
    .count()
    .linesOfCode()
    .shouldBeBelow(60);
  await expect(rule).toPassAsync();
});
```

### Core use-case cohesion

```ts
it('core use cases should be cohesive', async () => {
  const rule = metrics()
    .inFolder('src/core/**')
    .lcom()
    .lcom96b()
    .shouldBeBelow(0.5);
  await expect(rule).toPassAsync();
});
```

### Adapter complexity limit

```ts
it('adapters should not be overly complex', async () => {
  const rule = metrics()
    .inFolder('src/adapters/**')
    .complexity()
    .cyclomaticComplexity()
    .shouldBeBelow(15);
  await expect(rule).toPassAsync();
});
```

---

## Common Folder Name Variants

| Canonical | Common alternatives |
|---|---|
| `core/` | `domain/`, `application/`, `hexagon/` |
| `ports/` | `interfaces/`, `driven/`, `driving/` |
| `adapters/` | `infrastructure/`, `infra/`, `driven/`, `primary/`, `secondary/` |
| `adapters/primary/` | `driving/`, `in/`, `inbound/` |
| `adapters/secondary/` | `driven/`, `out/`, `outbound/` |

Adjust paths to match the actual structure found in Phase D. If the project uses a flat `src/adapters/` without `primary/` and `secondary/` sub-folders, adapt the cross-dependency rules accordingly.

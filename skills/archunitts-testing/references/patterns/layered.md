# Layered (N-Tier) Architecture — ArchUnitTS Rule Patterns

**Applies when:** `src/controllers/` + `src/services/` + `src/repositories/` (or similar naming like `src/routes/`, `src/handlers/`, `src/dao/`) detected in the source structure.

---

## Layer Model

```
Presentation   (controllers / routes / handlers)
     │ depends on ▼
Application    (services / use-cases)
     │ depends on ▼
Data Access    (repositories / DAOs / stores)
     │ depends on ▼
Domain / Core  (models / entities / value-objects)
```

Dependency flows strictly **downward**. No upward or skip-layer imports.

---

## Required Rules

### 1. Presentation must not depend on Data Access directly

```ts
it('presentation layer must not depend on data access layer', async () => {
  const rule = projectFiles()
    .inFolder('src/controllers/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/repositories/**');
  await expect(rule).toPassAsync();
});
```

**Why:** Controllers calling repositories directly bypasses service-layer business logic — the most common layered architecture violation.

### 2. Data Access must not depend on Presentation

```ts
it('data access layer must not depend on presentation layer', async () => {
  const rule = projectFiles()
    .inFolder('src/repositories/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/controllers/**');
  await expect(rule).toPassAsync();
});
```

### 3. Domain / Core must not depend on any upper layer

```ts
it('domain models must not depend on services or controllers', async () => {
  const rule = projectFiles()
    .inFolder('src/domain/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/services/**');
  await expect(rule).toPassAsync();
});
```

### 4. No cycles across the whole src tree

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

### Service layer cohesion

```ts
it('services should be cohesive', async () => {
  const rule = metrics()
    .inFolder('src/services/**')
    .lcom()
    .lcom96b()
    .shouldBeBelow(0.5);
  await expect(rule).toPassAsync();
});
```

### Repository size limit

```ts
it('repositories should not grow too large', async () => {
  const rule = metrics()
    .inFolder('src/repositories/**')
    .count()
    .linesOfCode()
    .shouldBeBelow(400);
  await expect(rule).toPassAsync();
});
```

---

## Common Folder Name Variants

| Canonical | Common alternatives |
|---|---|
| `controllers/` | `routes/`, `handlers/`, `resolvers/`, `api/` |
| `services/` | `use-cases/`, `usecases/`, `application/` |
| `repositories/` | `dao/`, `stores/`, `data/`, `persistence/` |
| `domain/` | `models/`, `entities/`, `core/` |

Adjust `inFolder()` paths to match the actual folder names found in Phase D of the skill.

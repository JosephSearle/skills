# Clean Architecture — ArchUnitTS Rule Patterns

**Applies when:** `src/domain/`, `src/application/`, `src/infrastructure/` folders detected, or ADRs/docs explicitly describe Clean Architecture.

---

## Layer Model

```
Infrastructure  (frameworks, DB adapters, HTTP clients, external APIs)
     │ depends on ▼
Application     (use cases, DTOs, application services)
     │ depends on ▼
Domain          (entities, value objects, domain services, repository interfaces)
```

The **Dependency Rule**: source code dependencies must point **inward only**. Domain knows nothing about application or infrastructure. Application knows nothing about infrastructure.

---

## Required Rules

### 1. Domain must not depend on Application or Infrastructure

```ts
it('domain must not depend on application layer', async () => {
  const rule = projectFiles()
    .inFolder('src/domain/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/application/**');
  await expect(rule).toPassAsync();
});

it('domain must not depend on infrastructure layer', async () => {
  const rule = projectFiles()
    .inFolder('src/domain/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/infrastructure/**');
  await expect(rule).toPassAsync();
});
```

### 2. Application must not depend on Infrastructure

```ts
it('application must not depend on infrastructure layer', async () => {
  const rule = projectFiles()
    .inFolder('src/application/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/infrastructure/**');
  await expect(rule).toPassAsync();
});
```

### 3. Domain must not import any framework (framework-agnostic domain)

```ts
it('domain must not import NestJS', async () => {
  const rule = projectFiles()
    .inFolder('src/domain/**')
    .shouldNot()
    .dependOnFiles()
    .matchingPattern('**/node_modules/@nestjs/**');
  await expect(rule).toPassAsync();
});
```

Add rules for each framework present in the project (`express`, `fastify`, `@modelcontextprotocol/sdk`, etc.).

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

### Use-case cohesion — each use case should do one thing

```ts
it('use cases should be cohesive (single responsibility)', async () => {
  const rule = metrics()
    .inFolder('src/application/use-cases/**')
    .lcom()
    .lcom96b()
    .shouldBeBelow(0.5);
  await expect(rule).toPassAsync();
});
```

### Domain layer should sit on the main sequence

```ts
it('domain layer should balance abstractness and stability', async () => {
  const rule = metrics()
    .inFolder('src/domain/**')
    .distance()
    .distanceFromMainSequence()
    .shouldBeBelow(0.3);
  await expect(rule).toPassAsync();
});
```

### Domain entities should be small and focused

```ts
it('domain entities should be below 300 lines', async () => {
  const rule = metrics()
    .inFolder('src/domain/**')
    .count()
    .linesOfCode()
    .shouldBeBelow(300);
  await expect(rule).toPassAsync();
});
```

---

## PlantUML Diagram Enforcement

> **Note:** ArchUnitTS's `adhereToDiagramInFile()` only supports PlantUML syntax (`@startuml`/`@enduml`). If your architecture docs use Mermaid diagrams, you need to create a separate `.puml` companion file for this rule to work — or skip this rule and rely on the layer-boundary rules above instead.

If a `.puml` file exists at `docs/architecture/components.puml`:

```ts
it('slices must adhere to the component diagram', async () => {
  const rule = projectSlices()
    .definedBy('src/(**)/') 
    .should()
    .adhereToDiagramInFile('docs/architecture/components.puml');
  await expect(rule).toPassAsync();
});
```

---

## Common Folder Name Variants

| Canonical | Common alternatives |
|---|---|
| `domain/` | `core/`, `entities/`, `model/` |
| `application/` | `app/`, `use-cases/`, `usecases/` |
| `infrastructure/` | `infra/`, `adapters/`, `driven/`, `secondary/` |

Adjust paths to match the actual structure found in Phase D.

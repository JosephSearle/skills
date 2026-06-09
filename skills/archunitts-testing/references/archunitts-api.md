# ArchUnitTS API Reference

**Package:** `archunit` (npm) · **Version:** 2.1.63 (published) / 2.3.0 (docs, may have unreleased features) · **License:** MIT

> Always verify a documented feature exists in your installed version — there is a known gap between the npm-published version and the auto-deployed docs site.

---

## Entry Functions

ArchUnitTS exports four top-level entry functions. There is **no `classes()` or `filesOfProject()` API** — those belong to Java ArchUnit and ts-arch respectively.

```ts
import { projectFiles, metrics, projectSlices, nxProjectSlices } from 'archunit';
```

---

## `projectFiles()` — File and Folder Rules

The primary workhorse. Builds a fluent rule over the compiled TypeScript dependency graph.

### Selectors / Filters

| Method | Matches against | Example |
|---|---|---|
| `.withName(pattern)` | filename only (no path) | `.withName('*-service.ts')` |
| `.inPath(pattern)` | full relative path | `.inPath('src/services/UserService.ts')` |
| `.inFolder(pattern)` | folder path (no filename) | `.inFolder('src/domain/**')` |

All three accept a glob string or `RegExp`. Chainable — chaining creates AND semantics:
```ts
projectFiles().inFolder('src/**').withName('*.service.ts')
```

Exceptions (carve out a sub-path from a broad rule):
```ts
projectFiles()
  .inFolder('src/domain/**', { except: { inPath: 'src/domain/shared/index.ts' } })
```

### Assertion Entry

```ts
.should()     // assert positive condition
.shouldNot()  // assert negative condition
```

### Dependency Assertions

```ts
.dependOnFiles().inFolder('src/infrastructure/**')
.dependOnFiles().inPath('src/database/connection.ts')
.dependOnFiles().withName('*.module.ts')
.dependOnFiles().matchingPattern('**/node_modules/@nestjs/**')   // for npm package rules
```

### Other Assertions

```ts
.haveNoCycles()                     // Tarjan SCC cycle detection
.haveName('*-service.ts')           // all matched files must match this name pattern
.beInFolder('**/services/**')       // all matched files must be in this folder
.adhereTo(ruleFn, 'description')    // custom rule function: (file: FileInfo) => boolean
```

### Execution

```ts
// Jest / Vitest (globals: true required for Vitest)
await expect(rule).toPassAsync();
await expect(rule).toPassAsync({ logging: { enabled: true, level: 'debug' } });

// Jasmine (requires setup: jasmine.addAsyncMatchers(jasmineMatcher))
await expectAsync(rule).toPassAsync();

// Universal — works in any framework
const violations = await rule.check();
expect(violations).toHaveLength(0);
// Each violation exposes: violation.dependency.cumulatedEdges[].source / .target
```

### Full Example

```ts
import { projectFiles } from 'archunit';

it('domain must not depend on infrastructure', async () => {
  const rule = projectFiles()
    .inFolder('src/domain/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/infrastructure/**');
  await expect(rule).toPassAsync();
});
```

---

## `metrics()` — Code Metrics and Class-Level Analysis

Supports the same `.withName()` / `.inFolder()` / `.inPath()` filters, plus `.forClassesMatching(/regex/)` which matches against class names (not file paths).

### Count Metrics

```ts
metrics().count().linesOfCode().shouldBeBelow(500)
metrics().count().methodCount().shouldBeBelow(20)
metrics().count().fieldCount().shouldBeBelow(15)
metrics().count().statements().shouldBeBelow(100)
// Comparators: shouldBeBelow(n) | shouldBeBelowOrEqual(n) | shouldBe(n)
```

### Cohesion — LCOM (Lack of Cohesion of Methods)

Lower values = better cohesion. 0 = perfect, 1 = no cohesion.

```ts
metrics().inFolder('src/application/use-cases/**').lcom().lcom96b().shouldBeBelow(0.5)
metrics().inFolder('src/domain/**').lcom().lcom96a().shouldBeBelowOrEqual(0.7)
```

### Distance Metrics (Robert Martin)

```ts
metrics().distance().abstractness().shouldBeAbove(0.1)       // A
metrics().distance().instability().shouldBeBelow(0.8)         // I
metrics().distance().couplingFactor().shouldBeBelow(0.3)
metrics().distance().distanceFromMainSequence().shouldBeBelow(0.3) // |A + I - 1|
```

`distanceFromMainSequence`: 0 = sits on the ideal "main sequence" (balanced abstractness + stability). High value → "zone of pain" (concrete + stable) or "zone of uselessness" (abstract + unstable).

### Cyclomatic Complexity

```ts
metrics().complexity().cyclomaticComplexity().shouldBeBelow(10)
```

### Custom Metrics

```ts
metrics()
  .inFolder('src/tools/**')
  .customMetric(
    'method-to-field ratio',
    'tools should not have more methods than fields × 3',
    (classInfo) => classInfo.methods.length / Math.max(classInfo.fields.length, 1)
  )
  .shouldBeBelowOrEqual(3.0)
```

### HTML Export (beta)

```ts
await metrics().inFolder('src/**').exportAsHTML('reports/metrics.html')
```

---

## `projectSlices()` — Architecture Slicing / Diagram Validation

Different filter model: uses a glob with a capture group `(**)` that defines how files are grouped into slices.

```ts
projectSlices().definedBy('src/(**)/')   // each top-level folder under src/ is one slice
```

### Assertions

```ts
.should().adhereToDiagram(plantUmlString)
.should().adhereToDiagramInFile('docs/components.puml')
.shouldNot().containDependency('services', 'controllers')  // slice names from capture group
.should().haveNoCycles()
```

### Example

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

## `nxProjectSlices()` — Nx Monorepo Support

Reads the Nx project graph directly.

```ts
nxProjectSlices()
  .matching('feature-*')
  .shouldNot().dependOnSlices().matching('data-access-*')

nxProjectSlices()
  .should().haveNoCycles()
  .ignoringExternalDependencies()

nxProjectSlices()
  .should().adhereToDiagramInFile('docs/nx-projects.puml')
```

---

## Custom File Rules

```ts
import { projectFiles, FileInfo } from 'archunit';

const noBarrelImports = (file: FileInfo): boolean =>
  !file.content.includes("export * from");

it('no barrel re-exports in domain', async () => {
  const rule = projectFiles()
    .inFolder('src/domain/**')
    .should()
    .adhereTo(noBarrelImports, 'domain files must not use barrel exports');
  await expect(rule).toPassAsync();
});
```

`FileInfo` exposes: `.content` (raw file text), path information.

---

## Check Options

All execution methods accept an options object:

```ts
await expect(rule).toPassAsync({
  logging: { enabled: true, level: 'debug' },  // 'error' | 'warn' | 'info' | 'debug'
  allowEmptyTests: false,                        // default: false (empty-test protection ON)
  clearCache: false,                             // default: false (use cached graph)
});
```

---

## Empty-Test Protection

**Default: a rule that matches zero files FAILS.** This catches typos in folder paths that would silently pass in other libraries.

```ts
// This FAILS if src/domaiin/ doesn't exist (typo caught)
projectFiles().inFolder('src/domaiin/**').shouldNot().dependOnFiles().inFolder('src/infra/**')

// Override only when a folder is intentionally optional
await expect(rule).toPassAsync({ allowEmptyTests: true });
```

---

## Migration from ts-arch

| ts-arch | ArchUnitTS |
|---|---|
| `filesOfProject()` | `projectFiles()` |
| `.beFreeOfCycles()` | `.haveNoCycles()` |
| `slicesOfProject()` | `projectSlices()` |
| `slicesOfNxProject()` | `nxProjectSlices()` |
| `import "tsarch/dist/jest"` | no side-effect import needed |

---

## Known Bugs and Caveats

### Vitest 4 Bug (#8)
**`toPassAsync()` throws `TypeError: (0 , common_1.guessLocationOfTsconfig) is not a function`** on Vitest 4.x (reported Oct 2025, open on archunit 2.1.63 / Node 24 / Vitest 4.0.2).

Workaround — use `rule.check()` instead:
```ts
const violations = await rule.check();
expect(violations).toHaveLength(0);
```

Vitest config requirements (all versions):
```ts
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  }
})
```

### Path Aliases
ArchUnitTS uses `ts.createProgram()` (real TypeScript compiler), so `compilerOptions.paths` aliases are resolved through the compiler. Generally correct, but smoke-test alias resolution in your project before trusting negative (passing) results — multi-tsconfig monorepos need extra care.

### Performance
Naïve per-feature-pair rules approach O(n²) on large multi-feature projects (issue #55). If test suite exceeds ~30–60 seconds: run one `check()` per broad rule and bucket violations by feature; keep `clearCache: false` (default); run arch tests in a dedicated CI job.

### Version Drift
npm publishes `2.1.63`; docs auto-deploy at `v2.3.0`. Pin an exact version and verify documented features exist in the version you install.

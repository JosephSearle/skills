# ArchUnitTS Deep-Dive: Comprehensive Capabilities Report for a NestJS MCP Server

## TL;DR
- **ArchUnitTS (npm `archunit`) is the strongest TypeScript architecture-testing library available in 2026 and a clear upgrade over ts-arch for your NestJS MCP server** — it adds code metrics (LCOM, coupling, distance-from-main-sequence), custom rules/metrics, empty-test protection, universal test-runner support, and richer error messages, none of which ts-arch has.
- **A critical correction to the task's premise: ArchUnitTS does NOT expose a Java-style `classes()`/`noClasses()` API, nor the `filesOfProject()` name from ts-arch.** Its real entry points are `projectFiles()`, `metrics()`, `projectSlices()`, and `nxProjectSlices()`; class-level analysis is reached only through `metrics().forClassesMatching()` and custom rules operating on `FileInfo`/`ClassInfo`.
- **For an MCP server, model your tools/resources/prompts/transport layers as folders and enforce boundaries with `projectFiles().inFolder(...).shouldNot().dependOnFiles().inFolder(...)`, cycle-freedom with `haveNoCycles()`, and framework isolation of the domain layer** — but budget for known rough edges (a Vitest 4 runtime bug, path-alias resolution caveats, and O(n²) slowness on very large multi-feature trees).

## Key Findings

### Library overview and ecosystem
- **Package:** npm `archunit`; GitHub `LukasNiessen/ArchUnitTS`; MIT licensed; docs at lukasniessen.github.io/ArchUnitTS.
- **Version:** The npm registry page reports the latest published version as **2.1.63** ("Latest version: 2.1.63, last published: 3 months ago... There are 0 other projects in the npm registry using archunit"), while the auto-deployed docs site is titled **v2.3.0**. This gap is expected and by design: per the ArchUnitTS README FAQ, docs auto-deploy on every push to `main`, but npm publishing is deliberately manual — "We consider auto deploying the library to npm too risky given the fact that there are no full time maintainers." Pin an exact version in `package.json` and verify documented features exist in the version you install.
- **Adoption:** GitHub stars/forks have grown over the research window — the repo page showed **314 stars / 5 forks** at one snapshot and **360–414 stars / 10–12 forks** at later crawls; it bills itself as "the #1 architecture testing library for TypeScript, measured by GitHub stars." Downloads: Lukas Niessen's April 2026 Medium post titled "How my Library hit 400 GitHub Stars and 50k Monthly Downloads" states "ArchUnitTS has reached 400 stars on GitHub and crossed 50,000 monthly downloads on npm" — treat this as a maintainer-reported figure (~11–12k/week if evenly spread), not a neutral analytics number. The unrelated, much smaller `arch-unit-ts` package (latest v1.0.9) gets just 99 weekly downloads per Socket.dev ("The npm package arch-unit-ts receives a total of 99 weekly downloads... classified as not popular"); ts-arch (`tsarch`) is likewise far smaller.
- **Maintainers:** per the README, "LukasNiessen - Creator and main maintainer · janMagnusHeimann - Maintainer · TristanKruse - Maintainer"; Niessen's 200-star post additionally credits Jan Heimann, Tristan Kruse and Sina Rezaei as active contributors. Not full-time maintained.
- **Related/companion projects:** **ArchUnitPython** (Python port by the same author, kept roughly in sync); planned core-engine extraction for Go/Rust and an LLM-based "fuzzy fitness function" library. The HTML **Reports** module and `projectGraph()` graph export are marked Experimental/beta.
- **Origin:** Built by Niessen while consulting on an Express backend that needed ArchUnit-style fitness functions in TypeScript.

### Architecture (how it works under the hood)
ArchUnitTS is built on the **TypeScript Compiler API** + Node's filesystem. Pipeline: User API layer (`projectFiles()`, `metrics()`, `projectSlices()`) → Fluent rule definition → Graph extraction (TS AST → dependency graph) → Analysis/validation (cycle detection, dependency analysis, metrics) → TS Compiler API. Key internals:
- Uses `ts.createProgram()`, the `TypeChecker`, `SourceFile.forEachChild()`, and `ts.SyntaxKind` to walk the AST (`src/common/extraction/extract-graph.ts`).
- Each file becomes a graph **node**; import statements become directed **edges**. Critically, **every file also gets a self-referencing edge** (`utils.ts → utils.ts`) so standalone/entry-point/config/type-definition files are always included in analysis.
- **Cycle detection uses Tarjan's Strongly Connected Components algorithm.**
- Class info (methods, fields, access modifiers, inheritance, intra-class deps) is extracted in `src/metrics/extraction/extract-class-info.ts`.
- Performance: caching of nodes/imports/graph (toggle with `clearCache`) plus parallelism.

### Full API surface
ArchUnitTS has four documented top-level entry functions plus an experimental graph export. `index.ts` re-exports `./src/slices`, `./src/files`, `./src/metrics`, `./src/testing`, and `./src/common`, plus named `extractGraph`/`clearGraphCache`. **There is no `classes()` or `filesOfProject()` function** (those belong to Java ArchUnit and ts-arch respectively).

**`projectFiles()` — file/folder rules (the workhorse).** Fluent chain:
- **Selectors/filters:** `.withName(pattern)` (matches filename only, e.g. `Service.ts`), `.inPath(pattern)` (matches full relative path, e.g. `src/services/Service.ts`), `.inFolder(pattern)` (matches folder path without filename, e.g. `src/services`). All three accept glob strings or RegExp, are case-sensitive by default, are chainable for AND semantics, and accept an optional second argument `{ except: { inPath: '...' } }` to carve out exceptions.
- **Assertion entry:** `.should()` / `.shouldNot()`.
- **Dependency assertions:** `.dependOnFiles().inFolder(...)/.inPath(...)/.withName(...)`, and `.matchingPattern('...')` (used in the author's blog to target `**/node_modules/@nestjs/**`).
- **Other assertions:** `.haveNoCycles()`, `.haveName('*-service.ts')` / `.haveName(/regex/)`, `.beInFolder('**/services/**')`, `.adhereTo(customRuleFn, description)`.
- **Execution:** `await expect(rule).toPassAsync()` (Jest/Vitest), `await expectAsync(rule).toPassAsync()` (Jasmine), or `const violations = await rule.check()` (universal — returns a violations array; each violation exposes `.dependency.cumulatedEdges` with `.source`/`.target`).

```ts
import { projectFiles, metrics } from 'archunit';

it('presentation must not depend on database', async () => {
  const rule = projectFiles()
    .inFolder('src/presentation/**')
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/database/**');
  await expect(rule).toPassAsync();
});
```

**`metrics()` — code metrics & all class-level analysis.** Supports the same `.withName()/.inFolder()/.inPath()` filters **plus** `.forClassesMatching(/regex/)` (matches against class names, ignoring file path). Sub-APIs:
- `.count().linesOfCode() / .methodCount() / .fieldCount() / .statements()` with `.shouldBeBelow(n)` / `.shouldBeBelowOrEqual(n)` / `.shouldBe(n)`.
- `.lcom().lcom96a() / .lcom96b()` (lack-of-cohesion-of-methods; lower = better cohesion; 0 = perfect, 1 = none).
- `.distance().abstractness() / .instability() / .couplingFactor() / .distanceFromMainSequence()` with `.shouldBeAbove(n)` / `.shouldBeBelow(n)`.
- `.complexity().cyclomaticComplexity().shouldBeBelow(n)`.
- `.customMetric(name, description, (classInfo) => number).shouldBeBelowOrEqual(n)`.
- `.exportAsHTML(path, options)` for dashboards.

**`projectSlices()` — architecture slicing / diagram validation.** Uses a different filtering model: `.definedBy('src/(**)/')` (the `(**)` capture group defines slice grouping). Assertions: `.should().adhereToDiagram(plantUmlString)`, `.should().adhereToDiagramInFile(path)`, `.shouldNot().containDependency('services','controllers')`, `.should().haveNoCycles()`.

**`nxProjectSlices()` — Nx monorepo support.** Reads the Nx project graph. Chain: `.matching('feature-*')`, `.shouldNot().dependOnSlices().matching(...)`, `.should().containSlices().matching(/regex/)`, `.ignoringExternalDependencies()`, `.should().adhereToDiagramInFile(path)`, `.should().haveNoCycles()`.

**Other exports:** `projectGraph()` (experimental graph export), `MetricsExporter.exportComprehensiveAsHTML(...)`, and named `extractGraph` / `clearGraphCache` debug helpers.

### Dependency checking
- **Direction rules (deny-list, most common):** `projectFiles().inFolder('src/presentation/**').shouldNot().dependOnFiles().inFolder('src/database/**')`.
- **Allow-list / "must depend":** `projectFiles().inFolder('src/adapters/**').should().dependOnFiles().inFolder('src/ports/**')`.
- **Pattern matching:** glob (`*`, `**`, `?`, `[abc]`, `[a-z]`, `{js,ts}`) and RegExp; both case-sensitive by default (use `/i` for insensitivity). `withName` vs `inPath` vs `inFolder` choose the match target.
- **Exceptions:** the `{ except: { inPath: '...' } }` second arg lets a folder be generally forbidden while allowing a public-API sub-path.
- **Transitive vs direct:** the analysis builds a full dependency graph (so cycle detection is transitive), but file-to-file `dependOnFiles` rules evaluate import edges. There is no documented Java-style `onlyDependOnClassesThat` transitive-only-allow-list at class granularity.
- **Folder/package rules:** all expressed via `inFolder`/`inPath` globs.

### Cycle detection
- `projectFiles().inFolder('src/**').should().haveNoCycles()` — Tarjan's SCC algorithm.
- Scopable to any folder/path/name filter or to slices (`projectSlices().definedBy(...).should().haveNoCycles()`, `nxProjectSlices().should().haveNoCycles()`).
- **Special empty-test handling for cycles:** because folder A may legitimately contain only files that depend on folder B, cycle-free checks check the *unfiltered* file set for emptiness rather than the filtered set, to avoid confusing empty-test failures.
- Violations are reported with the cycle path and participating edges.

### Code metrics support
- **LCOM** (`lcom96a`, `lcom96b`) cohesion; LCOM96b formula `(m - sum(μ(A))/m)/(1-1/m)`.
- **Count:** lines of code, method count, field count, statements.
- **Complexity:** cyclomatic complexity.
- **Distance:** abstractness (A), instability (I), coupling factor, and **distance from main sequence** = `|A + I − 1|` (Robert Martin's metric: 0 means the component sits on the ideal "main sequence" balancing abstractness and stability; high values flag the "zone of pain" — concrete + stable — or "zone of uselessness" — abstract + unstable). Used as `metrics().distance().distanceFromMainSequence().shouldBeBelow(0.3)`.
- **Custom metrics** via `customMetric(name, desc, fn)`.
- **HTML reports** per metric family or comprehensive (beta).

### PlantUML / diagram integration
- `projectSlices().definedBy('src/(**)/').should().adhereToDiagram(inlineString)` or `.adhereToDiagramInFile('docs/components.puml')`.
- Supports component diagrams (`component [X] as Y`, `X --> Y`), package diagrams, class diagrams, hexagon notation, and notes. Same `@startuml/@enduml` syntax as ts-arch, so existing ts-arch `.puml` files port over.
- Integrates with existing docs by pointing at a checked-in `.puml` file — keeps diagram and code in sync as a fitness function.
- There is an open RFC (#54) for symbol-level PlantUML enforcement (finer than slice-level today).

### Empty-test protection
- **Default behavior: a rule that matches zero files FAILS** ("empty test"), catching typos in folder paths that would silently pass in ts-arch and other libraries. The maintainers call this the single most important differentiator.
- Configurable off via `allowEmptyTests: true` in the options object passed to `toPassAsync(options)` or `check(options)`.
- Cycle-free checks use the more permissive unfiltered-set emptiness check described above.

### Test runner integration
- **Jest:** works out of the box; `await expect(rule).toPassAsync()`.
- **Vitest:** works out of the box **but requires `globals: true` in `vitest.config.ts`** (plus typically `environment: 'node'`). ⚠️ **Known bug (#8): on Vitest 4.x, `toPassAsync()` throws `TypeError: (0 , common_1.guessLocationOfTsconfig) is not a function`** (reported Oct 2025, open at time of research, on archunit 2.1.63 / Node 24 / Vitest 4.0.2). Validate on your Vitest version before committing.
- **Jasmine:** requires one line — `jasmine.addAsyncMatchers(jasmineMatcher)` in `beforeEach` — and you must use `expectAsync(rule).toPassAsync()` (not `expect`).
- **Mocha / Node assert / any framework:** use the universal `const violations = await rule.check(); expect(violations).to.have.length(0)`.
- **Async/timeout:** tests are async (graph extraction can take time on large repos); with Jest you may want to raise the timeout. The check accepts `{ logging, allowEmptyTests, clearCache }` options.

### tsconfig.json and path alias support
- ArchUnitTS reads `tsconfig.json` to drive TypeScript module resolution (it builds a `ts.createProgram()`); a helper `guessLocationOfTsconfig` locates the config (and is implicated in the Vitest 4 bug above).
- Because it uses the real TS compiler/`TypeChecker`, **TypeScript path aliases (`@app/*`, `@domain/*`) defined under `compilerOptions.paths` are resolved through the compiler** rather than naïve string matching — generally the right behavior, but verify against your config since alias handling is the most common source of architecture-tool false negatives. There is no ArchUnitTS-specific documentation guaranteeing every alias scenario; multiple-tsconfig/monorepo setups should be smoke-tested.
- Rule path patterns (`inFolder('src/...')`) are matched against project-relative paths.

### Custom rules and plugin system
- **Custom file rules:** `const myRule = (file: FileInfo) => file.content.includes('export'); projectFiles().withName('*.ts').should().adhereTo(myRule, 'desc')`. `FileInfo` exposes `.content` and path info.
- **Custom metrics:** `metrics().customMetric('ratio', 'desc', (classInfo) => classInfo.methods.length / Math.max(classInfo.fields.length,1)).shouldBeBelow(3.0)`. `ClassInfo` exposes `.methods`, `.fields`, etc.
- **No formal plugin system** — extension is via these callback hooks, not loadable plugins. ArchUnitTS is "the only library that allows you to define custom rules and custom metrics" (vs ts-arch, which has none).

### Logging and debugging
- Logging is **off by default**; enable per-check: `toPassAsync({ logging: { enabled: true, level: 'debug' } })`. Levels: `error | warn | info | debug`.
- **File logging (beta):** `logFile: true` writes timestamped logs to `./logs/archunit-YYYY-MM-DD_HH-MM-SS.log` (or a custom path) — handy as CI artifacts. Caveat: parallel test runners (Jest) can interleave/garble the log file on large suites.
- **Clickable error paths:** failing tests print colorful messages with clickable file paths that jump to the offending file in the IDE.

### NestJS-specific patterns
- There is **no NestJS-aware feature set** (no decorator/provider/`@Injectable`/`@Module` introspection). ArchUnitTS treats a NestJS app as files/folders/classes. The official `examples/clean-architecture/nestjs` README demonstrates a **Clean Architecture** layout, not Nest module internals.
- Recommended NestJS enforcement, all folder/metric based:
  - Domain isolation: `projectFiles().inFolder('src/domain/**').shouldNot().dependOnFiles().inFolder('src/infrastructure/**')` and `...inFolder('src/application/**')`.
  - **Framework-agnostic domain:** `projectFiles().inFolder('src/domain/**').shouldNot().dependOnFiles().matchingPattern('**/node_modules/@nestjs/**')` (keeps business logic portable).
  - Application→infrastructure ban, use-case cohesion (`metrics().inFolder('src/application/use-cases/**').lcom().lcom96b().shouldBeBelow(0.5)`), and infra weight limits (`metrics().inFolder('src/infrastructure/**').count().linesOfCode().shouldBeBelow(800)`).
  - **Module boundaries** between feature modules: `projectFiles().inFolder('src/modules/orders/**').shouldNot().dependOnFiles().inFolder('src/modules/billing/**')`. NestJS's own DI module encapsulation is a runtime construct not statically enforced at build time, so this fills a real gap.
  - **Constructor injection visibility / decorator awareness** is NOT directly inspectable; approximate it with a custom `FileInfo` rule scanning `file.content` for `@Inject`/field-injection patterns, or rely on an ESLint plugin. (NestJS best practice favors constructor injection over `@Inject()` property injection and uses abstract classes as DI tokens for interfaces — boundaries around those are folder-enforceable, not decorator-enforceable.)

### MCP server architecture patterns
- There are **no MCP-specific examples** in ArchUnitTS, but MCP servers map cleanly onto the layered/hexagonal patterns it already supports. The Model Context Protocol defines a **data layer** (JSON-RPC 2.0 primitives: tools = actions with side effects, resources = read-only context data, prompts = reusable templates, plus notifications) and a **transport layer** (stdio for local processes, Streamable HTTP/SSE for remote). Recommended folder model and rules:
  - `src/tools/**`, `src/resources/**`, `src/prompts/**`, `src/transport/**` (stdio/HTTP), and `src/domain/**` (or `src/core/**`) for business logic.
  - **Transport isolation:** `projectFiles().inFolder('src/domain/**').shouldNot().dependOnFiles().inFolder('src/transport/**')` — keeps tool/business logic independent of stdio vs HTTP so transports are swappable.
  - **Primitive separation:** ban `src/resources/**` from depending on `src/tools/**` (resources should be side-effect free), and ensure tools/resources/prompts only reach the domain through a defined interface (use `inPath(..., { except: {...} })`).
  - **No cycles:** `projectFiles().inFolder('src/**').should().haveNoCycles()`.
  - **SDK isolation:** confine `@modelcontextprotocol/sdk` imports to the transport/adapter layer via `projectFiles().inFolder('src/domain/**').shouldNot().dependOnFiles().matchingPattern('**/node_modules/@modelcontextprotocol/**')`.
  - **Diagram-drive it:** write `docs/mcp-components.puml` describing tools→domain, transport→tools, and validate with `projectSlices().definedBy('src/(**)/').should().adhereToDiagramInFile('docs/mcp-components.puml')`.

### Real-world usage examples
- **Layered architecture:** Fastify backend using a UML diagram (in `examples/`).
- **Clean architecture:** NestJS example (domain/application/infrastructure isolation + LCOM/LOC metrics).
- **Hexagonal/ports-and-adapters:** Express example (core must not depend on adapters/infrastructure; adapters must implement ports; ports kept small via LOC; adapter cohesion via LCOM).
- **Micro frontends:** React + Nx example. **Angular:** typical frontend example.
- **Monorepo:** first-class **Nx** support via `nxProjectSlices()` (project-graph boundaries, naming conventions, diagram adherence). Full working example repos exist for Jest, Vitest, and Jasmine.

### Limitations and known issues
- **No `classes()`/`noClasses()` fluent class-dependency API** (unlike Java ArchUnit). Class-level work is limited to metrics + custom rules; you cannot natively express, e.g., "no class annotated with X may depend on a class annotated with Y."
- **No decorator/annotation awareness** — a real gap for NestJS/MCP decorator-driven code.
- **Open bugs:** Vitest 4 `guessLocationOfTsconfig` TypeError (#8); deprecated transitive dependency `lodash.get@4.4.2` (#9); a reported empty-test edge case when there are no dependencies into the target folder (#10); a feature request for `shouldNotDependOnSelf` (#6).
- **Performance:** naïve "every feature must not depend on every other feature" rules can approach O(n²) and run 100+ seconds on a project with hundreds of features (issue #55); the maintainer's workaround is to run one `check()` and bucket violations by feature. Caching helps but the TS-compiler-based graph build is inherently heavier than a regex linter.
- **Reports, file logging, and `projectGraph()` are beta/experimental.**
- **npm vs docs version drift** (2.1.63 published vs 2.3.0 docs) means some documented features may not yet be in the published package — verify against the version you install.

### Comparison with ts-arch
**What ts-arch has that ArchUnitTS matches or supersedes:** ts-arch's entire feature set — `filesOfProject()`/`slicesOfProject()`/`slicesOfNxProject()`, `inFolder().shouldNot().dependOnFiles()`, `beFreeOfCycles()`, PlantUML `adhereToDiagramInFile()`, Nx support, and the `toPassAsync()` Jest matcher — all have ArchUnitTS equivalents. ts-arch has essentially **nothing unique** that ArchUnitTS lacks, except possibly the inertia/stability of an older, smaller API.

**What ArchUnitTS has that ts-arch lacks:** code metrics (LCOM, complexity, coupling, distance from main sequence), custom rules, custom metrics, empty-test protection, universal test-framework support (ts-arch's matcher is Jest-only), debug logging + file logging, clickable/detailed error messages, HTML report dashboards, and deeper TS-AST analysis.

**API/naming differences (migration-relevant):**

| ts-arch | ArchUnitTS |
|---|---|
| `filesOfProject()` | `projectFiles()` |
| `.beFreeOfCycles()` | `.haveNoCycles()` |
| `slicesOfProject()` | `projectSlices()` |
| `slicesOfNxProject()` | `nxProjectSlices()` |
| `import "tsarch/dist/jest"` | auto-setup on import (no side-effect import) |

**Migration path ts-arch → ArchUnitTS:**
1. `npm uninstall tsarch && npm install archunit --save-dev`.
2. Remove `import "tsarch/dist/jest"`; import `{ projectFiles, projectSlices, metrics }` from `'archunit'`.
3. Rename `filesOfProject()`→`projectFiles()`, `.beFreeOfCycles()`→`.haveNoCycles()`, `slicesOfProject()`→`projectSlices()`, `slicesOfNxProject()`→`nxProjectSlices()`.
4. Keep `.inFolder()/.shouldNot()/.dependOnFiles()` chains and `.toPassAsync()` calls — they're compatible.
5. Reuse existing `.puml` files with `adhereToDiagramInFile()`.
6. Expect previously-passing rules to start **failing if they were empty tests** (typo'd paths) — that's the empty-test protection working; fix the paths.
7. For Vitest, add `globals: true`; for Jasmine, add the async matcher line.

## Details
All capability-specific code examples are embedded inline under each Key Findings subsection above (entry points, dependency rules, cycles, metrics, PlantUML, custom rules, NestJS, and MCP patterns). The core mental model: ArchUnitTS analyzes your compiled TS dependency graph and lets you assert folder-to-folder import rules, graph-level cycle freedom, slice/diagram adherence, and class/file-level metrics — executed as ordinary async unit tests via `toPassAsync()` or `check()`.

## Recommendations
1. **Adopt ArchUnitTS over ts-arch for the NestJS MCP server.** It is a strict superset of ts-arch's capabilities and is actively (if part-time) maintained. Pin the exact installed version.
2. **Stage 1 — baseline guardrails (day one):** add three tests: (a) `projectFiles().inFolder('src/**').should().haveNoCycles()`; (b) domain framework-isolation against `@nestjs/**` and `@modelcontextprotocol/**`; (c) one layer-direction rule (`domain` must not depend on `infrastructure`/`transport`). Use Jest if possible to dodge the Vitest 4 bug; if on Vitest, confirm `toPassAsync()` works on your version before relying on it, and fall back to `await rule.check()` if it throws.
3. **Stage 2 — MCP primitive boundaries:** model `tools/`, `resources/`, `prompts/`, `transport/`, `domain/` folders and enforce: resources have no side-effect deps on tools; transport is swappable (domain ∌ transport); MCP SDK confined to transport. Codify the intended graph in `docs/mcp-components.puml` and validate with `projectSlices().adhereToDiagramInFile`.
4. **Stage 3 — metrics fitness functions:** add `metrics().count().linesOfCode().shouldBeBelow(...)`, `lcom96b().shouldBeBelow(0.5)` on use-cases/tools, and `distance().distanceFromMainSequence().shouldBeBelow(0.3)` on core packages. Wire `exportAsHTML` outputs as CI artifacts.
5. **Keep empty-test protection ON** (the default). It is the main reason to switch. Only set `allowEmptyTests: true` for intentionally-optional folders.
6. **For decorator/DI-level rules ArchUnitTS can't express** (constructor-injection-only, provider visibility), supplement with ESLint (`eslint-plugin-import`/boundaries) or write custom `FileInfo.content` scanners.
7. **Performance thresholds that change the plan:** if your architecture test suite exceeds ~30–60s or you have many feature modules, switch from per-pair rules to a single broad `check()` that buckets violations (issue #55 pattern), keep caching on (default), and run architecture tests in a dedicated CI job rather than on every unit-test run.

## Caveats
- **Version drift:** features documented at v2.3.0 may not be in the npm-published 2.1.63 — verify against your installed version. Download (~50k/month) and star counts are partly maintainer-self-reported and were moving during research (314→~400 stars).
- **Vitest 4 bug (#8)** is open and will break `toPassAsync()`; Jest is the safer default today.
- **No class-level dependency DSL and no decorator awareness** — the task's request for a `classes()` API and "constructor injection visibility / decorator/provider awareness" is only partially satisfiable; those need custom rules or a complementary linter.
- **Path-alias and multi-tsconfig** behavior, while compiler-backed, should be smoke-tested on your exact monorepo layout before you trust negative (passing) results.
- Reports, file logging, and `projectGraph()` are beta.
- The maintainers are part-time; plan accordingly for timely bug fixes.
---
name: archunitts-testing
description: >
  Implement, audit, and gap-analyse ArchUnitTS architecture tests for TypeScript projects.
  Reads docs/architecture/, README.md, CONTRIBUTING.md, and AGENTS.md to understand the
  project's intended architecture, then generates or evaluates ArchUnitTS tests that enforce
  layer boundaries, cycle-freedom, framework isolation, and code-quality metrics.
  Triggers on: "add architecture tests", "implement ArchUnit tests", "enforce architecture",
  "audit architecture tests", "review arch test coverage", "gap analyse architecture tests",
  "what architecture rules are missing", "set up ArchUnitTS", "generate arch tests",
  or any instruction to implement, check, or improve architecture fitness functions in a TypeScript project.
---

# ArchUnitTS Testing Skill

Architecture tests are executable fitness functions — they fail the moment the codebase drifts away from the intended design. This skill reads the project's own human-authored documents (README, CONTRIBUTING, AGENTS.md, ADRs, Mermaid diagrams) to understand *intended* architecture, not just observed folder structure, and produces tests that enforce that intent or identifies the gaps in existing coverage.

---

## Step 1 — Detect Mode

Classify the request before doing anything else.

```
Does the user want to CREATE new tests?
  └─ YES → MODE = IMPLEMENT

Does the user want to REVIEW what tests exist?
  └─ YES → MODE = AUDIT

Does the user want to FIND what tests are MISSING?
  └─ YES (gap analysis, "what's missing", "plan tests") → MODE = GAP_ANALYSIS
```

Ambiguous requests ("help with arch tests") → ask a single clarifying question:
> "Do you want me to (a) generate new ArchUnitTS tests, (b) audit your existing tests for coverage, or (c) identify what rules are missing?"

---

## Step 2 — Gather Project Context

Read in order. Record everything found; mark files as `[present]` or `[missing]`.

### Phase A — Intent Documents

Read these files if they exist:
- `README.md` — project overview, stated design principles, technology stack
- `CONTRIBUTING.md` — coding standards, architecture expectations, module rules
- `AGENTS.md` — AI agent guidance, often describes architecture patterns explicitly
- `CLAUDE.md` — per-project Claude instructions that may describe architecture

Extract: layer names, boundary rules, any explicit statements like "X must not depend on Y", technology choices (NestJS, MCP SDK, Express, etc.).

### Phase B — Architecture Documentation

Inventory these locations:
- `docs/architecture/` — Mermaid diagrams, ADRs (`adr/`), component docs
- `docs/arch/` — alternate location
- `ARCHITECTURE.md` — top-level doc

For each file found, record the layer names, dependency arrows, and ADR decisions. These are the ground truth for what the architecture should look like.

### Phase C — Project Configuration

Read:
- `package.json` — identify test runner (`jest` or `vitest` in `devDependencies` / `scripts`), check if `archunit` is already installed, scan for `@nestjs/*`, `@modelcontextprotocol/*`, `express`, `fastify`, `hono`
- `tsconfig.json` — read `compilerOptions.paths` for path aliases (e.g. `@domain/*`, `@app/*`)

### Phase D — Source Structure

Run: `find src -type d -maxdepth 3 2>/dev/null || find . -path ./node_modules -prune -o -type d -name "src" -print`

Map top-level and second-level folders under `src/`. Common patterns to recognise:
- `domain/`, `application/`, `infrastructure/` → clean architecture
- `core/`, `ports/`, `adapters/` → hexagonal
- `controllers/`, `services/`, `repositories/` → layered (N-tier)
- `tools/`, `resources/`, `prompts/`, `transport/` → MCP server
- `modules/<feature>/` → NestJS feature modules

### Phase E — Existing Architecture Tests

Search for existing arch tests:
```
find . -not -path "*/node_modules/*" \( -name "*.arch.spec.ts" -o -name "*.arch.test.ts" -o -name "architecture.spec.ts" -o -name "architecture.test.ts" \)
```
For each file found, read it and record: which `projectFiles()` / `metrics()` rules exist, which folders they target, and which assertion type they use (`haveNoCycles`, `dependOnFiles`, `adhereToDiagram`, metrics).

### Phase F — Summary

Before proceeding, produce an internal summary:
- Architecture style detected: `[clean | hexagonal | layered | mcp-server | nestjs-modules | unknown]`
- Test runner: `[jest | vitest | unknown]`
- ArchUnitTS installed: `[yes | no]`
- Vitest major version (check `package.json`): flag if `vitest@4.x` (known bug #8)
- Existing arch tests: `[list of files]` or `[none]`
- Key path aliases: `[list]` or `[none]`

---

## Step 3 — Load References

Always load `references/archunitts-api.md`.

Load architecture-pattern references based on Phase F summary:

| Detected signal | Load reference |
|---|---|
| `@nestjs/*` in dependencies | `references/patterns/nestjs-modules.md` |
| `@modelcontextprotocol/*` in dependencies | `references/patterns/mcp-server.md` |
| `src/domain/` + `src/application/` + `src/infrastructure/` | `references/patterns/clean-architecture.md` |
| `src/core/` or `src/ports/` + `src/adapters/` | `references/patterns/hexagonal.md` |
| `src/controllers/` + `src/services/` + `src/repositories/` | `references/patterns/layered.md` |
| Multiple signals match | Load all matching references |
| No pattern detected | Load `references/patterns/layered.md` as the default |

For AUDIT and GAP_ANALYSIS modes, also load `references/gap-analysis.md`.

---

## Step 4 — Mode-Specific Execution

### IMPLEMENT

#### 4a — ArchUnitTS Installation

Is `archunit` present in `devDependencies`?
```
NO → output: npm install --save-dev archunit
```

Is the test runner Vitest?
```
YES → Check Vitest major version:
  └─ vitest@4.x → WARN: known bug (#8) — `toPassAsync()` throws TypeError on Vitest 4.
                   Use `await rule.check()` pattern instead (see references/archunitts-api.md).
                   Add to vitest.config.ts: globals: true, environment: 'node'
  └─ vitest@3.x or earlier → Add to vitest.config.ts: globals: true, environment: 'node'
NO (Jest) → no config changes needed
```

#### 4b — Determine Test File Location

Where do existing tests live?
```
src/__tests__/ exists → place arch tests there
test/ exists at root   → place arch tests at test/architecture/
No convention found    → use src/architecture/
```

#### 4c — Generate Test Files

Using `assets/arch.spec.template.ts` as the scaffold and the loaded pattern references, generate these test files (only the ones applicable to the detected architecture):

**File 1: `cycle-freedom.arch.spec.ts`**
- One `haveNoCycles()` rule scoped to `src/**`
- Scope to sub-folders if the project is large (e.g. one per module)

**File 2: `layer-boundaries.arch.spec.ts`**
- One rule per layer-direction violation (from the loaded pattern reference)
- Framework-isolation rules (no `@nestjs/*` in domain, no `@modelcontextprotocol/sdk` outside transport/adapter layer)
- Use the actual folder paths discovered in Phase D

**File 3: `metrics.arch.spec.ts`** (include only if `metrics()` makes sense for the detected layers)
- `linesOfCode().shouldBeBelow(500)` on the largest expected layer
- `lcom96b().shouldBeBelow(0.5)` on use-case/tool classes
- `distanceFromMainSequence().shouldBeBelow(0.3)` on the domain/core layer

Generate each file with real folder paths (not placeholders) wherever Phase D provided them. Where a path is uncertain, use a `// TODO: verify path` comment.

Hard rules for generated tests:
- **Never** set `allowEmptyTests: true` — the default empty-test protection is a core safety feature
- **Always** include `await` on `rule.check()` or `toPassAsync()`
- **Never** mix rule assertion styles (pick `toPassAsync()` for Jest, `await rule.check()` for Vitest 4)
- **Always** scope cycle rules to `src/**` or narrower, not the root

#### 4d — Generate PlantUML Companion File

ArchUnitTS's `adhereToDiagramInFile()` requires PlantUML format — Mermaid (used for human-readable docs) is not supported by the library. Generate a minimal `.puml` slice diagram so the diagram-adherence test has a file to validate against.

Write `docs/architecture/arch-slices.puml` using the layers identified in Phase D and Phase A/B:

```
@startuml
' Architecture slice dependency diagram — used by archunitts-testing adhereToDiagramInFile()
' Do not use this file for documentation; see the Mermaid diagrams in this directory instead.

component [<layer-a>] as layerA
component [<layer-b>] as layerB
component [<layer-c>] as layerC

layerA --> layerB
layerB --> layerC
@enduml
```

Rules for the generated `.puml`:
- Component names must match the top-level folder names under `src/` (the slice capture group in `projectSlices().definedBy('src/(**)/'))`)
- Only draw arrows that are **permitted** — the diagram is an allowlist, not a full map
- Add a comment at the top of the file clarifying it is a tooling artefact, not a documentation file
- If `docs/architecture/` does not exist, create it; the Mermaid diagrams from `architecture-docs` may already be there

Then add the diagram-adherence test to `layer-boundaries.arch.spec.ts`:

```ts
it('slices must adhere to the architecture diagram', async () => {
  const rule = projectSlices()
    .definedBy('src/(**)/')
    .should()
    .adhereToDiagramInFile('docs/architecture/arch-slices.puml');
  await expect(rule).toPassAsync();
});
```

#### 4e — Output

List every file written with its full path. Then emit:
1. Installation command (if needed)
2. Config snippet (if Vitest)
3. Run command: `npx jest --testPathPattern="arch"` or `npx vitest run --reporter=verbose` filtered to arch files

---

### AUDIT

For each arch test file found in Phase E:

1. **Coverage map** — for each rule, record:
   - Layer / boundary targeted
   - Assertion type: `haveNoCycles` | `dependOnFiles` | `metrics` | `adhereToDiagram` | `custom`
   - Direction: deny-list (`.shouldNot().dependOnFiles()`) or allow-list (`.should().dependOnFiles()`)
   - Empty-test risk: does the folder path look correct? (check against Phase D source structure)

2. **Quality checks** — for each rule:
   - Is `allowEmptyTests: true` set? → flag as `[risk: empty-test bypass]`
   - Is the folder path verified against actual source structure? → flag `[risk: path mismatch]` if uncertain
   - Are path aliases used as rule targets? → note as `[review: alias resolution]`
   - Is the test async (`await`)? → flag `[bug: missing await]` if synchronous

3. **Produce coverage summary table**:

```
| Category              | Covered | Notes                        |
|-----------------------|---------|------------------------------|
| Cycle detection       | ✓/✗     | e.g. "scoped to src/**"      |
| Layer direction       | ✓/✗     | e.g. "domain→infra missing"  |
| Framework isolation   | ✓/✗     | e.g. "@nestjs/* not checked" |
| Module boundaries     | ✓/✗     |                              |
| Metrics               | ✓/✗     |                              |
| PlantUML diagram adherence | ✓/✗ |                             |
```

Write the coverage summary to `docs/architecture/arch-test-report.md`.

---

### GAP_ANALYSIS

Combine the AUDIT coverage map with the rule set from the loaded pattern references.

For each rule category that is `✗` (missing) in the coverage map, produce a **gap finding**:

```
Severity: critical | major | minor
Category: [e.g. Cycle Detection]
Finding: [one-sentence description of what's missing]
Impact: [what could go wrong without this rule]
Example test:
```typescript
it('should have no dependency cycles', async () => {
  const rule = projectFiles()
    .inFolder('src/**')
    .should()
    .haveNoCycles();
  await expect(rule).toPassAsync();
});
```
```

Severity classification:
- **critical** — no cycle detection at all; no layer-direction rules
- **major** — missing framework isolation; missing module-boundary rules
- **minor** — no metrics rules; no diagram adherence rule (the IMPLEMENT mode generates `docs/architecture/arch-slices.puml` so this can always be added)

Write the gap analysis report to `docs/architecture/arch-test-report.md` with:
1. Executive summary (total gaps: N critical, M major, P minor)
2. Coverage map table (same as AUDIT)
3. Gap findings (sorted by severity)
4. Next-step stubs: copy-paste-ready test code for the top 3 critical/major gaps

---

## Step 5 — Final Output

### IMPLEMENT output
```
Architecture tests written:

  ✓ <path>/cycle-freedom.arch.spec.ts           — haveNoCycles on src/**
  ✓ <path>/layer-boundaries.arch.spec.ts        — N layer direction rules, M framework isolation rules, diagram adherence
  ✓ <path>/metrics.arch.spec.ts                 — lines-of-code, LCOM, distance-from-main-sequence
  ✓ docs/architecture/arch-slices.puml          — PlantUML slice diagram for adhereToDiagramInFile()

Setup:
  [npm install command if needed]
  [vitest.config.ts changes if needed]

Run architecture tests:
  [exact command]

Notes:
  [any Vitest bug warnings, path alias caveats, or TODO paths]
  arch-slices.puml is a tooling artefact — the human-readable Mermaid diagrams in docs/architecture/ are the source of truth for documentation.
```

### AUDIT / GAP_ANALYSIS output
```
Architecture test report written to docs/architecture/arch-test-report.md

Summary: N tests audited | M gaps found (P critical, Q major, R minor)

Critical gaps (fix first):
  1. [gap 1 — one line]
  2. [gap 2 — one line]
```

---

## Reference Files

- `references/archunitts-api.md` — Full API surface, known bugs, migration from ts-arch; **always loaded**
- `references/patterns/layered.md` — N-tier layer rules (controller → service → repository)
- `references/patterns/clean-architecture.md` — Clean arch rules (domain / application / infrastructure)
- `references/patterns/hexagonal.md` — Ports-and-adapters rules (core / ports / adapters)
- `references/patterns/mcp-server.md` — MCP primitive boundary rules (tools / resources / prompts / transport)
- `references/patterns/nestjs-modules.md` — NestJS feature-module boundary rules
- `references/gap-analysis.md` — Severity heuristics for AUDIT and GAP_ANALYSIS modes

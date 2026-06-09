# Gap Analysis — Severity Heuristics for ArchUnitTS Coverage

Load this reference for AUDIT and GAP_ANALYSIS modes. It defines how to classify missing rule categories and what constitutes adequate coverage.

---

## Severity Classification

| Severity | Definition | Fix urgency |
|---|---|---|
| **critical** | Absence allows a class of architectural violations that go completely undetected | Fix before any new feature work |
| **major** | Coverage exists but key boundaries are unguarded; violations require manual discovery | Fix in the next sprint |
| **minor** | Good structural coverage but quality metrics or diagram adherence are missing | Address as code quality backlog |

---

## Coverage Categories and Severity

### Cycle Detection — critical if absent

| Condition | Finding |
|---|---|
| No `haveNoCycles()` rule anywhere | **critical** — circular imports will accumulate invisibly; they are the most common cause of build-order issues and incremental compilation failures |
| Cycle detection exists but scoped to a sub-folder only | **major** — cycles between top-level layers remain undetected |

Minimum acceptable: one `haveNoCycles()` rule covering at least `src/**`.

---

### Layer Direction Rules — critical if absent

| Condition | Finding |
|---|---|
| No `shouldNot().dependOnFiles()` rules at all | **critical** — any layer may freely import from any other; the architectural boundary exists only as convention |
| Some layer pairs covered but core inward-dependency rule missing | **major** — e.g., domain → infrastructure missing while infrastructure → domain is covered |
| All inward rules present but cross-module rules missing | **major** (for modular projects) |

Minimum acceptable: the innermost layer (domain/core) has at least one rule preventing it from importing outer layers.

---

### Framework Isolation — major if absent

| Condition | Finding |
|---|---|
| Domain/core imports a web framework or MCP SDK without a rule preventing it | **major** — framework coupling in the domain makes the business logic untestable in isolation and non-portable |
| Framework isolation rule exists but only for one framework when multiple are present | **major** |

Minimum acceptable: one rule per framework-package-pattern (`**/node_modules/@nestjs/**`, `**/node_modules/@modelcontextprotocol/**`, etc.) preventing domain/core from importing it.

---

### Module Boundary Rules — major if absent (modular projects only)

| Condition | Finding |
|---|---|
| Feature modules present but no cross-module dependency rules | **major** — NestJS modules do not enforce static imports; feature A can import feature B's services directly |
| Rules exist but only cover some module pairs | **major** |

Applies when: `src/modules/<feature>/` structure detected, or `@nestjs/*` present.

---

### Metrics Rules — minor if absent

| Condition | Finding |
|---|---|
| No metrics rules at all | **minor** — architecture tests pass but code quality can degrade unchecked |
| `linesOfCode` rules missing on large layers | **minor** |
| No LCOM cohesion rules on use-case / service classes | **minor** |
| No `distanceFromMainSequence` on domain/core | **minor** |

---

### PlantUML / Diagram Adherence — minor if absent

| Condition | Finding |
|---|---|
| Architecture diagram exists in docs but no `adhereToDiagramInFile()` rule | **minor** — the diagram and code can silently diverge |
| No architecture diagram exists | informational (not a gap in test coverage, but a documentation gap; see architecture-docs skill) |

---

## Coverage Score

Use this to produce an at-a-glance summary:

```
Cycle detection:      ✓ / ✗ (critical)
Layer direction:      ✓ / ✗ (critical)
Framework isolation:  ✓ / ✗ (major)
Module boundaries:    ✓ / ✗ / N/A (major)
Metrics:              ✓ / ✗ (minor)
Diagram adherence:    ✓ / ✗ / N/A (minor)

Overall:  STRONG / ADEQUATE / WEAK / NONE
```

| Rating | Condition |
|---|---|
| **STRONG** | All critical + all major covered; minor gaps only |
| **ADEQUATE** | All critical covered; some major gaps |
| **WEAK** | At least one critical covered; multiple majors missing |
| **NONE** | No critical coverage at all |

---

## Quality Checks for Existing Rules

Even present rules can have quality issues:

| Issue | Severity | Check |
|---|---|---|
| `allowEmptyTests: true` set without justification | major | Empty-test protection disabled — a typo'd path silently passes |
| Path in `inFolder()` does not exist in source tree | major | Dead rule — always passes, never catches a real violation |
| No `await` on `rule.check()` or `toPassAsync()` | major | Async assertion not awaited — test passes regardless of violations |
| Path aliases used as rule targets without verification | minor | Alias may not resolve as expected (see archunitts-api.md caveats) |
| Cycle rule scoped too narrowly (single sub-folder) | minor | Cross-folder cycles still undetected |
| `clearCache: true` on every rule | minor | Defeats caching, significantly slows large suites |

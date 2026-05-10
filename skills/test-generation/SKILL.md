---
name: test-generation
description: >
  Generate unit tests, integration tests, and benchmarks for Python, TypeScript, and Go code.
  Detects the language and test framework automatically, loads language-specific standards, reads
  the source under test, and writes idiomatic test files to disk. Triggers on: "write tests for",
  "add tests to", "generate unit tests", "test this function", "create test coverage for",
  "write a test suite for", "add coverage", "benchmark this", or any instruction to generate,
  add, or improve tests for existing code.
---

# Test Generation Skill

A skill for generating idiomatic, standards-grounded tests for Python, TypeScript, and Go code.
Covers unit tests, integration tests, and benchmarks — grounded in ISO/IEC/IEEE 29119, NIST IR 8397,
ISTQB conventions, and the official style guides for each language.

---

## Core Philosophy

A test has one job: verify that a unit of code does what it claims to do, under conditions that
matter. Every generated test must answer: **what behaviour is being verified, under what conditions,
and what is the expected outcome.**

A test suite that maximises a coverage metric without covering meaningful conditions has failed its
purpose. A test suite tightly coupled to implementation details that breaks on every refactor is a
liability, not an asset.

---

## Step 1 — Language & Framework Detection

Detect language from file extensions. Detect framework from project configuration files. Ask only
if genuinely ambiguous.

**Language detection:**

| File extension | Language |
|---|---|
| `.py` | Python |
| `.ts`, `.tsx` | TypeScript |
| `.go` | Go |

**Framework detection:**

```
Python:
  Is pytest configured? (pyproject.toml [tool.pytest], pytest.ini, setup.cfg [tool:pytest])
    └─ YES → pytest
    └─ NO  → assume pytest; note it will need installing

TypeScript:
  Is vite.config.ts present in the project root?
    └─ YES → Vitest — actively recommend it, do not default to Jest
    └─ NO  → Is jest.config.* present?
              └─ YES → Jest
              └─ NO  → Ask: "No test framework configured. Use Jest or Vitest?"

Go:
  Is testify listed in go.mod?
    └─ YES → note it is available; still default to stdlib testing + google/go-cmp
    └─ NO  → stdlib testing package only
```

**Coverage configuration detection:**

Check for existing coverage targets before generating tests — respect them if found.

| Language | Where to look |
|---|---|
| Python | `pyproject.toml` `[tool.coverage.report]` `fail_under` |
| TypeScript | `jest.config.ts` / `jest.config.js` `coverageThreshold` |
| Go | CI scripts for `-coverprofile` flags |

---

## Step 2 — Load References

Always load `references/universal.md` first.

```
Language detected:
  .py files        → load references/python.md
  .ts / .tsx files → load references/typescript.md
  .go files        → load references/golang.md
  Mixed            → load all relevant language references
```

---

## Step 3 — Read Context

Before generating any tests:

1. **Read the source file(s)** — identify every public function, method, or class to be tested.
   Note parameter types, return types, and documented error conditions.

2. **Check for existing test files** — if a test file already exists for this module, read it.
   Match the existing style, fixture patterns, and naming conventions. Do not regenerate tests that
   already exist; extend the suite.

3. **Map dependencies** — identify every external dependency the code calls (DB clients, HTTP
   clients, filesystem, environment variables). Each must be mocked or stubbed in unit tests.

4. **Identify error paths** — look for error returns, raised exceptions, panics, or conditional
   branches. Each is a test case.

---

## Step 4 — Determine Test Scope

Answer these questions before generating any test:

```
What level(s) of tests are needed?
  └─ Unit (default) — isolated, all external deps mocked
  └─ Integration — user explicitly requested, OR the code under test is primarily a boundary
     (HTTP handler, database repository, message queue consumer)
  └─ Both — generate both; integration tests go in a separate file

Is benchmarking needed?
  └─ YES — user requests it, OR function is described as performance-critical / a hot path
  └─ NO  → skip

What coverage categories are required?
  ├─ Happy path (specification-based): expected inputs → expected outputs
  ├─ Edge cases: boundary values, empty inputs, zero values, null/nil/None
  ├─ Error / failure paths: invalid inputs, error returns, thrown exceptions
  ├─ Parameterized cases: any function with multiple input variants → use the language idiom
  └─ Regression cases: if existing tests are present, check for gaps before adding new

What is the coverage target?
  └─ Project has configured threshold → use it
  └─ No threshold configured → target 80% branch + statement (NIST / ISTQB de facto standard)
     Note: branch coverage is the meaningful metric — do not optimise for line coverage alone
```

---

## Step 5 — Generate Tests

Apply `references/universal.md` to all tests. Apply the language-specific reference for patterns,
idioms, and framework mechanics.

### Universal rules (apply regardless of language)

- **AAA structure:** Arrange (set up state and inputs), Act (invoke the unit under test), Assert
  (verify the outcome). Keep all three phases visually distinct.
- **One behaviour per test:** each test verifies exactly one thing. Multiple independent assertions
  testing different behaviours must be split into separate tests.
- **No logic in tests:** no `if`, `for`, or `while` inside test bodies. Conditional behaviour
  belongs in a parameterized case list — not as a branch inside a single test.
- **Deterministic:** mock all sources of non-determinism: `time.Now()` / `datetime.now()`,
  random number generation, external APIs, environment variables.
- **Independent:** tests must be runnable in any order with no shared mutable state.
- **Descriptive names:** names must communicate what is tested, under what condition, and what the
  expected outcome is.

### Test file placement

| Language | File name | Location |
|---|---|---|
| Python | `test_<module>.py` | `tests/` or colocated — match project convention |
| TypeScript | `<module>.test.ts` or `<module>.spec.ts` | Colocated or `__tests__/` — match project convention |
| Go | `<file>_test.go` | Same directory as the source file |

If the project has an established convention, always match it. Ask only if the layout is
genuinely non-standard in a way that conflicts with the language convention.

### Naming patterns

| Language | Pattern | Example |
|---|---|---|
| Python | `test_<what>_<condition>_<expected>` | `test_login_invalid_password_raises_auth_error` |
| TypeScript | `describe` + `it('should <outcome> when <condition>')` | `it('should return 401 when credentials are invalid')` |
| Go | `TestFuncName_WhenCondition` (outer) + `t.Run("descriptor")` (subtests) | `TestLogin_WhenPasswordInvalid` |

---

## Step 6 — Write to Disk & Run Guidance

### Write tests to disk

Write the generated test file(s) to the correct location per Step 5. If a test file already
exists, extend it — do not overwrite. Ask before writing only if a non-standard layout conflicts
with the language's expected file placement.

### Run commands

Output the exact commands to run and verify the generated tests after writing.

**Python:**
```bash
# Unit tests with coverage
pytest --cov=<package> --cov-report=term-missing

# Integration tests only
pytest -m integration

# Benchmarks only
pytest --benchmark-only
```

**Go:**
```bash
# Unit tests with race detector
go test -race ./...

# With coverage report
go test -race -coverprofile=coverage.out ./...
go tool cover -func=coverage.out

# Integration tests (requires build tag)
go test -race -tags=integration ./...

# Benchmarks — minimum 10 samples for statistical validity
go test -bench=. -benchmem -count=10 ./...

# Compare benchmarks with benchstat
benchstat old.txt new.txt
```

**TypeScript (Jest):**
```bash
# Unit tests with coverage
jest --coverage

# Integration tests
jest --config jest.integration.config.ts
```

**TypeScript (Vitest):**
```bash
# Unit tests with coverage
vitest run --coverage

# Benchmarks
vitest bench
```

---

## Reference Files

- `references/universal.md` — ISO/IEC 29119 test levels, ISTQB test pyramid (70/20/10 ratios),
  NIST IR 8397 minimum techniques, coverage standards, integration testing principles, and
  universal unit testing principles that apply to every language
- `references/python.md` — pytest conventions, fixture scoping, `@pytest.mark.parametrize`,
  `conftest.py`, marker registration, integration test setup, async tests, pytest-benchmark
- `references/typescript.md` — Jest and Vitest conventions, typed mocks, readonly fixtures,
  snapshot guidance, `supertest` integration testing, coverage threshold configuration, vitest bench
- `references/golang.md` — Table-driven tests, `t.Fatal` vs `t.Error`, no-assert-library rule,
  `google/go-cmp`, build constraints, `testdata/`, race detector, fuzz testing, `b.Loop()`
  benchmarks, benchstat comparison workflow

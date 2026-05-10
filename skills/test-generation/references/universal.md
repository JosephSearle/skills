# Universal Test Generation Reference

Standards authorities:
- [ISO/IEC/IEEE 29119](https://www.iso.org/standard/81291.html) — Software Testing (primary international standard)
- [NIST IR 8397](https://nvlpubs.nist.gov/nistpubs/ir/2021/NIST.IR.8397.pdf) — Minimum Standards for Developer Verification of Software
- [ISTQB](https://www.istqb.org/) — International Software Testing Qualifications Board

Apply this reference to all generated tests, regardless of language.

---

## Test Levels (ISO/IEC 29119 + ISTQB)

| Level | Focus | Mocking stance |
|---|---|---|
| Unit / Component | Individual functions, classes, or modules in isolation | All external deps mocked |
| Integration | Interactions between real components at a boundary | Minimal mocking; own code is real |
| System | End-to-end behaviour of the full application | Real or near-real environment |
| Acceptance | Conformance to user requirements | User / business perspective |

**Default scope for this skill:** Unit testing. Generate integration tests only when explicitly
requested or when the code under test is primarily a boundary component (HTTP handler, DB
repository, message queue consumer).

---

## The Test Pyramid (ISTQB)

The pyramid defines the target distribution of tests by level. Generating tests that invert it
creates a slow, brittle, expensive suite.

```
         ┌─────┐
         │ E2E │  10%  — slow, expensive; cover critical user paths only
       ┌─┴─────┴─┐
       │  Integ  │  20%  — verify component interactions
     ┌─┴─────────┴─┐
     │    Unit     │  70%  — fast, isolated; the bulk of the suite
     └─────────────┘
```

When generating a suite from scratch, aim for this ratio. Do not generate one integration test per
function — that inverts the pyramid.

---

## NIST IR 8397 — Minimum Test Technique Coverage

NIST IR 8397 (published under Executive Order 14028) defines the minimum set of techniques
required for developer verification of software. The most directly applicable to test generation:

| Technique | What it means for generated tests |
|---|---|
| Automated testing | Tests must be runnable in CI with a single command — no manual steps |
| Black-box / specification-based | Happy path: exercise the documented interface against its specification |
| Structural / coverage-driven | Branch and boundary tests: exercise all conditional paths and boundary values |
| Historical / regression | When existing tests are present, identify gaps; do not duplicate |
| Fuzzing | For input-parsing functions in Go, generate a `FuzzXxx` function (Go 1.18+) |

NIST coverage guidance: *"Most code should be executed during unit testing. Coverage metrics
(branch, block, function) should drive additional test case creation."* Branch and statement
coverage are the meaningful metrics — not just line coverage.

---

## Coverage Standards

No standards body mandates a single universal target, but the following are the widely-adopted
industry norms:

| Threshold | Meaning |
|---|---|
| < 70% | Under-tested — below the organizational floor for most production software |
| 70% | Common minimum floor |
| 80% | De facto industry expectation for production code (NIST-aligned) |
| 100% | Rarely the right target — optimises for the metric, not quality |

**Branch + statement coverage is the meaningful measure.** Line coverage can be 100% while entire
conditional paths are never exercised.

If the project has a configured threshold, respect it. If not, target 80% branch + statement and
output the CI configuration to enforce it.

---

## Unit Testing Principles

**Isolation:** every unit test runs independently. No shared mutable state between tests. No
ordering dependencies. A test that only passes when run after another test is broken.

**Single concern:** one test verifies one behaviour. If a test must assert multiple independent
facts about different behaviours, each becomes its own test.

**AAA structure:** three phases, kept visually distinct:

```
# Arrange — set up inputs and state
# Act     — invoke the unit under test (one call)
# Assert  — verify the observable outcome
```

Never collapse Arrange and Act into the same line when it obscures what is being tested.

**Descriptive naming:** test names communicate what is being tested, under what condition, and what
the expected outcome is. The name should be a readable sentence for someone unfamiliar with the
code. "test_divide" is not descriptive. "test_divide_by_zero_raises_value_error" is.

**Test behaviour, not implementation:** tests must survive internal refactors. If a test breaks
because a private method was renamed — not because observable behaviour changed — the test is
testing the wrong thing.

**No logic in tests:** no `if`, `for`, `while`, or `try/except` inside test bodies. Conditional
behaviour belongs in a parameterized case list, not as a branch inside a single test. Logic in
tests makes the test itself a source of bugs.

**Deterministic:** the same inputs must always produce the same result on every run, in any
environment. Mock all sources of non-determinism:
- Current time (`time.Now()`, `datetime.now()`, `Date.now()`)
- Random number generation
- External APIs and network calls
- File system contents that may vary
- Environment variables (set explicitly in the test, do not rely on ambient values)

A test that sometimes passes and sometimes fails is worse than no test — it erodes trust in the
entire suite.

**Independence:** tests must run in any order. No test may depend on state set by a prior test or
left over from a previous run.

---

## Integration Testing Principles

Integration tests verify that real components work together correctly. They differ from unit tests
in key ways:

**Minimal mocking:** test at the real boundary. Do not mock components you own — only mock external
third-party services that cannot be containerised or sandboxed.

**Real infrastructure:** prefer real databases and message queues in containers (e.g.
Testcontainers) over in-memory fakes when behavioural differences between the fake and real system
could mask bugs.

**Explicit teardown:** all state mutated during the test must be cleaned up. Database rows inserted
must be deleted or the transaction rolled back. Containers must be stopped. Temp files must be
removed.

**Separate from unit tests by default:** integration tests are tagged, marked, or placed in a
separate configuration so they are excluded from the default unit test run. They run as a distinct
CI step. This keeps the unit test feedback loop fast.

**Slower by nature:** integration tests take seconds to minutes. Keep their count proportional to
the pyramid (approximately 20% of total test count).

---

## Coverage Categories to Generate

For every function or method under test, identify which categories apply and generate at least one
test per applicable category:

| Category | What to test |
|---|---|
| Happy path | Expected inputs → expected outputs per the documented interface |
| Edge cases | Boundary values (min, max, off-by-one), empty collections, zero values |
| Null / nil / None | Any parameter that could be absent or unset |
| Error / failure paths | Invalid inputs, upstream failures, error return values, thrown exceptions |
| Parameterized variants | Multiple input/output pairs for the same logical behaviour → use the language's data-driven idiom |
| Regression | If existing tests are present, identify untested paths before adding new cases |

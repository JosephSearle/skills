# Testing Reference — pytest, Hypothesis, Coverage, CI Strategy

## Configuration in `pyproject.toml`

```toml
[tool.pytest.ini_options]
minversion       = "8.0"
testpaths        = ["tests"]
pythonpath       = ["src"]           # required for src/ layout
asyncio_mode     = "auto"            # pytest-asyncio 1.0: auto-detect async tests
asyncio_default_fixture_loop_scope = "function"   # silences deprecation warning
addopts = [
    "-ra",                           # short summary for all non-passes
    "--strict-markers",              # unregistered markers raise an error
    "--strict-config",               # config typos raise an error
    "--showlocals",
    "--tb=short",
    "--cov=mypkg",
    "--cov-report=term-missing",
    "--cov-report=xml",              # for Codecov / CI artefacts
    "--cov-branch",
    "--cov-fail-under=90",
]
markers = [
    "slow: marks tests as slow (deselect with -m 'not slow')",
    "integration: requires external services",
    "unit: pure-function tests",
]
filterwarnings = [
    "error",                         # all warnings fail tests by default
    "ignore::DeprecationWarning:third_party_lib.*",
]

[tool.coverage.run]
source         = ["mypkg"]
branch         = true                # branch coverage > line coverage
parallel       = true                # supports pytest-xdist
relative_files = true
omit = ["*/tests/*", "*/__main__.py", "*/_version.py"]

[tool.coverage.report]
fail_under   = 90
show_missing = true
skip_covered = false
precision    = 2
exclude_lines = [
    "pragma: no cover",
    "raise NotImplementedError",
    "if TYPE_CHECKING:",
    "if __name__ == .__main__.:",
    "@overload",
    "\\.\\.\\.",
]
```

---

## Fixture Best Practices

```python
# tests/conftest.py
from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


# ─── Scope rules of thumb ─────────────────────────────────────────────────
# function (default): fresh per test — safest, slowest
# class:    shared across tests in a class
# module:   shared across a file
# session:  shared across the whole pytest run — fastest; requires isolation
# ──────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def db_engine():
    """Create the database engine once per test session."""
    engine = create_engine("sqlite:///:memory:", future=True)
    yield engine
    engine.dispose()


@pytest.fixture()
def db_session(db_engine) -> Iterator[Session]:
    """Per-test transactional session — rolls back on teardown."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(autouse=True)
def _set_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Apply env setup to every test automatically."""
    monkeypatch.setenv("MYPKG_ENV", "test")


# Factory fixture — when callers need to customise the produced object
@pytest.fixture()
def make_user():
    def _make(name: str = "alice", role: str = "viewer") -> dict[str, str]:
        return {"name": name, "role": role}
    return _make
```

**RULES:**
- Use `yield` for fixtures that need teardown — code after `yield` runs even if the test raises.
- Use `scope="session"` only for **idempotent, read-only** setup (an engine, a container). Anything
  mutable should be function-scoped or wrapped in a per-test transaction.
- Reserve `autouse=True` for env setup, time freezing, log capture — never for things tests
  should opt into explicitly.
- Use **factory fixtures** (fixture returns a callable) instead of `pytest.fixture(params=[...])`
  when callers need customisation without sharing state.

---

## Parametrize Patterns

```python
import pytest


@pytest.mark.parametrize(
    ("input_val", "expected"),
    [
        pytest.param("",        "",      id="empty"),
        pytest.param("hello",   "hello", id="ascii"),
        pytest.param("café",    "café",  id="utf8"),
        pytest.param("  hi  ",  "hi",    id="whitespace-stripped"),
        pytest.param(None, None, id="none-passthrough",
                     marks=pytest.mark.xfail(reason="not yet implemented")),
    ],
)
def test_normalize(input_val: str | None, expected: str | None) -> None:
    assert normalize(input_val) == expected


# Stacking produces the Cartesian product
@pytest.mark.parametrize("a", [1, 2, 3])
@pytest.mark.parametrize("b", ["x", "y"])
def test_combinations(a: int, b: str) -> None:   # runs 6 times
    ...
```

**RULE:** Always provide `id=` for non-trivial parameters — otherwise pytest fabricates IDs
like `test_x[obj0-obj1]` that are useless in CI logs and impossible to run individually.

---

## Marker Conventions

Register every marker in `[tool.pytest.ini_options].markers` and use `--strict-markers` (already
in the template above). Typos in `@pytest.mark.xxx` then become errors instead of silent no-ops.

```bash
pytest -m "not slow"     # fast local run (skip slow tests)
pytest -m "integration"  # CI nightly job
pytest -m "unit"         # fastest unit-only run
```

---

## `conftest.py` Structure (src layout)

```
project/
├── pyproject.toml
├── src/mypkg/...
└── tests/
    ├── conftest.py           # session/global fixtures, env setup
    ├── unit/
    │   ├── conftest.py       # unit-only fixtures
    │   └── test_models.py
    └── integration/
        ├── conftest.py       # DB containers, external service mocks
        └── test_api.py
```

- **Root `conftest.py`** loads before any test; put env vars, shared session fixtures, and
  `pythonpath`-style setup there.
- **Subdirectory `conftest.py`** files cascade downward — fixtures defined there are only
  visible below that directory.
- **Test file naming:** one `test_<module>.py` per source module:
  `src/mypkg/parser.py` → `tests/unit/test_parser.py`.
- **Test function naming:** `test_<unit>_<scenario>_<expectation>` —
  e.g., `test_parse_empty_input_returns_none`. Long is fine; pytest shows names verbatim.

---

## Async Tests (pytest-asyncio 1.0)

pytest-asyncio 1.0 (released May 25, 2025) removed the `event_loop` fixture and added
implicit loop management via `loop_scope`.

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"   # every async test function auto-detected
asyncio_default_fixture_loop_scope = "function"
```

With `asyncio_mode = "auto"`, you no longer need `@pytest.mark.asyncio` on every async test.
Every `async def test_*` in the test directories becomes a coroutine test automatically.

```python
async def test_fetch_returns_data(aiohttp_session) -> None:
    result = await fetch(aiohttp_session, "https://api.example.com/data")
    assert result["status"] == "ok"
```

---

## Hypothesis — Property-Based Testing

Each property-based test finds ~50× as many mutations as the average unit test (Coblenz et al.,
OOPSLA 2025 — studied 426 Python programs in 40 projects). The invest-in-Hypothesis rule:
**any code with an invariant is a candidate.**

### When to reach for it

- **Parsing / serialisation** — `parse(serialize(x)) == x` (round-trip)
- **Arithmetic / domain ops** — `abs(x) >= 0`, `sorted(xs)` is monotonic, `add(a, b) == add(b, a)`
- **Cross-check against a slow "gold standard"** — fast optimized impl vs naive reference
- **Stateful systems** — account balance ≥ 0, refcount ≥ 0, cache size ≤ max

### The 5 most useful strategies

```python
from hypothesis import given, settings, strategies as st


# 1. Primitives with constraints
@given(st.integers(min_value=1, max_value=10_000))
def test_positive_bounded(n: int) -> None:
    assert 1 <= n <= 10_000


# 2. Floats (always disable NaN unless you explicitly handle it)
@given(st.floats(allow_nan=False, allow_infinity=False, width=64))
def test_float_round_trip(x: float) -> None:
    assert float(repr(x)) == x


# 3. Text with alphabet control
@given(st.text(min_size=1, max_size=100,
               alphabet=st.characters(categories=("L", "N"))))
def test_no_empty_string(s: str) -> None:
    assert len(s) > 0


# 4. Collections compose
@given(st.lists(st.integers(), min_size=0, max_size=100))
def test_sort_is_idempotent(xs: list[int]) -> None:
    assert sorted(xs) == sorted(sorted(xs))


# 5. Composite strategies for domain objects
@st.composite
def user(draw: st.DrawFn) -> dict:
    return {
        "name":  draw(st.text(min_size=1, max_size=50)),
        "age":   draw(st.integers(min_value=0, max_value=150)),
        "email": draw(st.emails()),
    }

@given(user())
def test_user_json_roundtrip(u: dict) -> None:
    import json
    assert json.loads(json.dumps(u)) == u
```

### CI vs local settings profiles

```python
# tests/conftest.py
import os
from hypothesis import HealthCheck, settings, Verbosity

settings.register_profile(
    "ci",
    max_examples=1000,
    deadline=None,                # CI runners are noisy; avoid spurious timeouts
    suppress_health_check=[HealthCheck.too_slow],
)
settings.register_profile(
    "dev",
    max_examples=50,
    deadline=200,                 # ms; fast feedback during edit-test-loop
)
settings.register_profile("debug", max_examples=10, verbosity=Verbosity.verbose)

settings.load_profile(os.getenv("HYPOTHESIS_PROFILE", "dev"))
```

In CI: `HYPOTHESIS_PROFILE=ci pytest -n auto`.

### Stateful testing — `RuleBasedStateMachine`

Use when correctness depends on **operation sequences**, not single operations: ORMs, caches,
ledgers, refcounters, file systems. Hypothesis generates random operation sequences and minimises
failing ones to the smallest repro.

```python
from hypothesis import strategies as st
from hypothesis.stateful import Bundle, RuleBasedStateMachine, invariant, rule


class LedgerMachine(RuleBasedStateMachine):
    """Invariants: balance ≥ 0; ledger sum == balance under any sequence."""

    accounts = Bundle("accounts")

    def __init__(self) -> None:
        super().__init__()
        self.ledger: dict[str, list[int]] = {}

    @rule(target=accounts, name=st.text(min_size=1, max_size=20))
    def open_account(self, name: str) -> str:
        self.ledger.setdefault(name, [])
        return name

    @rule(account=accounts, amount=st.integers(min_value=1, max_value=10_000))
    def deposit(self, account: str, amount: int) -> None:
        self.ledger[account].append(amount)

    @rule(account=accounts, amount=st.integers(min_value=1, max_value=10_000))
    def withdraw(self, account: str, amount: int) -> None:
        if sum(self.ledger[account]) >= amount:
            self.ledger[account].append(-amount)

    @invariant()
    def no_negative_balance(self) -> None:
        for entries in self.ledger.values():
            assert sum(entries) >= 0


TestLedger = LedgerMachine.TestCase   # pytest discovers this class
```

**RULE:** Don't reach for `RuleBasedStateMachine` first. Try `@given` with a composite
strategy. Escalate to stateful tests only when the bugs you're hunting need a **sequence** of
operations to manifest.

---

## CI Test Strategy

### Recommended split

**pre-commit (local + pre-commit.ci):** Ruff lint, Ruff format, file-hygiene hooks. Fast,
file-scoped, auto-fixable. Not mypy, not pytest.

**CI pipeline:**

```bash
# Step 1 — install
uv sync --frozen

# Step 2 — lint (fast sanity check before slower steps)
uv run ruff check src/ tests/
uv run ruff format --check src/ tests/

# Step 3 — type check (full project graph, not file-by-file)
uv run mypy src/ tests/

# Step 4 — tests with coverage
HYPOTHESIS_PROFILE=ci uv run pytest -n auto

# Step 5 — free-threading matrix (optional, for libraries)
uv run --python 3.14t pytest -n auto --parallel-threads=4
```

### Coverage thresholds

- `fail_under = 90` is the default floor for high-quality projects.
- If coverage stays below 90% after two sprints: lower `fail_under` to current + 5%, ratchet
  upward; don't write fake tests for the gauge.
- Use `# pragma: no cover` only for truly unreachable defensive code.

### Branch coverage

Set `branch = true` in `[tool.coverage.run]`. Branch coverage catches missing `else` paths and
early returns that line coverage misses entirely.

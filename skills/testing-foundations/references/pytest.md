# pytest Reference

**Versions**: pytest ≥ 8.4.0, pytest-asyncio ≥ 1.4.0, pytest-cov ≥ 6.0.0

## Full pyproject.toml configuration

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]
addopts = ["-ra", "--strict-markers"]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
markers = [
  "unit: fast, no I/O, mock LLMs and external services",
  "integration: requires external services (DB, APIs)",
  "eval: LLM evaluation tests — slow and costly, excluded from standard CI",
]
filterwarnings = ["error"]
```

Register all markers to avoid noise under `--strict-markers`. The `filterwarnings = ["error"]` 
setting promotes deprecation warnings to errors — catches compatibility issues early.

## pytest-asyncio 1.0 breaking change

The `event_loop` fixture was **removed** in pytest-asyncio 1.0. Migration:
- `asyncio_mode = "auto"` automatically handles event loops per test.
- Session-scoped async fixtures need `asyncio_default_fixture_loop_scope = "session"` set at
  module level (use sparingly — prefer function scope for isolation).
- pytest 8.4 **fails** (not warns) on async tests missing pytest-asyncio — install it.

## Async test patterns

```python
# Function-scoped (default) — no decorator needed with asyncio_mode = "auto"
async def test_agent_response():
    result = await my_agent.ainvoke({"input": "hello"})
    assert result["output"]

# Session-scoped async fixture (use sparingly)
@pytest.fixture(scope="session")
async def db_pool():
    pool = await create_pool(DATABASE_URL)
    yield pool
    await pool.close()
```

## Markers usage

```python
@pytest.mark.unit
async def test_node_logic():
    ...

@pytest.mark.integration
async def test_vector_store_retrieval():
    ...

@pytest.mark.eval
def test_faithfulness_score():
    # Run with: deepeval test run tests/eval/
    ...
```

Run subsets:
```bash
uv run pytest -m unit              # only unit tests
uv run pytest -m "not eval"        # all except eval
uv run pytest -m "unit or integration"
```

## Coverage

```bash
uv run pytest --cov=src --cov-report=term-missing --cov-report=html
```

```toml
[tool.coverage.run]
branch = true
source = ["src"]
omit = ["tests/*", "*/conftest.py"]

[tool.coverage.report]
fail_under = 80
```

## conftest.py patterns

```python
# tests/conftest.py
import pytest
from langchain_core.language_models.fake import FakeListChatModel
from langgraph.checkpoint.memory import InMemorySaver


@pytest.fixture
def fake_llm():
    """Deterministic LLM — use for all unit tests."""
    return FakeListChatModel(responses=["default mock response"])


@pytest.fixture
def checkpointer():
    """Fresh InMemorySaver per test — never share across tests."""
    return InMemorySaver()
```

## Common gotchas

- `parametrize` not `parameterize` — pytest silently ignores the misspelling.
- Shared `InMemorySaver` across tests causes state bleed in stateful graph tests.
- Session-scoped async fixtures need a session-scoped event loop; function-scoped fixtures
  cannot be used inside session-scoped fixtures.
- `filterwarnings = ["error"]` may surface deprecation warnings in third-party libraries —
  use `filterwarnings = ["error", "ignore::DeprecationWarning:somepackage"]` to suppress
  known external warnings while keeping your own errors visible.

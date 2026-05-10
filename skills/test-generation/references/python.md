# Python Test Generation Reference

Style authorities:
- [pytest official documentation](https://docs.pytest.org/en/stable/)
- [pytest good practices](https://docs.pytest.org/en/stable/explanation/goodpractices.html)
- [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)
- PEP 8 — applies to test code without exception

---

## File & Naming Conventions

| Element | Convention |
|---|---|
| Test files | `test_<module>.py` or `<module>_test.py` — both discovered automatically |
| Test functions | `def test_<what>_<condition>_<expected>():` |
| Test classes | `class Test<Subject>:` — no `__init__`, no inheritance required |
| Fixture functions | Descriptive snake_case noun: `user_fixture`, `db_session`, `mock_email_sender` |

Match whichever naming convention (`test_*.py` vs `*_test.py`) is already in use in the project.
PEP 8 applies to all test code: snake_case names, 79-character line limit.

---

## Project Layout

pytest recommends two accepted layouts. Match whichever the project already uses.

**External `tests/` directory** (most common for libraries):
```
src/
  mypackage/
    module.py
tests/
  test_module.py
  conftest.py
```

**Colocated tests** (common for applications):
```
src/
  mypackage/
    module.py
    tests/
      test_module.py
      conftest.py
```

For projects using the `src/` layout, use `importlib` import mode to avoid package/source
conflicts. Add to `pyproject.toml`:

```toml
[tool.pytest.ini_options]
addopts = "--import-mode=importlib"
```

---

## Fixtures

Fixtures are pytest's mechanism for dependency injection and reusable setup/teardown. They replace
`setUp`/`tearDown` methods entirely. Inject via function arguments — no inheritance needed.

```python
import pytest
from mypackage.models import User

@pytest.fixture
def user():
    return User(id=1, name="Alice", email="alice@example.com")

def test_display_name_returns_full_name(user):
    assert user.display_name == "Alice"
```

### Fixture scoping

Use the narrowest scope that works. Broader scopes improve speed but increase state leakage risk.

| Scope | Lifetime | When to use |
|---|---|---|
| `function` (default) | New instance per test | Always — unless setup cost justifies broader scope |
| `class` | Shared across one test class | Read-only fixtures used by all methods in a class |
| `module` | Shared across one test file | Expensive read-only setup shared across a file |
| `session` | Shared for the entire test run | One-time infrastructure: DB engine, container start |

```python
@pytest.fixture(scope="session")
def db_engine():
    engine = create_engine("postgresql://test:test@localhost/testdb")
    yield engine
    engine.dispose()
```

Always use `yield` for fixtures with teardown — code after `yield` runs regardless of test outcome.

---

## Parametrize

`@pytest.mark.parametrize` is the idiomatic way to data-drive tests. Always use it instead of
writing multiple near-identical test functions.

```python
@pytest.mark.parametrize("email,expected", [
    ("alice@example.com", True),
    ("not-an-email", False),
    ("", False),
    ("@example.com", False),
    ("user+tag@domain.org", True),
])
def test_is_valid_email(email, expected):
    assert is_valid_email(email) == expected
```

For cases that benefit from readable IDs, use `pytest.param`:

```python
@pytest.mark.parametrize("value,expected", [
    pytest.param(0, 0, id="zero"),
    pytest.param(-1, 0, id="negative_clamps_to_zero"),
    pytest.param(100, 100, id="positive_passthrough"),
])
def test_clamp_to_non_negative(value, expected):
    assert clamp_to_non_negative(value) == expected
```

---

## Exception Testing

Use `pytest.raises` as a context manager. Always assert the exception message when it is part of
the contract.

```python
def test_divide_by_zero_raises_value_error():
    with pytest.raises(ValueError, match="cannot divide by zero"):
        divide(10, 0)
```

Combine with parametrize for multiple exception types:

```python
@pytest.mark.parametrize("a,b,exc_type", [
    (10, 0, ZeroDivisionError),
    ("x", 1, TypeError),
    (None, 1, TypeError),
])
def test_divide_raises_on_invalid_input(a, b, exc_type):
    with pytest.raises(exc_type):
        divide(a, b)
```

---

## Mocking

### `pytest-mock` — `mocker` fixture (preferred in pytest projects)

```python
def test_fetch_user_calls_http_client(mocker):
    mock_get = mocker.patch("mypackage.client.requests.get")
    mock_get.return_value.json.return_value = {"id": 1, "name": "Alice"}

    user = fetch_user(1)

    mock_get.assert_called_once_with("https://api.example.com/users/1")
    assert user.name == "Alice"
```

### `monkeypatch` fixture (built-in) — env vars, attributes, items

```python
def test_reads_api_key_from_env(monkeypatch):
    monkeypatch.setenv("API_KEY", "test-key-123")

    client = ApiClient()

    assert client.api_key == "test-key-123"
```

### `unittest.mock` — for complex mock configuration

```python
from unittest.mock import MagicMock, patch

def test_send_email_calls_smtp_client(mocker):
    mock_smtp = mocker.patch("mypackage.email.smtplib.SMTP")

    send_email("alice@example.com", "Subject", "Body")

    mock_smtp.return_value.__enter__.return_value.send_message.assert_called_once()
```

### `tmp_path` fixture — filesystem tests

```python
def test_write_report_creates_file_with_expected_content(tmp_path):
    output_file = tmp_path / "report.txt"

    write_report(output_file, data={"count": 42})

    assert output_file.read_text() == "count: 42\n"
```

`tmp_path` is automatically cleaned up after each test — no manual teardown needed.

---

## `conftest.py`

Shared fixtures go in `conftest.py`. pytest discovers it automatically at each directory level —
fixtures defined there are available to all tests in that directory and below without explicit
imports.

```python
# tests/conftest.py
import pytest
from mypackage.db import create_engine, Base

@pytest.fixture(scope="session")
def db_engine():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()

@pytest.fixture
def db_session(db_engine):
    connection = db_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()
```

Use `conftest.py` for: session-scoped infrastructure, shared factory fixtures, custom hooks.
Do not put test functions in `conftest.py`.

---

## Marker Registration

Custom markers must be registered in `pyproject.toml` to avoid `PytestUnknownMarkWarning` and
to enable filtering.

```toml
[tool.pytest.ini_options]
markers = [
    "integration: marks tests as integration tests (deselect with '-m not integration')",
    "slow: marks tests expected to take more than one second",
    "benchmark: marks tests as benchmark tests",
]
```

---

## Integration Tests

Tag integration tests with `@pytest.mark.integration` and place them in a separate directory or
file (e.g. `tests/integration/`).

```python
# tests/integration/test_user_repository.py
import pytest

@pytest.mark.integration
class TestUserRepository:
    def test_save_and_retrieve_user(self, db_session):
        repo = UserRepository(db_session)
        user = User(name="Alice", email="alice@example.com")

        saved_id = repo.save(user)
        retrieved = repo.get(saved_id)

        assert retrieved.name == "Alice"
        assert retrieved.email == "alice@example.com"

    def test_get_unknown_id_raises_not_found(self, db_session):
        repo = UserRepository(db_session)

        with pytest.raises(NotFoundError):
            repo.get(99999)
```

Run unit tests only (exclude integration):
```bash
pytest -m "not integration"
```

Run integration tests only:
```bash
pytest -m integration
```

---

## Async Tests

Use `pytest-asyncio` for async code. Configure the mode in `pyproject.toml` to avoid
per-test marker clutter:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

```python
async def test_fetch_data_returns_expected_payload():
    result = await fetch_data("resource-id-123")

    assert result["status"] == "ok"
    assert result["count"] == 42
```

For async fixtures:
```python
@pytest.fixture
async def async_client():
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
```

---

## Coverage

```bash
# Run with coverage — shows missing lines
pytest --cov=mypackage --cov-report=term-missing

# Enforce a minimum threshold (blocks CI if coverage drops below)
pytest --cov=mypackage --cov-fail-under=80
```

Configure persistent thresholds in `pyproject.toml`:

```toml
[tool.coverage.run]
source = ["src/mypackage"]
omit = ["*/tests/*", "*/__init__.py"]

[tool.coverage.report]
fail_under = 80
show_missing = true
skip_covered = false
```

---

## Benchmarking

Use `pytest-benchmark`. Install: `pip install pytest-benchmark`.

```python
def test_sort_1000_items_performance(benchmark):
    data = list(range(1000, 0, -1))

    result = benchmark(sorted, data)

    assert result == list(range(1, 1001))
```

For functions with arguments:
```python
@pytest.mark.benchmark
def test_hash_password_performance(benchmark):
    result = benchmark(hash_password, "my-secure-password")
    assert result is not None
```

Run benchmarks only:
```bash
pytest --benchmark-only

# Save results for comparison across runs
pytest --benchmark-only --benchmark-json=output.json

# Compare against a previous run
pytest-benchmark compare output.json
```

`pytest-benchmark` determines the number of iterations automatically to achieve statistical
validity. Do not hardcode iteration counts.

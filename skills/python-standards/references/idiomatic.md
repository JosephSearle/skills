# Idiomatic Python Reference — Data Modelling, Docstrings, Stdlib Patterns

## Data Modelling Decision Table

| Use case | Tool | Why |
|---|---|---|
| Simple internal container (no validation, no serialisation) | `@dataclass` | Stdlib; zero deps; slots on 3.10+; `kw_only` on 3.10+ |
| Internal container with validators, converters, or slots | `attrs` | Ancestor of dataclasses; richer converter/validator API; `cattrs` for (de)serialisation |
| HTTP APIs, config from env, untrusted JSON, any trust boundary | `Pydantic v2` | Rust core; 4–50× faster than v1; JSON Schema generation; FastAPI native |
| Fixed-shape JSON payload (type-checker view only, no runtime validation) | `TypedDict` | No runtime overhead; pure annotation |

**RULE:** Pydantic at trust boundaries; dataclasses (or attrs) for internal containers.
Pydantic v2 benchmarks show ~17× speedup over v1 when validating common field types —
but raw dataclasses are still faster for non-validating work.

### `@dataclass` essentials (3.10+ features)

```python
from dataclasses import dataclass, field


@dataclass(slots=True, kw_only=True, frozen=True)   # 3.10+
class Config:
    host: str
    port: int = 8080
    tags: list[str] = field(default_factory=list)

    def url(self) -> str:
        return f"http://{self.host}:{self.port}"
```

- `slots=True` (3.10+) — generates `__slots__`; faster attribute access, less memory.
- `kw_only=True` (3.10+) — all fields keyword-only; prevents positional argument mistakes.
- `frozen=True` — immutable; generates `__hash__`.
- Use `field(default_factory=...)` for mutable defaults — never `field(default=[])`.

### attrs for validation

```python
import attrs


@attrs.define(slots=True)
class Range:
    start: float
    stop: float

    @stop.validator
    def _check_stop(self, attribute, value: float) -> None:
        if value <= self.start:
            raise ValueError(f"stop ({value}) must be > start ({self.start})")
```

### Pydantic v2 at trust boundaries

```python
from pydantic import BaseModel, field_validator, model_validator


class UserRequest(BaseModel):
    name: str
    age: int
    email: str

    @field_validator("age")
    @classmethod
    def age_must_be_positive(cls, v: int) -> int:
        if v < 0:
            raise ValueError("age must be non-negative")
        return v

    model_config = {"str_strip_whitespace": True}
```

---

## Google Docstring Format

Google style is the de-facto choice because: mkdocstrings/Griffe parses it natively, Ruff
supports it as `convention = "google"`, and it's the most human-readable of the three styles
(Sphinx-RST, NumPy, Google).

### Complete function docstring

```python
def fetch_rows(
    table_handle: Table,
    keys: Sequence[bytes],
    *,
    require_all_keys: bool = False,
) -> dict[bytes, tuple[str, ...]]:
    """Fetch rows from a table by key.

    Retrieves the rows with values set for all requested keys, and returns
    a dict mapping each key to its row data.

    Args:
        table_handle: An open Table instance to query.
        keys: A sequence of row keys to fetch.
        require_all_keys: If True, only rows with values set for all keys
            will be returned. Defaults to False.

    Returns:
        A dict mapping keys to the corresponding row data. Each row is a
        tuple of strings. Returns an empty dict if no keys match.

    Raises:
        IOError: An error occurred accessing the table.
        ValueError: If `keys` is empty.

    Example:
        >>> fetch_rows(table, [b"Serak"])
        {b'Serak': ('Rigel VII', 'Preparer')}
    """
```

### Class docstring (preferred: attributes on class, not `__init__`)

```python
class Pipeline:
    """Coordinates batch jobs over a queue.

    Drains `source` into `sink` while respecting `max_concurrency`.
    Failures are written to `dead_letter`.

    Attributes:
        source: An async-iterable of input messages.
        sink: An async-callable that consumes a single message.
        max_concurrency: Upper bound on in-flight messages.
        dead_letter: Optional callable invoked on terminal failure.

    Example:
        >>> async with Pipeline(source, sink, max_concurrency=8) as p:
        ...     await p.run()
    """

    def __init__(
        self,
        source: AsyncIterable[Message],
        sink: Callable[[Message], Awaitable[None]],
        max_concurrency: int = 8,
        dead_letter: Callable[[Message, Exception], None] | None = None,
    ) -> None:
        # No docstring on __init__ when attributes align with the class docstring
        self.source = source
        self.sink = sink
        self.max_concurrency = max_concurrency
        self.dead_letter = dead_letter
```

Google's style guide: *"When the `__init__` method arguments line up with the class's
attributes, there is no need to duplicate argument documentation in the `__init__` docstring."*

### Type hints in signature vs docstring — don't duplicate

```python
# ✅ Types in the signature; descriptions in the docstring
def fetch(user_id: int, *, active_only: bool = True) -> User | None:
    """Fetch a user record.

    Args:
        user_id: Unique identifier for the user.
        active_only: If True, return None for soft-deleted users.

    Returns:
        The matching User, or None if no row exists.
    """

# ❌ Don't put types in both places — they drift apart
def fetch(user_id: int) -> "User":
    """Args:
        user_id (int): ...   ← redundant, will drift
    """
```

### mkdocstrings compatibility

Required `mkdocs.yml` config:

```yaml
plugins:
  - mkdocstrings:
      handlers:
        python:
          paths: [src]
          options:
            docstring_style: google
            show_source: false
            merge_init_into_class: true
            inherited_members: true
```

Recognised sections: `Args`, `Returns`, `Yields`, `Raises`, `Example(s)`, `Note(s)`,
`Warning`, `Attributes`, `See Also`. Unrecognised `Section:` titles become admonitions.

---

## Key stdlib Modules to Internalise

### `functools`

| Function | Use for |
|---|---|
| `@lru_cache(maxsize=None)` / `@cache` | Memoize pure functions; `@cache` is `@lru_cache(maxsize=None)` |
| `partial(fn, *args, **kwargs)` | Fix arguments of a callable; creates a new callable |
| `singledispatch` | Type-based dispatch without isinstance chains |
| `@wraps(wrapped)` | Preserve `__name__`, `__doc__`, `__annotations__` of a wrapped function |
| `@cached_property` | Lazy property computed once per instance; descriptor-based |
| `reduce(fn, iterable, initial)` | Left-fold; use explicitly when the fold is the point |

### `contextlib`

| Function | Use for |
|---|---|
| `@contextmanager` | Turn a `yield`-once generator into a context manager |
| `@asynccontextmanager` | Same for `async def` generators |
| `ExitStack` | Dynamically manage a variable number of context managers |
| `suppress(*exceptions)` | `try/except: pass` → `with suppress(OSError):` |
| `closing(thing)` | Ensure `.close()` is called on an object that doesn't implement `__exit__` |

### `itertools`

| Function | Use for |
|---|---|
| `chain(*iterables)` | Flatten / concatenate iterables without materialising |
| `islice(iterable, n)` | Slice any iterator; avoids materialising |
| `groupby(iterable, key)` | Group consecutive items; pre-sort the input |
| `pairwise(iterable)` | Sliding pairs `(a, b), (b, c), …`; added in 3.10 |
| `accumulate(iterable, fn)` | Running totals / prefix sums |
| `product(*iterables)` | Cartesian product; parametrize substitute |
| `tee(iterable, n)` | Fork an iterator into n independent iterators; use sparingly |

### `collections`

| Class | Use for |
|---|---|
| `defaultdict(factory)` | Dict with auto-initialised missing keys |
| `Counter(iterable)` | Frequency counts; `.most_common(n)` for top-N |
| `deque(maxlen=N)` | O(1) append/pop from both ends; rolling window |
| `ChainMap(*maps)` | Layered view of dicts (e.g., defaults → env → config) |
| `namedtuple(name, fields)` | Lightweight immutable record; prefer `@dataclass(frozen=True, slots=True)` for new code |

---

## pathlib over `os.path`

```python
from pathlib import Path

# ✅ Modern
config_file = Path(__file__).parent / "config.toml"
text = config_file.read_text(encoding="utf-8")
config_file.with_suffix(".bak").write_bytes(config_file.read_bytes())
for p in Path("src").rglob("*.py"):
    print(p.name, p.stat().st_size)

# ❌ Legacy
import os.path
config_file = os.path.join(os.path.dirname(__file__), "config.toml")
with open(config_file, encoding="utf-8") as f:
    text = f.read()
```

Ruff's `PTH` rule family (`PTH100`–`PTH124`) auto-flags all `os.path.*` calls and `os.getcwd`,
`os.mkdir`, `os.remove`, `os.listdir`, `os.rename`, and `open(path)` that should use `pathlib`.

**RULE:** Use `pathlib.Path` for all filesystem operations. `os.path` is functionally legacy
for new code.

---

## Canonical Resources (10/10 only)

| Resource | URL | What it covers |
|---|---|---|
| Official Python docs | https://docs.python.org/3/ | Language reference, library reference, "What's New" per version |
| PEP Index | https://peps.python.org/ | All language changes; "why" behind every feature |
| *Fluent Python, 2nd ed.* — Ramalho | https://www.oreilly.com/library/view/fluent-python-2nd/9781492056348/ | Data model, sequences, first-class functions, OOP idioms, async |
| *Effective Python, 3rd ed.* — Slatkin | https://effectivepython.com/ | 125 items through Python 3.13; practical senior guidelines |
| Ruff docs | https://docs.astral.sh/ruff/ | Full rule reference and configuration guide |
| uv docs | https://docs.astral.sh/uv/ | Complete package and Python-version management reference |
| pyright docs | https://microsoft.github.io/pyright/ | Type checker configuration and strict mode |
| mypy docs | https://mypy.readthedocs.io/ | Reference type checker; plugin guide; per-module overrides |
| pytest docs | https://docs.pytest.org/ | Fixtures, marks, parametrize, hooks, plugins |
| Pydantic v2 docs | https://docs.pydantic.dev/ | Validation, serialisation, JSON Schema, v1→v2 migration |

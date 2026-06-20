# Type Checking Reference — mypy, pyright, ty, Pyrefly, and 3.10+ Typing Features

## The Four Major Type Checkers (May 2026)

| Tool | Backer | Language | Conformance | Status |
|---|---|---|---|---|
| **pyright** | Microsoft | TypeScript / Node | **97.8%** | 1.1.408 stable; powers VS Code Pylance |
| **Pyrefly** | Meta | Rust | **>90%** | 1.0.0 stable (May 12, 2026) |
| **mypy** | Community / Dropbox | Python (mypyc-compiled) | **58–60%** | 2.1 stable; reference implementation of PEP 484 |
| **ty** | Astral (→ OpenAI) | Rust | **53–67%** | 0.0.39 beta; 10–100× faster than mypy/pyright |

Conformance score = % of Python typing-spec conformance suite passed. Low score ≠ low utility:
mypy's score reflects decisions that predate the spec; ty's reflects intentional beta gaps.

### Speed benchmarks (Apple Silicon, cold runs, May 2026)

| Codebase | mypy | pyright | ty | Pyrefly |
|---|---|---|---|---|
| Rich (38k LOC) | 0.88 s | 2.78 s | 0.13 s | 0.20 s |
| SQLGlot (74k LOC) | 2.39 s | 4.07 s | 3.41 s | 0.36 s |

**Key finding:** On small/medium projects pyright is now slower than mypyc-compiled mypy.
ty's speedup is not uniform — on overload-heavy code it matches mypy.

---

## The Two-Tool Pattern: pyright (editor) + mypy (CI)

**Default recommendation for 2026.** Three reasons:
1. **Latency vs soundness split** — pyright gives sub-second editor feedback and checks all code
   including unannotated bodies. mypy in CI brings the broadest plugin coverage and is the de
   facto reference for library stub compatibility.
2. **Disagreements are informative** — when pyright and mypy disagree, the discrepancy frequently
   points at a real ambiguity (variance, narrowing assumptions, overload resolution).
3. **Annotations are portable** — every checker reads the same PEP 484+ syntax; only suppression
   comments differ.

**Why mypy stays in CI in 2026:**
- Plugins (`pydantic.mypy`, `mypy_django_plugin`, `sqlalchemy[mypy]`) produce the most precise
  model typing. No other checker reproduces this fidelity.
- mypy 2.0's `--num-workers` mitigates the historical speed gap on multi-core CI runners.
- `# type: ignore[<code>]` suppression comments are the most universally documented pattern.

### When to use ty or Pyrefly instead

**Use Pyrefly** when:
- Codebase >100k LOC (pyright/mypy startup times hurt CI)
- You want aggressive inference that flags errors in unannotated code (Pyrefly defaults)
- You use PyTorch/JAX/NumPy and want experimental tensor-shape types

**Use ty** when:
- Codebase is partially typed and you need the gradual guarantee (adding annotations cannot
  create new errors)
- You want full Astral-stack coherence (uv + ruff + ty)
- Editor incremental-update latency (<5 ms file re-check) is the dominant pain point

**Do not yet drop mypy from CI** for ty if you depend on Django, SQLAlchemy 1.x, or any
mypy-plugin-driven framework. Pyrefly's built-in Django/Pydantic support is closer to feature
parity than ty's.

---

## Complete `[tool.pyright]` Configuration

```toml
[tool.pyright]
include            = ["src", "tests"]
exclude            = ["**/__pycache__", "**/node_modules", "build", "dist"]
pythonVersion      = "3.11"
pythonPlatform     = "All"
typeCheckingMode   = "strict"

# Strictness fine-tuning
reportMissingTypeStubs            = false   # don't fail on stubless deps
reportUnknownMemberType           = "warning"
reportUnknownArgumentType         = "warning"
reportUnknownVariableType         = "warning"
reportPrivateUsage                = "warning"
reportUnnecessaryTypeIgnoreComment = "error"
reportImplicitOverride            = "error"  # enforce @override (PEP 698)
reportShadowedImports             = "error"
reportDeprecated                  = "warning"
```

Notes:
- `typeCheckingMode = "strict"` is the same as adding `# pyright: strict` to every file.
- `reportMissingTypeStubs = false` is the most common CI relaxation — otherwise any untyped
  dep fails the build.
- `reportImplicitOverride = "error"` makes the PEP 698 `@override` decorator mandatory on
  overriding methods. This is **off** by default even in strict mode.
- A `pyrightconfig.json` (if present) always takes precedence over `[tool.pyright]` in
  `pyproject.toml`.

---

## Complete `[tool.mypy]` Configuration

```toml
[tool.mypy]
python_version      = "3.11"
strict              = true
warn_unreachable    = true          # NOT in --strict; very useful
warn_unused_ignores = true          # included in --strict
warn_return_any     = true          # included in --strict
warn_unused_configs = true
pretty              = true
show_error_codes    = true
show_error_context  = true
cache_dir           = ".mypy_cache"
incremental         = true
files               = ["src", "tests"]

# Plugins
plugins = [
    "pydantic.mypy",
    # "mypy_django_plugin.main",  # uncomment for Django projects
]

# Extra error codes not in --strict
enable_error_code = [
    "redundant-self",
    "redundant-expr",
    "possibly-undefined",
    "truthy-bool",
    "explicit-override",            # mypy's equivalent of reportImplicitOverride
    "unused-awaitable",
    "ignore-without-code",          # forbid bare `# type: ignore`
]

[[tool.mypy.overrides]]
module = ["tests.*"]
disallow_untyped_defs       = false
disallow_incomplete_defs    = false
disallow_untyped_decorators = false

[[tool.mypy.overrides]]
module = ["untyped_dep.*", "another_untyped.*"]
ignore_missing_imports = true

[tool.pydantic-mypy]
init_forbid_extra             = true
init_typed                    = true
warn_required_dynamic_aliases = true
```

`strict = true` enables (mypy 1.x): `warn_unused_configs`, `disallow_any_generics`,
`disallow_subclassing_any`, `disallow_untyped_calls`, `disallow_untyped_defs`,
`disallow_incomplete_defs`, `check_untyped_defs`, `disallow_untyped_decorators`,
`no_implicit_optional`, `warn_redundant_casts`, `warn_unused_ignores`, `warn_return_any`,
`no_implicit_reexport`, `strict_equality`, `extra_checks`.

---

## Reconciling pyright vs mypy Disagreements

1. **Prefer the stricter verdict.** If pyright flags something mypy passes, that's usually
   because pyright checks an unannotated body mypy skipped. Fix it.
2. **Per-tool suppression comments:**
   - `# type: ignore[assignment]` — mypy only
   - `# pyright: ignore[reportAssignmentType]` — pyright only
   - Stack both on the same line when needed: `x = thing()  # type: ignore[assignment]  # pyright: ignore[reportAssignmentType]`
3. **Narrowing differences** — pyright narrows more aggressively after `isinstance` and `assert`.
   For TypeGuard/TypeIs return-type narrowing, prefer `TypeIs` (PEP 742) — both tools narrow
   both branches.
4. **Empty container inference** — `x = []` is inferred as `list[int]` by mypy (from later
   usage); pyright and ty infer `list[Unknown]`. Annotate explicitly: `x: list[int] = []`.

**RULE:** Run pyright in the editor and mypy `--strict` in CI. Every `# type: ignore` must carry
an error code. Every per-tool suppression must include the rule name.

---

## Python 3.10+ Typing Features

### `X | Y` Union syntax — PEP 604, Python 3.10

```python
def first_word(text: str | None) -> str | None:
    if text is None:
        return None
    return text.split(" ")[0]
```

**RULE:** Use `X | None`, never `Optional[X]`. Use `X | Y`, never `Union[X, Y]`. Ruff UP045
and UP007 enforce this automatically.

### Lowercase builtins for generics — PEP 585, Python 3.9+

```python
from collections.abc import Callable, Iterable, Mapping

def histogram(items: Iterable[str]) -> dict[str, int]: ...
Handler = Callable[[bytes], None]
```

**RULE:** Never import `List`, `Dict`, `Tuple`, `Set`, `Callable`, `Iterable`, `Mapping`,
or `Sequence` from `typing`. Use built-ins or `collections.abc`. Ruff UP006/UP035 enforce this.

### `ParamSpec` and `Concatenate` — PEP 612, Python 3.10

```python
from collections.abc import Callable
from typing import ParamSpec, TypeVar, Concatenate
from functools import wraps

P = ParamSpec("P")
R = TypeVar("R")

def timed(func: Callable[P, R]) -> Callable[P, R]:
    @wraps(func)
    def inner(*args: P.args, **kwargs: P.kwargs) -> R:
        return func(*args, **kwargs)
    return inner
```

**RULE:** Type every decorator you intend others to use. Bare `Callable` parameters erase
signature information from callers.

### `TypeGuard` vs `TypeIs` — PEP 647 / PEP 742

```python
from typing import TypeIs  # TypeIs from 3.13; backport in typing_extensions

def is_str(x: object) -> TypeIs[str]:
    return isinstance(x, str)

def consume(x: int | str) -> None:
    if is_str(x):
        x.upper()    # x: str
    else:
        x + 1        # x: int (TypeIs narrows BOTH branches; TypeGuard only True)
```

**RULE:** Prefer `TypeIs` over `TypeGuard` unless you specifically need TypeGuard behaviour
(the True-branch type is not a subtype of the input type).

### `Self` type — PEP 673, Python 3.11

```python
from typing import Self

class QueryBuilder:
    def where(self, clause: str) -> Self:
        self._where.append(clause)
        return self

    @classmethod
    def from_table(cls, name: str) -> Self:
        return cls()

class UserQuery(QueryBuilder): ...
reveal_type(UserQuery().where("active"))  # UserQuery, not QueryBuilder
```

**RULE:** Use `Self` as the return type of fluent builders, `__enter__`, classmethod factories,
and copy/clone methods.

### `@override` decorator — PEP 698, Python 3.12

```python
from typing import override

class Animal:
    def sound(self) -> str: return "?"

class Cat(Animal):
    @override
    def sound(self) -> str: return "meow"   # OK

class Dog(Animal):
    @override
    def soud(self) -> str: return "woof"    # ERROR — typo; no Animal.soud
```

Enable enforcement: pyright `reportImplicitOverride = "error"` and mypy
`enable_error_code = ["explicit-override"]`.

**RULE:** Add `@override` to every method that overrides a parent class method. Enable strict
enforcement so a missing decorator becomes a CI failure.

### `type` statement for aliases — PEP 695, Python 3.12

```python
# Python 3.12+ — lazy, forward-reference-safe
type JsonValue = dict[str, "JsonValue"] | list["JsonValue"] | str | int | float | bool | None
type Pair[T] = tuple[T, T]

# Python 3.10–3.11 — use TypeAlias
from typing import TypeAlias
JsonValue: TypeAlias = "dict[str, JsonValue] | ..."
```

**RULE:** On 3.12+, use the `type` statement. On 3.10–3.11, use `TypeAlias`. Never rely on
implicit aliases (no annotation) — they confuse readers and some checkers.

### Deferred annotation evaluation — PEP 649, Python 3.14

PEP 649 stores annotations as code objects evaluated lazily on access. No stringification.

```python
# Python 3.14+ (PEP 649 is the default — no __future__ import needed)
class Node:
    children: list[Node]   # forward reference works without quotes

# Python 3.10–3.13
from __future__ import annotations   # still required for forward refs
class Node:
    children: list[Node]
```

**RULE:** On Python 3.14+ codebases, **stop adding** `from __future__ import annotations` to
new files. On 3.10–3.13, keep it for forward references. Audit any runtime-annotation-consuming
library (Pydantic, FastAPI, attrs, SQLAlchemy) for Python 3.14 compatibility before upgrading.

---

## Annotation Policy

### Always annotate public interfaces

Public = anything in `__all__`, any public method/attribute without a leading underscore, every
parameter and return type of every public callable, every module-level constant.

**RULE:** No public function ships without parameter and return-type annotations. mypy's
`disallow_untyped_defs = true` enforces this.

### Private / internal: annotate where non-obvious

Annotate when: the function spans >10 lines, takes a non-trivial type (Protocol, Union, generic),
inference would yield `Any` or `Unknown`, or the function is recursive.

Skip when: inference produces a meaningful type and the code is a trivial one-liner.

### The no-bare-`Any` rule

Every `Any` annotation requires an inline comment explaining why a narrower type isn't possible:

```python
def parse_event(raw: bytes) -> dict[str, Any]:
    # Any: payload schema varies by event type; validated downstream by Pydantic
    return json.loads(raw)
```

**RULE:** Every `Any` requires an inline comment. Configure Ruff:

```toml
[tool.ruff.lint.flake8-annotations]
allow-star-arg-any    = true    # *args / **kwargs may be Any
suppress-dummy-args   = true    # _ may be untyped
mypy-init-return      = true    # __init__ may omit -> None
```

### `TYPE_CHECKING` guard for circular imports

```python
from __future__ import annotations   # required pre-3.14

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import User
    from collections.abc import AsyncIterator

def find_user(uid: int) -> "User | None":
    ...
```

**RULE:** Use `if TYPE_CHECKING:` for type-only imports that would cause a cycle or pull in
heavyweight modules used only in signatures.

---

## Anti-Patterns Table

| ❌ Don't | ✅ Do | Ruff rule |
|---|---|---|
| `Optional[X]` | `X \| None` | `UP045` |
| `Union[X, Y]` | `X \| Y` | `UP007` |
| `List[int]`, `Dict[str, int]` | `list[int]`, `dict[str, int]` | `UP006` |
| `from typing import Dict, List, Tuple, ...` | Built-ins + `from collections.abc import ...` | `UP035` |
| Bare `Any` with no comment | `Any` with inline comment | `ANN401` |
| `# type: ignore` (bare) | `# type: ignore[error-code]` | `PGH003`, mypy `ignore-without-code` |
| `Optional[X] = None` for kw-only arg | `x: X \| None = None` | `UP045` |
| `from __future__ import annotations` on new 3.14-only code | Omit it; rely on PEP 649 | manual policy |
| Returning `Any` from a typed function | Narrow before return, or annotate honestly | mypy `no-any-return` |
| `Type[X]` | `type[X]` | `UP006` |
| Bare `Callable` without parameters | `Callable[[int, str], bool]` or `Callable[P, R]` | `disallow_any_generics` |

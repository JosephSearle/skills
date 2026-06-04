# Free-Threaded Python Reference — PEP 703/779, python3.14t, GIL Gotchas

## Status Overview (May 2026)

| Phase | Python version | Status |
|---|---|---|
| **Phase I** | 3.13 (Oct 2024) | Experimental; `python3.13t`; ~40% single-thread overhead |
| **Phase II** | 3.14 (Oct 7, 2025) | **Officially supported but opt-in**; `python3.14t`; ~1–8% overhead |
| **Phase III** | No committed release | GIL-free becomes the default; earliest realistic: Python 3.16–3.17 (2027–2028) |

PEP 779 was accepted by the Steering Council on June 15, 2025. Key commitment verbatim:
*"we as the Python developer community should broadly advertise that free-threading is a
supported Python build option now and into the future, and that it will not be removed without
following a proper deprecation schedule."*

**RULE:** Plan as if Phase III is at least two release cycles away (≥ Python 3.16, ~late 2027),
and as if a GIL-enabled mode will remain available indefinitely.

---

## Performance Numbers

### Single-threaded overhead vs GIL build

From the official Python 3.14 HOWTO:
*"On the pyperformance benchmark suite, the average overhead ranges from about 1% on macOS
aarch64 to 8% on x86-64 Linux systems."*

3.13 overhead was ~40%. The 3.14 improvement is driven by:
- PEP 659 specializing adaptive interpreter now enabled in the free-threaded build
- Deferred reference counting for common interpreter-internal objects

### Memory overhead

PEP 779 governance constraint (hard limit):
| Metric | Soft target | Hard limit |
|---|---|---|
| Single-threaded CPU regression | ≤10% | negotiate with SC up to 15% |
| Memory regression vs GIL build | ≤15% | **20%** |

Per Matt Page at the 2025 Language Summit: *"the memory overhead was more substantial at 20%
more for pyperformance workloads compared to without free-threading."*

**RULE:** Budget **5–10% single-threaded overhead** and **up to ~20% extra memory** when sizing
capacity on `python3.14t`. If your workload is single-threaded I/O-bound, you pay this tax for
no benefit — stay on the standard GIL build.

---

## Installation and Verification

### Install with uv (recommended)

```bash
uv python install 3.14t           # download free-threaded CPython
uv python pin 3.14t               # write 3.14t to .python-version
uv sync                           # recreate .venv against cp314t

# Ad-hoc verification
uv run --python 3.14t python -VV
# → Python 3.14.0 free-threading build (experimental)
```

### Verify GIL state at runtime

```python
import sys
import sysconfig

# Was the interpreter BUILT free-threaded?
is_ft_build = bool(sysconfig.get_config_var("Py_GIL_DISABLED"))

# Is the GIL ACTUALLY DISABLED right now?
# (an unported C extension may have re-enabled it)
try:
    gil_active = sys._is_gil_enabled()
except AttributeError:
    gil_active = True   # Python ≤ 3.12

print(f"Free-threaded build: {is_ft_build}")
print(f"GIL currently active: {gil_active}")
```

These two checks answer different questions. An unported C extension can make them disagree.

**RULE:** Check `sysconfig.get_config_var("Py_GIL_DISABLED")` for build-time decisions and
`sys._is_gil_enabled()` for runtime decisions. Both are needed.

---

## The C Extension Gotcha — Most Important Rule

When a C extension without `Py_mod_gil = Py_MOD_GIL_NOT_USED` is imported on `python3.14t`:

1. CPython **pauses all threads**
2. **Re-enables the GIL process-wide, permanently**
3. Prints a `RuntimeWarning`:

```
RuntimeWarning: The global interpreter lock (GIL) has been enabled to load module
'triton._C.libtriton', which has not declared that it can run safely without the GIL.
```

This re-enable is **permanent for the process lifetime**. A single non-compliant import in any
transitive dependency silently neutralizes the entire free-threading benefit.

### Treating the warning as a hard failure

```python
import warnings

warnings.filterwarnings(
    "error",
    message=r".*global interpreter lock \(GIL\) has been enabled.*",
    category=RuntimeWarning,
)

import my_app   # any GIL re-enable now raises immediately

# Bootstrap assertion (run after all imports)
def assert_free_threading_intact() -> None:
    if not sysconfig.get_config_var("Py_GIL_DISABLED"):
        raise RuntimeError("Not running on a free-threaded build.")
    if sys._is_gil_enabled():
        raise RuntimeError("GIL was re-enabled by an unported C extension.")

assert_free_threading_intact()
```

**RULE:** Treat the `RuntimeWarning` about GIL re-enabling as a **hard CI failure**. Add
`-W error::RuntimeWarning` to your pytest invocation or the `warnings.filterwarnings("error", ...)`
call above to your app bootstrap. Better to fail loudly in CI than to silently lose parallelism
in production.

---

## Ecosystem Status (May 2026)

From the Quansight Labs compatibility tracker at <https://py-free-threading.github.io/tracking/>:

| Package | First supported release | Notes |
|---|---|---|
| **NumPy** | 2.1.0 | Ships `cp314t` wheels for all platforms |
| **SciPy** | 1.15.0 | Ships `cp314t` wheels |
| **pandas** | 2.2.3 | Ships `cp314t` wheels |
| **scikit-learn** | 1.6.0 | Ships `cp314t` wheels |
| **Pillow** | 11.0.0 | Ships `cp314t` wheels |
| **Pydantic** | 2.11.0 | Ships `cp314t` wheels (pydantic-core 2.29+ / PyO3 0.23+) |
| **Cython** | 3.1.0 | Use `# cython: freethreading_compatible=True` |
| **Matplotlib** | 3.9.0 | Ships `cp314t` wheels |
| **PyArrow** | 18.0.0 | Ships `cp314t` wheels |
| **cryptography** | 46.0.0 | Ships `cp314t` wheels |
| **aiohttp** | 3.13.0 | Ships `cp314t` wheels |
| **lxml** | **NOT YET** | Upstream issue open; imports re-enable the GIL |

**RULE:** Before adopting `python3.14t`, install your full lockfile against a `cp314t` venv
and check for source builds and RuntimeWarnings:

```bash
uv venv --python 3.14t .venv-ft
source .venv-ft/bin/activate
uv pip install -r requirements.txt 2>&1 | grep -E "Building|^WARNING"
python -W error::RuntimeWarning -c "import my_app; print('GIL:', sys._is_gil_enabled())"
```

---

## Thread Safety in Pure Python (What Changes Without the GIL)

The GIL implicitly serialized code that *looked* atomic but was never specified to be. Removing
it doesn't change the language semantics — it removes an accidental safety property real code
came to depend on.

### Operations that are no longer implicitly safe

| Pattern | GIL build | Free-threaded build |
|---|---|---|
| `cache[k] = v` (single dict store) | atomic | atomic (internal lock) |
| `if k not in cache: cache[k] = compute(k)` | racy in principle; often safe | **racy** — two threads may compute |
| `lst.append(x)` | atomic | atomic |
| `counter += 1` | not atomic (rarely observed to fail) | **frequently fails** |
| `dict.update(other)` where other is a builtin | atomic | atomic |
| Iterating a shared dict while another thread mutates it | `RuntimeError` reliably | `RuntimeError` mostly; can observe partial states |
| `if k in d: del d[k]` | racy in principle | **not atomic** — use `d.pop(k, None)` |

### Thread-safe patterns for free-threading

```python
import threading

# Pattern 1: Lock-protected shared dict (compute-once cache)
class ThreadSafeCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data: dict[str, object] = {}

    def get_or_compute(self, key: str, factory: Callable[[], object]) -> object:
        with self._lock:                   # two-step → must hold the lock for both
            if key not in self._data:
                self._data[key] = factory()
            return self._data[key]

# Pattern 2: Lazy singleton WITHOUT double-checked-locking trap
_instance: object | None = None
_instance_lock = threading.Lock()

def get_instance() -> object:
    global _instance
    with _instance_lock:                   # always acquire; no "check first"
        if _instance is None:
            _instance = ExpensiveInit()
        return _instance

# Pattern 3: Atomic counter (+= is not atomic without the GIL)
class AtomicCounter:
    def __init__(self) -> None:
        self._value = 0
        self._lock = threading.Lock()

    def inc(self) -> int:
        with self._lock:
            self._value += 1
            return self._value

# Pattern 4: Per-thread state — no lock needed
_thread_local = threading.local()

def get_db_connection() -> Connection:
    if not hasattr(_thread_local, "conn"):
        _thread_local.conn = connect()
    return _thread_local.conn
```

**RULE:** When in doubt, use `threading.local()` instead of locking. Per-thread state has
zero contention overhead and eliminates the entire class of races.

---

## Audit Checklist for Existing Threaded Code

Before running on `python3.14t`, search for and fix in priority order:

```bash
# 1. Module-level mutable state
rg -n '^[a-zA-Z_]+\s*=\s*(\{|\[|set\(\)|dict\(\)|list\(\))' --type py

# 2. Lazy singletons / double-checked locking
rg -n 'if .* is None:\s*$' -A 2 --type py | rg -B 1 '='

# 3. Check-then-act patterns on shared containers
rg -n 'if .+ not in .+:\s*$' -A 1 --type py
rg -n 'if .+ in .+:' -A 1 --type py | grep 'del '

# 4. Counter increment patterns
rg -n '\+= 1$|\-= 1$' --type py

# 5. Threading code without explicit locks
rg -n 'Thread\(|ThreadPoolExecutor\(' --type py
```

Priority items:
1. `global` keyword + assignment → module-level mutable state needs a lock
2. Lazy initialization (`if _x is None: _x = …`) → wrap in a lock
3. Compound dict/list operations → use atomic alternatives or wrap in a lock
4. Class-level mutable defaults (`class C: cache = {}`) → shared across instances
5. `+= 1` counters → not atomic, ever
6. C extensions without `Py_MOD_GIL_NOT_USED` → GIL silently re-enables

---

## The 4-Condition Checklist: Should You Target `python3.14t` Today?

Target `python3.14t` **only if all four are true**:

1. ✅ The workload is **measurably CPU-bound in pure Python** (or NumPy/GIL-releasing C code)
   and parallelizes naturally (no global serialization point).
2. ✅ The full transitive dependency tree ships `cp314t` wheels — verified by `uv sync` with
   zero "Building" lines and zero `RuntimeWarning` about GIL re-enable.
3. ✅ A CI matrix entry on `python3.14t` runs your full test suite, ideally with
   `pytest-run-parallel`.
4. ✅ The team has audited shared mutable state and added explicit locks.

**Stay on standard `python3.14`** if:
- Workload is I/O-bound (asyncio or threads already work fine on the GIL build)
- Any dependency falls back to a source build or triggers a GIL re-enable RuntimeWarning
- The team cannot debug ThreadSanitizer races

**RULE:** Target `python3.14t` for CPU-bound data/ML batch jobs, simulation engines, and
parallel preprocessing pipelines. Stay on standard `python3.14` for web backends, API services,
and most general-purpose applications — they are I/O-bound and won't benefit from free-threading.

---

## asyncio on Free-Threaded Python

asyncio itself remains single-threaded by design — one event loop per OS thread. On `python3.14t`
you can now run N independent event loops in N threads efficiently.

```python
from concurrent.futures import ThreadPoolExecutor
import asyncio

async def worker() -> None:
    async with asyncio.TaskGroup() as tg:
        tg.create_task(fetch_a())
        tg.create_task(fetch_b())

def thread_main() -> None:
    asyncio.run(worker())

# Run N event loops in N threads — only useful on python3.14t
with ThreadPoolExecutor(max_workers=8) as pool:
    futures = [pool.submit(thread_main) for _ in range(8)]
```

Per Quansight's Kumar Aditya ("Scaling asyncio on Free-Threaded Python", Sept 2025):
*"performance scales linearly with the number of threads"* with no lock contention in the
multi-loop case.

**RULE:** Use `asyncio.TaskGroup` **within** a thread for I/O fan-out. Use threads **between**
event loops for CPU parallelism. Do not `await` across threads.

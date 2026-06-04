# Concurrency Reference — asyncio, Threading, Multiprocessing, AnyIO

## Concurrency Decision Tree

```
┌─ Is the workload I/O-bound or CPU-bound?
│
├─ I/O-BOUND ──────────────────────────────────────────────────────────────────┐
│  │                                                                            │
│  ├─ Are the libraries async-native (httpx, aiohttp, asyncpg, aioredis)?      │
│  │   ├─ YES → asyncio with TaskGroup (3.11+)                                  │
│  │   │        Library code: use AnyIO (works on asyncio + Trio)              │
│  │   └─ NO  → blocking drivers (psycopg2, boto3, requests, redis-py sync)    │
│  │            → ThreadPoolExecutor                                            │
│  │            Or: asyncio.to_thread() to bridge a few sync calls from async  │
│  │                                                                            │
│  └─ Mixing async + blocking? Bridge with asyncio.to_thread().                │
│     NEVER call blocking code directly inside a coroutine.                    │
│                                                                              │
├─ CPU-BOUND ──────────────────────────────────────────────────────────────────┐
│  │                                                                            │
│  ├─ Standard GIL build (3.11/3.12/3.13/3.14 default):                        │
│  │   → ProcessPoolExecutor (concurrent.futures)                              │
│  │   → multiprocessing.Pool only when you need apply_async/imap_unordered   │
│  │                                                                            │
│  ├─ Numeric / C-extension workload that releases the GIL                     │
│  │   (numpy, scipy, torch, sklearn, blosc, lxml*):                           │
│  │   → ThreadPoolExecutor often wins — no pickling, shared memory           │
│  │                                                                            │
│  └─ Free-threaded build (python3.14t, PEP 703 + 779):                        │
│      → Threads can exploit multiple cores for pure-Python CPU work           │
│      → Validate every C extension is FT-safe before relying on it           │
│                                                                              │
└─ Long-running or polyglot workload?                                          │
   → Don't use multiprocessing — run a separate service and treat it as I/O   │
```

### Four Hard Rules

- **RULE 1** — Never call a blocking function inside a coroutine. Bridge with
  `asyncio.to_thread(fn)` (3.9+) or `loop.run_in_executor(executor, fn, *args)`.
- **RULE 2** — I/O → threads or asyncio; CPU → processes (until FT build is verified with
  your full dependency tree). Picking the wrong axis costs ~10× in performance.
- **RULE 3** — If uncertain: asyncio + `TaskGroup` for new I/O code;
  `ProcessPoolExecutor` for new CPU code. Revisit only when measured.
- **RULE 4** — Libraries should depend on AnyIO, not asyncio, so downstream apps using
  Trio can still consume them.

---

## asyncio Fundamentals

### Coroutines vs Tasks vs Futures

- **Coroutine** — object returned by calling an `async def` function. Does nothing until
  awaited or scheduled. A bare call (`coro()`) emits `RuntimeWarning: coroutine was never awaited`.
- **Task** — a coroutine wrapped by the loop via `asyncio.create_task(coro)` or
  `tg.create_task(coro)`. Scheduled; can be awaited, cancelled, named, inspected.
- **Future** — low-level placeholder for a result the loop will eventually deliver. `Task`
  is a subclass. End-user code rarely constructs `Future` directly.

### `asyncio.run()`

```python
import asyncio

async def main() -> None:
    ...

asyncio.run(main())   # creates loop, runs main, shuts down, closes loop
```

**RULE:** Use `asyncio.run()` as the sole entry point of an async program. Never call
`asyncio.get_event_loop()` in modern code — it has emitted `DeprecationWarning` since 3.10.

### Cancellation and `CancelledError`

`CancelledError` inherits from `BaseException` since 3.8, so `except Exception:` does NOT
catch it — but bare `except:` does.

```python
async def worker() -> None:
    try:
        await long_call()
    except asyncio.CancelledError:
        await release_resource()   # cleanup
        raise                       # MANDATORY re-raise
```

**RULE:** Never swallow `CancelledError`. If you catch it, re-raise after cleanup.
Use `try / finally` for guaranteed cleanup — the `finally` block runs on cancellation too.

### `asyncio.timeout()` vs `asyncio.wait_for()` (3.11)

| Feature | `asyncio.timeout(d)` (3.11+) | `asyncio.wait_for(coro, d)` |
|---|---|---|
| Form | async context manager | coroutine wrapper |
| Wraps | a *block* of awaits | a single awaitable |
| Creates a new task? | No | Yes |
| Reschedulable | Yes (`cm.reschedule(when)`) | No |
| 3.10 compatible | No (use `async_timeout` backport) | Yes |

```python
# Preferred 3.11+ form — wraps any block
async with asyncio.timeout(5.0):
    for url in urls:
        await client.get(url)

# Legacy per-call form
result = await asyncio.wait_for(client.get(url), timeout=5.0)
```

**RULE:** Prefer `asyncio.timeout()` for blocks with more than one await. Use `wait_for`
only when wrapping a single foreign coroutine.

### Bridging sync code: `asyncio.to_thread()`

```python
import asyncio

def blocking_io() -> bytes:
    with open("/dev/urandom", "rb") as f:
        return f.read(100)

async def main() -> None:
    # 3.9+: runs in default ThreadPoolExecutor, propagates contextvars
    chunk = await asyncio.to_thread(blocking_io)

    # CPU-bound → pass a ProcessPoolExecutor explicitly
    from concurrent.futures import ProcessPoolExecutor
    loop = asyncio.get_running_loop()
    with ProcessPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, cpu_bound, 10_000_000)
```

**RULE:** `asyncio.to_thread()` is for I/O-bound blocking code. For CPU-bound work, pass a
`ProcessPoolExecutor` to `run_in_executor` — the default executor is a `ThreadPoolExecutor`
and threads cannot parallelize CPU work under the GIL.

---

## Structured Concurrency — TaskGroup (Python 3.11)

### Canonical Pattern

```python
import asyncio

async def fetch(name: str, delay: float) -> str:
    await asyncio.sleep(delay)
    return f"{name}-result"

async def main() -> list[str]:
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(fetch("a", 0.1))
        t2 = tg.create_task(fetch("b", 0.2))
        t3 = tg.create_task(fetch("c", 0.05))
    # All tasks done; if any failed, ExceptionGroup was raised
    return [t1.result(), t2.result(), t3.result()]
```

When the first task fails: remaining tasks are cancelled; `__aexit__` raises an
`ExceptionGroup` (or `BaseExceptionGroup` if any leaf is a `BaseException`).

### `except*` — Handling ExceptionGroups

```python
async def main() -> None:
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(boom_value())
            tg.create_task(boom_key())
    except* ValueError as eg:
        for e in eg.exceptions:
            print("value:", e)
    except* KeyError as eg:
        for e in eg.exceptions:
            print("key:", e)
```

Notes:
- `except*` always binds an `ExceptionGroup`, even if only one leaf matched.
- `continue`, `break`, `return` inside `except*` are syntax errors (PEP 654).

### The CancelledError Gotcha

```python
# BAD — bare except swallows the group's cancellation signal
try:
    await something()
except:              # catches BaseException including CancelledError
    ...

# GOOD — Exception does NOT catch CancelledError since 3.8
try:
    await something()
except Exception:    # safe
    ...
```

**RULE:** Never use bare `except:` in a coroutine. Catch `Exception`, not `BaseException`.

### TaskGroup vs `asyncio.gather()`

| Aspect | `TaskGroup` (3.11+) | `gather()` |
|---|---|---|
| On first failure | Cancels remaining siblings | Other tasks keep running by default |
| Exception delivery | `ExceptionGroup` of all failures | First exception raised; later ones may be lost |
| Structured-concurrency safe | **Yes** | **No** — orphaned tasks possible |
| Result collection | `task.result()` after exit | Returned tuple in argument order |
| Python version | 3.11+ | 3.7+ |

**When `gather` is still right:** `return_exceptions=True` to receive parallel results-or-exceptions
without aborting; you must support Python 3.10; a fixed known set of awaitables where failure
of one shouldn't cancel others.

---

## Threading Module

### `threading.Thread` vs `ThreadPoolExecutor`

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def fetch(url: str) -> bytes: ...

urls = [...]
with ThreadPoolExecutor(max_workers=32, thread_name_prefix="http") as pool:
    futures = {pool.submit(fetch, u): u for u in urls}
    for fut in as_completed(futures):
        url = futures[fut]
        try:
            data = fut.result(timeout=10)
        except Exception as e:
            log.warning("fetch %s failed: %s", url, e)
```

**RULE:** Use `ThreadPoolExecutor` for bounded fan-out of blocking calls. Use raw
`threading.Thread` only for long-lived background workers (heartbeats, log consumers) or when
you need direct lifecycle control the executor doesn't provide.

### GIL Thread-Safety Guarantees

The GIL guarantees that any single Python bytecode instruction executes atomically. It does NOT:
- Make multi-bytecode operations atomic (`x += 1` is LOAD + ADD + STORE — not atomic)
- Prevent data races on compound operations
- Guarantee deterministic ordering

What it **does** guarantee: single attribute load/store on built-in types; `dict.get`,
`list.append`, `dict.setdefault` are individually atomic (CPython implementation detail).

**RULE:** Protect any shared mutable state with `threading.Lock`, regardless of how trivial the
operation looks.

### Lock vs RLock

| | `threading.Lock` | `threading.RLock` |
|---|---|---|
| Re-acquire from same thread | Deadlock | Allowed (counter-based) |
| Performance | Marginally faster | Slight overhead per acquire |
| Use case | Flat critical section | Recursive functions; methods that re-enter the lock |

```python
class Account:
    def __init__(self, balance: int) -> None:
        self.balance = balance
        self._lock = threading.RLock()   # RLock because withdraw() calls _log()

    def withdraw(self, amount: int) -> None:
        with self._lock:
            if self.balance >= amount:
                self.balance -= amount
                self._log(amount)        # nested acquire OK with RLock

    def _log(self, amount: int) -> None:
        with self._lock:
            print(f"-{amount} → {self.balance}")
```

**RULE:** Default to `Lock`; switch to `RLock` only when you can demonstrate a recursive
acquisition pattern. Always use `with` — never call `acquire()` / `release()` manually.

### Other Threading Primitives

```python
# Event — one-shot binary flag
ready = threading.Event()
# Thread sets: ready.set(); caller waits: ready.wait(timeout=5)

# Semaphore — bounded resource pool
db_slots = threading.Semaphore(4)
def query(q: str) -> ...:
    with db_slots:
        return run(q)

# Condition — producer/consumer with arbitrary predicate
queue: list[str] = []
cv = threading.Condition()
def consumer() -> str:
    with cv:
        cv.wait_for(lambda: len(queue) > 0)
        return queue.pop(0)

# Barrier — N threads sync before proceeding
b = threading.Barrier(parties=4)
def worker() -> None:
    do_phase_1()
    b.wait()          # all 4 sync here
    do_phase_2()
```

### Deadlock Causes and Remedies

1. **Lock ordering inversion** — Thread A acquires `L1` then `L2`; Thread B acquires `L2`
   then `L1`. *Remedy:* enforce a global lock order; document it.
2. **Recursive acquire of non-reentrant lock** — *Remedy:* use `RLock` or restructure.
3. **Holding a lock across a blocking call** — *Remedy:* copy needed data, drop the lock,
   then do the slow thing.
4. **Forgetting `task_done()`** with `queue.Queue.join()` — `join()` blocks forever.
5. **Worker waiting on a future from the same bounded executor** — *Remedy:* never call
   `future.result()` from inside a task submitted to the same executor.

**RULE:** Prefer message-passing (`queue.Queue`) to shared mutable state. Lock the smallest
possible critical section; never hold a lock while calling user-supplied callbacks.

### `threading.local()` for per-thread state

```python
import threading

_state = threading.local()

def get_db() -> Connection:
    if not hasattr(_state, "conn"):
        _state.conn = db.connect()
    return _state.conn
```

Each thread sees its own attributes. Use for per-thread caches, HTTP sessions, request contexts.

---

## Multiprocessing

### `ProcessPoolExecutor` vs `multiprocessing.Pool`

| | `ProcessPoolExecutor` | `multiprocessing.Pool` |
|---|---|---|
| API | `submit`/`map` → `Future` | `apply`/`apply_async`/`imap_unordered` → `AsyncResult` |
| Composes with asyncio | Yes (`loop.run_in_executor(pool, …)`) | No |
| Context-manager shutdown | Yes | Yes (since 3.3) |
| `max_tasks_per_child` | Yes (3.11+) | Yes (`maxtasksperchild`) |

**RULE:** Default to `ProcessPoolExecutor`. Drop to `multiprocessing.Pool` only when you need
`imap_unordered` for streaming results or callbacks via `apply_async`.

### Shared Memory (3.8+)

```python
from multiprocessing.shared_memory import SharedMemory
import numpy as np

# Creator
shm = SharedMemory(create=True, size=src.nbytes)
arr = np.ndarray(src.shape, dtype=src.dtype, buffer=shm.buf)

# Worker (attach by name)
def worker(name: str, shape: tuple, dtype: np.dtype) -> None:
    shm = SharedMemory(name=name)
    arr = np.ndarray(shape, dtype=dtype, buffer=shm.buf)
    arr[:] += 1
    shm.close()

# Teardown (creator only)
shm.close()
shm.unlink()   # only creator calls unlink()
```

For a 240 MB `numpy.recarray` across 4 workers: shared memory = **2.09 s / 0.33 MB peak**
vs pickle = **216 s / 1.8 GB peak** (Mingze Gao, "Python Shared Memory in Multiprocessing").

**RULE:** Only the creator calls `unlink()`. Workers call `close()`. Use `SharedMemoryManager`
for automatic lifecycle management in nested `with` blocks.

### The Pickling Constraint

Process pools serialize arguments and return values via `pickle`. This excludes:
- Lambdas and local functions
- Methods of classes defined in `__main__`
- Objects holding live OS handles (sockets, DB connections, locks)
- Generators, iterators, `asyncio.Task`

**RULE:** Use top-level functions with picklable arguments. Use `cloudpickle` only when you
absolutely must ship lambdas, and only with full awareness of the overhead.

---

## AnyIO — For Library Authors

```python
import anyio

async def fetch(url: str) -> None: ...

async def main() -> None:
    async with anyio.create_task_group() as tg:
        for u in urls:
            tg.start_soon(fetch, u)

anyio.run(main)                   # asyncio backend (default)
anyio.run(main, backend="trio")   # same code, Trio backend
```

### AnyIO vs `asyncio.TaskGroup`

| | `asyncio.TaskGroup` | `anyio.TaskGroup` |
|---|---|---|
| API | `tg.create_task(coro)` → Task | `tg.start_soon(fn, *args)` (no Task object) |
| Cancel scope | No built-in | Yes — `tg.cancel_scope.cancel()` |
| Cancellation semantics | Edge (fires once) | Level (re-fires at every await until scope exits) |
| Readiness signalling | No | `task_status.started(value)` + `await tg.start(fn)` |
| Backend compatibility | asyncio only | asyncio + Trio |

**RULE:** If your code needs to be Trio-compatible, requires cancellable subtrees, or needs
reliable startup signalling → use AnyIO. If you're writing application code on asyncio with
no library aspirations → `asyncio.TaskGroup` is fine.

---

## Common Async Anti-Patterns

| ❌ Anti-pattern | ✅ Correct | Why it matters |
|---|---|---|
| `requests.get(url)` inside `async def` | `await session.get(url)` or `await asyncio.to_thread(requests.get, url)` | Blocks the loop; every other coroutine stalls for the full RTT |
| `except CancelledError: pass` or bare `except:` | `try: ... finally: cleanup()` or re-raise | Breaks TaskGroup/timeout/wait_for invariants; tasks become un-cancellable |
| `asyncio.create_task(coro)` without holding the result | `tg.create_task(coro)` inside a TaskGroup | Free-floating tasks can be GC'd mid-flight; loop logs "Task destroyed but pending" |
| `asyncio.get_event_loop()` in modern code | `asyncio.get_running_loop()` or `asyncio.run()` | `get_event_loop()` emits `DeprecationWarning` since 3.10 |
| `time.sleep(1.0)` in an `async def` | `await asyncio.sleep(1.0)` | `time.sleep` blocks the OS thread = entire event loop |
| Sharing `asyncio.Lock` between threads | Use `threading.Lock` cross-thread | `asyncio.Lock` is not thread-safe; assumes single-loop access |
| HTTP / DB call without timeout | `async with asyncio.timeout(N):` around every external call | One stuck remote leaks tasks and exhausts connection pools |
| `await asyncio.gather(*tasks)` ignoring exceptions | `async with asyncio.TaskGroup()` or `gather(..., return_exceptions=True)` with per-task inspection | Default gather loses secondary failures |

---

## Version Compatibility

| Feature | Introduced | Notes |
|---|---|---|
| `asyncio.to_thread()` | 3.9 | Sugar over `run_in_executor(None, …)` with contextvars propagation |
| `asyncio.TaskGroup` | 3.11 | Structured-concurrency primitive |
| `asyncio.timeout()` / `asyncio.timeout_at()` | 3.11 | Context-manager form; use `async-timeout` on 3.10 |
| `ExceptionGroup`, `except*` (PEP 654) | 3.11 | Use `exceptiongroup` backport on 3.10 |
| `TimeoutError` unifies `asyncio.TimeoutError` | 3.11 | `asyncio.TimeoutError` is now an alias |
| `multiprocessing.shared_memory` | 3.8 | `SharedMemory`, `ShareableList`, `SharedMemoryManager` |
| `ProcessPoolExecutor(max_tasks_per_child=N)` | 3.11 | Recycles workers, mitigates memory growth |
| Free-threaded build officially supported | 3.14 (`python3.14t`) | ~1–8% single-thread overhead; still opt-in |

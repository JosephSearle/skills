# Python Code Review Reference

Style authority: [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)

Apply these checks to all `.py` files in the diff.

---

## Error Handling

### Bare `except:` clause
- **Look for:** `except:` or `except Exception:` or `except BaseException:` without re-raising
- **Why:** Google style: "Never use bare `except:` or catch `Exception`/`StandardError` unless re-raising or creating isolation boundaries." Catching everything silently swallows unexpected errors, making bugs invisible
- **Suggest:** Catch the specific exception type(s): `except ValueError as e:`. If a broad catch is needed at a boundary, always log and re-raise: `except Exception: logging.exception("..."); raise`
- **Severity:** blocker

### `assert` used for runtime validation
- **Look for:** `assert condition, "message"` used to validate function inputs, API responses, or runtime state outside of test files
- **Why:** Google style: "Avoid `assert` statements for critical logic; they're not guaranteed to execute." Python runs with `-O` optimisation strip assertions entirely. Use explicit `if`/`raise` instead
- **Suggest:** `if not condition: raise ValueError("message")`
- **Severity:** major

### `try` block too broad
- **Look for:** Large `try` blocks containing many statements, where only one or two lines can actually raise the caught exception
- **Why:** Google style: "Minimise code within `try` blocks to prevent masking unexpected errors." Broad try blocks catch exceptions from unrelated lines, hiding bugs
- **Suggest:** Move only the specific raising call(s) inside the `try` block; handle the result outside
- **Severity:** major

### Resource not managed with context manager
- **Look for:** `f = open(...)` without a `with` statement, or `conn = db.connect()` without `with` or explicit `finally: conn.close()`
- **Why:** Google style: "Use `with` statement for context managers." Files, connections, and locks must be closed/released even when exceptions occur. `with` guarantees this
- **Suggest:** `with open(path) as f:` / `with db.connect() as conn:`
- **Severity:** major

---

## Type Annotations

### Public function missing type annotations
- **Look for:** A public function (no leading underscore) with no parameter or return type annotations, particularly on public APIs or complex logic
- **Why:** Google style: "Annotate at minimum: public APIs, error-prone code, complex logic." Type annotations enable static analysis with `pytype`/`mypy` and serve as machine-verifiable documentation
- **Suggest:** `def process(user_id: int, name: str) -> UserRecord:`
- **Severity:** major

### `Optional[X]` used instead of `X | None`
- **Look for:** `Optional[str]`, `Optional[int]`, or `Optional[SomeType]` in Python 3.10+ code
- **Why:** Google style (modern Python): prefer `X | None` over `Optional[X]`. `Optional` is a legacy form from the `typing` module; the union syntax is clearer and more consistent
- **Suggest:** `def get_user(id: int) -> User | None:`
- **Severity:** nit

### Implicit `None` default with non-`None` annotation
- **Look for:** `def foo(x: str = None)` — a non-optional type with a `None` default
- **Why:** This is a type error. Google style: "Never use implicit `a: str = None`; must be `a: str | None = None`." The annotation and default must be consistent
- **Suggest:** `def foo(x: str | None = None):`
- **Severity:** major

### Type comment used instead of annotation syntax
- **Look for:** `x = value  # type: int` or `# type: (str, int) -> bool`
- **Why:** Google style: "Avoid type comments." Type comments are a Python 2 compatibility mechanism. Python 3 has native annotation syntax which is preferred
- **Suggest:** `x: int = value` / `def foo(a: str, b: int) -> bool:`
- **Severity:** minor

---

## Imports

### Relative import used
- **Look for:** `from . import module` or `from ..sibling import something`
- **Why:** Google style: "Never use relative imports; employ full package paths consistently." Relative imports make code harder to move and refactor, and obscure where symbols originate
- **Suggest:** `from mypackage.subpackage import module`
- **Severity:** major

### Individual class or function imported from a module
- **Look for:** `from os.path import join, exists` or `from collections import defaultdict, OrderedDict` (beyond `typing` and `collections.abc`)
- **Why:** Google style: "Use `import x` for packages/modules, not individual classes or functions." Importing from modules by name pollutes the local namespace and makes origins ambiguous
- **Suggest:** `import os.path` then `os.path.join(...)` / `import collections` then `collections.defaultdict`
- **Severity:** minor

### Imports not ordered correctly
- **Look for:** Standard library imports mixed with third-party or local imports, or local imports before third-party
- **Why:** Google style import order: future statements → standard library → third-party → local application code. Consistent ordering makes dependency relationships immediately visible
- **Suggest:** Separate into groups with an optional blank line between groups, sorted lexicographically within each group
- **Severity:** nit

---

## Naming

### Function or variable uses non-`snake_case`
- **Look for:** `def processUser()` or `myVariable = ...` or `class_name` used as a variable
- **Why:** Google style (following PEP 8): functions, methods, variables, and module names use `lower_with_under`. `camelCase` is not idiomatic Python
- **Suggest:** `def process_user()`, `my_variable`
- **Severity:** minor

### Class name uses non-`CapWords`
- **Look for:** `class user_profile:` or `class api_client:`
- **Why:** Google style: classes and exceptions use `CapWords` (PascalCase)
- **Suggest:** `class UserProfile:`, `class ApiClient:`
- **Severity:** minor

### Constant not in `CAPS_WITH_UNDER`
- **Look for:** `maxRetries = 3` or `apiTimeout = 5000` at module level where the value is a constant
- **Why:** Google style: module-level constants use `CAPS_WITH_UNDER`
- **Suggest:** `MAX_RETRIES = 3`, `API_TIMEOUT_SECONDS = 5`
- **Severity:** nit

### Redundant type information in name
- **Look for:** `user_list`, `config_dict`, `id_to_name_dict`, `users_set`
- **Why:** Google style: "Avoid redundant type information in names." Type annotations serve this purpose; encoding the type in the name is duplication that rots when types change
- **Suggest:** `users`, `config`, `id_to_name`
- **Severity:** nit

### Single-character variable outside a small loop
- **Look for:** Variables named `x`, `y`, `z`, `n`, `s` used in functions longer than ~10 lines or in non-loop contexts
- **Why:** Google style: single-character names are acceptable for loop counters (`i`, `j`, `k`), exception variables (`e`), and file handles (`f`) only. All other variables should be descriptive
- **Suggest:** Use a descriptive name that reflects the value's purpose
- **Severity:** minor

---

## Common Gotchas

### Mutable default argument
- **Look for:** `def foo(items=[], config={})` or `def bar(tags=set())`
- **Why:** Python evaluates default arguments once at function definition time, not at each call. A mutable default is shared across all calls, causing state to leak between invocations — a classic and hard-to-debug bug
- **Suggest:** `def foo(items=None): if items is None: items = []`
- **Severity:** blocker

### String concatenation in a loop
- **Look for:** `result += str(item)` or `result = result + item` inside a `for` or `while` loop
- **Why:** Google style: "Never accumulate strings with `+`/`+=` in loops." Each concatenation creates a new string object, making the operation O(n²). This is a serious performance issue for large collections
- **Suggest:** Collect parts in a list and join: `parts = [str(item) for item in items]; result = "".join(parts)`
- **Severity:** major

### Dictionary iterated with `.keys()`
- **Look for:** `for k in d.keys():` or `if x in d.keys():`
- **Why:** Google style: "Avoid `.keys()` method on dictionaries; iterate directly." Iterating a dict directly gives keys. `.keys()` returns a view object with no benefit in these patterns
- **Suggest:** `for k in d:` / `if x in d:`
- **Severity:** nit

### Container mutated during iteration
- **Look for:** A `list`, `dict`, or `set` being modified (`.append()`, `.remove()`, `del`, `.pop()`) inside a `for` loop iterating over that same container
- **Why:** Google style: "Never mutate containers during iteration." This causes skipped elements or `RuntimeError: dictionary changed size during iteration`
- **Suggest:** Iterate over a copy: `for item in list(my_list):` or collect mutations and apply after the loop
- **Severity:** blocker

### `global` or `nonlocal` used to modify state
- **Look for:** `global config` or `nonlocal counter` inside a function
- **Why:** Google style discourages mutable module-level globals and the use of `global` to modify them. `nonlocal` is a code smell indicating state should be encapsulated in a class or passed explicitly
- **Suggest:** Encapsulate state in a class, or pass and return values explicitly
- **Severity:** major

---

## Style & Formatting

### Line exceeds 80 characters
- **Look for:** Lines longer than 80 characters (excluding URLs and string constants that cannot be split)
- **Why:** Google style: "Maximum 80 characters per line." Use implicit line joining with parentheses for continuation
- **Suggest:** Break at the highest syntactic level using implicit continuation in parentheses/brackets
- **Severity:** minor

### Backslash used for line continuation
- **Look for:** `result = something + \` at the end of a line
- **Why:** Google style: "Use implicit line joining (parentheses, brackets, braces), never backslash continuation." Backslash continuation is fragile — a trailing space after `\` breaks the continuation silently
- **Suggest:** Wrap the expression in parentheses: `result = (something + other_thing)`
- **Severity:** minor

### f-string not used for string formatting
- **Look for:** `"Hello, " + name` or `"Hello, %s" % name` or `"Hello, {}".format(name)` in Python 3.6+ code
- **Why:** Google style: prefer f-strings for string formatting. They are more readable and less error-prone than `%` formatting or `.format()`
- **Suggest:** `f"Hello, {name}"`
- **Severity:** nit

### Public function or class missing docstring
- **Look for:** A public function, method, or class with no docstring (triple-quoted string as the first statement)
- **Why:** Google style: docstrings are mandatory for public APIs, non-trivial functions, and classes. They describe calling semantics, not implementation
- **Suggest:** Add a docstring following the Google format: one-line summary, blank line, then `Args:`, `Returns:`, `Raises:` sections as applicable
- **Severity:** major

### Boolean compared with `==`
- **Look for:** `if x == True:`, `if x == False:`, `if x != True:`
- **Why:** Google style: "Never compare booleans to `False` using `==`." Use truthiness directly
- **Suggest:** `if x:` / `if not x:`
- **Severity:** minor

### `None` compared with `==`
- **Look for:** `if x == None:` or `if x != None:`
- **Why:** `None` is a singleton; identity comparison is correct and more explicit. `==` can be overridden by `__eq__` on custom objects
- **Suggest:** `if x is None:` / `if x is not None:`
- **Severity:** minor

---

## Testing

### Test method does not follow naming convention
- **Look for:** Test methods named `testSomething` (camelCase) or `test_something` without the `test_<method>_<state>` pattern for non-trivial cases
- **Why:** Google style for `pytest`: follow `lower_with_under` naming. The recommended pattern for clear test names is `test_<method_under_test>_<state_or_condition>`
- **Suggest:** `def test_parse_user_returns_none_on_empty_input(self):`
- **Severity:** nit

### `print()` used for test output
- **Look for:** `print(...)` statements in test files
- **Why:** `print` output is not captured by `pytest` by default and does not appear in CI failure logs in a useful way. Use `logging` or `pytest`'s built-in capture
- **Suggest:** Remove debug prints before committing, or use `logging.debug(...)` if trace output is genuinely needed
- **Severity:** minor

# Ruff Reference — Rule Families, Configuration, and What Each Catches

Ruff implements 900+ rules from 50+ source tools in a single Rust binary. The question is
never "all or nothing" — it's *which families* to enable and why.

---

## The Core Set (must-have)

| Prefix | Source | What it catches |
|---|---|---|
| **E, W** | pycodestyle | Whitespace, indentation, bare `except:`, comparison-to-None with `==`. Most overlap with the formatter; F is more valuable in practice. |
| **F** | Pyflakes | Real bugs: unused imports (F401), undefined names (F821), unused vars (F841), invalid `%` and `.format` string args. Ruff enables F by default. |
| **I** | isort | Import sorting; deterministic ordering of stdlib / third-party / first-party. |
| **UP** | pyupgrade | With `target-version = "py311"` rewrites: `Optional[X]` → `X \| None`, `Union[X, Y]` → `X \| Y`, `List[X]` → `list[X]`, `typing.Iterable` → `collections.abc.Iterable`, removes `from __future__ import annotations` on 3.14+, replaces deprecated typing aliases. |
| **B** | flake8-bugbear | Top hits: B006 (mutable default arg), B008 (function call in default arg), B904 (`raise X` inside `except` without `from`), B007 (loop var unused), B023 (closure capturing loop variable), B017 (`assertRaises(Exception)`). |
| **RUF** | Ruff-native | RUF001/002/003 (ambiguous unicode), RUF005 (list concat → unpacking), RUF012 (mutable class attrs need `ClassVar`), RUF013 (implicit Optional in annotation), RUF100 (unused `# noqa`). |

---

## The Quality Set (strongly recommended)

| Prefix | What it catches |
|---|---|
| **C4** (flake8-comprehensions) | C400 `list(generator)` → list comprehension; C401 `set(gen)` → set comp; C408 `dict(a=1)` → `{"a": 1}`; C414 unnecessary wrapping inside `sorted`/`min`/`max`. |
| **SIM** (flake8-simplify) | SIM102 nested `if`s; SIM108 if/else → ternary; SIM117 nested `with` → combined; SIM118 `key in d.keys()` → `key in d`; SIM401 manual `d.get(k, default)` pattern. |
| **RET** (flake8-return) | RET501 unnecessary `return None`; RET503 missing return; RET504 assignment-before-return; RET505–508 unnecessary `else` after `return`/`raise`/`continue`/`break`. |
| **PTH** (flake8-use-pathlib) | Replaces `os.path.join` → `Path /`, `os.path.exists` → `Path.exists`, `open(p)` → `Path(p).open`, `os.getcwd` → `Path.cwd`, and all other `os.path.*` calls. |
| **TC** (flake8-type-checking) | TC001–TC003 move imports used only for type hints into `if TYPE_CHECKING:` (faster startup, breaks circular imports). TC004 flags imports incorrectly inside `TYPE_CHECKING` that ARE used at runtime. |
| **FURB** (refurb) | FURB101 `open().read()` → `Path.read_text()`; FURB103 `open().write()` → `Path.write_text()`; FURB107 `try/except: pass` → `contextlib.suppress`; FURB113 `list.append` in loop → `list.extend`. Most have auto-fixes. |
| **ISC** (flake8-implicit-str-concat) | ISC002 catches `["a" "b"]` where the missing comma collapses two list elements into one string. (ISC001 must be in `ignore` under ruff-format — see below.) |
| **PERF** (Perflint) | Anti-patterns: PERF401 list accumulation in a loop instead of a comprehension; PERF203 `try/except` in a loop body. |
| **PL** (Pylint) | Selected PL rules (refactoring R, warning W, error E subsets). PL-max-args threshold configurable. |

---

## The Docstring Set

Enable `D` and set `convention = "google"`.

From Ruff's docs: *"The Google convention includes all D errors apart from: D203, D204, D213,
D215, D400, D401, D404, D406, D407, D408, D409, and D413."* Selecting `D` + Google convention
disables the incompatible rules automatically.

Most useful D rules kept by Google convention:
- D100 (public module), D101 (public class), D102 (public method), D103 (public function)
- D104 (public package), D200 (one-line docstring on one line), D205 (blank line after summary)
- D300 (use `"""`), D417 (missing argument description in `Args:`)

```toml
[tool.ruff.lint.pydocstyle]
convention = "google"
```

**RULE:** Disable `D` for `tests/**`, `*.pyi`, and `migrations/**` in `per-file-ignores`:

```toml
[tool.ruff.lint.per-file-ignores]
"tests/**/*.py"   = ["D", "S101", "S105", "S106", "PLR2004", "ANN"]
"*.pyi"           = ["D", "E501"]
"**/migrations/*" = ["E501", "D"]
```

---

## The Security Set (selective, not bulk `S`)

Enabling all of `S` is noisy (especially in tests). Enable individual rules:

| Rule | What it catches |
|---|---|
| **S105** | `password = "literal"` in module-level strings |
| **S106** | `connect(password="literal")` in function-call args |
| **S107** | `def login(password="literal"):` in defaults |
| **S108** | Insecure temp file (`/tmp/foo` vs `tempfile.mkstemp`) |
| **S113** | `requests.get(url)` without `timeout=` (DoS risk) |
| **S301** | `pickle.loads` (RCE on untrusted input) |
| **S307** | `eval()` |
| **S324** | `hashlib.md5/sha1/sha/md4` — weak hash functions susceptible to collision attacks |
| **S506** | `yaml.load(...)` without `SafeLoader` (RCE) |
| **S608** | SQL injection via `f"SELECT ... WHERE name='{name}'"` |

---

## Rules to Avoid or Suppress

### Formatter conflicts — MUST be in `ignore`

Ruff docs: *"When using Ruff as a formatter, we recommend avoiding the following lint rules:
`COM812` (missing-trailing-comma) and `ISC001` (single-line-implicit-string-concatenation)."*

```toml
ignore = [
    "COM812",   # missing-trailing-comma — formatter handles trailing commas
    "ISC001",   # single-line-implicit-str-concat — formatter may produce these
    "E501",     # line-too-long — formatter wraps; long URLs/strings are OK
    "D203",     # 1 blank line before class docstring — conflicts with D211 (Google picks D211)
    "D213",     # multi-line summary on second line — conflicts with D212 (Google picks D212)
    "PLR0913",  # too-many-arguments — pydantic models / CLI commands legitimately have many
]
```

### Do NOT enable

- **ANN rules** (`ANN101`, `ANN102`, `ANN401`) — type-checking is mypy/pyright's job. ANN tries
  to enforce annotation presence syntactically and fails on perfectly typed code. Use mypy's
  `disallow_untyped_defs = true` instead — it understands semantics.
- **`select = ["ALL"]`** — a Ruff upgrade can break CI overnight as new rules are added. Per
  Ruff's own docs: *"Use `ALL` with discretion… Start with a small set of rules and add a
  category at-a-time."* A curated `select` is explicit and stable.
- **ERA** (eradicate commented-out code) — too many false positives on intentional examples.
- **FIX/TD** — TODO comment policing is opinionated and creates noise in review.
- **EM** (flake8-errmsg) — debatable readability benefit; forces variable-then-raise pattern.
- **CPY** (copyright) — only enable if your org requires file-level headers.

---

## The `unfixable` Rule

```toml
unfixable = ["F401"]   # don't auto-delete unused imports; surface them in reviews
```

Without this, Ruff silently deletes unused imports on `--fix`. The deleted import may be:
- an intentional re-export in `__init__.py`
- a side-effect import (`import logging; logging.basicConfig(...)`)
- something you want to see in the review diff to decide yourself

**RULE:** Set `unfixable = ["F401"]`. Let Ruff flag the unused import; let a human decide whether
to delete, add to `__all__`, or suppress with `# noqa: F401`.

---

## Complete `[tool.ruff]` Configuration Block

```toml
[tool.ruff]
target-version = "py311"
line-length    = 100
src            = ["src", "tests"]
extend-exclude = ["docs/_build", "build", "dist"]

[tool.ruff.lint]
select = [
    "E", "W",     # pycodestyle
    "F",          # Pyflakes
    "I",          # isort
    "UP",         # pyupgrade
    "B",          # flake8-bugbear
    "C4",         # flake8-comprehensions
    "SIM",        # flake8-simplify
    "RET",        # flake8-return
    "PTH",        # flake8-use-pathlib
    "TC",         # flake8-type-checking
    "TID",        # flake8-tidy-imports
    "ISC",        # flake8-implicit-str-concat
    "ICN",        # flake8-import-conventions
    "FA",         # flake8-future-annotations
    "FURB",       # refurb
    "PERF",       # Perflint
    "PIE",        # flake8-pie
    "PL",         # Pylint
    "RUF",        # Ruff-native
    "D",          # pydocstyle (Google convention)
    "S105", "S106", "S107",
    "S108", "S113",
    "S301", "S307", "S324", "S506", "S608",
]
ignore = [
    "COM812", "ISC001",    # formatter conflicts (MUST ignore)
    "E501",                # formatter wraps lines
    "D203", "D213",        # Google convention choices
    "PLR0913",             # too-many-arguments
]
unfixable = ["F401"]

[tool.ruff.lint.pydocstyle]
convention = "google"

[tool.ruff.lint.flake8-tidy-imports]
ban-relative-imports = "all"

[tool.ruff.lint.flake8-type-checking]
runtime-evaluated-base-classes = ["pydantic.BaseModel"]

[tool.ruff.lint.isort]
known-first-party          = ["mypkg"]
combine-as-imports         = true
force-sort-within-sections = true
split-on-trailing-comma    = true

[tool.ruff.lint.pylint]
max-args = 8

[tool.ruff.lint.per-file-ignores]
"tests/**/*.py"     = ["D", "S101", "S105", "S106", "PLR2004", "ANN"]
"src/*/__init__.py" = ["F401", "D104"]
"**/migrations/*"   = ["E501", "D"]
"*.pyi"             = ["D", "E501"]

[tool.ruff.format]
quote-style                = "double"
indent-style               = "space"
docstring-code-format      = true
docstring-code-line-length = 80
skip-magic-trailing-comma  = false
```

---

## Retrofit Adoption Sequence

When adding Ruff to an existing project, don't enable everything at once:

1. Start with `select = ["E", "F", "I", "UP", "B", "RUF"]` — fix or `# noqa` everything. Merge.
2. Add `ruff format` in a **separate commit** — formatter diffs are noisy; isolate them so
   future `git blame` still works.
3. Add the quality set (`C4, SIM, RET, PTH, TC, FURB, ISC`) one prefix at a time.
4. Add `D` last — docstring enforcement is the highest-friction rule family.

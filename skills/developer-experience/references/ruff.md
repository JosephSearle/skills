# Ruff Reference

**Version**: ≥ 0.15.17

## pyproject.toml configuration

```toml
[tool.ruff]
target-version = "py311"    # match your Python version
line-length = 100

[tool.ruff.lint]
select = [
  "E",     # pycodestyle errors
  "F",     # pyflakes
  "I",     # isort
  "UP",    # pyupgrade
  "B",     # flake8-bugbear
  "ASYNC", # flake8-async — critical for async agent/tool code
  "SIM",   # flake8-simplify
  "PTH",   # flake8-use-pathlib
  "RUF",   # Ruff-native rules
  "PT",    # flake8-pytest-style
]
ignore = []

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "PLR2004"]  # assert OK; magic value comparison OK in tests
"**/prompts/**" = ["E501"]        # long prompt strings are expected
"**/fixtures/**" = ["S101", "E501"]

[tool.ruff.format]
# Default settings match Black
```

## Key rule groups for agent codebases

| Rule prefix | What it catches | Why it matters for agents |
|---|---|---|
| `ASYNC` | Blocking I/O (`asyncio.sleep`, `requests.get`, `time.sleep`) inside `async def` | LangGraph nodes are async; blocking calls stall the entire graph |
| `ASYNC212` | Blocking HTTP calls (`requests`, `httpx` sync) in async context | Catches accidental sync HTTP in async tool code |
| `B` | Common bug patterns (mutable defaults, `except Exception`, bare `raise`) | Agent error handling is critical |
| `UP` | Outdated syntax (`Union[X, Y]` → `X \| Y`, `Optional[X]` → `X \| None`) | LangChain/LangGraph type hints use modern syntax |
| `I` | Import order (isort replacement) | Consistent imports across large agent codebases |
| `PT` | pytest style (`assert` vs `assertEqual`, fixture conventions) | Enforces consistent test patterns |

## CLI usage

```bash
uv run ruff check src/ tests/ --fix       # lint + auto-fix safe fixes
uv run ruff check src/ tests/ --fix-only  # fix without reporting remaining errors
uv run ruff format src/ tests/            # format (Black replacement)
uv run ruff check --select ASYNC src/    # check only ASYNC rules
```

## Upgrade gotchas

- As of v0.13, deprecated rules are no longer activated by prefix or `ALL` — audit rule sets after upgrading.
- The 2026 formatter style guide changed blank-line and `except` formatting — expect diff noise on first `ruff format` after upgrade.
- `ASYNC` rules fire on any blocking call in `async def` — this is correct behaviour; fix the code.

## Integration with pre-commit

Order matters: lint (with `--fix`) → then format:

```yaml
- repo: https://github.com/astral-sh/ruff-pre-commit
  rev: v0.15.17
  hooks:
    - id: ruff
      args: [--fix]
    - id: ruff-format
```

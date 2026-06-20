# Pyright Reference

**Version**: ≥ 1.1.410 (pyright-python wrapper tracks weekly)

## pyproject.toml configuration

```toml
[tool.pyright]
pythonVersion = "3.11"
venvPath = "."
venv = ".venv"
typeCheckingMode = "standard"
```

**Do not also have a `pyrightconfig.json`** — it wins over `[tool.pyright]` and the two will conflict.
Delete `pyrightconfig.json` if present and consolidate into `pyproject.toml`.

## typeCheckingMode guidance

| Mode | Use for |
|---|---|
| `"basic"` | Legacy codebases, rapid prototyping, maximum permissiveness |
| `"standard"` | Default for agent codebases — catches real type errors without false-positive noise |
| `"strict"` | Core `src/` modules only; set via per-directory execution environments |

To apply strict mode only to core modules:

```toml
[tool.pyright]
typeCheckingMode = "standard"

[[tool.pyright.executionEnvironments]]
root = "src/core"
typeCheckingMode = "strict"
```

## Running Pyright

```bash
# Via uv (recommended — resolves project dependencies correctly)
uv run pyright src/

# Check a specific file
uv run pyright src/agents/orchestrator.py

# Output as JSON (for CI parsing)
uv run pyright src/ --outputjson
```

## LangChain / LangGraph compatibility

- LangChain and LangGraph ship `py.typed` markers — no external stubs needed.
- Pydantic v2 models are understood via `@dataclass_transform` (PEP 681) — no stubs needed.
- `Field(default=...)` must take `default` as a keyword arg for optionality to be inferred by Pyright.

## Known false positives in strict mode

- Dynamic LangGraph `State` dicts typed as `TypedDict` — Pyright may complain about extra keys when
  graph state is composed from multiple reducers. Use `Annotated` type aliases.
- `RunnableConfig` passed via `**kwargs` patterns — use explicit `config: RunnableConfig` parameter.
- `BaseModel.model_fields` access in generic functions — cast or use `TYPE_CHECKING` guard.

## pre-commit integration (local hook — required)

Pyright in an isolated pre-commit venv cannot resolve project dependencies, making it useless for
agent code. Always use a **local system hook**:

```yaml
- repo: local
  hooks:
    - id: pyright
      name: pyright
      language: system
      entry: uv run pyright
      types: [python]
      pass_filenames: false
```

Do NOT use `RobertCraigie/pyright-python` in pre-commit — it installs into an isolated venv.

## VS Code / Cursor

Pylance uses the same engine as Pyright. Settings sync automatically when `[tool.pyright]` is
configured in `pyproject.toml`. No separate `.vscode/settings.json` entry needed.

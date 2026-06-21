# HarnessProfile Reference — deepagents

> Requires deepagents>=0.5.4. Public beta — APIs may be updated in future releases.

---

## HarnessProfile fields

```python
from deepagents import HarnessProfile, GeneralPurposeSubagentProfile

profile = HarnessProfile(
    base_system_prompt="...",               # str | None
    system_prompt_suffix="...",             # str | None
    tool_description_overrides={},          # dict[str, str]
    excluded_tools=frozenset(),             # frozenset[str]
    excluded_middleware=[],                 # list[type | str]
    extra_middleware=[],                    # list[AgentMiddleware]
    general_purpose_subagent=GeneralPurposeSubagentProfile(
        enabled=True,
        system_prompt=None,                 # str | None
    ),
)
```

### Field descriptions

| Field | Type | What it does |
|---|---|---|
| `base_system_prompt` | `str \| None` | Replace the entire default deep-agent base prompt (becomes CUSTOM in assembly) |
| `system_prompt_suffix` | `str \| None` | Append text after the assembled base prompt (SUFFIX in assembly); applies to main agent, declarative subagents, and the auto-added general-purpose subagent |
| `tool_description_overrides` | `dict[str, str]` | Override individual tool descriptions shown to the model, keyed by tool name |
| `excluded_tools` | `frozenset[str]` | Remove specific harness-level tools from the model's tool set |
| `excluded_middleware` | `list[type \| str]` | Strip specific middleware classes from the stack — accepts class objects or string names |
| `extra_middleware` | `list[AgentMiddleware]` | Append additional middleware to every stack this profile applies to |
| `general_purpose_subagent` | `GeneralPurposeSubagentProfile` | Disable, rename, or re-prompt the auto-added general-purpose subagent |

---

## register_harness_profile

```python
from deepagents import register_harness_profile, HarnessProfile

register_harness_profile(
    key="anthropic:claude-sonnet-4-6",   # model identifier string
    profile=HarnessProfile(...),
)
```

- Must be called **before** `create_deep_agent`.
- `key` matches the `model=` string passed to `create_deep_agent`.
- Registration is global (module-level) — it affects all agents in the process.

### HarnessProfileConfig (YAML/JSON-friendly)

For config-file-driven profiles, use `HarnessProfileConfig` — a serialisable subset:

```python
from deepagents import HarnessProfileConfig

config = HarnessProfileConfig(
    system_prompt_suffix="Respond concisely.",
    excluded_tools=["execute"],
    general_purpose_subagent={"enabled": False},
)
# Convert to HarnessProfile:
profile = config.to_profile()
```

---

## Merge semantics (re-registration is additive)

Re-registering under an existing key **merges** the new profile on top of the prior one — it does not replace it.

| Field | Merge behaviour |
|---|---|
| `base_system_prompt` | New value wins if provided; otherwise inherits previous |
| `system_prompt_suffix` | New value wins if provided; otherwise inherits previous |
| `tool_description_overrides` | Mapping merge per key (new keys add, existing keys update) |
| `excluded_tools` | **Set union** (both sets combined) |
| `excluded_middleware` | **Set union** |
| `extra_middleware` | Merged by concrete class (deduplicated) |
| `general_purpose_subagent` | Field-wise merge |

**Implication for tests:** If tests register profiles and the module is shared, profiles accumulate across test runs. Reset or use isolated processes if profile state must be clean between tests.

---

## excluded_middleware constraints

`excluded_middleware` cannot remove scaffolding middleware:

```python
# These raise ValueError at agent construction time:
HarnessProfile(excluded_middleware=["FilesystemMiddleware"])   # ValueError
HarnessProfile(excluded_middleware=["SubAgentMiddleware"])    # ValueError
# Internal permission middleware also cannot be removed
```

To hide the model-visible surface of these middleware, use `excluded_tools` instead:

```python
HarnessProfile(excluded_tools=frozenset({"execute", "write_file", "edit_file"}))
```

---

## GeneralPurposeSubagentProfile

```python
from deepagents import GeneralPurposeSubagentProfile

# Disable the auto-added general-purpose subagent entirely
gp = GeneralPurposeSubagentProfile(enabled=False)

# Re-prompt the general-purpose subagent
gp = GeneralPurposeSubagentProfile(
    enabled=True,
    system_prompt="You are a specialised data analyst. Use only pandas and SQL.",
)
```

The general-purpose subagent is always added by the harness unless explicitly disabled. It handles overflow tasks the main agent delegates but doesn't have a named subagent for.

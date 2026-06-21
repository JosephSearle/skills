# Built-in Claude & Codex Profiles Reference — deepagents

---

## Built-in profile coverage

Built-in harness profiles ship for **OpenAI and Anthropic (Claude)** models.

> **Note on Google:** The official docs list OpenAI and Anthropic. The LangChain blog additionally claims Google support. Treat Google profile support as **unconfirmed** until verified against your installed version with `register_harness_profile` introspection.

---

## Confirmed Claude registrations

| Model key | Profile name | What the built-in profile adds |
|---|---|---|
| `anthropic:claude-sonnet-4-6` | Claude Sonnet 4.6 | Base system prompt optimised for long-horizon coding/research tasks |
| `anthropic:claude-opus-4-7` | Claude Opus 4.7 | `<tool_result_reflection>` and `<tool_usage>` prompt blocks (see Opus profile below) |
| `anthropic:claude-haiku-4-5` | Claude Haiku 4.5 | Lightweight base prompt; suited for worker/subagent roles |

These are registered at import time when deepagents is installed. You can extend them with `register_harness_profile` (merges additively) or replace specific fields by setting `base_system_prompt`.

---

## Opus profile details

The Opus built-in profile adds structured reflection blocks to encourage deeper reasoning:

```xml
<tool_result_reflection>
Think carefully about the tool result before proceeding.
</tool_result_reflection>

<tool_usage>
Consider whether a tool call is necessary before making one.
</tool_usage>
```

These blocks are added to the system prompt SUFFIX slot. They instruct Opus to reflect on tool results and consider tool necessity — exploiting Opus's stronger reasoning capabilities.

When customising the Opus profile, be aware that `system_prompt_suffix` merges (additive), so your suffix appends after these blocks unless you explicitly replace `base_system_prompt`.

---

## Codex profile details

The Codex profile (for OpenAI Codex / `openai:codex-*` models) overrides the default edit and execute tools:

| Default tool | Codex override | Effect |
|---|---|---|
| `edit_file` | `apply_patch` | Codex-native patch format instead of old_string/new_string replacement |
| `execute` | `shell_command` | Alias that matches Codex's expected tool name |

Additionally adds:
- Parallel-tool-call planning prompts — instructs the model to plan which tools to call in parallel before executing.

> **Wording inconsistency:** Some source excerpts say the edit tool override is `apply_patch` replacing `file_edit`; others say `edit_file`. Verify against the installed deepagents source (`grep -r "apply_patch" $(uv run python -c "import deepagents; print(deepagents.__file__[:deepagents.__file__.rfind('/')])") `) before publishing documentation that quotes this verbatim.

---

## Inspecting the active profile for a model

```python
from deepagents._profiles import get_harness_profile  # internal — may change

profile = get_harness_profile("anthropic:claude-sonnet-4-6")
print(profile)
```

This uses an internal API — treat it as a debugging aid, not a stable interface.

---

## Extending a built-in profile

```python
from deepagents import HarnessProfile, register_harness_profile

# Merge on top of the built-in Sonnet profile
register_harness_profile(
    "anthropic:claude-sonnet-4-6",
    HarnessProfile(
        system_prompt_suffix="You work at Acme Corp. Always prefix output with [ACME].",
        excluded_tools=frozenset({"execute"}),   # disable shell in Sonnet
    ),
)
# Result: built-in Sonnet base + Acme suffix + execute excluded
```

---

## Model key format

The `key` in `register_harness_profile` must exactly match the string passed to `model=` in `create_deep_agent`:

```python
# These are different keys — both are valid but independent
register_harness_profile("anthropic:claude-sonnet-4-6", ...)  # string model ID
register_harness_profile("claude-sonnet-4-6", ...)            # may or may not match

# The safest approach: always use the same string for both
create_deep_agent(model="anthropic:claude-sonnet-4-6", ...)
register_harness_profile("anthropic:claude-sonnet-4-6", ...)
```

If no profile matches the model key, the agent runs without harness-profile customisation (using only the SDK defaults).

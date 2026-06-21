---
name: deepagents-harness-and-claude
version: 1.0.0
description: >
  Deep Agents harness profiles and Claude integration — HarnessProfile configuration,
  register_harness_profile, prompt assembly order, AnthropicPromptCachingMiddleware, and the
  built-in Claude/Codex model profiles. Triggers on: HarnessProfile, register_harness_profile,
  GeneralPurposeSubagentProfile, base_system_prompt, system_prompt_suffix, excluded_tools,
  excluded_middleware, extra_middleware, tool_description_overrides, prompt assembly, USER BASE
  CUSTOM SUFFIX, SystemMessage cache_control, AnthropicPromptCachingMiddleware, ttl ephemeral,
  cache_control leak, Bedrock cachePoint, claude-sonnet-4-6, claude-opus-4-7, claude-haiku-4-5,
  Codex profile, apply_patch, shell_command, Opus profile, tool_result_reflection,
  HarnessProfileConfig. Requires deepagents>=0.5.4 (public beta).
---

## Core Philosophy

Claude is the default model for deepagents and the harness ships built-in profiles for Claude Sonnet/Opus/Haiku and the Codex (OpenAI) pattern. Harness profiles are **additive** — re-registering under the same model key merges on top of the existing profile, it does not replace it. Prompt-assembly order (USER → BASE/CUSTOM → SUFFIX) is an invariant: the caller's instructions always lead, model-tuning guidance always trails. The most common production failure in this area is `cache_control` leaking to non-Anthropic fallback models via `ModelFallbackMiddleware`, causing `TypeError: unexpected keyword argument 'cache_control'` (issue #33709). Document this before enabling prompt caching.

---

## Step 1 — Determine Context

| Signal | Sub-topic | Reference to load |
|---|---|---|
| `HarnessProfile`, `register_harness_profile`, field names, merge semantics | Harness profiles | `references/harness-profiles.md` |
| `system_prompt_suffix`, `base_system_prompt`, assembly order, `SystemMessage` | Prompt assembly | `references/prompt-assembly.md` |
| `AnthropicPromptCachingMiddleware`, `cache_control`, `ttl`, cost, bugs | Anthropic caching | `references/anthropic-caching.md` |
| Claude Sonnet/Opus/Haiku defaults, Codex profile, `apply_patch` | Built-in profiles | `references/claude-defaults.md` |
| General "how do profiles work?" | All of the above | Load all four references |

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/harness-profiles.md` | HarnessProfile seven fields, GeneralPurposeSubagentProfile, register_harness_profile, merge semantics | Any profile configuration question |
| `references/prompt-assembly.md` | Assembly order USER/BASE/CUSTOM/SUFFIX, SystemMessage vs str, cache_control preservation | Any system prompt or assembly question |
| `references/anthropic-caching.md` | AnthropicPromptCachingMiddleware params, cost, MemoryMiddleware placement, known bugs | Any prompt caching question; #33709 / #917 |
| `references/claude-defaults.md` | Built-in Sonnet/Opus/Haiku/Codex profiles, what each adds | Any "what does the default Claude profile do?" question |

---

## Step 3 — Implement

### Harness profile registration pattern

```python
from deepagents import (
    HarnessProfile,
    GeneralPurposeSubagentProfile,
    register_harness_profile,
)

register_harness_profile(
    "anthropic:claude-sonnet-4-6",
    HarnessProfile(
        system_prompt_suffix="Respond in under 100 words. Use bullet points.",
        excluded_tools=frozenset({"execute"}),
        general_purpose_subagent=GeneralPurposeSubagentProfile(
            enabled=False,  # disable the auto-added general-purpose subagent
        ),
    ),
)
```

Call `register_harness_profile` before `create_deep_agent` — it must be registered at construction time.

### Mandatory checklist for profile configuration

| Concern | Requirement |
|---|---|
| `excluded_middleware` limits | Cannot remove `FilesystemMiddleware` or `SubAgentMiddleware` — raises `ValueError`; use `excluded_tools` to hide their model-visible surface |
| Merge semantics | Re-registering merges (additive), not replaces — check for unintended accumulated state if re-registering in tests |
| `cache_control` + fallback models | Do not combine `AnthropicPromptCachingMiddleware` with `ModelFallbackMiddleware` pointing to non-Anthropic models — see #33709 |
| Bedrock deployment | Bedrock requires `cachePoint` blocks, not `cache_control` — DeepAgents prompt caching is stripped on Bedrock (#917) |
| `system_prompt=` type | Pass `SystemMessage` (not `str`) when you want to set `cache_control` markers on the caller's prompt block |

### Prompt assembly decision gate

```
Does the caller need to control system prompt content?
  └─ YES, replace the entire default prompt → set base_system_prompt in HarnessProfile
  └─ YES, append after the default prompt → set system_prompt_suffix in HarnessProfile
  └─ YES, prepend (caller instructions) → pass system_prompt= to create_deep_agent

Do you need prompt caching?
  └─ YES → Add AnthropicPromptCachingMiddleware via extra_middleware in HarnessProfile
           → Pass system_prompt= as SystemMessage to preserve cache_control markers
           → Confirm model is Anthropic-only (no ModelFallbackMiddleware to non-Anthropic)

Do you need to change how a specific tool is described to the model?
  └─ YES → Use tool_description_overrides={"tool_name": "new description"}
```

---

## Step 4 — Verify

```bash
# Confirm deepagents version supports HarnessProfile (>=0.5.4)
uv run python -c "import deepagents; print(deepagents.__version__)"

# Confirm profile is registered and merged correctly
uv run python -c "
from deepagents import HarnessProfile, register_harness_profile, create_deep_agent

register_harness_profile(
    'anthropic:claude-sonnet-4-6',
    HarnessProfile(system_prompt_suffix='Test suffix.'),
)
agent = create_deep_agent(model='anthropic:claude-sonnet-4-6', tools=[])
print('agent created with custom profile ok')
"

# Verify prompt caching middleware is in the stack
uv run python -c "
from deepagents import create_deep_agent, HarnessProfile, register_harness_profile
from deepagents.middleware import AnthropicPromptCachingMiddleware

register_harness_profile(
    'anthropic:claude-sonnet-4-6',
    HarnessProfile(extra_middleware=[AnthropicPromptCachingMiddleware(ttl='5m')]),
)
agent = create_deep_agent(model='anthropic:claude-sonnet-4-6', tools=[])
print('caching middleware registered ok')
"
```

---

## Reference Files

| File | Domain | Load when |
|---|---|---|
| [references/harness-profiles.md](references/harness-profiles.md) | HarnessProfile seven fields, merge semantics, register_harness_profile, beta caveats | Any profile configuration question |
| [references/prompt-assembly.md](references/prompt-assembly.md) | Assembly order USER/BASE/CUSTOM/SUFFIX, SystemMessage vs str, cache_control preservation | Any system prompt or assembly order question |
| [references/anthropic-caching.md](references/anthropic-caching.md) | AnthropicPromptCachingMiddleware, cost figures, MemoryMiddleware placement, known bugs | Any prompt caching question |
| [references/claude-defaults.md](references/claude-defaults.md) | Built-in Sonnet/Opus/Haiku/Codex profiles, what each profile adds | Questions about default Claude or Codex behaviour |

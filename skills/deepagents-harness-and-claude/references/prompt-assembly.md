# Prompt Assembly Reference — deepagents

---

## Assembly order (invariant)

The assembled system prompt is always built in this order:

```
[USER]  ← caller's system_prompt= (always first)
[BASE]  ← default deep-agent prompt (or [CUSTOM] if base_system_prompt is set)
[SUFFIX] ← HarnessProfile.system_prompt_suffix (always last)
```

Sections are joined with `\n\n` (double newline / blank line).

### Two invariants

1. **USER is always at the front** — caller instructions take precedence over the harness defaults and model-tuning guidance.
2. **SUFFIX is always at the end** — model-tuning guidance (brevity rules, tone, persona) sits closest to the conversation history where it has the most influence.

---

## Field-by-field rules

| Slot | How to set it | Effect |
|---|---|---|
| USER | `system_prompt=` in `create_deep_agent` | Prepended before everything else |
| BASE | Default deep-agent system prompt | Used when `base_system_prompt` is not set |
| CUSTOM | `HarnessProfile.base_system_prompt` | Replaces BASE entirely |
| SUFFIX | `HarnessProfile.system_prompt_suffix` | Appended after BASE or CUSTOM |

---

## system_prompt= as str vs SystemMessage

```python
from langchain_core.messages import SystemMessage

# Plain string — simple, no cache_control control
agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    system_prompt="You are a senior data engineer.",
)

# SystemMessage — preserves cache_control markers
agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    system_prompt=SystemMessage(
        content=[
            {
                "type": "text",
                "text": "You are a senior data engineer.",
                "cache_control": {"type": "ephemeral"},
            }
        ]
    ),
)
```

When `system_prompt=` is a `SystemMessage`, the right-hand assembly (BASE/CUSTOM + SUFFIX) is appended as an **additional text content block** onto the message's existing `content_blocks` list. This preserves any `cache_control` markers the caller set on their prompt block.

When `system_prompt=` is a plain `str`, it is converted to a simple `SystemMessage` with no `cache_control`.

---

## SUFFIX scope

`system_prompt_suffix` applies to:
- The main agent
- All declarative subagents
- The auto-added general-purpose subagent

It does NOT apply to `CompiledSubAgent` instances (which wrap externally compiled graphs).

---

## Overriding the entire base prompt

```python
from deepagents import HarnessProfile, register_harness_profile

register_harness_profile(
    "anthropic:claude-sonnet-4-6",
    HarnessProfile(
        base_system_prompt=(
            "You are a specialised SQL expert. "
            "Only answer questions about SQL. "
            "Refuse other requests politely."
        ),
        # base_system_prompt replaces the deep-agent default entirely (CUSTOM slot)
    ),
)
```

**Warning:** Replacing `base_system_prompt` removes the default deep-agent planning instructions (write_todos, systematic planning, etc.). Only do this if you want to run the agent in a completely different mode.

---

## Assembled prompt example

```
[USER]
You are a senior data engineer.

[BASE — default deep-agent prompt]
You are an expert autonomous agent...
[planning instructions, todo guidance, etc.]

[SUFFIX]
Respond in under 100 words. Use bullet points.
```

Result injected into the model as a single `SystemMessage` (with content blocks if `SystemMessage` was passed as `system_prompt=`).

# AnthropicPromptCachingMiddleware Reference — deepagents

---

## What it does

`AnthropicPromptCachingMiddleware` adds `cache_control` markers to static content before each model call, instructing the Anthropic API to cache that content for the specified TTL.

**What gets tagged:**
1. The last system-message content block
2. All tool definitions
3. The last cacheable message block in the conversation history

```python
from deepagents.middleware import AnthropicPromptCachingMiddleware
from deepagents import HarnessProfile, register_harness_profile

register_harness_profile(
    "anthropic:claude-sonnet-4-6",
    HarnessProfile(
        extra_middleware=[
            AnthropicPromptCachingMiddleware(
                type="ephemeral",                  # only supported value
                ttl="5m",                          # "5m" or "1h"
                unsupported_model_behavior="warn", # "warn" | "error" | "ignore"
            )
        ]
    ),
)
```

---

## TTL options and cost

| TTL | Cache write cost | Cache read cost | Use when |
|---|---|---|---|
| `"5m"` (5 minutes) | +25% over base input tokens | 10% of base input tokens | Short conversations, high churn |
| `"1h"` (1 hour) | Higher (Anthropic pricing) | 10% of base input tokens | Long-running or repeated sessions |

Cache hit: you pay 10% of what you'd normally pay for those tokens.
Cache miss / write: you pay 125% (5-min TTL) of the base price for the cached content.

**Break-even:** cache writes pay off after ~1.2 re-reads of the same content within the TTL window.

(Cost figures per Anthropic's official prompt-caching documentation.)

---

## MemoryMiddleware placement

`MemoryMiddleware` is placed **after** `AnthropicPromptCachingMiddleware` in the default stack:

```
Stack order (relevant excerpt):
  AnthropicPromptCachingMiddleware  ← marks static content
  MemoryMiddleware                  ← loads AGENTS.md into system prompt
```

This ensures that memory updates (changes to AGENTS.md between sessions) don't invalidate the Anthropic cache prefix that covers the static system prompt and tool definitions.

---

## Known bugs

### Bug #33709 — cache_control leaks to non-Anthropic fallback models

**Symptom:** `TypeError: unexpected keyword argument 'cache_control'` when using `ModelFallbackMiddleware` with a non-Anthropic fallback model.

**Cause:** `AnthropicPromptCachingMiddleware` adds `cache_control` to message content blocks. When `ModelFallbackMiddleware` routes to a non-Anthropic model (OpenAI, Gemini), that model's API rejects the unknown field.

**Fix:** Do not combine `AnthropicPromptCachingMiddleware` with `ModelFallbackMiddleware` that targets non-Anthropic models. Either:
- Remove caching when using fallbacks.
- Use only Anthropic models in the fallback chain.
- Strip `cache_control` markers before passing to non-Anthropic models (no built-in support — requires custom middleware).

### Bug #917 — Bedrock uses cachePoint, not cache_control

**Symptom:** Prompt caching appears enabled but has no effect on AWS Bedrock.

**Cause:** Amazon Bedrock's Anthropic API uses `cachePoint` blocks (not `cache_control`) for prompt caching. DeepAgents' `AnthropicPromptCachingMiddleware` writes `cache_control` markers, which Bedrock silently strips.

**Fix:** Do not use `AnthropicPromptCachingMiddleware` with Bedrock backends. Use Bedrock's native caching configuration instead (outside of deepagents).

---

## When NOT to use prompt caching

- When using `ModelFallbackMiddleware` pointing to non-Anthropic models (#33709)
- When deploying to AWS Bedrock (#917)
- When conversations are very short (cache write cost exceeds savings)
- When tool definitions change frequently between requests (cache miss every call)

---

## Verifying cache hits

Set `ANTHROPIC_LOG=debug` and look for `cache_read_input_tokens` in the API response:

```bash
ANTHROPIC_LOG=debug uv run python your_agent.py
# Look for: "cache_read_input_tokens": N in the API response
```

Cache hits appear in LangSmith traces as reduced `input_tokens` with non-zero `cache_read_input_tokens`.

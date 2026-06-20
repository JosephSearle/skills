# Anthropic Reference — langchain-anthropic 1.4.4

> **Install:**
> ```bash
> uv add langchain-anthropic==1.4.4
> ```

---

## CRITICAL: Model Retirement — June 15, 2026

> **⚠️ ACTION REQUIRED — Anthropic 4.0 model retirement:**
> Per Anthropic's April 14, 2026 platform changelog, **`claude-sonnet-4-20250514` and
> `claude-opus-4-20250514` retire on the Claude API on June 15, 2026 at 9 AM PT.**
>
> **Migration paths:**
> - `claude-sonnet-4-20250514` → `claude-sonnet-4-6`
> - `claude-opus-4-20250514` → `claude-opus-4-8`
>
> Grep your codebase immediately:
> ```bash
> grep -r "20250514" . --include="*.py" --include="*.yaml" --include="*.json" --include="*.toml"
> ```

---

## Package version matrix

| Version | Notable changes |
|---|---|
| 1.4.4 | Current stable |
| 1.4.1+ | Task budgets (`output_config` with `task_budget`) |
| 1.3.0+ | Programmatic tool calling, `allowed_callers`, `code_execution` container reuse |
| 1.1.0+ | Strict tool use, fine-grained tool streaming (`eager_input_streaming`) |
| 0.3.21+ | Context-management beta header `context-management-2025-06-27` |

---

## Model Families (June 2026)

| Model ID | Family | Context | Notes |
|---|---|---|---|
| `claude-opus-4-8` | Opus 4 | 1M tokens | Highest capability; adaptive thinking only (no explicit `budget_tokens`) |
| `claude-opus-4-7` | Opus 4 | 1M tokens | |
| `claude-opus-4-6` | Opus 4 | 1M tokens | Adaptive thinking available |
| `claude-sonnet-4-6` | Sonnet 4 | 1M tokens | Recommended general-purpose; full 1M at standard pricing |
| `claude-haiku-4-5-20251001` | Haiku 4 | 200K tokens | Fastest and cheapest |

> **⚠️ Dateless pinned-snapshot IDs:** The 4.6 generation onward uses dateless pinned-snapshot
> IDs (e.g. `claude-sonnet-4-6`, not `claude-sonnet-4-6-20250514`). Do not append date suffixes
> to these model IDs.

> **⚠️ 1M context beta retired:** The 1M-token context beta header (`context-1m-2025-08-07`) for
> Sonnet 4.5 and Sonnet 4 was **retired April 30, 2026** — requests over 200K now error on those
> models. Sonnet 4.6 / Opus 4.6+ support the full 1M context at standard pricing with no beta
> header needed.

---

## ChatAnthropic — Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | required | Model ID string |
| `temperature` | `float` | `1.0` | Sampling temperature; must be `None` when extended thinking is enabled |
| `max_tokens` | `int` | `1024` | Max output tokens; must be ≥ `budget_tokens` when thinking is enabled |
| `top_p` | `float \| None` | `None` | Nucleus sampling |
| `top_k` | `int \| None` | `None` | Top-k sampling |
| `timeout` | `float \| None` | `None` | Request timeout in seconds |
| `max_retries` | `int` | `2` | SDK-level retries. Set `0` when using `.with_fallbacks()` |
| `thinking` | `dict \| None` | `None` | Extended thinking config: `{"type": "enabled", "budget_tokens": N}` |
| `betas` | `list[str] \| None` | `None` | Beta feature headers |
| `inference_geo` | `str \| None` | `None` | Data residency region |
| `output_config` | `dict \| None` | `None` | Task budgets (≥1.4.1): `{"effort": "high", "task_budget": {"type": "tokens", "total": 128_000}}` |
| `stop_sequences` | `list[str] \| None` | `None` | Stop sequences |
| `rate_limiter` | `BaseRateLimiter \| None` | `None` | Attach an `InMemoryRateLimiter` |

---

## Extended Thinking

### Basic example

```python
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-sonnet-4-6",
    max_tokens=4096,        # must be >= budget_tokens
    thinking={"type": "enabled", "budget_tokens": 1024},
    temperature=None,       # thinking requires temperature=None
)

msg = llm.invoke("Solve this step by step: 17 × 23 + 45 ÷ 9")

# Inspect thinking and text blocks separately
for block in msg.content_blocks:
    print(block["type"], "→", block.get("reasoning") or block.get("text", "")[:80])
```

### content_blocks structure when thinking is enabled

```python
# msg.content_blocks example output:
[
    {
        "type": "reasoning",
        "reasoning": "Let me work through this...",
        "extras": {"signature": "ErUBCkYIARAAGiB..."},
    },
    {
        "type": "text",
        "text": "The answer is 396.",
    },
]
```

### Task budgets (requires langchain-anthropic ≥1.4.1)

```python
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-sonnet-4-6",
    max_tokens=131_072,
    output_config={
        "effort": "high",
        "task_budget": {"type": "tokens", "total": 128_000},
    },
)

msg = llm.invoke("Write a comprehensive analysis of microservices vs monoliths.")
print(msg.text)
```

### Opus 4.8 adaptive thinking

```python
from langchain_anthropic import ChatAnthropic

# Opus 4.8: do NOT pass thinking= or budget_tokens — adaptive only
llm = ChatAnthropic(
    model="claude-opus-4-8",
    max_tokens=8192,
    temperature=None,
)
msg = llm.invoke("Prove that sqrt(2) is irrational.")
print(msg.text)
```

> **⚠️ Opus 4.8 adaptive thinking:** Opus 4.8 supports **only adaptive thinking** — the explicit
> `budget_tokens` and sampling params were removed. Do not pass `thinking={"type": "enabled",
> "budget_tokens": ...}` for Opus 4.8; it will error. Adaptive thinking is available on
> opus-4-6+.

### Streaming thinking tokens

```python
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    thinking={"type": "enabled", "budget_tokens": 2048},
    temperature=None,
)

for chunk in llm.stream("Explain quantum entanglement simply."):
    if chunk.content:
        for block in chunk.content:
            if isinstance(block, dict) and block.get("type") == "thinking":
                print("[thinking]", block.get("thinking", ""), end="", flush=True)
            elif isinstance(block, dict) and block.get("type") == "text":
                print(block.get("text", ""), end="", flush=True)
            elif isinstance(block, str):
                print(block, end="", flush=True)
print()
```

---

## Prompt Caching

### Approach 1 — Manual cache_control

```python
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage

llm = ChatAnthropic(model="claude-sonnet-4-6", max_tokens=1024)

system_msg = SystemMessage(
    content=[
        {
            "type": "text",
            "text": "You are a coding assistant. " + open("large_context.txt").read(),
            "cache_control": {"type": "ephemeral"},  # mark for caching
        }
    ]
)

# First call — cache write (1.25× base input price for 5-min TTL)
r1 = llm.invoke([system_msg, HumanMessage(content="Summarise the document.")])

# Subsequent calls — cache read (0.1× base input price)
r2 = llm.invoke([system_msg, HumanMessage(content="What are the main themes?")])
```

### Approach 2 — AnthropicPromptCachingMiddleware

```python
from langchain_anthropic import ChatAnthropic
from langchain_anthropic.experimental import AnthropicPromptCachingMiddleware
from langchain_core.messages import SystemMessage, HumanMessage

base_llm = ChatAnthropic(model="claude-sonnet-4-6", max_tokens=1024)

# Middleware tags: last system block, all tool defs, last cacheable message block
# ttl options: "5m" (1.25× write) or "1h" (2× write)
llm = AnthropicPromptCachingMiddleware(llm=base_llm, ttl="5m")

r = llm.invoke([
    SystemMessage(content="Large stable system prompt here."),
    HumanMessage(content="Answer my question."),
])
```

### Prompt caching pricing

| Cache event | Pricing |
|---|---|
| Cache read | 0.1× base input price |
| 5-minute cache write | 1.25× base input price |
| 1-hour cache write | 2× base input price |

> **⚠️ Caching middleware + code_execution bug:** `AnthropicPromptCachingMiddleware` can
> incorrectly tag `tool_use`/`tool_result` blocks produced by `code_execution`, causing API
> errors (GitHub issue #34542). Scope `allowed_callers` carefully when using code execution
> alongside the middleware.

---

## Server-Side / Built-in Tools

### Version floors for built-in tools

| Tool | Min version | Beta header (if any) |
|---|---|---|
| `code_execution` | ≥1.0.3 (2025-08-25 beta) | `computer-use-2025-08-25` |
| `code_execution` (legacy) | ≥0.3.14 (2025-05-22) | `computer-use-2025-05-22` |
| `web_search` | ≥0.3.14 | — |
| `computer_use` | ≥0.3.14 | — |
| `text_editor` | ≥0.3.14 | — |
| `files` API | ≥0.3.14 | — |
| `memory_tool` | ≥0.3.14 | — |
| Tool search (`tool_search_tool_regex_20251119`) | ≥1.3.0 | — |
| Programmatic tool calling / `allowed_callers` / container reuse | ≥1.3.0 | — |
| Fine-grained tool streaming (`eager_input_streaming`) | ≥1.1.0 | — |
| Strict tool use | ≥1.1.0 | — |

### Web search example

```python
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(model="claude-sonnet-4-6", max_tokens=2048)
llm_with_web = llm.bind_tools([{"type": "web_search_20250305"}])

response = llm_with_web.invoke("What happened in the news today?")
print(response.text)
```

### Code execution example

```python
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    betas=["computer-use-2025-08-25"],
)
llm_with_code = llm.bind_tools([{"type": "code_execution_20250522"}])

response = llm_with_code.invoke(
    "Calculate the first 20 Fibonacci numbers and plot them."
)
print(response.text)
```

### Strict tool use

```python
from langchain_anthropic import ChatAnthropic
from langchain_core.tools import tool


@tool
def lookup_order(order_id: str) -> dict:
    """Look up an order by ID."""
    return {"order_id": order_id, "status": "shipped"}


llm = ChatAnthropic(model="claude-sonnet-4-6", max_tokens=1024)
llm_strict = llm.bind_tools([lookup_order], strict=True, tool_choice="any")

response = llm_strict.invoke("What is the status of order ORD-12345?")
for tc in response.tool_calls:
    print(tc["name"], tc["args"])
```

> **⚠️ strict=True JSON schema limitations:** Strict tool use with `strict=True` uses
> constrained decoding guaranteeing types and required fields, but has JSON schema limitations
> — unsupported schema features cause a 400.

---

## Vision and PDF Input

```python
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage

llm = ChatAnthropic(model="claude-sonnet-4-6", max_tokens=2048)

# Image URL
msg_url = HumanMessage(content=[
    {"type": "text", "text": "Describe this image."},
    {"type": "image_url", "image_url": {"url": "https://example.com/photo.jpg"}},
])

# Image base64
import base64
with open("diagram.png", "rb") as f:
    img_data = base64.b64encode(f.read()).decode("utf-8")

msg_b64 = HumanMessage(content=[
    {"type": "text", "text": "What does this diagram show?"},
    {
        "type": "image",
        "source_type": "base64",
        "data": img_data,
        "mime_type": "image/png",
    },
])

# PDF document
with open("report.pdf", "rb") as f:
    pdf_data = base64.b64encode(f.read()).decode("utf-8")

msg_pdf = HumanMessage(content=[
    {"type": "text", "text": "Summarise this PDF."},
    {
        "type": "document",
        "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_data},
    },
])

response = llm.invoke([msg_url])
print(response.text)
```

---

## Citations

```python
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage

llm = ChatAnthropic(model="claude-sonnet-4-6", max_tokens=2048)

msg = HumanMessage(content=[
    {
        "type": "document",
        "source": {
            "type": "text",
            "media_type": "text/plain",
            "data": "Python was created by Guido van Rossum in 1991.",
        },
        "citations": {"enabled": True},
    },
    {"type": "text", "text": "Who created Python and when?"},
])

response = llm.invoke([msg])
print(response.text)
# Citations appear in additional_kwargs or content_blocks
```

---

## Provider-agnostic construction via init_chat_model

```python
from langchain.chat_models import init_chat_model

# Fixed provider
llm = init_chat_model(
    "claude-sonnet-4-6",
    model_provider="anthropic",
    temperature=0,
    max_tokens=2048,
)

# Runtime switching
cfg = init_chat_model(configurable_fields=("model", "model_provider"))
response = cfg.invoke(
    "hello",
    config={"configurable": {"model": "claude-haiku-4-5-20251001", "model_provider": "anthropic"}},
)
```

---

## Production gotchas summary

| Gotcha | Detail |
|---|---|
| Model retirement June 15 2026 | `claude-*-20250514` IDs retire — migrate to `claude-sonnet-4-6` / `claude-opus-4-8` |
| Dateless IDs | `claude-sonnet-4-6` not `claude-sonnet-4-6-20250514` |
| temperature + thinking | Set `temperature=None` when `thinking=` is enabled |
| max_tokens < budget_tokens | Raises error — `max_tokens` must exceed `budget_tokens` |
| Opus 4.8 adaptive only | Do not pass explicit `budget_tokens` to Opus 4.8 |
| 1M context beta retired | `context-1m-2025-08-07` retired April 30 2026 — use Sonnet 4.6+ |
| Caching middleware + code_execution | Wrongly tags tool_use/tool_result blocks — see #34542 |
| task_budget requires ≥1.4.1 | `output_config` with `task_budget` not available before 1.4.1 |
| strict=True schema limits | Unsupported JSON schema features → 400 |

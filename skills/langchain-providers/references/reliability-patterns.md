# Reliability Patterns Reference — Rate Limiting, Retries, Fallbacks

## The Three-Layer Reliability Stack

Apply in this order. Each layer addresses a distinct failure mode:

| Layer | Mechanism | Failure addressed |
|---|---|---|
| 1 | `InMemoryRateLimiter` | Proactive rate cap — prevents hitting API quota |
| 2 | `.with_retry()` | Transient errors — handles spikes/jitter after the limiter |
| 3 | `.with_fallbacks()` | Provider unavailability — routes to backup provider |

> **⚠️ Critical ordering rule:** Set `max_retries=0` on the underlying client when you use
> `.with_fallbacks()`. If SDK-level retries are active (default `max_retries=2`), the SDK
> internally retries before LangChain ever sees the error — the fallback never triggers.

---

## InMemoryRateLimiter

### Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `requests_per_second` | `float` | required | Target rate cap |
| `check_every_n_seconds` | `float` | `0.1` | Polling interval for bucket refill check |
| `max_bucket_size` | `float` | `10` | Max burst capacity (token bucket) |

### Behaviour

The `InMemoryRateLimiter` implements a **token bucket algorithm**:
- Tokens refill at `requests_per_second` per second
- `max_bucket_size` caps burst capacity
- Blocks (sleeps) the calling thread/coroutine until a token is available
- **In-process only** — does not coordinate across multiple processes or machines

> **⚠️ Not token-aware:** The limiter counts requests, not tokens. For token-aware rate
> limiting in distributed deployments, use an external gateway or Redis-backed limiter.

> **⚠️ In-process only:** For multi-process deployments (gunicorn workers, distributed
> agents), each process has its own independent limiter. Use an external rate limiter (Redis,
> API gateway) if you need cross-process coordination.

### Usage pattern

```python
from langchain_core.rate_limiters import InMemoryRateLimiter
from langchain_openai import ChatOpenAI

# Size to your API tier — OpenAI Tier 1 is ~500 RPM = ~8.3 RPS
rl = InMemoryRateLimiter(
    requests_per_second=8.0,
    check_every_n_seconds=0.05,
    max_bucket_size=20,
)

llm = ChatOpenAI(model="gpt-5.4", rate_limiter=rl)

# Attach to ChatAnthropic
from langchain_anthropic import ChatAnthropic

llm_anthropic = ChatAnthropic(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    rate_limiter=rl,
)
```

---

## .with_retry()

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `retry_if_exception_type` | `tuple[type[Exception], ...]` | all exceptions | Exception types that trigger retry |
| `stop_after_attempt` | `int` | `3` | Max retry attempts |
| `wait_exponential_jitter` | `bool` | `True` | Exponential backoff with jitter between retries |
| `run_manager` | — | — | Internal LangChain param |

### Per-provider exception types

| Provider | Exception types to catch |
|---|---|
| OpenAI | `openai.RateLimitError`, `openai.APIConnectionError`, `openai.APITimeoutError` |
| Anthropic | `anthropic.RateLimitError`, `anthropic.APIConnectionError` |
| AWS Bedrock | `botocore.exceptions.ClientError` (ThrottlingException), `botocore.exceptions.EndpointResolutionError` |
| Groq | `groq.RateLimitError` |
| Cohere | `cohere.TooManyRequestsError` |
| Mistral | `mistralai` SDK exceptions |
| Ollama | `httpx.ConnectError`, `httpx.RemoteProtocolError` |

### Examples

```python
import openai
from langchain_openai import ChatOpenAI
from langchain_core.rate_limiters import InMemoryRateLimiter

rl = InMemoryRateLimiter(requests_per_second=5.0, check_every_n_seconds=0.05, max_bucket_size=10)

llm = ChatOpenAI(
    model="gpt-5.4",
    max_retries=0,  # disable SDK retries — let with_retry handle it
    rate_limiter=rl,
).with_retry(
    retry_if_exception_type=(
        openai.RateLimitError,
        openai.APIConnectionError,
        openai.APITimeoutError,
    ),
    stop_after_attempt=6,
    wait_exponential_jitter=True,
)

response = llm.invoke("Summarise the key points of REST API design.")
print(response.text)
```

```python
import anthropic as anthropic_sdk
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    max_retries=0,
).with_retry(
    retry_if_exception_type=(
        anthropic_sdk.RateLimitError,
        anthropic_sdk.APIConnectionError,
    ),
    stop_after_attempt=5,
    wait_exponential_jitter=True,
)
```

```python
import botocore.exceptions
from langchain_aws import ChatBedrockConverse

llm = ChatBedrockConverse(
    model_id="us.anthropic.claude-sonnet-4-6",
    region_name="us-west-2",
    max_retries=0,
).with_retry(
    retry_if_exception_type=(botocore.exceptions.ClientError,),
    stop_after_attempt=4,
    wait_exponential_jitter=True,
)
```

---

## .with_fallbacks()

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `fallbacks` | `list[Runnable]` | Ordered list of fallback runnables |
| `exceptions_to_handle` | `tuple[type[Exception], ...]` | Exceptions that trigger fallback; defaults to all |

### Canonical cross-provider fallback chain

```python
import openai
import anthropic as anthropic_sdk
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.rate_limiters import InMemoryRateLimiter

rl_primary = InMemoryRateLimiter(
    requests_per_second=5.0,
    check_every_n_seconds=0.05,
    max_bucket_size=10,
)
rl_fallback = InMemoryRateLimiter(
    requests_per_second=2.0,
    check_every_n_seconds=0.1,
    max_bucket_size=5,
)

primary = ChatOpenAI(
    model="gpt-5.4",
    max_retries=0,   # CRITICAL: disable SDK retries for fallback to work
    rate_limiter=rl_primary,
).with_retry(
    retry_if_exception_type=(
        openai.RateLimitError,
        openai.APIConnectionError,
        openai.APITimeoutError,
    ),
    stop_after_attempt=3,
    wait_exponential_jitter=True,
)

fallback = ChatAnthropic(
    model="claude-sonnet-4-6",
    max_tokens=2048,
    max_retries=0,
    rate_limiter=rl_fallback,
).with_retry(
    retry_if_exception_type=(
        anthropic_sdk.RateLimitError,
        anthropic_sdk.APIConnectionError,
    ),
    stop_after_attempt=3,
    wait_exponential_jitter=True,
)

robust_llm = primary.with_fallbacks(
    [fallback],
    exceptions_to_handle=(
        openai.RateLimitError,
        openai.APIConnectionError,
        openai.APITimeoutError,
        Exception,  # catch-all for provider outages
    ),
)

response = robust_llm.invoke("What is the difference between TCP and UDP?")
print(response.text)
```

### Multi-key load balancing pattern

```python
from langchain_openai import ChatOpenAI
from langchain_core.rate_limiters import InMemoryRateLimiter

# Multiple API keys, each with its own rate limiter
keys = ["sk-key1", "sk-key2", "sk-key3"]
instances = [
    ChatOpenAI(
        model="gpt-5.4",
        api_key=key,
        max_retries=0,
        rate_limiter=InMemoryRateLimiter(
            requests_per_second=5.0,
            max_bucket_size=10,
        ),
    )
    for key in keys
]

# Primary = first key; fallbacks = remaining keys
primary = instances[0].with_fallbacks(instances[1:])
```

---

## Provider-Agnostic content_blocks Handling

Read `msg.content_blocks` and `msg.text` instead of raw `content`. The `output_version`
parameter standardizes reasoning/tool output so downstream code is provider-independent.

### content_blocks type map

| Provider | Block type | Field |
|---|---|---|
| Anthropic (thinking enabled) | `"reasoning"` | `block["reasoning"]` |
| OpenAI (reasoning, `output_version="responses/v1"`) | `"reasoning"` | `block["reasoning"]` |
| Ollama (reasoning=True) | `"reasoning"` | `block["reasoning"]` |
| Any provider | `"text"` | `block["text"]` |
| Any provider (tool calls) | `"tool_use"` | `msg.tool_calls` list |

### Pattern: provider-agnostic response handling

```python
from langchain_core.messages import AIMessage


def extract_response(msg: AIMessage) -> dict:
    """Extract text and reasoning from any provider's response."""
    result: dict = {"text": msg.text, "reasoning": None, "tool_calls": msg.tool_calls}

    if msg.content_blocks:
        reasoning_blocks = [
            b for b in msg.content_blocks
            if isinstance(b, dict) and b.get("type") == "reasoning"
        ]
        if reasoning_blocks:
            result["reasoning"] = reasoning_blocks[0].get("reasoning")

    return result


# Works identically for ChatOpenAI, ChatAnthropic, ChatOllama
response = llm.invoke("What is 2+2?")
data = extract_response(response)
print(data["text"])
```

### output_version standardization

```python
from langchain_openai import ChatOpenAI

# Without output_version: reasoning summaries and built-in tool invocations
# land in additional_kwargs (harder to consume generically)
llm_raw = ChatOpenAI(model="gpt-5.4", use_responses_api=True)

# With output_version="responses/v1": all output normalized into content/content_blocks
llm_normalized = ChatOpenAI(
    model="gpt-5.4",
    use_responses_api=True,
    output_version="responses/v1",
)

response = llm_normalized.invoke("What is the capital of Japan?")
# content_blocks is now the canonical place to look for ALL output types
for block in response.content_blocks:
    print(block.get("type"), "→", (block.get("text") or block.get("reasoning") or "")[:80])
```

---

## Full Production Example — All Three Layers

```python
from __future__ import annotations

import openai
import anthropic as anthropic_sdk
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.rate_limiters import InMemoryRateLimiter
from langchain_core.messages import AIMessage, HumanMessage


def build_robust_llm() -> object:
    """Build a production-hardened LLM with rate limiting, retries, and fallback."""
    rl_openai = InMemoryRateLimiter(
        requests_per_second=8.0,
        check_every_n_seconds=0.05,
        max_bucket_size=20,
    )
    rl_anthropic = InMemoryRateLimiter(
        requests_per_second=3.0,
        check_every_n_seconds=0.1,
        max_bucket_size=10,
    )

    primary = ChatOpenAI(
        model="gpt-5.4",
        use_responses_api=True,
        output_version="responses/v1",
        max_retries=0,           # CRITICAL: disable SDK retries
        rate_limiter=rl_openai,
    ).with_retry(
        retry_if_exception_type=(
            openai.RateLimitError,
            openai.APIConnectionError,
            openai.APITimeoutError,
        ),
        stop_after_attempt=4,
        wait_exponential_jitter=True,
    )

    fallback = ChatAnthropic(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        max_retries=0,
        rate_limiter=rl_anthropic,
    ).with_retry(
        retry_if_exception_type=(
            anthropic_sdk.RateLimitError,
            anthropic_sdk.APIConnectionError,
        ),
        stop_after_attempt=4,
        wait_exponential_jitter=True,
    )

    return primary.with_fallbacks(
        [fallback],
        exceptions_to_handle=(
            openai.RateLimitError,
            openai.APIConnectionError,
            openai.APITimeoutError,
            Exception,
        ),
    )


def extract_response(msg: AIMessage) -> str:
    """Provider-agnostic text extraction."""
    return msg.text


robust_llm = build_robust_llm()
response = robust_llm.invoke([HumanMessage(content="Explain idempotency in REST APIs.")])
print(extract_response(response))
```

---

## Gotchas summary

| Gotcha | Detail |
|---|---|
| `max_retries=0` when using fallbacks | SDK retries prevent fallback from ever triggering |
| `InMemoryRateLimiter` is in-process only | Does not coordinate across processes or machines |
| Rate limiter is request-count based | Not token-aware — does not prevent token quota exhaustion |
| Bedrock throttling is a `ClientError` | Check `e.response["Error"]["Code"] == "ThrottlingException"` inside the catch |
| Always read `msg.content_blocks` | `msg.content` is provider-raw; `content_blocks` is normalized |
| `output_version="responses/v1"` for OpenAI | Without this, reasoning summaries land in `additional_kwargs` |

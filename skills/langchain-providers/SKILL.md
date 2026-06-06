---
name: langchain-providers
description: >
  Configure, tune, and harden LangChain provider integrations in production Python 3.11+
  services. Triggers on: ChatOpenAI, AzureChatOpenAI, use_responses_api, reasoning_effort,
  output_version, ChatAnthropic, extended thinking, thinking=, ChatBedrock,
  ChatBedrockConverse, ChatAnthropicBedrock, bedrock_converse, Bedrock Converse,
  cross-region inference, ChatOllama, num_ctx, ChatMistralAI, ChatGroq,
  ChatHuggingFace, langchain-huggingface 1.2.1, ChatCohere, Vertex AI auth, ADC,
  InMemoryRateLimiter, with_retry, with_fallbacks, model_provider,
  Anthropic model retirement, init_chat_model, content_blocks, stream_usage.
---

## Core Philosophy

Every provider integration decision in 2025/2026 has a correct default: **ChatBedrockConverse**
for AWS (not ChatBedrock), the **Responses API** (`use_responses_api=True`) for OpenAI reasoning
and built-in tools, **`thinking={...}`** for Anthropic extended thinking, and
**`init_chat_model(model, model_provider=...)`** as the universal construction layer so provider
swaps are a config change, not a code change. Consume `msg.content_blocks`, `msg.text`, and
`msg.tool_calls` everywhere — the `output_version` parameter normalizes reasoning summaries,
thinking blocks, and tool output across all providers. Harden every production integration in
the same order: `InMemoryRateLimiter` → `.with_retry()` (with `max_retries=0` on the client) →
`.with_fallbacks()`.

---

## Step 1 — Determine Context

Classify the task across two axes before loading any reference:

| Signal in request | Provider domain | Reference to load |
|---|---|---|
| `ChatOpenAI`, `AzureChatOpenAI`, `use_responses_api`, `reasoning_effort`, `o3`, `o4-mini`, `gpt-5`, `output_version`, `stream_usage` | **OPENAI** | `references/openai.md` |
| `ChatAnthropic`, `extended thinking`, `thinking=`, `claude-`, `AnthropicPromptCachingMiddleware`, `task_budget`, `inference_geo` | **ANTHROPIC** | `references/anthropic.md` |
| `ChatBedrock`, `ChatBedrockConverse`, `ChatAnthropicBedrock`, `bedrock_converse`, `cross-region inference`, `us.anthropic`, `guardrails`, `region_name` | **AWS-BEDROCK** | `references/aws-bedrock.md` |
| `ChatOllama`, `num_ctx`, `ChatMistralAI`, `ChatGroq`, `ChatHuggingFace`, `langchain-huggingface`, `ChatCohere`, `CohereRerank`, `MistralAIEmbeddings` | **OTHER** | `references/other-providers.md` |
| `InMemoryRateLimiter`, `with_retry`, `with_fallbacks`, `RateLimitError`, `ThrottlingException`, `content_blocks`, `output_version` cross-provider | **RELIABILITY** | `references/reliability-patterns.md` |

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/openai.md` | ChatOpenAI, AzureChatOpenAI, Responses API, reasoning models | Any OpenAI signal from Step 1 table |
| `references/anthropic.md` | ChatAnthropic, extended thinking, prompt caching, built-in tools | Any Anthropic signal; always load when `claude-` model IDs appear |
| `references/aws-bedrock.md` | ChatBedrockConverse, ChatBedrock, ChatAnthropicBedrock, cross-region | Any Bedrock / AWS signal |
| `references/other-providers.md` | Mistral, Groq, Ollama, HuggingFace, Cohere | Any non-OpenAI/Anthropic/AWS provider signal |
| `references/reliability-patterns.md` | Rate limiting, retries, fallbacks, content_blocks | Any reliability/production-hardening signal; load alongside any provider reference when request involves production deployment |

Always load `references/reliability-patterns.md` in addition to the provider-specific reference
when the request involves production hardening, SLA requirements, or multi-provider fallback.

---

## Step 3 — Configure Provider

### Provider selection decision gate

| Workload | Recommended class | Key param |
|---|---|---|
| General agentic / coding | `ChatAnthropic(model="claude-sonnet-4-6")` or `ChatOpenAI(model="gpt-5.4", use_responses_api=True)` | `thinking=` / `reasoning=` |
| Cost/latency-sensitive high volume | `ChatGroq(model="llama-3.3-70b-versatile")` or `ChatAnthropic(model="claude-haiku-4-5-20251001")` | `max_tokens`, rate limiter |
| On-prem / air-gapped | `ChatOllama(model=..., num_ctx=8192)` or `HuggingFacePipeline` | `num_ctx` MUST be set |
| Enterprise on AWS | `ChatBedrockConverse(model_id="us.anthropic.claude-sonnet-4-6")` | cross-region prefix `us.` |
| Provider-agnostic / runtime switching | `init_chat_model(configurable_fields=("model", "model_provider"))` | `model_provider=` |

### Auth decision gate

| Provider | Primary auth | Override |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | `api_key=`, `base_url=` |
| Anthropic | `ANTHROPIC_API_KEY` | `base_url=`, `inference_geo=` |
| AWS Bedrock | boto3 chain (`AWS_ACCESS_KEY_ID` etc.) | `credentials_profile_name=`, `client=` |
| Groq | `GROQ_API_KEY` | `groq_api_key=`, `base_url=` |
| Mistral | `MISTRAL_API_KEY` | `endpoint=` |
| Ollama | none (local) | `base_url="http://localhost:11434"` |
| HuggingFace | `HF_TOKEN` | `huggingfacehub_api_token=` |
| Cohere | `COHERE_API_KEY` | `cohere_api_key=` |

### Reliability pattern decision gate

From `references/reliability-patterns.md`:
- Apply `InMemoryRateLimiter` sized to your API tier before all else.
- Set `max_retries=0` on the underlying client when using `.with_fallbacks()` — SDK retries block fallback triggering.
- Compose: `llm.with_retry(...).with_fallbacks([backup])` — retry fires first, then fallback.

---

## Step 4 — Output & Verification

After configuring a provider, provide the exact verification commands:

```bash
# Verify package versions match pinned values
uv pip show langchain-openai langchain-anthropic langchain-aws langchain-mistralai \
    langchain-groq langchain-ollama langchain-huggingface langchain-cohere

# Smoke test provider auth (replace model/provider as needed)
uv run python -c "
from langchain.chat_models import init_chat_model
m = init_chat_model('claude-sonnet-4-6', model_provider='anthropic')
print(m.invoke('ping').text)
"

# Verify content_blocks are present on response
uv run python -c "
from langchain_anthropic import ChatAnthropic
m = ChatAnthropic(model='claude-haiku-4-5-20251001', max_tokens=64)
msg = m.invoke('hello')
print(msg.content_blocks)
print(msg.text)
"
```

What gets produced:
- Configured provider class instance ready for `.invoke()` / `.stream()` / `.batch()`
- Rate limiter + retry + fallback chain where production hardening is requested
- Pinned `uv add` commands with exact versions from the reference files

---

## Reference Files

| File | Domain | Primary source section |
|---|---|---|
| [references/openai.md](references/openai.md) | ChatOpenAI, AzureChatOpenAI, Responses API, reasoning, structured output | Research §OpenAI (langchain-openai 1.2.2) |
| [references/anthropic.md](references/anthropic.md) | ChatAnthropic, extended thinking, prompt caching, built-in tools, model retirement | Research §Anthropic (langchain-anthropic 1.4.4) |
| [references/aws-bedrock.md](references/aws-bedrock.md) | ChatBedrockConverse, ChatBedrock, ChatAnthropicBedrock, cross-region, Guardrails | Research §AWS Bedrock (langchain-aws 1.5.0) |
| [references/other-providers.md](references/other-providers.md) | Mistral, Groq, Ollama, HuggingFace, Cohere | Research §§MistralAI, Groq, Ollama, HuggingFace, Cohere |
| [references/reliability-patterns.md](references/reliability-patterns.md) | InMemoryRateLimiter, with_retry, with_fallbacks, exception types, content_blocks | Research §Rate limiting, retries, fallbacks + §Provider-agnostic content blocks |

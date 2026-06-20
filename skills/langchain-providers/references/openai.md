# OpenAI Reference — langchain-openai 1.2.2

> **Install:**
> ```bash
> uv add langchain-openai==1.2.2
> ```

## Package version matrix

| Version | Notable changes |
|---|---|
| 1.2.2 (May 21 2026) | Current stable; targets langchain-core 1.3.x |
| 1.0.1+ | `ChatOpenAI` can target Azure OpenAI v1 endpoints via `base_url` ending in `/openai/v1/`; Entra ID token-provider callables accepted as `api_key` |
| 0.3.29+ | `@custom_tool` with lark/regex context-free grammars |
| 0.3.26+ | `output_version="responses/v1"` added |

---

## ChatOpenAI — Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | `"gpt-4o"` | Model ID |
| `temperature` | `float` | `0.7` | Sampling temperature; must be `None` for reasoning models |
| `max_tokens` | `int \| None` | `None` | Deprecated alias → `max_completion_tokens`; still accepted and auto-converted. Leave `None` or set generously for reasoning models. |
| `max_completion_tokens` | `int \| None` | `None` | Preferred param since Sept 2024 |
| `top_p` | `float` | `1.0` | Nucleus sampling |
| `timeout` | `float \| None` | `None` | Request timeout in seconds |
| `max_retries` | `int` | `2` | SDK-level retries. Set `0` when using `.with_fallbacks()` |
| `stream_usage` | `bool` | `True` | Stream token-usage deltas. Disabled if `OPENAI_BASE_URL` env var is set (see base_url resolution order) |
| `reasoning_effort` | `str \| None` | `None` | Deprecated — use `reasoning={"effort": ...}` |
| `reasoning` | `dict \| None` | `None` | `{"effort": "medium", "summary": "auto"}` — auto-routes to Responses API |
| `use_responses_api` | `bool` | `False` | Use the OpenAI Responses API endpoint |
| `use_previous_response_id` | `bool` | `False` | Auto-chain `previous_response_id` from last message for stateful sessions |
| `output_version` | `str \| None` | `None` | `"responses/v1"` routes reasoning summaries and built-in tool invocations into `content` rather than `additional_kwargs` |
| `parallel_tool_calls` | `bool` | `True` | Allow parallel tool calls in a single response |
| `api_key` | `str \| Callable \| None` | `None` | Overrides `OPENAI_API_KEY`; accepts Entra ID token-provider callables for Azure |
| `base_url` | `str \| None` | `None` | See resolution order below |
| `organization` | `str \| None` | `None` | Overrides `OPENAI_ORG_ID` |
| `model_kwargs` | `dict` | `{}` | Pass-through to API for undocumented / future params |
| `context_management` | `list[dict] \| None` | `None` | gpt-5.4+: `[{"type": "compaction", "compact_threshold": 100_000}]` |

### base_url resolution order

Resolution is checked left-to-right; first match wins:

| Priority | Source | Side effect |
|---|---|---|
| 1 | `base_url=` constructor kwarg | None |
| 2 | `OPENAI_API_BASE` environment variable | Read by LangChain layer |
| 3 | `OPENAI_BASE_URL` environment variable | Read by the `openai` SDK — **also disables the `stream_usage` default** |

> **⚠️ stream_usage side effect:** Setting `OPENAI_BASE_URL` (source 3) causes the `openai` SDK
> to disable streaming usage by default. If you rely on token-usage data in streaming responses,
> set `stream_usage=True` explicitly on the constructor or use `base_url=` (source 1) instead.

---

## AzureChatOpenAI — Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `azure_endpoint` | `str \| None` | `None` | Azure OpenAI resource endpoint |
| `azure_deployment` | `str \| None` | `None` | Deployment name |
| `api_version` | `str \| None` | `None` | API version string, e.g. `"2024-12-01-preview"` |
| `api_key` | `str \| Callable \| None` | `None` | API key or Entra ID token-provider callable |
| `model` | `str \| None` | `None` | Optional model name for metadata |
| All `ChatOpenAI` params | — | — | Inherited |

> **⚠️ v1 endpoint via ChatOpenAI (≥1.0.1):** You can target an Azure OpenAI v1 endpoint directly
> using `ChatOpenAI` (not `AzureChatOpenAI`) by setting `base_url` to a URL ending in
> `/openai/v1/`. Entra ID token-provider callables are accepted as `api_key` in this mode.

---

## Responses API

### When to use

| Use case | Recommendation |
|---|---|
| Reasoning models (o3, o4-mini, gpt-5 series) | Use Responses API — `reasoning=` auto-routes |
| Built-in tools (web_search, file_search, code_interpreter, computer_use, image_generation, mcp) | Requires `use_responses_api=True` |
| Stateful multi-turn with tool calls on non-OpenAI base | Use `use_previous_response_id=True` to auto-chain |
| Standard chat completion, no built-in tools | Responses API optional; default endpoint is fine |

### Built-in tool list

| Tool name | Notes |
|---|---|
| `web_search` | Live web search |
| `file_search` | Search over uploaded files / vector stores |
| `code_interpreter` | Sandboxed Python code execution |
| `computer_use` | Desktop automation |
| `image_generation` | DALL-E image generation |
| `mcp` | Model Context Protocol server connection |

### Complete Responses API example

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-5.4",
    use_responses_api=True,
    output_version="responses/v1",
)

# Bind a built-in tool
llm_with_search = llm.bind_tools([{"type": "web_search"}])
response = llm_with_search.invoke("What are the top headlines today?")

# content_blocks contains web search results and text with output_version="responses/v1"
for block in response.content_blocks:
    print(block)
```

### Stateful sessions (use_previous_response_id)

```python
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

llm = ChatOpenAI(
    model="gpt-5.4",
    use_responses_api=True,
    use_previous_response_id=True,  # auto-chains previous_response_id
    output_version="responses/v1",
)

# First turn
r1 = llm.invoke([HumanMessage(content="My name is Alice.")])
# Second turn — prior context carried via response ID, not message list
r2 = llm.invoke([HumanMessage(content="What is my name?")])
print(r2.text)  # "Alice"
```

---

## Reasoning Models (o3, o4-mini, gpt-5 series)

### Constructor pattern

```python
from langchain_openai import ChatOpenAI

# reasoning= auto-routes to Responses API
llm = ChatOpenAI(
    model="o4-mini",
    reasoning={"effort": "medium", "summary": "auto"},
    max_completion_tokens=None,  # leave None — too low causes empty output
    temperature=None,            # reasoning models do not support temperature
)

response = llm.invoke("Solve: if 2x + 3 = 11, what is x?")
print(response.text)
```

### reasoning= effort levels

| Effort | Behaviour |
|---|---|
| `"minimal"` | Fastest, least reasoning |
| `"low"` | Light reasoning |
| `"medium"` | Balanced (default for most tasks) |
| `"high"` | Deep reasoning, highest latency and cost |

### Reasoning gotchas

> **⚠️ temperature restriction:** Reasoning models (`o3`, `o4-mini`, gpt-5 reasoning variants)
> do not support `temperature`. Pass `temperature=None` explicitly or you will receive a 400.

> **⚠️ max_tokens too low:** Reasoning models can return empty output if `max_tokens`/
> `max_completion_tokens` is set too low. Leave it `None` or set generously (e.g. 16384+).

> **⚠️ reasoning summaries require org verification:** `"summary": "auto"` requires a verified
> OpenAI organization. Without verification, the API returns a 400. Use `"summary": None` if
> your org is not verified.

> **⚠️ verbosity + structured output conflict:** Setting
> `model_kwargs={"text": {"verbosity": "high"}}` while using `with_structured_output()` raises
> a `text`/`response_format` conflict (GitHub issue #32492). Do not combine these two features.

### Verbosity example (standalone, not combined with structured output)

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="o3",
    reasoning={"effort": "high", "summary": "auto"},
    model_kwargs={"text": {"verbosity": "high"}},
)
```

---

## Structured Output

```python
from pydantic import BaseModel
from langchain_openai import ChatOpenAI


class CalendarEvent(BaseModel):
    name: str
    date: str
    participants: list[str]


llm = ChatOpenAI(model="gpt-5.4", temperature=0)
structured_llm = llm.with_structured_output(CalendarEvent, strict=True)

event = structured_llm.invoke(
    "Alice and Bob are meeting tomorrow to discuss the project launch."
)
print(event.name)
print(event.participants)
```

### with_structured_output method options

| Method | Notes |
|---|---|
| `"json_schema"` | Default for models that support it; uses JSON Schema |
| `"function_calling"` | Legacy function-calling format |

---

## Tool Calling

```python
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool


@tool
def get_weather(city: str) -> str:
    """Return current weather for a city."""
    return f"It is sunny in {city}."


llm = ChatOpenAI(model="gpt-5.4", temperature=0)
llm_with_tools = llm.bind_tools(
    [get_weather],
    strict=True,
    parallel_tool_calls=True,
    tool_choice="auto",
)

response = llm_with_tools.invoke("What's the weather in London and Paris?")
for tc in response.tool_calls:
    print(tc["name"], tc["args"])
```

### tool_choice options

| Value | Behaviour |
|---|---|
| `"auto"` | Model decides whether to call a tool |
| `"none"` | Force no tool calls |
| `"required"` | Force at least one tool call |
| `{"type": "function", "function": {"name": "..."}}` | Force a specific tool |

---

## Context Management (gpt-5.4+)

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-5.4",
    use_responses_api=True,
    context_management=[{"type": "compaction", "compact_threshold": 100_000}],
)
```

> **⚠️ Compaction blocks in history:** When compaction triggers, a compaction block appears in
> `content`. This block must be retained in the message history — do not strip it — or subsequent
> turns will lose context.

---

## Embeddings

```python
from langchain_openai import OpenAIEmbeddings

# text-embedding-3-large with Matryoshka truncation to 1024 dims
embeddings = OpenAIEmbeddings(model="text-embedding-3-large", dimensions=1024)
vectors = embeddings.embed_documents(["hello world", "foo bar"])
```

### Embeddings model comparison

| Model | Default dims | Max dims | Notes |
|---|---|---|---|
| `text-embedding-3-small` | 1536 | 1536 | Lowest cost |
| `text-embedding-3-large` | 3072 | 3072 | `dimensions=1024` beats ada-002 at 1536 |
| `text-embedding-ada-002` | 1536 | 1536 | Legacy; no `dimensions` param |

> **⚠️ Non-OpenAI endpoints:** For third-party OpenAI-compatible endpoints, set
> `check_embedding_ctx_length=False` and optionally `encoding_format="float"` to avoid
> tokenization failures.

---

## Production gotchas summary

| Gotcha | Detail |
|---|---|
| Non-standard `reasoning_content` dropped | `ChatOpenAI` parses only official OpenAI API fields; `reasoning_content`/`reasoning_details` from OpenRouter/vLLM/DeepSeek are silently dropped — use the provider-specific package |
| `max_tokens` deprecated | Deprecated Sept 2024; use `max_completion_tokens`. Still accepted and auto-converted. |
| `OPENAI_BASE_URL` disables `stream_usage` | See base_url resolution order above |
| Reasoning models + temperature | Pass `temperature=None`; otherwise 400 |
| Reasoning models + low max_tokens | Empty output; leave `None` or set ≥16384 |
| verbosity + with_structured_output | Raises `text`/`response_format` conflict (#32492) |
| Reasoning summaries + unverified org | 400 error; use `"summary": None` |
| `model_provider` auto-inference for OpenAI-compatible third-party | Set `model_provider="openai"` explicitly or auth routes to inferred provider |

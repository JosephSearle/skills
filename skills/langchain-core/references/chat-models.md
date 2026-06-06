# Chat Models Reference — init_chat_model, Messages, content_blocks, with_structured_output

## BaseChatModel Interface

`from langchain_core.language_models import BaseChatModel`

Abstract surface: `invoke`, `ainvoke`, `stream`, `astream`, `batch`, `abatch`,
`bind_tools`, `with_structured_output`, plus declarative `with_retry`, `with_fallbacks`,
`configurable_fields`, `configurable_alternatives`.

> **⚠️ v1:** `invoke` return type was tightened from `BaseMessage` to `AIMessage`. Custom
> chat models implementing `bind_tools` must update their return signature.

---

## init_chat_model

`from langchain.chat_models import init_chat_model`
(Re-exported from core; legacy alias `from langchain_classic.chat_models import init_chat_model`.)

### Signature

```python
init_chat_model(
    model: str | None = None,
    *,
    model_provider: str | None = None,
    configurable_fields: Literal["any"] | list[str] | tuple[str, ...] | None = None,
    config_prefix: str | None = None,
    **kwargs,
) -> BaseChatModel | _ConfigurableModel
```

### Provider Prefix Table (all 26 rows)

| Prefix | Required package | Prefix | Required package |
|---|---|---|---|
| `openai` | `langchain-openai` | `ollama` | `langchain-ollama` |
| `anthropic` | `langchain-anthropic` | `google_anthropic_vertex` | `langchain-google-vertexai` |
| `azure_openai` | `langchain-openai` | `deepseek` | `langchain-deepseek` |
| `azure_ai` | `langchain-azure-ai` | `ibm` | `langchain-ibm` |
| `google_vertexai` | `langchain-google-vertexai` | `nvidia` | `langchain-nvidia-ai-endpoints` |
| `google_genai` | `langchain-google-genai` | `xai` | `langchain-xai` |
| `bedrock` | `langchain-aws` | `openrouter` | `langchain-openrouter` |
| `bedrock_converse` | `langchain-aws` | `perplexity` | `langchain-perplexity` |
| `anthropic_bedrock` | `langchain-aws` | `upstage` | `langchain-upstage` |
| `cohere` | `langchain-cohere` | `baseten` | `langchain-baseten` |
| `fireworks` | `langchain-fireworks` | `mistralai` | `langchain-mistralai` |
| `together` | `langchain-together` | `litellm` | `langchain-litellm` |
| `huggingface` | `langchain-huggingface` | `groq` | `langchain-groq` |

### Bare-name inference (best-effort — prefer prefixed form)

| Pattern | Inferred provider |
|---|---|
| `gpt-*`, `o1*`, `o3*` | `openai` |
| `claude*` | `anthropic` |
| `gemini*` | `google_vertexai` |
| `command*` | `cohere` |
| `mistral*`, `mixtral*` | `mistralai` |
| `deepseek*` | `deepseek` |
| `grok*` | `xai` |
| `sonar*` | `perplexity` |
| `amazon.*`, `meta.*` | `bedrock` |

> **Best practice:** always use the `"provider:model"` prefixed form and pin full model IDs
> (e.g. `"anthropic:claude-haiku-4-5-20251001"`) over moving aliases.

> **Missing package:** integrations are imported lazily. If the provider package is absent,
> `init_chat_model` raises `ImportError` directing you to install it.

### Basic usage

```python
from langchain.chat_models import init_chat_model

# Prefixed form — unambiguous
model = init_chat_model("openai:gpt-4o-mini", temperature=0)
response = model.invoke("Explain quantum entanglement in one sentence.")
print(response.content)
```

### configurable_fields — Runtime model/provider switching

```python
from langchain.chat_models import init_chat_model

# "any" exposes all model parameters as runtime-configurable
configurable = init_chat_model(
    "openai:gpt-4o-mini",
    configurable_fields="any",
    config_prefix="llm",   # runtime keys become llm_model, llm_temperature, etc.
    temperature=0,
)

# Switch to Anthropic at runtime — no new object required
result = configurable.invoke(
    "Tell me a joke",
    config={
        "configurable": {
            "llm_model": "anthropic:claude-haiku-4-5-20251001",
            "llm_temperature": 0.7,
        }
    },
)

# With empty config_prefix, runtime keys are bare: model, temperature
bare = init_chat_model(configurable_fields="any")
bare.invoke(
    "hi",
    config={"configurable": {"model": "openai:gpt-4o-mini", "temperature": 0}},
)
```

> Declarative methods (`bind_tools`, `with_structured_output`) work on a configurable model.

---

## Message Types

`from langchain_core.messages import (HumanMessage, AIMessage, SystemMessage, ToolMessage,
FunctionMessage, AIMessageChunk, ToolCall, InvalidToolCall, ToolCallChunk)`

### Message type reference

| Class | Role | Key fields |
|---|---|---|
| `HumanMessage` | User turn | `content: str \| list[ContentBlock]` |
| `SystemMessage` | System prompt | `content: str` |
| `AIMessage` | Model response | `content`, `tool_calls`, `invalid_tool_calls`, `usage_metadata`, `response_metadata`, `id` |
| `ToolMessage` | Tool result | `content`, `tool_call_id: str` (must match originating `ToolCall.id`) |
| `FunctionMessage` | Legacy OpenAI functions | Deprecated — use `ToolMessage` |
| `AIMessageChunk` | Streaming chunk | All `AIMessage` fields + `tool_call_chunks`, `chunk_position` |

### AIMessage field reference

| Field | Type | Notes |
|---|---|---|
| `content` | `str \| list` | String for text-only; list of content blocks when multi-modal |
| `tool_calls` | `list[ToolCall]` | Parsed tool calls (provider-agnostic) |
| `invalid_tool_calls` | `list[InvalidToolCall]` | Calls that failed to parse (streamed args malformed) |
| `usage_metadata` | `UsageMetadata \| None` | Token counts — see shape below |
| `response_metadata` | `dict` | Headers, logprobs, token counts, model name (provider-specific) |
| `additional_kwargs` | `dict` | Raw provider extras |
| `id` | `str \| None` | Provider-assigned message ID |

> **⚠️ v1:** The `example` parameter was removed from `AIMessage`.

### usage_metadata shape

```python
usage: dict = {
    "input_tokens": 42,
    "output_tokens": 100,
    "total_tokens": 142,
    "input_token_details": {"cache_read": 10, "cache_creation": 0},
    "output_token_details": {"reasoning": 50},
}
```

### AIMessageChunk streaming

`AIMessageChunk` adds:
- `tool_call_chunks: list[ToolCallChunk]` — partial JSON args arrive incrementally
- `chunk_position` — set to `'last'` on the **final** streamed chunk; `None` on all others

Chunks can be added: `total = chunk1 + chunk2 + chunk3` — content is concatenated and
`tool_call_chunks` are re-parsed into `tool_calls`.

```python
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o-mini")

final_chunk = None
async def stream_and_collect(prompt: str):
    global final_chunk
    async for chunk in model.astream(prompt):
        if chunk.chunk_position == "last":
            final_chunk = chunk
        print(chunk.content, end="", flush=True)

import asyncio
asyncio.run(stream_and_collect("Count to 5"))
print(f"\nUsage: {final_chunk.usage_metadata}")
```

### ToolCall TypedDict

```python
from typing import Any, Literal, NotRequired
from typing_extensions import TypedDict

class ToolCall(TypedDict):
    name: str
    args: dict[str, Any]
    id: str | None
    type: NotRequired[Literal["tool_call"]]

class ToolCallChunk(TypedDict):
    name: str | None
    args: str | None        # partial JSON string
    id: str | None
    index: int | None
    type: Literal["tool_call_chunk"]

class InvalidToolCall(TypedDict):
    name: str | None
    args: str | None
    id: str | None
    error: str | None
    type: Literal["invalid_tool_call"]
```

---

## content_blocks (v1 flagship feature)

Every message exposes `.content_blocks` — a lazily-parsed, provider-agnostic `list[ContentBlock]`
derived from raw `.content`.

### Standard block types

| Block type | Fields | Notes |
|---|---|---|
| `text` | `type`, `text` | Standard text response |
| `reasoning` | `type`, `reasoning` | Extended thinking (Anthropic) |
| `tool_call` | `type`, `name`, `args`, `id` | Normalized tool call |
| `web_search_call` | `type`, `query` | Web search action |
| `web_search_result` | `type`, `url`, `title`, `content` | Web search result |
| `image` | `type`, `source_type`, `data\|url`, `media_type` | Image data |
| `video` | `type`, `source_type`, `data\|url` | Video data |
| `audio` | `type`, `source_type`, `data\|url` | Audio data |
| `file` | `type`, `source_type`, `data\|url` | File attachment |
| `citation` | `type`, `text`, `source` | Grounded citation |
| `non_standard` | `type="non_standard"`, `data` | Provider-specific block |

> **⚠️ Content block support initially shipped only for `langchain-anthropic`, `langchain-openai`,
> `langchain-ollama`, and Chat-Completions-style providers.** Broader support is rolling out
> gradually. Set `output_version="v0"` on `ChatOpenAI` (or env `LC_OUTPUT_VERSION=v0`) to restore
> pre-v1 raw-content behaviour with the Responses API.

```python
from langchain.chat_models import init_chat_model
from langchain_core.messages import create_text_block, create_image_block

# Anthropic extended thinking via content_blocks
llm = init_chat_model(
    "anthropic:claude-sonnet-4-20250514",
    thinking={"type": "enabled", "budget_tokens": 5000},
)
resp = llm.invoke("When was LangChain created?")

for block in resp.content_blocks:
    if block["type"] == "reasoning":
        print("[thinking]", block["reasoning"])
    elif block["type"] == "text":
        print("[answer]", block["text"])
```

### Constructors in langchain_core.messages

```python
from langchain_core.messages import (
    create_text_block,
    create_image_block,
    create_reasoning_block,
)

text_block  = create_text_block("Hello world")
image_block = create_image_block(
    data="<base64-encoded-bytes>",
    media_type="image/png",
)
reasoning_block = create_reasoning_block("Let me think step by step...")
```

---

## bind_tools

`bind_tools(tools, *, tool_choice=None, parallel_tool_calls=None, **kwargs)`

### Tool schema sources

| Source | How it's converted |
|---|---|
| `@tool`-decorated function | Uses function signature → JSON schema |
| `BaseTool` subclass | Uses `.args_schema` Pydantic model |
| Pydantic `BaseModel` | Class fields → JSON schema |
| `TypedDict` | Fields → JSON schema |
| Plain function | Signature → JSON schema via `convert_to_openai_tool` |

### tool_choice values

| Value | Behaviour |
|---|---|
| `"auto"` | Model decides whether to call a tool |
| `"any"` / `"required"` | Model must call at least one tool |
| `"none"` | Model must not call any tool |
| `"tool_name"` | Model must call that specific tool |

```python
from langchain.chat_models import init_chat_model
from langchain_core.tools import tool
from pydantic import BaseModel, Field


@tool
def get_weather(location: str, unit: str = "celsius") -> str:
    """Get the current weather for a location."""
    return f"Weather in {location}: 22 {unit}"


class SearchQuery(BaseModel):
    query: str = Field(description="The search query")
    top_k: int = Field(default=5, description="Number of results")


model = init_chat_model("openai:gpt-4o-mini")

# Bind a tool and a Pydantic schema
model_with_tools = model.bind_tools(
    [get_weather, SearchQuery],
    tool_choice="auto",
    parallel_tool_calls=False,   # disable multi-tool (OpenAI only)
)

response = model_with_tools.invoke("What's the weather in Paris?")
for tc in response.tool_calls:
    print(tc["name"], tc["args"])
```

---

## with_structured_output

`with_structured_output(schema, *, method="function_calling"|"json_schema"|"json_mode", include_raw=False, strict=None)`

### Strategy Decision Table

| Situation | Strategy | Method param | Notes |
|---|---|---|---|
| Modern provider with native structured output, simple schema | `ProviderStrategy` | `"json_schema"` | Deterministic; CFG→FSM constrained decoding; fastest |
| Complex / deeply nested / many-nullable fields | `ToolStrategy` | `"function_calling"` | `ProviderStrategy` can raise `400 Schema is too complex for grammar compilation` |
| Need both parsed object + raw message with usage | Either | Any + `include_raw=True` | Returns `{"raw": BaseMessage, "parsed": ..., "parsing_error": ...}` |
| Anthropic + extended thinking enabled | Avoid `ToolStrategy` | — | `ToolStrategy` can trigger `400 Thinking may not be enabled when tool_choice forces tool use` |
| Weak model without native structured output | `ToolStrategy` | `"function_calling"` | Falls back to prompt-guided JSON |
| OpenAI strict mode (additionalProperties:false required) | Either | Any + `strict=True` | Requires all properties in `required` |

### Schema types

| Schema type | Output type |
|---|---|
| Pydantic `BaseModel` | Validated Pydantic instance |
| `TypedDict` | `dict` |
| Dataclass | Dataclass instance |
| JSON schema dict | `dict` |

### include_raw=True shape

```python
{
    "raw": AIMessage,           # always present
    "parsed": MyModel | None,   # None on parse failure
    "parsing_error": Exception | None,
}
```

### Code examples

```python
from pydantic import BaseModel, Field
from langchain.chat_models import init_chat_model


class Joke(BaseModel):
    setup: str = Field(description="The setup of the joke")
    punchline: str = Field(description="The punchline of the joke")
    rating: int = Field(description="Funniness rating 1–10", ge=1, le=10)


model = init_chat_model("openai:gpt-4o-mini")

# Simple — use json_schema / ProviderStrategy
structured_model = model.with_structured_output(Joke, method="json_schema")
joke: Joke = structured_model.invoke("Tell me a programming joke")
print(joke.setup, joke.punchline, joke.rating)


# include_raw — never raises on parse failure
safe_model = model.with_structured_output(Joke, include_raw=True)
result = safe_model.invoke("Tell me a joke")
if result["parsing_error"]:
    print("Parse failed:", result["parsing_error"])
    print("Raw:", result["raw"].content)
else:
    joke2: Joke = result["parsed"]
    print(joke2.setup)


# Anthropic + extended thinking — avoid forcing tool_choice
anthropic_model = init_chat_model(
    "anthropic:claude-sonnet-4-20250514",
    thinking={"type": "enabled", "budget_tokens": 5000},
)
# Use include_raw and parse manually; do NOT use with_structured_output(method="function_calling")
raw_response = anthropic_model.invoke("What is 127 * 43?")
for block in raw_response.content_blocks:
    if block["type"] == "text":
        print("Answer:", block["text"])
```

### Agent-layer strategies

`from langchain.agents.structured_output import ToolStrategy, ProviderStrategy`

```python
from langchain.agents import create_agent
from langchain.agents.structured_output import ProviderStrategy, ToolStrategy
from pydantic import BaseModel, Field
from langchain.chat_models import init_chat_model


class FinalAnswer(BaseModel):
    answer: str
    confidence: float = Field(ge=0.0, le=1.0)
    sources: list[str]


model = init_chat_model("openai:gpt-4o-mini")

# Auto-select: ProviderStrategy if model profile reports native support, else ToolStrategy
agent = create_agent(model=model, tools=[], response_format=FinalAnswer)

# Explicit ProviderStrategy
agent2 = create_agent(
    model=model,
    tools=[],
    response_format=ProviderStrategy(FinalAnswer, strict=None),  # strict requires langchain>=1.2
)

# Explicit ToolStrategy for complex schema or Anthropic + thinking disabled
agent3 = create_agent(
    model=model,
    tools=[],
    response_format=ToolStrategy(FinalAnswer, handle_errors=True),
)
# Validated result lands in agent state["structured_response"]
```

---

## Production Gotchas

| Issue | Cause | Fix |
|---|---|---|
| `400 Schema is too complex for grammar compilation` | `ProviderStrategy` / `json_schema` on deeply nested Pydantic model | Switch to `ToolStrategy` / `function_calling` or flatten the schema |
| `400 Thinking may not be enabled when tool_choice forces tool use` | `ToolStrategy` with Anthropic extended thinking | Use `include_raw=True` and parse manually; do not force `tool_choice` |
| `ImportError: No module named 'langchain_openai'` | Provider package not installed | `uv add langchain-openai` (or the relevant partner package) |
| `AIMessage.text()` emits `DeprecationWarning` | `.text` is now a property, not a method | Replace `.text()` → `.text` |
| `example` kwarg rejected on `AIMessage` | Removed in v1 | Remove the `example` parameter |
| Streaming tool calls arrive as `invalid_tool_calls` | Partial JSON fails to parse on final chunk | Accumulate all chunks via `+` operator before parsing |
| Custom `bind_tools` returns `BaseMessage` instead of `AIMessage` | v1 tightened return type | Update return type annotation to `AIMessage` |
| `langchain-google-vertexai ≥ 3.2.0` deprecation warnings | Classes moved to `langchain-google-genai ≥ 4.0.0` | Pin `langchain-google-genai>=4.0.0` and use `ChatGoogleGenerativeAI` |

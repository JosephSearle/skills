# Other Providers Reference — Mistral, Groq, Ollama, HuggingFace, Cohere

## Package versions (June 6, 2026)

| Package | Version | Notes |
|---|---|---|
| langchain-mistralai | 1.1.4 (May 5 2026) | Production/Stable |
| langchain-groq | 1.1.2 (Feb 2 2026) | |
| langchain-ollama | 1.1.0 | Local only |
| langchain-huggingface | 1.2.0 | ⚠️ 1.2.1 was NEVER published to PyPI — pin 1.2.0 |
| langchain-cohere | 0.5.1 (Apr 15 2026) | Still 0.x — separate repo |

---

## MistralAI (langchain-mistralai 1.1.4)

> **Install:**
> ```bash
> uv add langchain-mistralai==1.1.4
> ```

**Auth:** `MISTRAL_API_KEY`

### ChatMistralAI — Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | `"mistral-small-latest"` | Model ID |
| `temperature` | `float` | `0.7` | Sampling temperature |
| `max_tokens` | `int \| None` | `None` | Max output tokens |
| `top_p` | `float` | `1.0` | Nucleus sampling |
| `random_seed` | `int \| None` | `None` | Seed for reproducibility |
| `safe_mode` / `safe_prompt` | `bool` | `False` | Safety filters |
| `endpoint` | `str \| None` | `None` | Proxy or base URL override |
| `max_retries` | `int` | `5` | SDK-level retries |
| `reasoning_effort` | `str \| None` | `None` | `"none"` → fast chat; `"high"` → deep reasoning (hybrid models only) |
| `api_key` | `str \| None` | `None` | Overrides `MISTRAL_API_KEY` |

### Model IDs (June 2026)

| Alias | Underlying model | Architecture | Context | Notable |
|---|---|---|---|---|
| `mistral-large-latest` | `mistral-large-2512` ("Mistral Large 3") | MoE — 41B active / 675B total + 2.5B vision encoder | 256K | Apache 2.0, December 2025 |
| `mistral-medium-3-5` | Medium 3.5 | Dense 128B | 256K | `reasoning_effort` supported |
| `mistral-small-latest` | `mistral-small-2603` (Small 4) | ~6B active | 128K | `reasoning_effort` supported |
| `codestral-latest` | Codestral | — | 256K | Code specialised |
| `pixtral-large-latest` | Pixtral Large | — | 256K | Vision (use native SDK for image input) |

> **⚠️ No image input through LangChain ChatMistralAI:** Per the integration feature matrix,
> `ChatMistralAI` does not expose image input. For vision workloads use Pixtral via the raw
> Mistral SDK.

### Examples

```python
from langchain_mistralai import ChatMistralAI

# Standard chat
llm = ChatMistralAI(model="mistral-large-latest", temperature=0)
response = llm.invoke("Explain gradient descent in 3 sentences.")
print(response.text)

# Deep reasoning (hybrid models)
llm_reasoning = ChatMistralAI(
    model="mistral-medium-3-5",
    reasoning_effort="high",
    max_tokens=4096,
)
response = llm_reasoning.invoke("Prove the Pythagorean theorem.")
print(response.text)
```

### Structured output

```python
from pydantic import BaseModel
from langchain_mistralai import ChatMistralAI


class Product(BaseModel):
    name: str
    price: float
    category: str


llm = ChatMistralAI(model="mistral-large-latest", temperature=0)
structured = llm.with_structured_output(Product)
product = structured.invoke("A red bicycle costs $299, it's a vehicle.")
print(product.name, product.price)
```

### Embeddings

```python
from langchain_mistralai import MistralAIEmbeddings

# General embeddings (1024-dim)
embeddings = MistralAIEmbeddings(model="mistral-embed")
vectors = embeddings.embed_documents(["hello world"])

# Code embeddings (configurable dims)
code_embeddings = MistralAIEmbeddings(model="codestral-embed")
```

---

## Groq (langchain-groq 1.1.2)

> **Install:**
> ```bash
> uv add langchain-groq==1.1.2
> ```

**Auth:** `GROQ_API_KEY`

### ChatGroq — Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | `"llama-3.3-70b-versatile"` | Model ID |
| `temperature` | `float` | `0.7` | Sampling temperature |
| `max_tokens` | `int \| None` | `None` | Max output tokens |
| `timeout` | `float \| None` | `None` | Request timeout |
| `max_retries` | `int` | `2` | SDK retries |
| `reasoning_format` | `str \| None` | `None` | `"parsed"` → surfaces `reasoning_content` for reasoning models |
| `groq_api_key` | `str \| None` | `None` | Overrides `GROQ_API_KEY` |
| `base_url` | `str \| None` | `None` | Endpoint override |
| `model_kwargs` | `dict` | `{}` | Pass-through: `parallel_tool_calls`, `seed`, `presence_penalty` |

### Active model IDs (June 2026)

| Model ID | Context | Max output | Pricing (input / output per M tokens) |
|---|---|---|---|
| `llama-3.3-70b-versatile` | 128K | 32,768 | $0.59 / $0.79 |
| `llama-3.1-8b-instant` | 128K | 8,192 | Low cost |
| `openai/gpt-oss-120b` | — | — | OpenAI OSS model via Groq |
| `qwen/qwen3-32b` | — | — | |
| `gemma2-9b-it` | 8K | 8,192 | |
| `meta-llama/llama-4-scout-17b-16e-instruct` | — | — | Vision capable |

### Deprecated model IDs — do NOT use

> **⚠️ The following models were deprecated by Groq in 2025–2026 and should not be pinned.
> Verify against the live Groq models page before using any model ID in production.**

| Deprecated ID | Reason |
|---|---|
| `deepseek-r1-distill-llama-70b` | Deprecated |
| `llama3-70b-8192` | Deprecated |
| `llama3-8b-8192` | Deprecated |
| `mixtral-8x7b-32768` | Deprecated |
| `moonshotai/kimi-k2` | Deprecated |
| `llama-4-maverick` | Deprecated |

### Examples

```python
from langchain_groq import ChatGroq

# Fast general-purpose
llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
response = llm.invoke("What is the time complexity of quicksort?")
print(response.text)

# Reasoning model with parsed reasoning
llm_reason = ChatGroq(
    model="openai/gpt-oss-120b",
    reasoning_format="parsed",
    max_tokens=8192,
)
response = llm_reason.invoke("What are the implications of Gödel's incompleteness theorems?")
print(response.additional_kwargs.get("reasoning_content", ""))
print(response.text)
```

### Rate limiting and retry for Groq

```python
from langchain_groq import ChatGroq
from langchain_core.rate_limiters import InMemoryRateLimiter
import groq

rl = InMemoryRateLimiter(requests_per_second=1.0, check_every_n_seconds=0.05, max_bucket_size=5)

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    max_retries=0,  # disable SDK retries when using with_retry
    rate_limiter=rl,
).with_retry(
    retry_if_exception_type=(groq.RateLimitError,),
    stop_after_attempt=6,
    wait_exponential_jitter=True,
)

response = llm.invoke("Hello!")
print(response.text)
```

---

## Ollama (langchain-ollama 1.1.0)

> **Install:**
> ```bash
> uv add langchain-ollama==1.1.0
> ```

**Auth:** None — local service. `base_url` defaults to `http://localhost:11434`.

### ChatOllama — Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | required | Model name as in `ollama list` |
| `base_url` | `str` | `"http://localhost:11434"` | Ollama server URL |
| `temperature` | `float` | `0.8` | Sampling temperature |
| `num_ctx` | `int` | `2048` | **Context window size. ⚠️ MUST increase for production — see below.** |
| `num_predict` | `int` | `-1` | Max tokens to generate; `-1` = infinite |
| `top_k` | `int` | `40` | Top-k sampling |
| `top_p` | `float` | `0.9` | Nucleus sampling |
| `repeat_penalty` | `float` | `1.1` | Repetition penalty |
| `format` | `str \| dict` | `""` | `"json"` for JSON mode; `""` is correct default |
| `keep_alive` | `str \| int` | `"5m"` | Model VRAM residence time; `"24h"` for production |
| `reasoning` | `bool` | `False` | Enable reasoning trace (deepseek-r1, gpt-oss, qwen3, gemma3) |
| `validate_model_on_init` | `bool` | `True` | Validate model exists on init |

### CRITICAL: num_ctx=2048 Default

> **⚠️ num_ctx defaults to 2048 — MUST increase for production.**
> Many models support 8K–128K context windows. With the 2048-token default:
> - Retrieved chunks in RAG pipelines are **silently truncated**
> - Long system prompts are **silently ignored**
> - Agents with tool call history exceed context after only a few turns
>
> **Always set `num_ctx` explicitly for production:**
> ```python
> # Minimum for RAG
> llm = ChatOllama(model="llama3.1", num_ctx=8192)
> # Long-context workloads
> llm = ChatOllama(model="llama3.1:70b", num_ctx=32768)
> ```

### Tool-capable models

| Model | Tool support | Notes |
|---|---|---|
| `llama3.1`, `llama3.1:8b`, `llama3.1:70b` | Yes | |
| `llama3.2`, `llama3.2:3b` | Yes | |
| `qwen2.5`, `qwen2.5:7b`, `qwen2.5:14b` | Yes | |
| `mistral`, `mistral:7b` | Yes | |
| `qwen3`, `qwen3:8b`, `qwen3:32b` | Yes | Also supports reasoning |
| `deepseek-r1:*` | No | Reasoning only |
| `gemma3`, `gemma2` | Partial | |

> **⚠️ Tool calls disabled while streaming** on some models. If you need tool call results,
> use `.invoke()` instead of `.stream()` and verify tool support on your specific model version.

### Examples

```python
from langchain_ollama import ChatOllama
from langchain_core.tools import tool

# Production-ready instantiation — always set num_ctx
llm = ChatOllama(
    model="llama3.1:8b",
    num_ctx=8192,        # CRITICAL: override the 2048 default
    temperature=0,
    keep_alive="24h",    # keep model in VRAM between calls
)

response = llm.invoke("What is the capital of Germany?")
print(response.text)


# JSON mode
llm_json = ChatOllama(
    model="llama3.1:8b",
    num_ctx=8192,
    format="json",
    temperature=0,
)

response = llm_json.invoke(
    "Return a JSON object with keys: city, country, population for Berlin."
)
import json
data = json.loads(response.text)
print(data)


# Tool calling
@tool
def calculate_area(length: float, width: float) -> float:
    """Calculate the area of a rectangle."""
    return length * width


llm_tools = ChatOllama(model="qwen2.5:7b", num_ctx=8192, temperature=0)
llm_with_tools = llm_tools.bind_tools([calculate_area])
response = llm_with_tools.invoke("What is the area of a 5 by 3 room?")
for tc in response.tool_calls:
    print(tc["name"], tc["args"])


# Reasoning models
llm_reasoning = ChatOllama(
    model="deepseek-r1:8b",
    num_ctx=16384,
    reasoning=True,
    temperature=None,
)
response = llm_reasoning.invoke("What is the sum of angles in a hexagon?")
reasoning = response.additional_kwargs.get("reasoning_content", "")
print("[reasoning]", reasoning[:200])
print("[answer]", response.text)
```

### Performance tips

| Technique | Config | Effect |
|---|---|---|
| Keep model in VRAM | `keep_alive="24h"` | Eliminates 4–8s cold-reload per request |
| Parallel requests | `OLLAMA_NUM_PARALLEL=4` env | Good throughput before VRAM contention |
| CPU inference | Default | Viable for small models (≤7B); GPU beats hosted-API round trip |

### Embeddings

```python
from langchain_ollama import OllamaEmbeddings

embeddings = OllamaEmbeddings(
    model="nomic-embed-text",
    base_url="http://localhost:11434",
)
vectors = embeddings.embed_documents(["hello world"])
```

---

## HuggingFace (langchain-huggingface 1.2.0)

> **Install:**
> ```bash
> uv add langchain-huggingface==1.2.0
> ```
>
> **DO NOT pin 1.2.1 — see critical gotcha below.**

**Auth:** `HF_TOKEN` or `HUGGINGFACEHUB_API_TOKEN`

### CRITICAL: 1.2.1 Never Published to PyPI

> **⚠️ langchain-huggingface 1.2.1 was NEVER published to PyPI.**
> If you specify `langchain-huggingface==1.2.1` in your dependencies, pip/uv will fail with
> "No matching distribution found". Always pin to `1.2.0`.
>
> This is the version as of June 6 2026 — re-verify before upgrading past 1.2.0.

### Two backends, both wrapped by ChatHuggingFace

| Backend | Use case |
|---|---|
| `HuggingFaceEndpoint` | Hosted inference (Inference Endpoints, Serverless, third-party providers like hyperbolic/nebius/together) |
| `HuggingFacePipeline.from_model_id` | Local transformers (CPU/GPU, quantized) |

### HuggingFaceEndpoint — Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `repo_id` | `str` | required | Model repo ID on HuggingFace Hub |
| `task` | `str` | `"text-generation"` | Pipeline task |
| `huggingfacehub_api_token` | `str \| None` | `None` | Overrides `HF_TOKEN` |
| `max_new_tokens` | `int` | `512` | Max tokens to generate |
| `temperature` | `float` | `0.7` | Sampling temperature |
| `provider` | `str` | `"auto"` | Inference provider: `"auto"`, `"hyperbolic"`, `"nebius"`, `"together"` |
| `server_kwargs` | `dict` | `{}` | Extra kwargs forwarded to the inference server |

### HuggingFacePipeline — Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model_id` | `str` | required | Model ID for local loading |
| `task` | `str` | required | `"text-generation"` etc. |
| `pipeline_kwargs` | `dict` | `{}` | Forwarded to `transformers.pipeline()` |
| `device` | `int \| str \| None` | `None` | e.g. `"cuda"`, `0`, `"cpu"` |
| `device_map` | `str \| None` | `None` | e.g. `"auto"` for multi-GPU |
| `model_kwargs` | `dict` | `{}` | e.g. `BitsAndBytesConfig` for 4-bit quantization |

### Examples

```python
from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint

# Hosted inference via Inference Endpoints
endpoint_llm = HuggingFaceEndpoint(
    repo_id="deepseek-ai/DeepSeek-R1-0528",
    task="text-generation",
    max_new_tokens=512,
    provider="auto",
)
chat = ChatHuggingFace(llm=endpoint_llm)
response = chat.invoke("What is 2 + 2?")
print(response.text)
```

```python
from langchain_huggingface import ChatHuggingFace, HuggingFacePipeline

# Local model — 4-bit quantized
from transformers import BitsAndBytesConfig
import torch

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
)

pipeline_llm = HuggingFacePipeline.from_model_id(
    model_id="microsoft/Phi-3-mini-4k-instruct",
    task="text-generation",
    device_map="auto",
    model_kwargs={"quantization_config": bnb_config},
    pipeline_kwargs={"max_new_tokens": 512, "do_sample": False},
)
chat = ChatHuggingFace(llm=pipeline_llm)
response = chat.invoke("Explain neural networks simply.")
print(response.text)
```

### Provider-agnostic via init_chat_model

```python
from langchain.chat_models import init_chat_model

llm = init_chat_model(
    "microsoft/Phi-3-mini-4k-instruct",
    model_provider="huggingface",
)
```

### Embeddings

```python
from langchain_huggingface import HuggingFaceEmbeddings, HuggingFaceEndpointEmbeddings

# Local sentence-transformers
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-mpnet-base-v2",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True},
    multi_process=False,
)

# Asymmetric (e5-style) — use query_encode_kwargs
asymmetric_embeddings = HuggingFaceEmbeddings(
    model_name="intfloat/multilingual-e5-large",
    encode_kwargs={"normalize_embeddings": True},
    query_encode_kwargs={"prompt": "query: "},
)

# Hosted TEI (Text Embeddings Inference)
tei_embeddings = HuggingFaceEndpointEmbeddings(
    model="sentence-transformers/all-mpnet-base-v2",
    task="feature-extraction",
    huggingfacehub_api_token="hf_...",
)
```

---

## Cohere (langchain-cohere 0.5.1)

> **Install:**
> ```bash
> uv add langchain-cohere==0.5.1
> ```

**Auth:** `COHERE_API_KEY`

> **⚠️ Still on 0.x versioning.** `langchain-cohere` uses a separate repo and has not
> converged onto the 1.x scheme. Semver compatibility guarantees differ from 1.x packages.

### ChatCohere — Constructor Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | `"command-r-plus"` | Model ID |
| `cohere_api_key` | `str \| None` | `None` | Overrides `COHERE_API_KEY` |
| `temperature` | `float` | `0.3` | Sampling temperature |
| `max_tokens` | `int \| None` | `None` | Max output tokens |
| `base_url` | `str \| None` | `None` | Custom endpoint |
| `connectors` | `list[dict] \| None` | `None` | e.g. `[{"id": "web-search"}]` for web retrieval |

### Model IDs (June 2026)

| Model ID | Notes |
|---|---|
| `command-a-03-2025` | Latest Command A |
| `command-r-plus-08-2024` | Command R+ (Aug 2024) |
| `command-r-08-2024` | Command R (Aug 2024) |

> **⚠️ Unsupported models in LangChain:** `command-a-reasoning-08-2025` and
> `command-a-vision-07-2025` are NOT supported in `langchain-cohere`. Use the native Cohere
> SDK for these models.

### Examples

```python
from langchain_cohere import ChatCohere

# Standard chat
llm = ChatCohere(model="command-a-03-2025", temperature=0.3)
response = llm.invoke("What are the main use cases for vector databases?")
print(response.text)

# RAG citations — available in additional_kwargs
print(response.additional_kwargs.get("citations", []))
```

```python
from langchain_cohere import ChatCohere

# Web search via connectors
llm_web = ChatCohere(
    model="command-a-03-2025",
    connectors=[{"id": "web-search"}],
)
response = llm_web.invoke("What are the latest developments in LLM research?")
print(response.text)
# Search results in additional_kwargs["search_results"]
```

```python
from pydantic import BaseModel
from langchain_cohere import ChatCohere


class SentimentResult(BaseModel):
    sentiment: str
    confidence: float
    reasoning: str


llm = ChatCohere(model="command-a-03-2025", temperature=0)
structured = llm.with_structured_output(SentimentResult)
result = structured.invoke("This product is absolutely fantastic!")
print(result.sentiment, result.confidence)
```

### Reranker

```python
from langchain_cohere import CohereRerank
from langchain.retrievers import ContextualCompressionRetriever

reranker = CohereRerank(
    model="rerank-english-v3.0",
    top_n=3,
    cohere_api_key="...",  # or set COHERE_API_KEY
)

# Wrap any base retriever with contextual compression
compression_retriever = ContextualCompressionRetriever(
    base_compressor=reranker,
    base_retriever=base_retriever,  # your existing retriever
)
```

### Embeddings

```python
from langchain_cohere import CohereEmbeddings

# Indexing — use search_document
doc_embeddings = CohereEmbeddings(
    model="embed-english-v3.0",
    input_type="search_document",
    cohere_api_key="...",  # or set COHERE_API_KEY
)

# Query — use search_query
query_embeddings = CohereEmbeddings(
    model="embed-english-v3.0",
    input_type="search_query",
)

# input_type options:
# "search_document" — for indexing corpus documents
# "search_query"    — for embedding user queries
# "classification"  — for classification tasks
# "clustering"      — for clustering tasks
```

---

## init_chat_model provider strings

| Provider | `model_provider=` string |
|---|---|
| MistralAI | `"mistralai"` |
| Groq | `"groq"` |
| Ollama | `"ollama"` |
| HuggingFace | `"huggingface"` |
| Cohere | `"cohere"` |

```python
from langchain.chat_models import init_chat_model

# All providers accessible uniformly
mistral = init_chat_model("mistral-large-latest", model_provider="mistralai")
groq    = init_chat_model("llama-3.3-70b-versatile", model_provider="groq")
ollama  = init_chat_model("llama3.1:8b", model_provider="ollama")
cohere  = init_chat_model("command-a-03-2025", model_provider="cohere")
```

---

## Production gotchas summary

| Provider | Gotcha | Detail |
|---|---|---|
| HuggingFace | 1.2.1 never published to PyPI | Pin `langchain-huggingface==1.2.0` — 1.2.1 does not exist on PyPI |
| Ollama | `num_ctx=2048` default | MUST set higher (e.g. 8192) for RAG/agents — silent truncation otherwise |
| Ollama | Format default | Default `format=""` is correct; only set `"json"` when you need forced JSON |
| Ollama | Tool streaming | Tool calls may be disabled when streaming on some model versions |
| Groq | Deprecated model IDs | Many 2024 IDs deprecated; verify against live Groq models page |
| Mistral | No image input via LangChain | Use raw Mistral SDK for Pixtral vision |
| Cohere | 0.x versioning | Semver guarantees differ from 1.x packages |
| Cohere | Unsupported models | `command-a-reasoning-08-2025` and `command-a-vision-07-2025` not in LangChain |

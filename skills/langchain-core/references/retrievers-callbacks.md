# Retrievers & Callbacks Reference — BaseRetriever, VectorStoreRetriever, EnsembleRetriever, BaseCallbackHandler

## BaseRetriever

`from langchain_core.retrievers import BaseRetriever`

Modern entrypoints:

| Method | Signature | Notes |
|---|---|---|
| `invoke` | `invoke(input: str, config: RunnableConfig \| None = None) -> list[Document]` | Synchronous retrieval; preferred |
| `ainvoke` | `async ainvoke(input, config=None) -> list[Document]` | Async retrieval |
| `get_relevant_documents` | `get_relevant_documents(query: str) -> list[Document]` | **Deprecated** — use `invoke()` |

All `BaseRetriever` subclasses are Runnables — they compose directly in LCEL pipes.

---

## VectorStoreRetriever

`vectorstore.as_retriever(**kwargs)` — wraps any `VectorStore` as a `BaseRetriever`.

### search_type options

| `search_type` | Behaviour | Key `search_kwargs` |
|---|---|---|
| `"similarity"` (default) | Standard cosine/dot-product similarity | `k` (top-k, default 4) |
| `"mmr"` | Maximal Marginal Relevance — balances relevance and diversity | `k`, `fetch_k`, `lambda_mult` |
| `"similarity_score_threshold"` | Returns only docs above a score threshold | `score_threshold`, `k` |

### search_kwargs reference

| Key | Type | Default | Notes |
|---|---|---|---|
| `k` | `int` | `4` | Number of documents to return |
| `fetch_k` | `int` | `20` | MMR candidate pool size before diversity re-ranking |
| `lambda_mult` | `float` | `0.5` | MMR diversity weight: 0 = max diversity, 1 = max relevance |
| `score_threshold` | `float` | required for threshold type | Minimum similarity score (0–1) |
| `filter` | `dict` | `None` | Metadata filter (store-specific syntax) |

```python
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

# Build a vector store
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
docs = [
    Document(page_content="Python is a general-purpose programming language."),
    Document(page_content="LangChain enables LLM application development."),
    Document(page_content="Vector databases store embedding vectors efficiently."),
    Document(page_content="Python is widely used in data science and ML."),
]
vs = Chroma.from_documents(docs, embeddings)

# Similarity retriever
sim_retriever = vs.as_retriever(search_type="similarity", search_kwargs={"k": 3})
results = sim_retriever.invoke("Python programming")

# MMR retriever — balances relevance and diversity
mmr_retriever = vs.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 3, "fetch_k": 20, "lambda_mult": 0.5},
)

# Score threshold retriever — only high-confidence matches
threshold_retriever = vs.as_retriever(
    search_type="similarity_score_threshold",
    search_kwargs={"score_threshold": 0.7, "k": 5},
)

# Metadata filter (syntax varies by vector store)
filtered_retriever = vs.as_retriever(
    search_kwargs={"k": 3, "filter": {"source": "docs"}},
)
```

---

## EnsembleRetriever (Hybrid Search)

`from langchain_classic.retrievers import EnsembleRetriever`
(Moved from `langchain.retrievers` in v1.)

Combines retrievers via **weighted Reciprocal Rank Fusion**:
`score(d) = Σᵢ weightᵢ / (rankᵢ + c)` where `c = 60` default.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `retrievers` | `list[BaseRetriever]` | required | Ordered list of retrievers to ensemble |
| `weights` | `list[float]` | equal | Must sum to 1.0 (or are normalised); higher = more influence |
| `c` | `int` | `60` | RRF constant; higher = smoother rank differences |
| `id_key` | `str \| None` | `None` | Deduplicate by a metadata key instead of `page_content` |

```python
from langchain_classic.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

docs = [
    Document(page_content="LangChain is a framework for LLM apps.", metadata={"id": "1"}),
    Document(page_content="LCEL makes chain composition easy.", metadata={"id": "2"}),
    Document(page_content="Python is the dominant ML language.", metadata={"id": "3"}),
]

# BM25 keyword retriever
bm25 = BM25Retriever.from_documents(docs, k=3)

# Dense vector retriever
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vs = Chroma.from_documents(docs, embeddings)
dense = vs.as_retriever(search_kwargs={"k": 3})

# Ensemble — BM25 weighted lower, dense higher
ensemble = EnsembleRetriever(
    retrievers=[bm25, dense],
    weights=[0.4, 0.6],
    c=60,
    id_key="id",   # deduplicate by metadata["id"]
)
results = ensemble.invoke("LangChain chain composition")
```

> **Gotcha:** LangChain's RRF is technically a **weighted variant**; pure RRF doesn't use
> weights. The weighting scheme has limited published evidence — validate retrieval quality
> empirically against your dataset before deploying to production.

---

## Advanced Retrievers (all in langchain-classic in v1)

### MultiQueryRetriever

`from langchain_classic.retrievers import MultiQueryRetriever`

LLM rewrites the query into N variants, retrieves with each, then unions results.

```python
from langchain_classic.retrievers import MultiQueryRetriever
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.chat_models import init_chat_model
from langchain_core.documents import Document

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vs = Chroma.from_documents([
    Document(page_content="LangChain enables building LLM apps."),
    Document(page_content="LCEL uses a pipe syntax for chaining."),
], embeddings)
base_retriever = vs.as_retriever(search_kwargs={"k": 3})

llm = init_chat_model("openai:gpt-4o-mini")

multi_query_retriever = MultiQueryRetriever.from_llm(
    retriever=base_retriever,
    llm=llm,
)
# Generates 3 query variants by default; set `include_original=True` to also include original
docs = multi_query_retriever.invoke("How does LangChain work?")
```

### ContextualCompressionRetriever

`from langchain_classic.retrievers import ContextualCompressionRetriever`

Wraps a `base_retriever` with a `base_compressor` to post-filter and compress retrieved docs.

```python
from langchain_classic.retrievers import ContextualCompressionRetriever
from langchain_classic.retrievers.document_compressors import LLMChainExtractor
from langchain.chat_models import init_chat_model
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vs = Chroma.from_documents([
    Document(page_content="LangChain's LCEL uses a pipe operator for composition."),
    Document(page_content="Python 3.11 added TaskGroup for structured concurrency."),
], embeddings)
base_retriever = vs.as_retriever(search_kwargs={"k": 4})

llm = init_chat_model("openai:gpt-4o-mini")
compressor = LLMChainExtractor.from_llm(llm)

compression_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=base_retriever,
)
compressed_docs = compression_retriever.invoke("How does LangChain compose chains?")
```

### ParentDocumentRetriever

`from langchain_classic.retrievers import ParentDocumentRetriever`

Indexes small `child_splitter` chunks for precise embedding match, but returns the larger
`parent_splitter` (or whole) documents. Needs a `docstore` for parent storage.

```python
from langchain_classic.retrievers import ParentDocumentRetriever
from langchain.storage import InMemoryStore
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vs = Chroma(embedding_function=embeddings, collection_name="parent-doc")
docstore = InMemoryStore()

retriever = ParentDocumentRetriever(
    vectorstore=vs,
    docstore=docstore,
    child_splitter=RecursiveCharacterTextSplitter(chunk_size=400),
    parent_splitter=RecursiveCharacterTextSplitter(chunk_size=2000),
)

# Add documents — child chunks are embedded, parents stored separately
from langchain_core.documents import Document
docs = [
    Document(page_content="LangChain is " + "a " * 500 + "framework."),
]
retriever.add_documents(docs)

# Retrieval returns full parent documents, not small chunks
results = retriever.invoke("What is LangChain?")
```

### SelfQueryRetriever

`from langchain_classic.retrievers import SelfQueryRetriever`

LLM translates natural language into a structured metadata filter + semantic query.

```python
from langchain_classic.retrievers import SelfQueryRetriever
from langchain_classic.chains.query_constructor.base import AttributeInfo
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.chat_models import init_chat_model
from langchain_core.documents import Document

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

docs = [
    Document(page_content="Overview of LCEL.", metadata={"category": "tutorial", "year": 2024}),
    Document(page_content="Advanced agent patterns.", metadata={"category": "advanced", "year": 2025}),
    Document(page_content="Quickstart guide.", metadata={"category": "tutorial", "year": 2025}),
]
vs = Chroma.from_documents(docs, embeddings)

metadata_field_info = [
    AttributeInfo(name="category", description="The doc category", type="string"),
    AttributeInfo(name="year", description="Publication year", type="integer"),
]

llm = init_chat_model("openai:gpt-4o-mini")
self_query_retriever = SelfQueryRetriever.from_llm(
    llm=llm,
    vectorstore=vs,
    document_contents="LangChain documentation articles",
    metadata_field_info=metadata_field_info,
    verbose=True,
)
results = self_query_retriever.invoke("Find 2025 tutorial documents")
```

---

## BaseCallbackHandler

`from langchain_core.callbacks import BaseCallbackHandler, AsyncCallbackHandler`

### All method signatures

```python
from uuid import UUID
from typing import Any, Sequence
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import BaseMessage
from langchain_core.documents import Document
from langchain_core.outputs import LLMResult


class MyCallbackHandler(BaseCallbackHandler):

    def on_llm_start(
        self,
        serialized: dict[str, Any],
        prompts: list[str],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        """Called for non-chat LLMs. NOT called for chat models."""

    def on_chat_model_start(
        self,
        serialized: dict[str, Any],
        messages: list[list[BaseMessage]],   # batched: outer list = batch index
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        """Called for chat models. Implement THIS, not on_llm_start, for ChatModel hooks."""

    def on_llm_new_token(
        self,
        token: str,
        *,
        chunk: Any | None = None,   # GenerationChunk | ChatGenerationChunk
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called for each streamed token. Only fires when streaming=True."""

    def on_llm_end(
        self,
        response: LLMResult,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when the LLM finishes generating."""

    def on_llm_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when the LLM raises an exception."""

    def on_chain_start(
        self,
        serialized: dict[str, Any],
        inputs: dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when any Runnable/chain starts."""

    def on_chain_end(
        self,
        outputs: dict[str, Any],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when any Runnable/chain finishes."""

    def on_chain_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when a chain raises an exception."""

    def on_tool_start(
        self,
        serialized: dict[str, Any],
        input_str: str,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        inputs: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when a tool starts. `inputs` is the structured dict (when available)."""

    def on_tool_end(
        self,
        output: Any,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when a tool finishes."""

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when a tool raises an exception."""

    def on_retriever_start(
        self,
        serialized: dict[str, Any],
        query: str,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when a retriever starts."""

    def on_retriever_end(
        self,
        documents: Sequence[Document],
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called when a retriever finishes."""

    def on_retry(
        self,
        retry_state: Any,
        *,
        run_id: UUID,
        parent_run_id: UUID | None = None,
        **kwargs: Any,
    ) -> None:
        """Called before each retry attempt."""
```

> **Critical:** chat models call `on_chat_model_start`, **NOT** `on_llm_start`. If you only
> implement `on_llm_start`, it will never fire for `ChatOpenAI`, `ChatAnthropic`, etc.
> `on_chat_model_start` receives `list[list[BaseMessage]]` (outer list = batch dimension).

### Mixin inheritance hierarchy

`BaseCallbackHandler` mixes in: `LLMManagerMixin`, `ChainManagerMixin`, `ToolManagerMixin`,
`RetrieverManagerMixin`, `CallbackManagerMixin`, `RunManagerMixin`. Override only the methods
you need.

---

## Practical Callback Examples

### Token counter

```python
from langchain_core.callbacks import BaseCallbackHandler
from langchain.chat_models import init_chat_model


class TokenCounter(BaseCallbackHandler):
    def __init__(self) -> None:
        self.input_tokens = 0
        self.output_tokens = 0

    def on_llm_end(self, response, *, run_id, **kwargs) -> None:
        usage = getattr(response, "llm_output", {}).get("token_usage", {})
        self.input_tokens  += usage.get("prompt_tokens", 0)
        self.output_tokens += usage.get("completion_tokens", 0)


model = init_chat_model("openai:gpt-4o-mini")
counter = TokenCounter()
result = model.invoke("Hello", config={"callbacks": [counter]})
print(f"Tokens: in={counter.input_tokens} out={counter.output_tokens}")
```

### Async streaming to WebSocket

```python
import asyncio
from langchain_core.callbacks import AsyncCallbackHandler
from langchain.chat_models import init_chat_model


class WebSocketStreamHandler(AsyncCallbackHandler):
    def __init__(self, websocket) -> None:
        self.websocket = websocket

    async def on_llm_new_token(self, token: str, **kwargs) -> None:
        await self.websocket.send_text(token)

    async def on_chat_model_start(self, serialized, messages, **kwargs) -> None:
        await self.websocket.send_text("[START]")

    async def on_llm_end(self, response, **kwargs) -> None:
        await self.websocket.send_text("[DONE]")


# Usage (in a FastAPI WebSocket handler):
# handler = WebSocketStreamHandler(websocket)
# model = init_chat_model("openai:gpt-4o-mini", streaming=True)
# await model.ainvoke("Tell me a story", config={"callbacks": [handler]})
```

### Per-call vs constructor callbacks

| Placement | Scope | Recommendation |
|---|---|---|
| `config={"callbacks": [h]}` | This call + all sub-runnables | **Preferred** — request-scoped, propagates via COPIABLE_KEYS |
| `ChatOpenAI(callbacks=[h])` | Every call from this model instance | Use for persistent handlers (LangSmith tracer) |

```python
from langchain_core.callbacks import BaseCallbackHandler
from langchain.chat_models import init_chat_model
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser


class StepLogger(BaseCallbackHandler):
    def on_chain_start(self, serialized, inputs, **kwargs) -> None:
        print(f"[chain start] {serialized.get('name', 'unknown')}")

    def on_chain_end(self, outputs, **kwargs) -> None:
        print(f"[chain end] {list(outputs.keys())}")


model = init_chat_model("openai:gpt-4o-mini")
prompt = ChatPromptTemplate.from_template("Answer: {question}")
chain = prompt | model | StrOutputParser()

logger = StepLogger()
# Per-call: propagates to prompt, model, and parser sub-calls
result = chain.invoke({"question": "What is 2+2?"}, config={"callbacks": [logger]})
```

---

## Callbacks vs LangSmith vs OpenTelemetry

| Mechanism | Best for | Setup |
|---|---|---|
| `BaseCallbackHandler` | In-process hooks: token counting, streaming to UI, custom guardrails | Subclass and pass via `config={"callbacks": [...]}` |
| LangSmith tracing | End-to-end agent/chain observability, evals, prompt management | `LANGCHAIN_TRACING_V2=true` + `LANGSMITH_API_KEY` |
| OpenTelemetry | Unifying LLM traces with existing distributed tracing/APM infra | `opentelemetry-sdk` + LangChain OTel exporter |

### LangSmith tracing setup

```python
import os

# Set in environment before importing LangChain
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGSMITH_API_KEY"] = "ls__..."       # from LangSmith UI
os.environ["LANGCHAIN_PROJECT"] = "my-project"   # optional; defaults to "default"

from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-4o-mini")
# All calls are now automatically traced to LangSmith
result = model.invoke("Hello!")
```

### BaseTracer

`from langchain_core.tracers import BaseTracer` — buffers `Run` objects keyed by `run_id`,
maintains parent/child hierarchy via `parent_run_id`, and flushes to a backend. Subclassed by
`LangChainTracer` (→ LangSmith). `Run` shape: `id`, `name`, `run_type`, `inputs`, `outputs`,
`error`, `start_time`, `end_time`, `tags`, `metadata`, `parent_run_id`, `child_runs`.

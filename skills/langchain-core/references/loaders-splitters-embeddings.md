# Loaders, Splitters & Embeddings Reference — Document/Blob, Text Splitters, CacheBackedEmbeddings

## Document and Blob Types

### Document

`from langchain_core.documents import Document`

| Field | Type | Notes |
|---|---|---|
| `page_content` | `str` | The text content |
| `metadata` | `dict` | Arbitrary key-value pairs; preserved through splitting and retrieval |
| `id` | `str \| None` | Optional unique identifier |

```python
from langchain_core.documents import Document

doc = Document(
    page_content="LangChain is a framework for building LLM applications.",
    metadata={"source": "docs", "page": 1, "author": "Harrison Chase"},
    id="doc-001",
)
```

### Blob

`from langchain_core.documents import Blob`

Raw bytes/path abstraction for binary loaders — decouples file reading from parsing.

| Method | Returns | Notes |
|---|---|---|
| `Blob.from_path(path, *, encoding="utf-8", mime_type=None, guess_type=True)` | `Blob` | Reads from filesystem path |
| `Blob.from_data(data, *, encoding="utf-8", mime_type=None, path=None)` | `Blob` | From in-memory bytes or string |
| `.as_bytes()` | `bytes` | Raw byte content |
| `.as_string()` | `str` | Decoded string content |
| `.source` | `str \| None` | Original file path if loaded from disk |

```python
from langchain_core.documents import Blob

blob = Blob.from_path("/path/to/document.pdf")
raw_bytes: bytes = blob.as_bytes()

blob_from_data = Blob.from_data(b"<binary content>", mime_type="application/pdf")
```

---

## BaseLoader Interface

`from langchain_core.document_loaders import BaseLoader`

| Method | Returns | Notes |
|---|---|---|
| `load()` | `list[Document]` | Eager — loads all documents into memory |
| `lazy_load()` | `Iterator[Document]` | Streams one document at a time; bounded memory |
| `alazy_load()` | `AsyncIterator[Document]` | Async streaming |
| `aload()` | `list[Document]` | Async eager |
| `load_and_split(text_splitter=None)` | `list[Document]` | Convenience; chains load + split |

> **Rule:** use `lazy_load()` for large corpora (PDF repositories, web crawls) to bound memory;
> use `load()` only when you need all documents before processing.

```python
from langchain_community.document_loaders import PyPDFLoader
import asyncio


def process_large_pdf(path: str) -> list[str]:
    loader = PyPDFLoader(path)
    contents = []
    for doc in loader.lazy_load():   # one page at a time
        contents.append(doc.page_content)
    return contents


async def process_large_pdf_async(path: str) -> list[str]:
    loader = PyPDFLoader(path)
    contents = []
    async for doc in loader.alazy_load():
        contents.append(doc.page_content)
    return contents
```

### Common loaders and their packages

| Loader | Import | Stays in |
|---|---|---|
| `PyPDFLoader` | `langchain_community.document_loaders` | `langchain-community` |
| `WebBaseLoader` | `langchain_community.document_loaders` | `langchain-community` |
| `CSVLoader` | `langchain_community.document_loaders` | `langchain-community` |
| `TextLoader` | `langchain_community.document_loaders` | `langchain-community` |
| `DirectoryLoader` | `langchain_community.document_loaders` | `langchain-community` |
| `GoogleDriveLoader` | `langchain_google_community.document_loaders` | `langchain-google-community` |
| `BigQueryLoader` | `langchain_google_community.document_loaders` | `langchain-google-community` |
| Unstructured loaders | `langchain_unstructured` | `langchain-unstructured` |

PDF loaders typically yield one `Document` per page with `metadata["page"]` = page number.

---

## Text Splitters

`from langchain_text_splitters import (RecursiveCharacterTextSplitter, Language,
CharacterTextSplitter, TokenTextSplitter, MarkdownHeaderTextSplitter,
HTMLHeaderTextSplitter)`

### Splitter comparison table

| Splitter | Splits on | Use when |
|---|---|---|
| `RecursiveCharacterTextSplitter` | Hierarchical separators (`\n\n`, `\n`, ` `, `""`) | General purpose; default choice |
| `CharacterTextSplitter` | Single separator (default `\n\n`) | Simple uniform text |
| `TokenTextSplitter` | Token boundaries (tiktoken / HuggingFace) | Need token-accurate chunk sizes for a specific model |
| `MarkdownHeaderTextSplitter` | Markdown headings (`#`, `##`, etc.) | Preserving document structure in metadata |
| `HTMLHeaderTextSplitter` | HTML header tags | Preserving structure from web content |
| `SemanticChunker` | Embedding-distance threshold | Semantic coherence within chunks; see §SemanticChunker |

### RecursiveCharacterTextSplitter

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language
from langchain_core.documents import Document

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=100,
    separators=["\n\n", "\n", " ", ""],  # tried in order; recurses on finer separators
    length_function=len,
    is_separator_regex=False,
)

# From plain text
chunks: list[str] = splitter.split_text("Long document text here...")

# From Documents — preserves metadata
docs: list[Document] = splitter.split_documents([
    Document(page_content="Long document...", metadata={"source": "file.txt"}),
])

# Also: create_documents for creating Documents from text strings
docs2: list[Document] = splitter.create_documents(
    texts=["text1", "text2"],
    metadatas=[{"source": "a"}, {"source": "b"}],
)
```

Default separators `["\n\n", "\n", " ", ""]` are tried in order; the splitter recurses to
finer separators only when a chunk still exceeds `chunk_size` after splitting on coarser ones.

### Language-specific separators

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language

# 24 languages: PYTHON, JS, TS, MARKDOWN, HTML, SOL, RUST, GO, CPP, JAVA, ...
python_splitter = RecursiveCharacterTextSplitter.from_language(
    language=Language.PYTHON,
    chunk_size=500,
    chunk_overlap=50,
)

# Inspect the separators for any language
separators = RecursiveCharacterTextSplitter.get_separators_for_language(Language.PYTHON)
# ["\nclass ", "\ndef ", "\n\tdef ", "\n\n", "\n", " ", ""]
```

### TokenTextSplitter

```python
from langchain_text_splitters import TokenTextSplitter

# tiktoken — matches OpenAI model tokenizer
token_splitter = TokenTextSplitter(
    encoding_name="cl100k_base",   # or: model_name="gpt-4o"
    chunk_size=512,
    chunk_overlap=50,
)
chunks = token_splitter.split_text("Long document text...")

# HuggingFace tokenizer
from transformers import AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
hf_splitter = RecursiveCharacterTextSplitter.from_huggingface_tokenizer(
    tokenizer,
    chunk_size=256,
    chunk_overlap=30,
)
```

> **Gotcha:** token splitters measure chunk size in tokens, not characters. A `chunk_size=1000`
> tuned for characters produces very different chunks in tokens (roughly 1000 chars ≈ 250 tokens
> for English prose). Token counts also won't match a non-OpenAI model's tokenizer even when
> using tiktoken.

### MarkdownHeaderTextSplitter

```python
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from langchain_core.documents import Document

headers_to_split_on = [
    ("#",   "h1"),
    ("##",  "h2"),
    ("###", "h3"),
]

md_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
header_splits: list[Document] = md_splitter.split_text(markdown_content)
# Each Document's metadata carries: {"h1": "...", "h2": "...", "h3": "..."}

# Chain into size-capping splitter
char_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
final_docs = char_splitter.split_documents(header_splits)
```

### HTMLHeaderTextSplitter

```python
from langchain_text_splitters import HTMLHeaderTextSplitter

html_splitter = HTMLHeaderTextSplitter(
    headers_to_split_on=[("h1", "Header 1"), ("h2", "Header 2"), ("h3", "Header 3")]
)
docs = html_splitter.split_text(html_content)
# metadata carries {"Header 1": "...", "Header 2": "...", ...}
```

---

## SemanticChunker

`from langchain_experimental.text_splitter import SemanticChunker`

Embedding-based splitting: splits where consecutive-sentence embedding distance exceeds a
threshold. Lives in `langchain-experimental`, not core.

### Breakpoint threshold types

| Type | Behaviour | Use when |
|---|---|---|
| `"percentile"` (default) | Splits at distances above the Nth percentile | General purpose |
| `"standard_deviation"` | Splits at distances above mean + N×std | Normally distributed distances |
| `"interquartile"` | Splits at distances above Q3 + N×IQR | Outlier-robust |
| `"gradient"` | Splits at largest gradient change points | Detecting sharp topic shifts |

```python
from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

semantic_splitter = SemanticChunker(
    embeddings=embeddings,
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=95,  # percentile above which to split
)

docs = semantic_splitter.create_documents([long_text])
```

> **Gotcha:** `SemanticChunker` makes one embedding call per sentence pair — it is much more
> expensive than character/token splitters. Only use when semantic coherence within chunks
> justifiably improves downstream retrieval quality.

---

## Embeddings Interface

`from langchain_core.embeddings import Embeddings`

| Method | Signature | Returns |
|---|---|---|
| `embed_documents` | `embed_documents(texts: list[str]) -> list[list[float]]` | List of embedding vectors |
| `embed_query` | `embed_query(text: str) -> list[float]` | Single embedding vector |
| `aembed_documents` | `async aembed_documents(texts: list[str]) -> list[list[float]]` | Async documents |
| `aembed_query` | `async aembed_query(text: str) -> list[float]` | Async query |

### init_embeddings

`from langchain.embeddings import init_embeddings` — mirrors `init_chat_model`:

```python
from langchain.embeddings import init_embeddings

embedder = init_embeddings("openai:text-embedding-3-large")
vectors = embedder.embed_documents(["Hello", "World"])
query_vec = embedder.embed_query("What is LangChain?")
```

---

## CacheBackedEmbeddings

Moved to `langchain-classic`: `from langchain_classic.embeddings import CacheBackedEmbeddings`.
Byte stores: `from langchain_classic.storage import LocalFileStore, InMemoryByteStore`
(core also exposes `from langchain_core.stores import InMemoryByteStore`).

### from_bytes_store parameters

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `underlying_embedder` | `Embeddings` | required | The actual embedding model |
| `document_embedding_cache` | `ByteStore` | required | Where to cache document embeddings |
| `batch_size` | `int` | `512` | Embeddings batched this many at a time |
| `namespace` | `str` | `""` | Prefix to avoid cross-model collisions — use model name |
| `query_embedding_cache` | `bool \| ByteStore` | `False` | `True` reuses doc store; pass separate store for isolation |
| `key_encoder` | `str \| Callable` | `"sha1"` | `"sha1"` \| `"blake2b"` \| `"sha256"` \| `"sha512"` \| callable |

> **⚠️ Key encoder:** `"sha1"` is the default but is not collision-resistant. Use `"sha256"` in
> production to avoid rare key collisions across very large document corpora.

### ByteStore backends

| Backend | Import | Use when |
|---|---|---|
| `InMemoryByteStore` | `langchain_core.stores` or `langchain_classic.storage` | Testing; ephemeral per-process cache |
| `LocalFileStore` | `langchain_classic.storage` | Development; persistent on local disk |
| `RedisByteStore` | `langchain_community.storage` | Production; shared across processes |
| Postgres / cloud stores | provider-specific | Production; durable shared cache |

```python
from langchain_classic.embeddings import CacheBackedEmbeddings
from langchain_classic.storage import InMemoryByteStore, LocalFileStore
from langchain_openai import OpenAIEmbeddings

underlying = OpenAIEmbeddings(model="text-embedding-3-small")

# Development — in-memory (lost on process restart)
dev_cache = CacheBackedEmbeddings.from_bytes_store(
    underlying_embedder=underlying,
    document_embedding_cache=InMemoryByteStore(),
    namespace=underlying.model,          # "text-embedding-3-small" — prevents cross-model collision
    batch_size=64,
    query_embedding_cache=True,          # also cache query embeddings
    key_encoder="sha256",                # collision-resistant
)

# Production — local disk (persistent)
prod_cache = CacheBackedEmbeddings.from_bytes_store(
    underlying_embedder=underlying,
    document_embedding_cache=LocalFileStore("/tmp/embedding-cache"),
    namespace=underlying.model,
    batch_size=64,
    query_embedding_cache=False,         # queries are cheap to re-embed; save cache space
    key_encoder="sha256",
)

# Use exactly like a regular Embeddings object
vectors = prod_cache.embed_documents(["LangChain is powerful", "Python is great"])
query_vec = prod_cache.embed_query("What is LangChain?")
```

### Full RAG ingestion pipeline with caching

```python
from langchain_classic.embeddings import CacheBackedEmbeddings
from langchain_classic.storage import LocalFileStore
from langchain_openai import OpenAIEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma


def build_vector_store(pdf_path: str, persist_dir: str) -> Chroma:
    # Loader — lazy to bound memory
    loader = PyPDFLoader(pdf_path)
    docs = list(loader.lazy_load())

    # Splitter
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = splitter.split_documents(docs)

    # Embeddings with cache
    underlying = OpenAIEmbeddings(model="text-embedding-3-small")
    cached_embedder = CacheBackedEmbeddings.from_bytes_store(
        underlying_embedder=underlying,
        document_embedding_cache=LocalFileStore(f"{persist_dir}/embed-cache"),
        namespace=underlying.model,
        key_encoder="sha256",
    )

    # Vector store
    vs = Chroma.from_documents(
        documents=chunks,
        embedding=cached_embedder,
        persist_directory=persist_dir,
    )
    return vs
```

---

## Document Transformers

`from langchain_community.document_transformers import EmbeddingsRedundantFilter, LongContextReorder`

| Transformer | Behaviour | Use when |
|---|---|---|
| `EmbeddingsRedundantFilter(embeddings=...)` | Drops near-duplicate chunks by cosine similarity | De-duplicating retrieved results from multiple sources |
| `LongContextReorder()` | Reorders docs to place most-relevant at start and end | Mitigating "lost in the middle" degradation on long context |

```python
from langchain_community.document_transformers import (
    EmbeddingsRedundantFilter,
    LongContextReorder,
)
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Filter near-duplicates (cosine similarity > threshold)
redundancy_filter = EmbeddingsRedundantFilter(
    embeddings=embeddings,
    similarity_threshold=0.95,
)

docs = [
    Document(page_content="LangChain is a framework for LLM apps."),
    Document(page_content="LangChain is a framework for building LLM applications."),  # near-duplicate
    Document(page_content="Python is a popular programming language."),
]

filtered = redundancy_filter.transform_documents(docs)
# Drops the near-duplicate; keeps 2 docs

# Reorder for long-context models
reorder = LongContextReorder()
reordered = reorder.transform_documents(filtered)
```

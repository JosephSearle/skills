# Chunking Reference — Text Splitters, Semantic Chunking, Parent-Child

## Chunking Strategy Decision Table

| Content type | Recommended splitter | chunk_size | chunk_overlap | Notes |
|---|---|---|---|---|
| General prose (articles, docs) | `RecursiveCharacterTextSplitter.from_tiktoken_encoder` | 512 tokens | 64 tokens | Token-based; maps directly to model context budgets |
| Technical prose with headers | `MarkdownHeaderTextSplitter` → RCTS per section | 512 tokens | 64 tokens | Header hierarchy preserved in metadata |
| Source code | `RecursiveCharacterTextSplitter.from_language(Language.X)` | 200 tokens | 0 | Language-specific separators; overlap=0 for code |
| HTML web pages | `HTMLHeaderTextSplitter` → RCTS per section | 512 tokens | 64 tokens | Header-tag hierarchy in metadata |
| Policy / research (precision-critical) | `SemanticChunker` | meaning-based | none (boundary-based) | Expensive: embeds every sentence; `langchain_experimental` |
| Large docs needing precise retrieval + full context | `ParentDocumentRetriever` pattern (small child + large parent) | child: 200–400 | child: 0–20 | Returns parent on retrieval; docstore required |

**Default for any new pipeline:** `RecursiveCharacterTextSplitter.from_tiktoken_encoder(chunk_size=512, chunk_overlap=64)`.

---

## RecursiveCharacterTextSplitter

### API Surface

| Param | Type | Default | Notes |
|---|---|---|---|
| `chunk_size` | `int` | 4000 | Characters (default) or tokens when using `from_tiktoken_encoder` |
| `chunk_overlap` | `int` | 200 | Set 10–20% of `chunk_size` for prose; 0 for code/structured content |
| `separators` | `list[str]` | `["\n\n", "\n", " ", ""]` | Tried in order; falls back to next on oversize |
| `length_function` | `Callable` | `len` | Override with tokeniser for token-based splitting |
| `add_start_index` | `bool` | `False` | Adds `start_index` key to each chunk's metadata |
| `keep_separator` | `bool` | `False` | Retains separator char at start/end of each chunk |

### Prose Splitting (Token-Based)

```python
from __future__ import annotations

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    encoding_name="cl100k_base",   # OpenAI's encoding for text-embedding-3-* and GPT-4
    chunk_size=512,
    chunk_overlap=64,
    add_start_index=True,          # metadata["start_index"] = char offset in original doc
)

docs: list[Document] = [
    Document(page_content="Long article text...", metadata={"source": "article_001.txt"})
]
chunks: list[Document] = splitter.split_documents(docs)
# Each chunk.metadata carries forward the parent's metadata + "start_index"
```

> **⚠️ Character vs token sizing:** `RecursiveCharacterTextSplitter()` without `from_tiktoken_encoder`
> measures `chunk_size` in **characters**, not tokens. A 512-character chunk is roughly 100–150 tokens
> for English prose — far smaller than intended. Always use `from_tiktoken_encoder` for token-budget-aware splitting.

### Code-Aware Splitting

```python
from __future__ import annotations

from langchain_text_splitters import Language, RecursiveCharacterTextSplitter
from langchain_core.documents import Document

# Language enum covers: cpp, go, java, kotlin, js, ts, php, proto, python,
# rst, ruby, rust, scala, swift, markdown, latex, html, sol, csharp,
# cobol, c, lua, perl, haskell, VISUALBASIC6 (24 total)
py_splitter = RecursiveCharacterTextSplitter.from_language(
    language=Language.PYTHON,
    chunk_size=200,      # tokens
    chunk_overlap=0,     # class/function boundaries are already clean separators
)

code_doc = Document(
    page_content='def foo():\n    return 1\n\nclass Bar:\n    pass',
    metadata={"source": "mymodule.py", "language": "python"},
)
chunks: list[Document] = py_splitter.split_documents([code_doc])
```

---

## TokenTextSplitter

### API Surface

| Param | Type | Default | Notes |
|---|---|---|---|
| `encoding_name` | `str` | `"gpt2"` | tiktoken encoding name; use `"cl100k_base"` for OpenAI models |
| `model_name` | `str` | `None` | Alternative to `encoding_name`; derives encoding from model |
| `chunk_size` | `int` | 4000 | In **tokens** |
| `chunk_overlap` | `int` | 200 | In **tokens** |
| `allowed_special` | `set[str]` | `set()` | Special tokens to allow without error |
| `disallowed_special` | `set[str] \| Literal["all"]` | `"all"` | Special tokens that raise on encounter |

```python
from __future__ import annotations

from langchain_text_splitters import TokenTextSplitter
from langchain_core.documents import Document

# Preferred over RCTS when you need hard token-count guarantees
splitter = TokenTextSplitter(
    encoding_name="cl100k_base",
    chunk_size=512,
    chunk_overlap=64,
)

docs: list[Document] = [Document(page_content="...", metadata={"source": "doc.txt"})]
chunks: list[Document] = splitter.split_documents(docs)
```

> **⚠️ HuggingFace tokenisers:** `TokenTextSplitter` supports HuggingFace tokenisers via
> `from_huggingface_tokenizer(tokenizer)`. If your embedding model uses a different vocabulary
> (e.g., `sentence-transformers/all-MiniLM-L6-v2`), use that model's tokeniser to get accurate
> token counts — tiktoken and HF tokenisers produce different token counts for the same text.

---

## MarkdownHeaderTextSplitter

Splits Markdown on header hierarchy and stores header values in metadata.
Use `strip_headers=False` to retain header text inside chunk content.

### API Surface

| Param | Type | Default | Notes |
|---|---|---|---|
| `headers_to_split_on` | `list[tuple[str, str]]` | required | e.g., `[("#", "Header 1"), ("##", "Header 2")]` |
| `strip_headers` | `bool` | `True` | If `False`, header lines remain in chunk content |
| `return_each_line` | `bool` | `False` | Return each line as its own document (rarely useful) |

```python
from __future__ import annotations

from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from langchain_core.documents import Document

HEADERS = [
    ("#", "Header 1"),
    ("##", "Header 2"),
    ("###", "Header 3"),
]

md_splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on=HEADERS,
    strip_headers=False,   # keep headers in content so context is self-contained
)

markdown_text = """
# Architecture

## Storage Layer

### PGVectorStore
Use PGVectorStore for Postgres-backed vector search.

### Qdrant
Use Qdrant for best-in-class hybrid search.

## Retrieval Layer
...
"""

# Step 1: split by headers → sections with metadata
sections: list[Document] = md_splitter.split_text(markdown_text)
# sections[0].metadata = {"Header 1": "Architecture", "Header 2": "Storage Layer", "Header 3": "PGVectorStore"}

# Step 2: further split oversized sections on token boundaries
token_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    encoding_name="cl100k_base",
    chunk_size=512,
    chunk_overlap=64,
)
chunks: list[Document] = token_splitter.split_documents(sections)
# Each chunk carries the full header metadata from step 1
```

---

## HTMLHeaderTextSplitter

```python
from __future__ import annotations

from langchain_text_splitters import HTMLHeaderTextSplitter, RecursiveCharacterTextSplitter
from langchain_core.documents import Document

html_splitter = HTMLHeaderTextSplitter(
    headers_to_split_on=[
        ("h1", "Header 1"),
        ("h2", "Header 2"),
        ("h3", "Header 3"),
    ]
)

url = "https://docs.example.com/api"
sections: list[Document] = html_splitter.split_text_from_url(url)
# or: html_splitter.split_text(raw_html_string)

# Then token-split each section
token_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    encoding_name="cl100k_base", chunk_size=512, chunk_overlap=64
)
chunks: list[Document] = token_splitter.split_documents(sections)
```

---

## SemanticChunker

> **⚠️ langchain_experimental:** `SemanticChunker` lives in the `langchain_experimental`
> package. The API may change between minor releases without a deprecation period.
> Pin the version in `pyproject.toml` and audit on upgrade.

Splits text by sentence, embeds every sentence, then merges adjacent sentences where
embedding similarity is high — drawing chunk boundaries where similarity drops sharply.
Does not use a fixed overlap because boundaries are meaning-based.

**Cost:** embeds every sentence individually. For a 100-page document this can be
100–500 embedding API calls. Use only for precision-sensitive corpora.

### API Surface

| Param | Type | Default | Notes |
|---|---|---|---|
| `embeddings` | `Embeddings` | required | Any LangChain-compatible embeddings object |
| `breakpoint_threshold_type` | `str` | `"percentile"` | `"percentile"`, `"standard_deviation"`, `"interquartile"`, `"gradient"` |
| `breakpoint_threshold_amount` | `float` | type-dependent | 95 = only top 5% similarity drops → boundaries (percentile mode) |
| `buffer_size` | `int` | 1 | Sentences on each side of a split to include for context |
| `number_of_chunks` | `int \| None` | `None` | Force a target number of chunks instead of threshold-based splitting |
| `min_chunk_size` | `int \| None` | `None` | Minimum character count per chunk |
| `sentence_split_regex` | `str` | `r"(?<=[.?!])\s+"` | Regex used to tokenise sentences before embedding |

### Breakpoint Threshold Types

| Type | Description | `breakpoint_threshold_amount` guidance |
|---|---|---|
| `"percentile"` | Split where drop in similarity is in the top N% across all drops | 90–95: fewer, larger chunks; 70–80: more, smaller chunks |
| `"standard_deviation"` | Split where drop exceeds mean + N × std_dev | 1.0–2.0: 1.5 is a common starting point |
| `"interquartile"` | Split where drop exceeds Q3 + N × IQR | 1.0–1.5 |
| `"gradient"` | Splits on gradient of cosine distances | Same scale as percentile |

```python
from __future__ import annotations

from langchain_experimental.text_splitter import SemanticChunker
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

chunker = SemanticChunker(
    embeddings,
    breakpoint_threshold_type="percentile",
    breakpoint_threshold_amount=95,   # only the top 5% of similarity drops become boundaries
    buffer_size=1,
    min_chunk_size=100,               # avoid tiny orphan chunks
)

docs: list[Document] = [
    Document(
        page_content=(
            "The policy requires two-factor authentication. "
            "All user data is encrypted at rest. "
            "Incident response must begin within 4 hours. "
            "The refund policy allows returns within 30 days. "
            "Customer support is available 24/7."
        ),
        metadata={"source": "policy_v2.txt"},
    )
]

chunks: list[Document] = chunker.split_documents(docs)
# Boundaries form between semantically distinct topic switches
```

---

## Parent-Child Chunking (ParentDocumentRetriever)

Small child chunks are embedded and indexed for precise vector retrieval.
Large parent chunks (or the full document) are stored in a docstore and
returned to the LLM at generation time for full context.

```python
from __future__ import annotations

import asyncio
from langchain.retrievers import ParentDocumentRetriever
from langchain.storage import InMemoryStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_qdrant import QdrantVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

# ── Vector store for small child chunks ─────────────────────────────────────
client = QdrantClient(url="http://localhost:6333")
client.recreate_collection(
    collection_name="child_chunks",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)
vector_store = QdrantVectorStore(
    client=client,
    collection_name="child_chunks",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)

# ── Docstore for parent documents ────────────────────────────────────────────
# InMemoryStore for development; replace with a persistent store for production
# (e.g., langchain_community.storage.RedisStore or a custom SQL-backed store)
docstore = InMemoryStore()

# ── Splitters ────────────────────────────────────────────────────────────────
parent_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    encoding_name="cl100k_base",
    chunk_size=2000,     # large context chunks returned to the LLM
    chunk_overlap=200,
)
child_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    encoding_name="cl100k_base",
    chunk_size=200,      # small chunks for precise embedding retrieval
    chunk_overlap=0,
)

# ── Retriever ────────────────────────────────────────────────────────────────
retriever = ParentDocumentRetriever(
    vectorstore=vector_store,
    docstore=docstore,
    child_splitter=child_splitter,
    parent_splitter=parent_splitter,  # omit to use full documents as parents
)

# ── Ingest ────────────────────────────────────────────────────────────────────
docs: list[Document] = [
    Document(page_content="Long document content...", metadata={"source": "doc_001.txt"})
]
retriever.add_documents(docs)

# ── Retrieve (returns parent-sized chunks, not child chunks) ─────────────────
results: list[Document] = retriever.invoke("What is the refund policy?")
# results[0] is a parent (2000-token) chunk, not the 200-token child
```

> **⚠️ Docstore persistence:** `InMemoryStore` is ephemeral — lost on process restart.
> For production, use a persistent docstore. `langchain_community.storage.RedisStore`,
> or a custom implementation backed by Postgres/SQLite via `langchain_community.storage.EncoderBackedStore`.

---

## Chunk Overlap Guidance

| Content | Recommended overlap | Rationale |
|---|---|---|
| Prose (articles, manuals) | 10–20% of `chunk_size` | Answers spanning a boundary remain retrievable; the repeated tokens cost little at embedding time |
| Structured documents (JSON, tables) | 0 | Boundaries are already semantically clean; overlap injects confusing repeated rows |
| Source code | 0 | `from_language()` splits on class/function boundaries; overlap would duplicate function signatures |
| Semantic chunks | N/A | Boundaries are meaning-based; overlap concept does not apply |

---

## Production Gotchas

| Gotcha | Detail |
|---|---|
| `from_tiktoken_encoder` doesn't guarantee hard token limits | RCTS may slightly exceed `chunk_size` if the only separator available is `""` (character-level). Add a post-split assertion if hard limits are required. |
| `SemanticChunker` API is unstable | Lives in `langchain_experimental`. Pin version; audit on upgrade. No fixed overlap means adjacent chunks may share no context at boundaries. |
| `MarkdownHeaderTextSplitter` on non-standard Markdown | Headers must be at the start of a line with a space after `#`. ATX-style only (not setext `===` underlines). |
| `ParentDocumentRetriever` docstore is in-memory by default | `InMemoryStore` is lost on restart. Always swap to a persistent store before production deployment. |
| Metadata propagation | `split_documents()` copies parent metadata to all child chunks. If metadata is large (e.g., full HTML), this multiplies storage. Strip unnecessary keys before splitting. |
| Token encoding mismatch | Using `cl100k_base` for `text-embedding-3-small` is correct. For other providers (Cohere, HuggingFace), derive encoding from the actual model. |

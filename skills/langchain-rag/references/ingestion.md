# Ingestion Reference — SQLRecordManager, index/aindex, Parallel Ingestion

## Pipeline Overview

```
Raw source files
    ↓  BaseLoader / alazy_load()
Document objects (page_content + metadata)
    ↓  TextSplitter
Chunks (smaller Document objects)
    ↓  Embeddings model
Float vectors
    ↓  VectorStore.aadd_documents()
Vector store rows  ←→  SQLRecordManager (SHA-1 hashes, timestamps, source IDs)
```

The `SQLRecordManager` sits alongside the vector store and tracks which chunk hashes
have been ingested, enabling idempotent re-ingestion without rebuilding the entire corpus.

---

## SQLRecordManager — Setup

### API Surface

| Class / Function | Import path | Key params | Returns |
|---|---|---|---|
| `SQLRecordManager` | `langchain.indexes` | `namespace: str`, `db_url: str` | `SQLRecordManager` |
| `create_schema()` | method on `SQLRecordManager` | — | `None` |
| `index()` | `langchain.indexes` | `docs_source`, `record_manager`, `vector_store`, `cleanup`, `source_id_key`, `batch_size` | `IndexingResult` dict |
| `aindex()` | `langchain.indexes` | same as `index()` plus `cleanup_batch_size: int = 1000`, `key_encoder: str = 'sha1'` | `IndexingResult` dict (awaitable) |

### Namespace Convention

```
<vendor>/<collection>
```

Examples: `"postgres/my_docs"`, `"pinecone/product-kb"`, `"qdrant/support-tickets"`.
The namespace scopes hash lookups — two collections sharing a namespace will conflict.

### Complete Setup Example

```python
from __future__ import annotations

import asyncio
from langchain.indexes import SQLRecordManager, aindex
from langchain_postgres import PGEngine, PGVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

# ── 1. Connect to vector store ──────────────────────────────────────────────
engine = PGEngine.from_connection_string(
    url="postgresql+psycopg://langchain:langchain@localhost:5432/langchain"
)

async def setup() -> PGVectorStore:
    await engine.ainit_vectorstore_table(
        table_name="my_docs",
        vector_size=1536,
    )
    return await PGVectorStore.create(
        engine=engine,
        table_name="my_docs",
        embedding_service=OpenAIEmbeddings(model="text-embedding-3-small"),
    )

# ── 2. Create RecordManager ──────────────────────────────────────────────────
namespace = "postgres/my_docs"
record_manager = SQLRecordManager(
    namespace,
    db_url="postgresql+psycopg://langchain:langchain@localhost:5432/langchain",
)
record_manager.create_schema()   # idempotent — safe to call on every startup

# ── 3. Index documents ───────────────────────────────────────────────────────
async def ingest(docs: list[Document], vector_store: PGVectorStore) -> dict:
    result = await aindex(
        docs,
        record_manager,
        vector_store,
        cleanup="incremental",
        source_id_key="source",   # metadata key; must be present on every Document
        batch_size=100,
    )
    # result: {"num_added": int, "num_updated": int, "num_skipped": int, "num_deleted": int}
    return result
```

---

## Cleanup Modes

| Mode | What it does | When to use | Caveats |
|---|---|---|---|
| `None` | De-duplicates only. Never deletes anything. | Append-only corpora; no document deletions expected. | Stale chunks accumulate if sources are deleted. |
| `"incremental"` | Continuously cleans obsolete chunks from the same source as new versions arrive. Minimises the window during which old and new chunks co-exist. Requires `source_id_key`. | Continuous pipelines, streaming ingestion, file-watcher triggers. | Does NOT delete docs whose source was fully removed from the input corpus. Manual sweep needed for deletions. |
| `"full"` | After indexing the entire batch, deletes every chunk not present in the current run. The only mode that handles source-document deletions. | Periodic full reconciliation jobs (nightly/weekly). | Loader must return the complete current corpus on every run — partial batch causes deletions of valid chunks. |
| `"scoped_full"` | Like `"full"` but tracks seen source IDs in memory rather than requiring the entire dataset in one call. | Large corpora where a single batch is impractical; variable-size chunks across runs. | Higher memory use per run; still does not stream cleanup continuously like `"incremental"`. |

### Choosing Cleanup Mode

```
Is the source corpus ever deleted or renamed?
  └─ YES → do you process the full corpus each run?
       ├─ YES  → "full"
       └─ NO   → "scoped_full"
  └─ NO  → "incremental" (continuous pipelines)
           or None (append-only, dedup only)
```

---

## index() and aindex() — Full Signatures

```python
def index(
    docs_source: BaseLoader | Iterable[Document],
    record_manager: RecordManager,
    vector_store: VectorStore,
    *,
    cleanup: Literal[None, "incremental", "full", "scoped_full"] = None,
    source_id_key: str | Callable[[Document], str] = "source",
    batch_size: int = 100,
    cleanup_batch_size: int = 1000,
    force_update: bool = False,
) -> IndexingResult: ...

async def aindex(
    docs_source: BaseLoader | Iterable[Document] | AsyncIterator[Document],
    record_manager: RecordManager,
    vector_store: VectorStore,
    *,
    cleanup: Literal[None, "incremental", "full", "scoped_full"] = None,
    source_id_key: str | Callable[[Document], str] = "source",
    batch_size: int = 100,
    cleanup_batch_size: int = 1000,
    force_update: bool = False,
    key_encoder: Literal["sha1", "sha256", "sha512", "blake2b"] = "sha1",
) -> IndexingResult: ...
```

`IndexingResult` is a `TypedDict`:
```python
class IndexingResult(TypedDict):
    num_added: int
    num_updated: int
    num_skipped: int
    num_deleted: int
```

---

## Async Lazy Loading — alazy_load()

`BaseLoader.alazy_load()` streams one `Document` at a time as an `AsyncIterator[Document]`.
The default implementation wraps the synchronous `lazy_load()` in `run_in_executor` so
every loader automatically supports the async path without O(corpus) memory allocation.

```python
from __future__ import annotations

import asyncio
from langchain_community.document_loaders import DirectoryLoader
from langchain.indexes import SQLRecordManager, aindex
from langchain_postgres import PGVectorStore
from langchain_openai import OpenAIEmbeddings

async def stream_ingest(directory: str, vector_store: PGVectorStore) -> dict:
    namespace = "postgres/my_docs"
    record_manager = SQLRecordManager(
        namespace,
        db_url="postgresql+psycopg://langchain:langchain@localhost:5432/langchain",
    )
    record_manager.create_schema()

    loader = DirectoryLoader(directory, glob="**/*.md", show_progress=True)

    # aindex accepts AsyncIterator[Document] — streams without materialising corpus
    result = await aindex(
        loader.alazy_load(),   # AsyncIterator[Document]
        record_manager,
        vector_store,
        cleanup="incremental",
        source_id_key="source",
        batch_size=100,
    )
    return result
```

---

## Idempotency Caveats

| Caveat | Detail | Mitigation |
|---|---|---|
| Pre-populated store | RecordManager has no knowledge of chunks inserted outside the indexing API. Calling `index()` on such a store will re-insert (or skip, if hashes match by chance). | Always use `index()`/`aindex()` from day one. If migrating, wipe and re-ingest. |
| Same-clock-tick race | Two indexing runs that complete within the same wall-clock tick produce identical timestamps; the cleanup logic may skip deletion of stale chunks from the first run. | Run at intervals longer than your system clock resolution (≥1 s). |
| Incremental + multi-batch source | A single source's chunks spread across multiple batches causes redundant hash checks (but correct results). | "Select as big a batch size as possible" — Langchain docs. |
| `source_id_key` missing | If any `Document` in the batch lacks the `source_id_key` metadata field, `index()` raises `ValueError`. | Validate all documents before passing to `index()`. |
| `"full"` with partial loader | If the loader only returns a subset of documents, `"full"` mode deletes the rest. | Only use `"full"` when the loader is guaranteed to return the complete corpus. |

---

## Parallel Ingestion with asyncio.Semaphore

Rate limits on embedding APIs require bounded concurrency. Use `asyncio.Semaphore` to
cap simultaneous embedding requests while still ingesting in parallel batches.

```python
from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import AsyncQdrantClient

EMBED_CONCURRENCY = 4   # tune to your OpenAI tier RPM limit
CHUNK_BATCH = 200       # chunks per upsert batch


async def load_source(path: str) -> list[Document]:
    """Return documents from a single source file."""
    from langchain_community.document_loaders import UnstructuredFileLoader
    loader = UnstructuredFileLoader(path)
    return loader.load()


async def ingest_parallel(
    source_paths: list[str],
    vector_store: QdrantVectorStore,
) -> list[int]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=64)
    sem = asyncio.Semaphore(EMBED_CONCURRENCY)
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    async def process_source(path: str) -> int:
        async with sem:
            docs = await load_source(path)
            chunks = splitter.split_documents(docs)
            for chunk in chunks:
                chunk.metadata.setdefault("source", path)
            ids = await vector_store.aadd_documents(chunks)
            return len(ids)

    tasks = [asyncio.create_task(process_source(p)) for p in source_paths]
    return await asyncio.gather(*tasks)
```

---

## Per-Store Batch Size Limits

| Store | Default batch_size | Hard limit | Notes |
|---|---|---|---|
| Pinecone | 32 (langchain-pinecone `add_texts`) | 100 vectors / 2 MB per request | With integrated text embedding: **96 records/batch** (not 100). `embedding_chunk_size=1000`, `async_req=True` recommended for OpenAI embeddings. |
| Pinecone (integrated embedding) | — | **96 records/batch** | Drops from 100 due to embedded text overhead. |
| Elasticsearch | configurable | via `bulk_kwargs` | `add_texts(..., bulk_kwargs={"chunk_size": 50, "max_chunk_bytes": 200_000_000})` — tune down for ELSER/SparseVectorStrategy to avoid timeouts. |
| Qdrant | configurable | — | `batch_size` param on `aadd_documents`. Large local hybrid builds can be slow — start with 100. |
| PGVectorStore | 100 | — | `batch_size=100` in `aindex()`. |
| Redis | — | — | No explicit batch limit documented; match to pipeline throughput. |

---

## Production Gotchas

| Gotcha | Detail |
|---|---|
| `SQLRecordManager.create_schema()` must be called | Without it, `index()`/`aindex()` raises `OperationalError` — the `langchain_indexing_record_manager` table doesn't exist. Call it on every startup; it is idempotent. |
| `cleanup="incremental"` does not handle deletions | If a source file is deleted from disk but the loader doesn't return it, incremental mode leaves its chunks in the store. Switch to `"full"` or `"scoped_full"` for corpora with deletions. |
| Different `namespace` = different deduplication scope | Using `"postgres/docs_v1"` vs `"postgres/docs_v2"` for the same physical table = two independent dedup scopes. All reruns must use the same namespace. |
| `key_encoder` default is SHA-1 | Collision probability is negligible for typical corpora but the algorithm is cryptographically weak. Use `"sha256"` for compliance-sensitive environments. |
| RecordManager DB ≠ vector store DB | The `db_url` in `SQLRecordManager` is an independent SQLite or Postgres connection. It can point to the same Postgres DB as PGVectorStore or a separate SQLite file — either is valid. SQLite is fine for single-process pipelines; use Postgres for multi-process/distributed ingestion workers. |

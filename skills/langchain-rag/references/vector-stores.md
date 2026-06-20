# Vector Stores Reference — Per-Provider Production Guide

## Store Selection Summary

| Store | Hybrid | Multi-tenancy | Self-host / Managed | Scale ceiling | LangGraph checkpoint |
|---|---|---|---|---|---|
| PGVectorStore | Yes (tsvector + RRF/weighted) | schema / typed column filter | Self-host | Tens of millions | Postgres checkpointer |
| Pinecone | Sparse index (separate) | Namespaces | Managed only | Billions | — |
| Chroma | **No** | Collection | Local / Cloud | **Small — dev only** | — |
| Weaviate | Yes (`alpha` param) | Native tenants | Both | Large | — |
| Qdrant | Yes (RRF / DBSF) | Payload / collection | Both | Large | — |
| Milvus | Yes (BM25 native) | Partition key | Both / Zilliz | Very large | — |
| MongoDB Atlas | Yes (RRF) | DB / collection | Managed | Large | `langgraph-checkpoint-mongodb` |
| Elasticsearch | Yes (RRF 8.x) | Index | Both | Very large | — |
| Redis | Via filters only | Logical / prefix | Both | RAM-bound | Redis checkpointer |

---

## PGVectorStore + PGEngine (langchain-postgres)

> **⚠️ v0.0.14+: `PGVector` is deprecated.** The old `langchain_community.vectorstores.PGVector`
> and the early `langchain_postgres.PGVector` (2-table layout with a separate collections table)
> are deprecated as of `langchain-postgres 0.0.14`. Always use `PGVectorStore + PGEngine`.
> Migration guide: [langchain-ai/langchain-postgres#migration](https://github.com/langchain-ai/langchain-postgres)
> — old data in the 2-table layout must be migrated.

### Install

```bash
uv add langchain-postgres "psycopg[binary,pool]"
```

### Import paths

| Class | Import |
|---|---|
| `PGEngine` | `from langchain_postgres import PGEngine` |
| `PGVectorStore` | `from langchain_postgres import PGVectorStore` |
| `HNSWIndex` | `from langchain_postgres.v2.indexes import HNSWIndex` |
| `IVFFlatIndex` | `from langchain_postgres.v2.indexes import IVFFlatIndex` |
| `HybridSearchConfig` | `from langchain_postgres.v2.hybrid_search_config import HybridSearchConfig` |
| `reciprocal_rank_fusion` | `from langchain_postgres.v2.hybrid_search_config import reciprocal_rank_fusion` |

### Setup and Index Creation

```python
from __future__ import annotations

import asyncio
from langchain_postgres import PGEngine, PGVectorStore
from langchain_postgres.v2.indexes import HNSWIndex, IVFFlatIndex
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

engine = PGEngine.from_connection_string(
    url="postgresql+psycopg://langchain:langchain@localhost:5432/langchain"
)

async def create_store() -> PGVectorStore:
    # Create the table (idempotent)
    await engine.ainit_vectorstore_table(
        table_name="my_docs",
        vector_size=1536,
    )
    store = await PGVectorStore.create(
        engine=engine,
        table_name="my_docs",
        embedding_service=OpenAIEmbeddings(model="text-embedding-3-small"),
        # Optional: add typed metadata columns for fast filtered search
        # metadata_columns=[Column("category", "TEXT"), Column("year", "INT")],
    )
    # Apply HNSW index for scale (IVFFlat requires data present first)
    await store.aapply_vector_index(HNSWIndex(name="my_docs_hnsw"))
    return store

async def upsert_and_search(store: PGVectorStore) -> None:
    docs = [
        Document(page_content="PGVectorStore is the modern API.", metadata={"source": "docs.md"}),
        Document(page_content="PGVector (old API) is deprecated.", metadata={"source": "changelog.md"}),
    ]
    await store.aadd_documents(docs)

    # Similarity search
    results = await store.asimilarity_search("modern vector store API", k=3)

    # Filtered search
    filtered = await store.asimilarity_search(
        "vector store",
        k=3,
        filter={"$or": [{"source": "docs.md"}, {"source": "changelog.md"}]},
    )
```

### HNSW vs IVFFlat

| | HNSW | IVFFlat |
|---|---|---|
| Build cost | Higher (more memory) | Lower |
| Query recall | Best | Good |
| Requires data before build | No | **Yes** — build after inserting data |
| Re-index after bulk insert | Not required | Recommended after significant growth |
| Use when | Query latency + recall are primary concerns | Cheaper index, data stable before first build |

### Hybrid Search

> **⚠️ Open issue #234:** `HybridSearchConfig`'s score normalisation/linear-combination
> fusion logic has a known issue. Validate ranking quality on your own query set before
> trusting defaults.

```python
from __future__ import annotations

from langchain_postgres import PGEngine, PGVectorStore
from langchain_postgres.v2.hybrid_search_config import (
    HybridSearchConfig,
    reciprocal_rank_fusion,
)
from langchain_openai import OpenAIEmbeddings

engine = PGEngine.from_connection_string(
    url="postgresql+psycopg://langchain:langchain@localhost:5432/langchain"
)

store = PGVectorStore.create_sync(
    engine=engine,
    table_name="my_docs_hybrid",
    embedding_service=OpenAIEmbeddings(model="text-embedding-3-small"),
    hybrid_search_config=HybridSearchConfig(
        tsv_column="content_tsv",              # GIN-indexed tsvector column (faster than on-the-fly)
        tsv_lang="pg_catalog.english",
        fusion_function=reciprocal_rank_fusion, # or default weighted_sum_ranking
        primary_top_k=10,
        secondary_top_k=10,
    ),
)
```

**Metadata filtering syntax:**

```python
# AND
filter={"category": "news", "year": 2024}

# OR
filter={"$or": [{"topic": "animals"}, {"location": "market"}]}

# Numeric range (use typed metadata columns for this)
filter={"year": {"$gte": 2020}}
```

### Production Gotchas

| Gotcha | Detail |
|---|---|
| `PGVector` is deprecated | Do not import `langchain_community.vectorstores.PGVector` or `langchain_postgres.PGVector`. Use `PGVectorStore + PGEngine`. Old data needs migration. |
| IVFFlat: build after data | `IVFFlatIndex` must be created after inserting a representative data sample. Build too early and the index is sub-optimal. |
| `ainit_vectorstore_table` is idempotent | Safe to call on startup; skips if table exists. |
| asyncpg vs psycopg3 drivers | `PGEngine` works with both. Use `postgresql+asyncpg://` for asyncpg, `postgresql+psycopg://` for psycopg3. asyncpg is faster for async-heavy workloads. |
| HybridSearchConfig issue #234 | Score normalisation may produce unexpected ranking. Validate empirically before deploying. |

---

## Pinecone (langchain-pinecone)

### Install

```bash
uv add langchain-pinecone pinecone
```

### Import paths

| Class | Import |
|---|---|
| `PineconeVectorStore` | `from langchain_pinecone import PineconeVectorStore` |

### Setup and Upsert

```python
from __future__ import annotations

from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

pc = Pinecone(api_key="YOUR_API_KEY")

# Create index (serverless)
if "my-index" not in pc.list_indexes().names():
    pc.create_index(
        name="my-index",
        dimension=1536,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )

index = pc.Index("my-index")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Connect to existing index
store = PineconeVectorStore(
    index=index,
    embedding=embeddings,
    text_key="text",
    namespace="tenant_123",   # multi-tenancy: one namespace per tenant
)

# Upsert
docs = [
    Document(page_content="Pinecone is a managed vector database.", metadata={"source": "intro.txt"}),
]
ids = store.add_documents(docs)

# Similarity search
results = store.similarity_search("managed vector database", k=5)

# Filtered search
filtered = store.similarity_search(
    "vector database",
    k=5,
    filter={"source": {"$eq": "intro.txt"}},
)

# Async
async_results = await store.asimilarity_search("async query", k=5)
```

### Metadata Filter Syntax

```python
# Equality
filter={"genre": {"$eq": "documentary"}}

# Not in list
filter={"genre": {"$nin": ["drama", "horror"]}}

# Numeric comparison
filter={"year": {"$gte": 2020, "$lt": 2024}}

# Compound
filter={"$and": [{"genre": "documentary"}, {"year": {"$gte": 2020}}]}
```

### Batch Limits and Cost

| Scenario | Batch limit |
|---|---|
| Standard vector upsert | 100 vectors / 2 MB per request |
| Integrated text embedding | **96 records/batch** (drops from 100) |
| langchain-pinecone `add_texts` default | `batch_size=32`, `embedding_chunk_size=1000`, `async_req=True` |

> **⚠️ Integrated embedding batch limit:** When using Pinecone's integrated text embedding,
> batch size drops from 100 to **96** due to embedded text overhead. This is a silent truncation —
> the API accepts the request but only processes 96 items. Always set `batch_size=96` when
> using integrated embeddings.

### Production Gotchas

| Gotcha | Detail |
|---|---|
| Index must exist before `PineconeVectorStore` | Pinecone does not auto-create indexes. Pre-create or check existence in startup code. |
| Namespaces for multi-tenancy | Pass `namespace=` on every add/search/delete call. Mixing namespaces on the same index is common; wrong namespace = empty results. |
| Billing dimensions | RU (read units), WU (write units), storage (GB-month). Verify current rates at pinecone.io/pricing before forecasting cost — rates change and secondary sources conflict. |
| Community class deprecated | `langchain_community.vectorstores.Pinecone` is deprecated. Use `langchain_pinecone.PineconeVectorStore`. |

---

## Chroma (langchain-chroma)

> **⚠️ NOT FOR PRODUCTION.** Chroma has no horizontal scaling and no native hybrid search
> (lexical + vector fusion). Use for local prototyping and notebooks only. Migrate to a
> production store before deploying to any shared environment.

### Install

```bash
uv add langchain-chroma chromadb
```

### Usage (Prototyping Only)

```python
from __future__ import annotations

from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

# In-memory (ephemeral)
store = Chroma(
    collection_name="my_docs",
    embedding_function=OpenAIEmbeddings(model="text-embedding-3-small"),
)

# Persistent (local disk — auto-persists since Chroma 0.4.x; persist() is deprecated)
persistent_store = Chroma(
    collection_name="my_docs",
    embedding_function=OpenAIEmbeddings(model="text-embedding-3-small"),
    persist_directory="/tmp/chroma_db",
)

docs = [Document(page_content="Prototype content.", metadata={"source": "test.txt"})]
persistent_store.add_documents(docs)
results = persistent_store.similarity_search("prototype", k=3)
```

### Metadata Filter Syntax

```python
# Equality
filter={"source": {"$eq": "test.txt"}}

# Not equal
filter={"category": {"$ne": "internal"}}

# In list
filter={"tag": {"$in": ["rag", "search"]}}

# Document content contains
where_document={"$contains": "prototype"}

# Compound
filter={"$and": [{"source": {"$eq": "test.txt"}}, {"year": {"$gte": 2023}}]}
```

### Why Not Production

| Limitation | Detail |
|---|---|
| No horizontal scaling | Single-node only; cannot distribute across machines |
| No native hybrid search | No lexical+vector fusion; use `EnsembleRetriever` as a workaround if stuck on Chroma |
| Limited concurrency | Not designed for high-concurrency production workloads |
| `persist()` deprecated | Auto-persists since 0.4.x; calling `persist()` is a no-op but signals outdated code |

---

## Weaviate (langchain-weaviate)

> **⚠️ v4 client breaking changes.** `weaviate-client` 4.x has breaking changes from v3.
> Use `weaviate.connect_to_local()` (v4) — not `weaviate.Client()` (v3). The v3 class
> `langchain_community.vectorstores.Weaviate` is deprecated; use `langchain_weaviate.WeaviateVectorStore`.

### Install

```bash
uv add langchain-weaviate "weaviate-client>=4"
```

### Import paths

| Class | Import |
|---|---|
| `WeaviateVectorStore` | `from langchain_weaviate.vectorstores import WeaviateVectorStore` |

### Setup and Upsert

```python
from __future__ import annotations

import weaviate
from langchain_weaviate.vectorstores import WeaviateVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

# v4 client — not weaviate.Client()
client = weaviate.connect_to_local(host="localhost", port=8080)

store = WeaviateVectorStore(
    client=client,
    index_name="MyDocs",       # Weaviate class name (PascalCase convention)
    text_key="text",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
    attributes=["source", "category"],   # metadata properties to store + retrieve
)

docs = [
    Document(page_content="Weaviate supports native hybrid search.", metadata={"source": "docs.txt"}),
]
store.add_documents(docs)

# Similarity (vector) search
results = store.similarity_search("native hybrid search", k=5)

# Hybrid search (alpha=0.5: equal blend; 0=pure BM25, 1=pure vector)
hybrid_results = store.similarity_search(
    "native hybrid search",
    k=5,
    search_type="hybrid",
    alpha=0.5,
)
```

### Multi-Tenancy

```python
# Multi-tenant: tenant must be specified per operation (not in constructor)
mt_store = WeaviateVectorStore.from_documents(
    documents=docs,
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
    client=client,
    index_name="TenantDocs",
    text_key="text",
    tenant="tenant_abc",   # auto-created if it doesn't exist
    use_multi_tenancy=True,
)
# Note: tenant cannot be passed to WeaviateVectorStore() constructor — use class methods
```

### Production Gotchas

| Gotcha | Detail |
|---|---|
| v3 → v4 client migration | `weaviate.Client()` (v3) vs `weaviate.connect_to_local()` / `weaviate.connect_to_weaviate_cloud()` (v4). Different auth, different schema API. |
| Tenant not in constructor | `tenant` cannot be set on `WeaviateVectorStore(...)` — pass it to `from_documents()`, `from_texts()`, and search methods. |
| LangChain v4 integration lag | The `langchain-weaviate` integration historically lagged the v4 client on hybrid and `as_retriever` parity. Verify feature availability on your exact package versions. |

---

## Qdrant (langchain-qdrant)

> **⚠️ Query API requires Qdrant v1.10.0+.** `QdrantVectorStore` uses the Universal Query API
> introduced in Qdrant 1.10. Ensure your Qdrant server is 1.10.0 or later.

### Install

```bash
uv add langchain-qdrant qdrant-client
```

### Import paths

| Class | Import |
|---|---|
| `QdrantVectorStore` | `from langchain_qdrant import QdrantVectorStore` |
| `RetrievalMode` | `from langchain_qdrant import RetrievalMode` |
| `FastEmbedSparse` | `from langchain_qdrant import FastEmbedSparse` |
| `QdrantClient` | `from qdrant_client import QdrantClient` |

### Dense (Vector) Setup

```python
from __future__ import annotations

from langchain_qdrant import QdrantVectorStore, RetrievalMode
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

client = QdrantClient(url="http://localhost:6333")
client.recreate_collection(
    collection_name="my_docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

store = QdrantVectorStore(
    client=client,
    collection_name="my_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
    retrieval_mode=RetrievalMode.DENSE,
)

docs = [Document(page_content="Qdrant has excellent hybrid search.", metadata={"source": "docs.txt"})]
store.add_documents(docs)
results = store.similarity_search("hybrid search", k=5)
```

### Hybrid (Dense + Sparse) Setup

```python
from __future__ import annotations

from langchain_qdrant import FastEmbedSparse, QdrantVectorStore, RetrievalMode
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from qdrant_client import QdrantClient, models
from qdrant_client.http.models import Distance, SparseVectorParams, VectorParams

client = QdrantClient(url="http://localhost:6333")
client.recreate_collection(
    collection_name="hybrid_docs",
    vectors_config={"dense": VectorParams(size=1536, distance=Distance.COSINE)},
    sparse_vectors_config={
        "sparse": SparseVectorParams(
            index=models.SparseIndexParams(on_disk=False)
        )
    },
)

store = QdrantVectorStore(
    client=client,
    collection_name="hybrid_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
    sparse_embedding=FastEmbedSparse(model_name="Qdrant/bm25"),
    retrieval_mode=RetrievalMode.HYBRID,
    vector_name="dense",
    sparse_vector_name="sparse",
)

docs = [Document(page_content="Hybrid retrieval combines dense and sparse.", metadata={"source": "guide.txt"})]
store.add_documents(docs)

# Search in HYBRID mode (can also switch to DENSE or SPARSE at query time)
results = store.similarity_search("dense sparse fusion", k=5)
```

### Metadata Filtering

```python
from qdrant_client.http.models import Filter, FieldCondition, MatchValue

results = store.similarity_search(
    "query text",
    k=5,
    filter=Filter(
        must=[FieldCondition(key="metadata.source", match=MatchValue(value="guide.txt"))]
    ),
)
```

### Production Gotchas

| Gotcha | Detail |
|---|---|
| Qdrant v1.10.0+ required | `QdrantVectorStore` uses the Universal Query API (v1.10+). Older Qdrant servers will raise errors on hybrid queries. |
| Hybrid ingestion mode required for hybrid queries | Ingest with `RetrievalMode.HYBRID` to store both dense and sparse vectors. Dense-only ingestion cannot be queried in hybrid mode. |
| Local hybrid build speed | Large on-disk hybrid builds can be slow. Tune `batch_size` down to 50–100 for stability during initial ingestion. |
| `from_existing_collection()` | Use this to connect to an existing Qdrant collection without re-ingesting. `QdrantVectorStore.from_existing_collection(url=..., collection_name=..., embedding=...)` |
| SelfQueryRetriever translator | Newer `QdrantVectorStore` class may raise "not supported" in `SelfQueryRetriever` until a translator ships. Verify with your exact `langchain-qdrant` version. |

---

## Milvus (langchain-milvus)

> **⚠️ Milvus Lite BM25 limitation.** Native BM25 full-text search (`BM25BuiltInFunction`) is
> **NOT available in Milvus Lite**. It requires Milvus Standalone, Distributed, or Zilliz Cloud.
> Milvus Lite will raise an error if you attempt to use BM25BuiltInFunction.

### Install

```bash
uv add langchain-milvus pymilvus
```

### Import paths

| Class | Import |
|---|---|
| `Milvus` | `from langchain_milvus import Milvus` |
| `BM25BuiltInFunction` | `from langchain_milvus import BM25BuiltInFunction` |
| `MilvusCollectionHybridSearchRetriever` | `from langchain_milvus.retrievers import MilvusCollectionHybridSearchRetriever` |

### Dense Search Setup

```python
from __future__ import annotations

from langchain_milvus import Milvus
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

vectorstore = Milvus(
    embedding_function=OpenAIEmbeddings(model="text-embedding-3-small"),
    connection_args={"uri": "http://localhost:19530"},
    collection_name="my_docs",
    drop_old=True,          # drop and recreate on init; set False for existing collections
    auto_id=True,
)

docs = [Document(page_content="Milvus is a purpose-built vector database.", metadata={"source": "intro.txt"})]
vectorstore.add_documents(docs)
results = vectorstore.similarity_search("vector database", k=5)

# Metadata filtering (Milvus boolean expression language)
filtered = vectorstore.similarity_search(
    "vector database",
    k=5,
    expr="source == 'intro.txt'",
)
```

### Hybrid Search with Native BM25 (Standalone/Distributed/Zilliz only)

```python
from __future__ import annotations

from langchain_milvus import BM25BuiltInFunction, Milvus
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

# BM25BuiltInFunction generates server-side sparse vectors automatically
# NO manual sparse embedding generation required
vectorstore = Milvus.from_documents(
    documents=[
        Document(page_content="Milvus 2.5 introduces native BM25.", metadata={"source": "release.txt"}),
        Document(page_content="Hybrid search combines dense and sparse.", metadata={"source": "guide.txt"}),
    ],
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
    builtin_function=BM25BuiltInFunction(),  # server-side BM25; NOT available in Milvus Lite
    vector_field=["dense", "sparse"],
    connection_args={"uri": "http://localhost:19530"},
    consistency_level="Strong",
    drop_old=True,
)

# Hybrid similarity search (RRF fusion by default)
results = vectorstore.similarity_search("BM25 hybrid search", k=5)
```

### Reranking with RRFRanker

```python
from pymilvus.client.types import WeightedRanker, RRFRanker

# RRFRanker (default, k=60)
results = vectorstore.similarity_search(
    "hybrid search",
    k=5,
    ranker_type="rrf",
    ranker_params={"k": 60},
)

# WeightedRanker (dense_weight + sparse_weight must sum to 1.0)
results = vectorstore.similarity_search(
    "hybrid search",
    k=5,
    ranker_type="weighted",
    ranker_params={"weights": [0.7, 0.3]},  # [dense_weight, sparse_weight]
)
```

### Production Gotchas

| Gotcha | Detail |
|---|---|
| Milvus Lite: no BM25 | `BM25BuiltInFunction` raises an error on Milvus Lite. Use Standalone, Distributed, or Zilliz Cloud. |
| `drop_old=True` on init | Drops and recreates the collection every startup. Set `drop_old=False` for existing production collections. |
| `auto_id=True` recommended | Milvus assigns IDs; avoids ID collision on parallel ingestion. |
| Consistency levels | `"Strong"` (sync), `"Bounded"`, `"Eventually"`. Use `"Strong"` for correctness; `"Bounded"` or `"Eventually"` for throughput. |

---

## MongoDB Atlas Vector Search (langchain-mongodb)

### Install

```bash
uv add langchain-mongodb pymongo
```

### Import paths

| Class | Import |
|---|---|
| `MongoDBAtlasVectorSearch` | `from langchain_mongodb import MongoDBAtlasVectorSearch` |
| `MongoDBAtlasHybridSearchRetriever` | `from langchain_mongodb.retrievers import MongoDBAtlasHybridSearchRetriever` |

### Setup and Index Creation

```python
from __future__ import annotations

from pymongo import MongoClient
from langchain_mongodb import MongoDBAtlasVectorSearch
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

client = MongoClient("mongodb+srv://user:pw@cluster.mongodb.net/")
collection = client["langchain_db"]["my_docs"]

store = MongoDBAtlasVectorSearch(
    collection=collection,
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
    index_name="vector_index",
    text_key="text",
    embedding_key="embedding",
    relevance_score_fn="cosine",
)

# Programmatic index creation (Atlas only)
store.create_vector_search_index(
    dimensions=1536,
    filters=["category", "year"],    # metadata fields to filter on
    wait_until_complete=60,           # seconds to wait for index to become active
)
```

### Index JSON Definition (Atlas UI or API)

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "category"
    },
    {
      "type": "filter",
      "path": "year"
    }
  ]
}
```

### Upsert and Search

```python
from __future__ import annotations

from langchain_core.documents import Document

docs = [
    Document(page_content="MongoDB Atlas provides vector search.", metadata={"source": "docs.txt", "category": "database"}),
]
store.add_documents(docs)

# Similarity search with pre-filter
results = store.similarity_search(
    "vector search",
    k=5,
    pre_filter=[{"category": {"$eq": "database"}}],
    oversampling_factor=10,   # tune HNSW candidate count (default varies)
)

# MMR search
mmr_results = store.max_marginal_relevance_search(
    "vector search",
    k=5,
    fetch_k=20,
    pre_filter=[{"category": {"$eq": "database"}}],
)
```

### Production Gotchas

| Gotcha | Detail |
|---|---|
| Atlas-only vector search | Search indexes are Atlas-managed. Community Edition vector search is a preview feature as of 2025. |
| Index propagation latency | After `create_vector_search_index()`, the index may take 30–120 seconds to become queryable. Use `wait_until_complete` in setup scripts. |
| `pre_filter` fields must be indexed | Fields used in `pre_filter` must be declared as `"type": "filter"` in the index JSON. Unindexed filter fields are silently ignored (full scan fallback). |

---

## Elasticsearch (langchain-elasticsearch)

> **⚠️ Deprecated classes:** `ElasticVectorSearch` and `ElasticKNNSearch` are deprecated.
> Use `ElasticsearchStore` exclusively.

### Install

```bash
uv add langchain-elasticsearch elasticsearch
```

### Import paths

| Class | Import |
|---|---|
| `ElasticsearchStore` | `from langchain_elasticsearch import ElasticsearchStore` |
| `DenseVectorStrategy` | `from langchain_elasticsearch import DenseVectorStrategy` |
| `SparseVectorStrategy` | `from langchain_elasticsearch import SparseVectorStrategy` |
| `BM25Strategy` | `from langchain_elasticsearch import BM25Strategy` |
| `DenseVectorScriptScoreStrategy` | `from langchain_elasticsearch import DenseVectorScriptScoreStrategy` |

### Four Retrieval Strategies

| Strategy | Class | Description | When to use |
|---|---|---|---|
| Approximate dense KNN | `DenseVectorStrategy()` | HNSW approximate nearest-neighbour | Default; fast dense retrieval |
| Hybrid (dense + BM25 RRF) | `DenseVectorStrategy(hybrid=True)` | RRF fusion of HNSW + BM25 (ES 8.x) | When exact terms + semantic both matter |
| ELSER learned-sparse | `SparseVectorStrategy(model_id=".elser_model_2")` | Server-side learned-sparse retrieval | Semantic without external embeddings |
| Exact brute-force | `DenseVectorScriptScoreStrategy()` | KNN with script_score | Small corpora; exact results required |
| Pure BM25 | `BM25Strategy()` | Lexical only | Keyword-heavy domains without embeddings |

### Setup — Hybrid (DenseVector + BM25 RRF)

```python
from __future__ import annotations

from langchain_elasticsearch import DenseVectorStrategy, ElasticsearchStore
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

store = ElasticsearchStore(
    es_url="http://localhost:9200",
    index_name="my_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
    strategy=DenseVectorStrategy(hybrid=True),   # RRF fusion (ES 8.x)
)

docs = [
    Document(page_content="Elasticsearch supports hybrid RRF retrieval.", metadata={"source": "guide.txt"}),
]
store.add_documents(docs)

results = store.similarity_search("hybrid RRF", k=5)
```

### ELSER Sparse Retrieval

```python
from __future__ import annotations

from langchain_elasticsearch import ElasticsearchStore, SparseVectorStrategy
from langchain_core.documents import Document

# No external embedding model needed — ELSER runs inside Elasticsearch
store = ElasticsearchStore(
    es_url="http://localhost:9200",
    index_name="elser_docs",
    strategy=SparseVectorStrategy(model_id=".elser_model_2"),
)

docs = [Document(page_content="ELSER is a learned sparse retrieval model.", metadata={"source": "elser.txt"})]
# Add with bulk_kwargs to avoid timeout on large batches with ELSER inference
store.add_documents(docs, bulk_kwargs={"chunk_size": 50, "max_chunk_bytes": 200_000_000})
```

### Production Gotchas

| Gotcha | Detail |
|---|---|
| Bulk timeout with ELSER | ELSER inference during ingest is slow. Reduce `chunk_size` in `bulk_kwargs` (50–100) and increase `max_chunk_bytes`. |
| RRF hybrid requires ES 8.x | `DenseVectorStrategy(hybrid=True)` uses RRF which requires Elasticsearch 8.x. Fails silently or errors on older versions. |
| Deprecated classes | `ElasticVectorSearch`, `ElasticKNNSearch` — do not use. |
| Async variant | `AsyncElasticsearchStore` (same params) — async public classes raise `NotImplementedError` on inherited sync methods by design. |

---

## Redis (langchain-redis)

> **⚠️ Use `langchain-redis`, not `langchain_community`.** The community Redis vector store class is deprecated.
> Requires Redis Stack or RediSearch module (not plain Redis).

### Install

```bash
uv add langchain-redis redis
```

### Import paths

| Class | Import |
|---|---|
| `RedisVectorStore` | `from langchain_redis import RedisVectorStore` |
| `RedisConfig` | `from langchain_redis import RedisConfig` |

### Setup — HNSW (Recommended for > 1M docs)

```python
from __future__ import annotations

from langchain_redis import RedisConfig, RedisVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

config = RedisConfig(
    index_name="my_docs",
    redis_url="redis://localhost:6379",
    distance_metric="COSINE",           # "COSINE" | "L2" | "IP"
    index_type="HNSW",                  # "FLAT" | "HNSW" — HNSW for > 1M docs
    # HNSW tuning params:
    # m=16,                             # number of connections per layer
    # ef_construction=200,              # build-time search width
    # ef_runtime=10,                    # query-time search width
    storage_type="hash",                # "hash" (memory-efficient) | "json"
)

store = RedisVectorStore(
    embeddings=OpenAIEmbeddings(model="text-embedding-3-small"),
    config=config,
)

docs = [
    Document(page_content="Redis delivers sub-millisecond retrieval.", metadata={"source": "perf.txt", "category": "database"}),
]
store.add_documents(docs)

results = store.similarity_search("sub-millisecond retrieval", k=5)
```

### FLAT vs HNSW

| | FLAT (exact KNN) | HNSW (approximate KNN) |
|---|---|---|
| Recall | 100% (exact) | ~95–99% (approximate) |
| Query speed | Scales linearly with corpus size | Sublinear; fast at scale |
| Memory | Higher index overhead | Lower index overhead |
| Use when | Small corpus (< 100K docs) or exact recall required | Large datasets (> 1M docs) or performance matters |

### Metadata Filtering

```python
from redisvl.query.filter import Tag, Num, Text

# Tag filter
results = store.similarity_search(
    "vector search",
    k=5,
    filter=Tag("category") == "database",
)

# Numeric filter
results = store.similarity_search(
    "vector search",
    k=5,
    filter=Num("year") >= 2023,
)

# Combined
results = store.similarity_search(
    "vector search",
    k=5,
    filter=(Tag("category") == "database") & (Num("year") >= 2023),
)
```

### Production Gotchas

| Gotcha | Detail |
|---|---|
| Redis Stack required | Plain Redis does not have the RediSearch module. Use Redis Stack or enable the RediSearch module. |
| Vectors in RAM | All vectors are stored in memory. Corpus size is bounded by available RAM. |
| FLAT scales linearly | For > 100K documents, switch to HNSW to avoid query time degradation. |
| Community class deprecated | `langchain_community.vectorstores.Redis` is deprecated. Use `langchain_redis.RedisVectorStore`. |
| Sentinel URLs | `RedisChatMessageHistory` and `RedisVectorStore` support Redis Sentinel via sentinel URL format. |

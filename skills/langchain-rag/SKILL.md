---
name: langchain-rag
description: >
  Build and optimize production RAG pipelines with LangChain. Triggers on:
  PGVectorStore, PineconeVectorStore, QdrantVectorStore, WeaviateVectorStore,
  Milvus, MongoDBAtlasVectorSearch, ElasticsearchStore, RedisVectorStore,
  SQLRecordManager, aindex(), index(), RecordManager, HybridSearchConfig,
  EnsembleRetriever, ParentDocumentRetriever, CohereRerank, CrossEncoderReranker,
  SemanticChunker, MarkdownHeaderTextSplitter, cleanup="incremental",
  PGVector deprecated, as_retriever, similarity_score_threshold,
  CRAG, Self-RAG, HyDE, Adaptive RAG, vector store selection, chunking strategy,
  retriever reranking, idempotent ingestion, hybrid search, LangGraph RAG nodes.
---

## Core Philosophy

Production RAG in 2025/2026 is a pipeline engineering problem, not a prompt
engineering problem: idempotent ingestion with `SQLRecordManager`, store-native hybrid
search, and two-stage retrieve-then-rerank deliver the most measurable quality lift.
Always use first-party partner packages (`langchain-postgres`, `langchain-pinecone`,
`langchain-qdrant`, `langchain-milvus`, `langchain-mongodb`, `langchain-elasticsearch`,
`langchain-redis`, `langchain-weaviate`) — the legacy `langchain_community` vector store
classes are deprecated or sunset-risk. Graduate from LCEL to LangGraph nodes only when
you need self-correction (CRAG, Self-RAG) or agentic routing; LCEL is the canonical
default. Use `uv add` for all dependency management — never `pip install`.

---

## Step 1 — Determine Context

Classify the request before loading any reference:

| Intent signal | Mode |
|---|---|
| "build a RAG pipeline", "ingest documents", "set up ingestion", `SQLRecordManager`, `aindex`, `index()`, `cleanup=` | **INGESTION** |
| "retrieve documents", "add reranking", "hybrid search", `as_retriever`, `EnsembleRetriever`, `CohereRerank`, `CrossEncoderReranker`, `ParentDocumentRetriever`, `similarity_score_threshold` | **RETRIEVAL** |
| "which vector store", "PGVectorStore vs", "migrate from PGVector", `PGVectorStore`, `PineconeVectorStore`, `QdrantVectorStore`, `WeaviateVectorStore`, `MongoDBAtlasVectorSearch`, `ElasticsearchStore`, `RedisVectorStore`, `HybridSearchConfig`, `Milvus` | **STORE-SELECTION** |
| "CRAG", "Self-RAG", "HyDE", "Adaptive RAG", "query decomposition", "LangGraph RAG", "agentic RAG", "self-correction" | **ADVANCED-RAG** |
| "chunk documents", "SemanticChunker", "MarkdownHeaderTextSplitter", "RecursiveCharacterTextSplitter", "TokenTextSplitter", "parent-child chunking" | **CHUNKING** |

Then detect one cross-cutting axis:

**Async scope** — does the request mention `aindex`, `aadd_documents`, `asimilarity_search`, or a FastAPI/async context? If yes, all examples must use async paths.

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/ingestion.md` | RecordManager, `index()`/`aindex()`, cleanup modes, parallel ingestion, batch limits | INGESTION; any question about idempotent upsert, deduplication, batch sizing |
| `references/chunking.md` | RCTS, TokenTextSplitter, MarkdownHeaderTextSplitter, SemanticChunker, parent-child | CHUNKING; any question about text splitters, chunk overlap, code-aware splitting |
| `references/vector-stores.md` | Per-store reference: PGVectorStore, Pinecone, Chroma, Weaviate, Qdrant, Milvus, MongoDB, ES, Redis | STORE-SELECTION; any question about a specific store, hybrid search, migrations |
| `references/retrievers-reranking.md` | `as_retriever`, MMR, EnsembleRetriever, ContextualCompressionRetriever, CohereRerank, CrossEncoderReranker, MultiVectorRetriever, SelfQueryRetriever | RETRIEVAL; any question about retriever types or reranking |
| `references/rag-patterns.md` | LCEL RAG chain, LangGraph RAG StateGraph, Self-RAG, CRAG, HyDE, Adaptive RAG, query decomposition | ADVANCED-RAG; any question about RAG architectures, chains, or flow engineering |

For INGESTION: load `ingestion.md` + `chunking.md` + the relevant store section from `vector-stores.md`.

For STORE-SELECTION: load `vector-stores.md` in full; load `ingestion.md` if ingestion setup is part of the question.

For RETRIEVAL: load `retrievers-reranking.md`; load relevant store section from `vector-stores.md` for store-specific retriever config.

For ADVANCED-RAG: load `rag-patterns.md` + `retrievers-reranking.md`; add `ingestion.md` if the pipeline includes ingestion setup.

For CHUNKING: load `chunking.md` only; add `ingestion.md` if chunking is part of a larger ingestion pipeline question.

---

## Step 3 — Build RAG

### Vector store decision gate

From `references/vector-stores.md`:

- **Already on Postgres** → `PGVectorStore` (one fewer system; transactional; tens-of-millions scale). `PGVector` is deprecated since `langchain-postgres 0.0.14+` — always use `PGVectorStore + PGEngine`.
- **Already on Elasticsearch** → `ElasticsearchStore` (four strategies: dense/sparse/BM25/hybrid).
- **Already on Redis** → `RedisVectorStore` (sub-ms retrieval; RAM-bound).
- **Already on MongoDB Atlas** → `MongoDBAtlasVectorSearch` (+ LangGraph checkpoint integration).
- **Greenfield, managed scale** → Pinecone serverless or Qdrant Cloud.
- **Greenfield, best hybrid + self-host** → Qdrant (RRF/DBSF) or Milvus (native BM25; very large scale).
- **Prototyping only** → Chroma — NOT for production (no horizontal scaling, no hybrid search).

### Chunking strategy decision gate

From `references/chunking.md`:

- **Default prose** → `RecursiveCharacterTextSplitter.from_tiktoken_encoder(chunk_size=512, chunk_overlap=64)`.
- **Code** → `RecursiveCharacterTextSplitter.from_language(Language.PYTHON, ...)`.
- **Markdown docs** → `MarkdownHeaderTextSplitter` → then RCTS per section.
- **Precision-sensitive corpus (policy, research)** → `SemanticChunker` (expensive; lives in `langchain_experimental`).
- **Small chunks for retrieval, large context for generation** → `ParentDocumentRetriever` pattern.

### Retrieval strategy decision gate

From `references/retrievers-reranking.md`:

1. Start with `similarity` + metadata filters.
2. Add MMR when results are redundant.
3. Add `EnsembleRetriever` (BM25 + vector) when exact terms (codes, names, IDs) matter or the store lacks native hybrid.
4. Add `ContextualCompressionRetriever` + reranker for the largest single quality jump (retrieve `k=20`, rerank to `top_n=3`).
5. Use `ParentDocumentRetriever` or `MultiVectorRetriever` when chunks are too small to answer but precision retrieval is needed.
6. Use `SelfQueryRetriever` when users express structured constraints in natural language — verify translator support for your store version.

---

## Step 4 — Output & Verification

Every produced pipeline must include:

- Full `uv add` install commands (no `pip install`).
- A `SQLRecordManager` with `create_schema()` call and a `cleanup=` mode justified by the use-case.
- Async variants when the context is async (FastAPI, LangGraph nodes, async pipelines).
- At minimum: one `similarity_search` or `as_retriever` call verifying the store is queryable.

Shell commands to verify a working pipeline:

```bash
# Install dependencies
uv add langchain-core langchain-postgres langchain-openai langchain-text-splitters

# Verify store connectivity (Postgres example)
uv run python -c "
from langchain_postgres import PGEngine
engine = PGEngine.from_connection_string('postgresql+psycopg://user:pw@localhost:5432/db')
print('PGEngine OK')
"

# Run a round-trip ingest + retrieval smoke test
uv run python scripts/rag_smoke_test.py

# Trace with LangSmith (set env vars before running)
LANGSMITH_TRACING=true LANGSMITH_API_KEY=<key> uv run python scripts/rag_smoke_test.py
```

---

## Reference Files

| File | Domain | Primary source section |
|---|---|---|
| [references/ingestion.md](references/ingestion.md) | RecordManager, index/aindex, cleanup modes, parallel ingestion, batch limits | §1 DOCUMENT INGESTION PIPELINE |
| [references/chunking.md](references/chunking.md) | RCTS, TokenTextSplitter, MarkdownHeaderTextSplitter, SemanticChunker, parent-child | §2 CHUNKING STRATEGIES |
| [references/vector-stores.md](references/vector-stores.md) | Per-store deep dive: PGVectorStore, Pinecone, Chroma, Weaviate, Qdrant, Milvus, MongoDB, ES, Redis | §3 VECTOR STORES |
| [references/retrievers-reranking.md](references/retrievers-reranking.md) | as_retriever, MMR, Ensemble, ContextualCompression, Cohere/CrossEncoder, MultiVector, ParentDoc, SelfQuery | §4 RETRIEVERS + §6 RERANKING |
| [references/rag-patterns.md](references/rag-patterns.md) | LCEL chain, LangGraph nodes, Self-RAG, CRAG, HyDE, Adaptive RAG, query decomposition | §5 RAG PIPELINE PATTERNS |

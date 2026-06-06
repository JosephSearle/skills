# Retrievers and Reranking Reference

## Retriever Selection Guide

| Scenario | Recommended retriever | Notes |
|---|---|---|
| Baseline retrieval | `VectorStoreRetriever` (similarity) | Start here; add complexity only when measured |
| Redundant results | `VectorStoreRetriever` (MMR) | `lambda_mult` controls relevance vs. diversity |
| Score-based filtering | `VectorStoreRetriever` (similarity_score_threshold) | Only returns docs above `score_threshold` |
| Exact terms + semantic | `EnsembleRetriever` (BM25 + vector) | When names, codes, IDs matter; store lacks native hybrid |
| Large quality jump | `ContextualCompressionRetriever` + reranker | Retrieve k=20, rerank to top_n=3; highest single ROI |
| Chunks too small for context | `ParentDocumentRetriever` | Retrieves small chunks, returns large parents |
| Multiple index strategies | `MultiVectorRetriever` | Summaries, HyDE queries, sub-chunks all pointing to one parent |
| Natural-language structured filters | `SelfQueryRetriever` | LLM translates query to metadata filter; verify translator support |

---

## VectorStoreRetriever and as_retriever()

### API Surface

| Param | Type | Default | Notes |
|---|---|---|---|
| `search_type` | `str` | `"similarity"` | `"similarity"`, `"mmr"`, `"similarity_score_threshold"` |
| `search_kwargs` | `dict` | `{}` | `k`, `fetch_k`, `lambda_mult`, `score_threshold`, `filter` |

### All Three Search Types

```python
from __future__ import annotations

from langchain_qdrant import QdrantVectorStore
from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

client = QdrantClient(url="http://localhost:6333")
client.recreate_collection(
    collection_name="docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)
store = QdrantVectorStore(
    client=client,
    collection_name="docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)

# 1. Similarity — top-k by cosine distance
similarity_retriever = store.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 5, "filter": {"source": "manual.txt"}},
)

# 2. MMR — maximise relevance while minimising redundancy
mmr_retriever = store.as_retriever(
    search_type="mmr",
    search_kwargs={
        "k": 5,          # final returned count
        "fetch_k": 20,   # candidate pool size for MMR algorithm
        "lambda_mult": 0.5,  # 0 = max diversity, 1 = max relevance
    },
)

# 3. Score threshold — only return docs above normalised score
threshold_retriever = store.as_retriever(
    search_type="similarity_score_threshold",
    search_kwargs={
        "score_threshold": 0.75,   # normalised 0–1; tune empirically
        "k": 10,
    },
)

# Invoke any retriever
docs = similarity_retriever.invoke("What is vector search?")
```

> **⚠️ score_threshold semantics vary by store.** `similarity_search_with_relevance_scores`
> normalises raw distance to [0, 1] using a store-specific function. For cosine distance stores
> the mapping is typically `score = 1 - (distance / 2)`. Validate threshold values on your own
> data — do not transfer thresholds between stores.

---

## MMR Parameters

| Param | Type | Default | Effect |
|---|---|---|---|
| `fetch_k` | `int` | 20 | Candidate pool fetched by ANN before MMR reranking; must be ≥ `k` |
| `lambda_mult` | `float` | 0.5 | 0.0 = maximise diversity only; 1.0 = maximise relevance only (= similarity search) |
| `k` | `int` | 4 | Final number of documents returned after MMR |

MMR is useful when top-k results are all from the same section of a document and the user
needs diverse coverage. Increase `fetch_k` to expand the candidate pool; lower `lambda_mult`
if results are still redundant.

---

## EnsembleRetriever

> **⚠️ Weighted RRF, not pure RRF.** LangChain's `EnsembleRetriever` implements a
> **weighted variant** of Reciprocal Rank Fusion, not the standard RRF formula.
> The weights array scales each retriever's contribution, but the combination is
> LangChain-specific and not validated to be equivalent to pure RRF. Validate ranking
> quality empirically on your own query set — do not assume theoretical RRF properties.

`EnsembleRetriever` fuses multiple retrievers with weighted RRF. The canonical use-case
is `BM25Retriever` (lexical) + `VectorStoreRetriever` (semantic), providing hybrid search
for stores that lack native hybrid support (e.g., Chroma).

> **⚠️ Community imports.** `BM25Retriever` still imports from `langchain_community`.

```python
from __future__ import annotations

from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain_qdrant import QdrantVectorStore
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

# ── Example documents ────────────────────────────────────────────────────────
all_docs = [
    Document(page_content="Error code E-1024: disk quota exceeded", metadata={"source": "errors.txt"}),
    Document(page_content="Error code E-2048: memory allocation failed", metadata={"source": "errors.txt"}),
    Document(page_content="Vector search returns semantically similar documents", metadata={"source": "guide.txt"}),
    Document(page_content="BM25 is a lexical ranking function", metadata={"source": "guide.txt"}),
]

# ── BM25 retriever (keyword-based) ───────────────────────────────────────────
bm25_retriever = BM25Retriever.from_documents(all_docs, k=5)

# ── Vector store retriever ───────────────────────────────────────────────────
client = QdrantClient(url="http://localhost:6333")
client.recreate_collection(
    collection_name="ensemble_docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)
vector_store = QdrantVectorStore(
    client=client,
    collection_name="ensemble_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)
vector_store.add_documents(all_docs)
vector_retriever = vector_store.as_retriever(search_kwargs={"k": 5})

# ── Ensemble (weighted RRF fusion) ───────────────────────────────────────────
ensemble_retriever = EnsembleRetriever(
    retrievers=[bm25_retriever, vector_retriever],
    weights=[0.5, 0.5],    # must sum to 1.0; tune based on your query distribution
    c=60,                  # RRF rank constant (default 60); higher = less weight on top ranks
)

results = ensemble_retriever.invoke("Error code E-1024")
# BM25 matches exact code string; vector retriever provides semantic matches
# Ensemble fuses both via weighted RRF
```

---

## ContextualCompressionRetriever

Wraps a base retriever with a compressor that filters, reranks, or extracts from
the retrieved documents before returning them to the caller.

### Compressor Options

| Compressor | Import | Description | Cost |
|---|---|---|---|
| `CohereRerank` | `langchain_cohere` | Hosted cross-encoder reranking | API call per retrieval |
| `CrossEncoderReranker` | `langchain.retrievers.document_compressors` | Local cross-encoder reranking | Local GPU/CPU per retrieval |
| `EmbeddingsFilter` | `langchain.retrievers.document_compressors` | Drop docs below embedding similarity threshold | Embedding call per doc |
| `EmbeddingsRedundantFilter` | `langchain.retrievers.document_compressors` | Remove near-duplicate docs | Embedding call per doc |
| `LLMChainFilter` | `langchain.retrievers.document_compressors` | LLM yes/no relevance gate per doc | LLM call per doc |
| `LLMChainExtractor` | `langchain.retrievers.document_compressors` | LLM extracts only relevant spans | LLM call per doc |
| `DocumentCompressorPipeline` | `langchain.retrievers.document_compressors` | Chain multiple compressors | Sum of each stage |

---

## CohereRerank

```python
from __future__ import annotations

from langchain.retrievers import ContextualCompressionRetriever
from langchain_cohere import CohereRerank
from langchain_qdrant import QdrantVectorStore
from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

client = QdrantClient(url="http://localhost:6333")
client.recreate_collection(
    collection_name="rerank_docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)
vector_store = QdrantVectorStore(
    client=client,
    collection_name="rerank_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)

# Base retriever: wide recall pool
base_retriever = vector_store.as_retriever(search_kwargs={"k": 20})

# Cohere cross-encoder reranker: high-precision top-n
compressor = CohereRerank(
    model="rerank-english-v3.0",   # or "rerank-multilingual-v3.0"
    top_n=3,                        # return top 3 after reranking
    cohere_api_key="YOUR_COHERE_API_KEY",
)

reranking_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=base_retriever,
)

results = reranking_retriever.invoke("What is the refund policy?")
# 20 candidates retrieved by ANN → 3 returned after Cohere reranking
```

---

## CrossEncoderReranker (Local)

> **⚠️ Community import.** `HuggingFaceCrossEncoder` still imports from `langchain_community`.

```python
from __future__ import annotations

from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import CrossEncoderReranker
from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_qdrant import QdrantVectorStore
from langchain_openai import OpenAIEmbeddings
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

client = QdrantClient(url="http://localhost:6333")
client.recreate_collection(
    collection_name="cross_enc_docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)
vector_store = QdrantVectorStore(
    client=client,
    collection_name="cross_enc_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)

# Local cross-encoder — no API calls; GPU recommended for throughput
cross_encoder = HuggingFaceCrossEncoder(
    model_name="BAAI/bge-reranker-base"   # or "cross-encoder/ms-marco-MiniLM-L-6-v2"
)
compressor = CrossEncoderReranker(
    model=cross_encoder,
    top_n=3,
)

base_retriever = vector_store.as_retriever(search_kwargs={"k": 20})
reranking_retriever = ContextualCompressionRetriever(
    base_compressor=compressor,
    base_retriever=base_retriever,
)

results = reranking_retriever.invoke("What are the system requirements?")
```

### Reranking Cost vs Quality Tradeoffs

| Option | Latency | Quality | Cost |
|---|---|---|---|
| `CohereRerank` (rerank-english-v3.0) | ~100–300 ms (API RTT) | High | Per-call API billing |
| `CrossEncoderReranker` (BAAI/bge-reranker-base, CPU) | ~200–500 ms | High | Compute only |
| `CrossEncoderReranker` (BAAI/bge-reranker-base, GPU) | ~20–100 ms | High | Compute + GPU |
| `EmbeddingsFilter` (0.75 threshold) | ~50–150 ms (embedding calls) | Medium | Embedding API calls |
| `LLMChainFilter` | ~500–2000 ms (LLM calls) | Highest flexibility | LLM tokens per doc |

---

## MultiVectorRetriever

Stores multiple vectors per logical document (summaries, hypothetical questions, sub-chunks)
that all point back to one parent in a docstore. Useful when the retrievable unit should
differ from the unit returned to the LLM.

```python
from __future__ import annotations

import uuid
from langchain.retrievers import MultiVectorRetriever
from langchain.storage import InMemoryStore
from langchain_qdrant import QdrantVectorStore
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

client = QdrantClient(url="http://localhost:6333")
client.recreate_collection(
    collection_name="multi_vec_docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)
vector_store = QdrantVectorStore(
    client=client,
    collection_name="multi_vec_docs",
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)

# Parent docstore — replace InMemoryStore with persistent store in production
docstore = InMemoryStore()

retriever = MultiVectorRetriever(
    vectorstore=vector_store,
    docstore=docstore,
    id_key="doc_id",   # metadata key linking child vectors to parent docs
)

# Parent documents
parent_docs = [
    Document(
        page_content="Full text of document 1 with complete context...",
        metadata={"source": "doc1.txt"},
    ),
    Document(
        page_content="Full text of document 2 with complete context...",
        metadata={"source": "doc2.txt"},
    ),
]

# Generate summaries for indexing (retrieve by summary, return parent)
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
summarise_chain = (
    ChatPromptTemplate.from_template("Summarise this document in one sentence:\n{doc}")
    | llm
    | StrOutputParser()
)

doc_ids = [str(uuid.uuid4()) for _ in parent_docs]
summary_docs = []
for i, doc in enumerate(parent_docs):
    summary = summarise_chain.invoke({"doc": doc.page_content})
    summary_docs.append(
        Document(page_content=summary, metadata={"doc_id": doc_ids[i]})
    )

# Add summaries to vector store; parents to docstore
retriever.vectorstore.add_documents(summary_docs)
retriever.docstore.mset(list(zip(doc_ids, parent_docs)))

# Retrieve: query matches summary → returns parent document
results = retriever.invoke("document context")
# results contains the full parent documents, not the summary chunks
```

---

## ParentDocumentRetriever

See `references/chunking.md` for full setup. Summary:

- Small child chunks (~200 tokens) indexed in vector store.
- Large parent chunks (~2000 tokens) or full documents stored in docstore.
- Query matches child → parent returned to LLM.
- Use `InMemoryStore` for dev; persistent store for production.

---

## SelfQueryRetriever

Uses an LLM to translate a natural-language query into a structured metadata filter
plus a semantic search string. Requires a store-specific translator.

> **⚠️ Translator support gaps.** Newer store classes (`QdrantVectorStore`, `PGVectorStore`)
> have historically raised "Vector Store type ... not supported" until a translator ships.
> Always verify translator support against your exact `langchain-qdrant`, `langchain-postgres`,
> etc. package versions before relying on `SelfQueryRetriever` in production.

### Supported Stores (verify current versions)

| Store class | Package |
|---|---|
| `Chroma` | `langchain_chroma` |
| `Qdrant` (legacy class) | `langchain_community` |
| `QdrantVectorStore` | `langchain_qdrant` (verify translator ships) |
| `Milvus` | `langchain_milvus` |
| `PineconeVectorStore` | `langchain_pinecone` |
| `ElasticsearchStore` | `langchain_elasticsearch` |
| `MongoDBAtlasVectorSearch` | `langchain_mongodb` |
| `PGVector` (legacy) | `langchain_community` |

```python
from __future__ import annotations

from langchain.retrievers.self_query.base import SelfQueryRetriever
from langchain.chains.query_constructor.base import AttributeInfo
from langchain_openai import ChatOpenAI
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document

# Build a store with typed metadata
docs = [
    Document(page_content="A thriller set in 1920s Paris.", metadata={"genre": "thriller", "year": 1925, "rating": 8.2}),
    Document(page_content="A comedy set in modern Tokyo.", metadata={"genre": "comedy", "year": 2022, "rating": 7.5}),
    Document(page_content="A documentary about ocean wildlife.", metadata={"genre": "documentary", "year": 2019, "rating": 9.1}),
]

vector_store = Chroma.from_documents(
    docs,
    embedding=OpenAIEmbeddings(model="text-embedding-3-small"),
)

metadata_field_info = [
    AttributeInfo(name="genre", description="Genre of the film", type="string"),
    AttributeInfo(name="year", description="Year of release", type="integer"),
    AttributeInfo(name="rating", description="IMDB rating", type="float"),
]

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

self_query_retriever = SelfQueryRetriever.from_llm(
    llm=llm,
    vectorstore=vector_store,
    document_contents="Short descriptions of films",
    metadata_field_info=metadata_field_info,
    enable_limit=True,          # allow "find 2 thrillers" to set k=2
    use_original_query=False,   # use LLM-refined query, not raw user input
    verbose=True,
)

# "What are some thrillers from before 1950?" → filter: {genre: thriller, year: {$lt: 1950}}
results = self_query_retriever.invoke("What are some thrillers from before 1950?")
```

---

## Provider-Native Rerankers

| Provider | Class | Import | Notes |
|---|---|---|---|
| Pinecone | `PineconeRerank` | `langchain_pinecone` | Hosted reranker; integrates with Pinecone index |
| Weaviate | Generative/reranker modules | via Weaviate client | Configured at schema level |
| Milvus | `RRFRanker`, `WeightedRanker` | `pymilvus` | Pass to `similarity_search` as `ranker_type` param |
| MongoDB Atlas | `VoyageAIRerank` | `langchain_voyageai` | Atlas + Voyage AI integration |
| pgvector | None native | — | Use LangChain `ContextualCompressionRetriever` on top |

---

## Production Gotchas

| Gotcha | Detail |
|---|---|
| `EnsembleRetriever` weighted-RRF is not pure RRF | LangChain's implementation is a custom weighted variant. Do not assume theoretical RRF properties. Validate empirically. |
| `score_threshold` values are store-specific | A threshold of 0.75 on Qdrant cosine ≠ 0.75 on Elasticsearch. Calibrate per store. |
| Base retriever k must be >> reranker top_n | Pattern: `base k=20`, `top_n=3`. If base k = top_n, reranking has no candidates to filter. |
| `SelfQueryRetriever` LLM costs on every query | Every retrieval call invokes an LLM to construct the structured query. Budget for LLM tokens per retrieval. |
| `HuggingFaceCrossEncoder` is a community import | `from langchain_community.cross_encoders import HuggingFaceCrossEncoder` — community package, not a dedicated partner package. Monitor for deprecation. |
| `BM25Retriever` is a community import | `from langchain_community.retrievers import BM25Retriever` — community package. |
| MMR `fetch_k` too small | If `fetch_k < k`, MMR cannot return `k` results. Ensure `fetch_k >= k * 4` for meaningful diversity. |

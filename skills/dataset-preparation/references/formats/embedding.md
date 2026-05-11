# Embedding Model Dataset Format

## Supported Embedding Models

Fine-tune with `FastSentenceTransformer` for:
- **EmbeddingGemma-300M** — compact, fast
- **Qwen3-Embedding** (0.6B, 1.8B, 4B, 8B)
- **All-MiniLM-L6-v2** — widely-used baseline
- Any sentence-transformers compatible model

Use case: improve retrieval performance, domain-specific semantic search, RAG pipeline quality.

---

## Required Data Structures

### Pair Format (cosine similarity)

The simplest format — two sentences and a similarity label (0.0 to 1.0):

```json
{
  "sentence1": "The patient presents with acute chest pain.",
  "sentence2": "The individual is experiencing cardiac discomfort.",
  "label": 0.92
}
```

### Triplet Format (contrastive learning, recommended)

Provides stronger training signal — anchor, positive (similar), negative (dissimilar):

```json
{
  "anchor":   "How do I configure a Kubernetes ingress?",
  "positive": "Steps to set up ingress routing in Kubernetes clusters.",
  "negative": "What is the capital of France?"
}
```

### NLI Format (natural language inference)

Used with datasets like SNLI, MultiNLI — three classes: entailment, neutral, contradiction:

```json
{
  "premise":    "A man is playing the guitar.",
  "hypothesis": "A musician is performing.",
  "label": 0
}
```
Labels: `0` = entailment (similar), `1` = neutral, `2` = contradiction (dissimilar)

---

## Loss Function Selection

Choose based on your data format:

| Data format | Loss function | When to use |
|---|---|---|
| Pairs with float labels | `CosineSimilarityLoss` | You have similarity scores (0.0–1.0) |
| Triplets (anchor, pos, neg) | `TripletLoss` or `MultipleNegativesRankingLoss` | Most retrieval tasks |
| NLI pairs (entail/neutral/contra) | `SoftmaxLoss` | Classification-based similarity |
| Query + document pairs (no negatives) | `MultipleNegativesRankingLoss` | In-batch negatives from other examples |

`MultipleNegativesRankingLoss` with triplets is the recommended default for retrieval/RAG improvement.

---

## Hard Negatives

Hard negatives are semantically similar to the anchor but NOT the correct answer. They make
training significantly more effective than random negatives.

**Good hard negative (for a medical query):**
- Anchor: "Treatment for Type 2 diabetes"
- Positive: "Metformin is first-line for T2DM management"
- Random negative: "Recipe for chocolate cake" ← too easy, model learns nothing
- Hard negative: "Treatment for Type 1 diabetes" ← model must learn the distinction

**Generating hard negatives programmatically:**

```python
from sentence_transformers import SentenceTransformer
import numpy as np

def mine_hard_negatives(
    anchors: list[str],
    corpus: list[str],
    model_name: str = "all-MiniLM-L6-v2",
    top_k: int = 10,
    skip_top: int = 1,
) -> list[str]:
    """
    For each anchor, find the top_k most similar corpus sentences,
    then skip the top `skip_top` (which are likely positives) and
    use the next ones as hard negatives.
    """
    model = SentenceTransformer(model_name)
    anchor_embs = model.encode(anchors, convert_to_numpy=True)
    corpus_embs = model.encode(corpus,  convert_to_numpy=True)
    
    sims = np.dot(anchor_embs, corpus_embs.T)
    hard_negatives = []
    for row in sims:
        ranked = np.argsort(-row)
        hard_neg_idx = ranked[skip_top]
        hard_negatives.append(corpus[hard_neg_idx])
    return hard_negatives
```

---

## Building the Dataset from Domain Documents

For RAG improvement, build a query-document triplet dataset from your own corpus:

```python
import json
from pathlib import Path

def build_retrieval_dataset(
    corpus_path: str,
    output_path: str,
    queries_per_doc: int = 3,
):
    """
    Reads a JSONL corpus where each record has a 'text' field.
    Uses the document chunks themselves as positives.
    Negatives are mined from other documents in the corpus.
    """
    with open(corpus_path) as f:
        docs = [json.loads(l)["text"] for l in f]
    
    # Generate synthetic queries (requires an LLM call or use existing queries)
    # This is a scaffold — replace with actual query generation logic
    records = []
    for i, doc in enumerate(docs):
        for _ in range(queries_per_doc):
            # Placeholder: replace with actual synthetic query generation
            anchor   = f"[GENERATE_QUERY_FOR]: {doc[:100]}"
            positive = doc
            negative = docs[(i + len(docs) // 2) % len(docs)]  # naive: use a distant doc
            records.append({
                "anchor":   anchor,
                "positive": positive,
                "negative": negative,
            })
    
    with open(output_path, "w") as f:
        for r in records:
            f.write(json.dumps(r) + "\n")
    print(f"Built {len(records)} triplets → {output_path}")
```

---

## Applying with FastSentenceTransformer

```python
from unsloth import FastSentenceTransformer
from datasets import Dataset
from sentence_transformers import losses

model, tokenizer = FastSentenceTransformer.from_pretrained(
    "unsloth/Qwen3-Embedding-0.6B",
    max_seq_length=512,
)

dataset = Dataset.from_json("dataset.jsonl")

train_loss = losses.MultipleNegativesRankingLoss(model)
```

---

## Validation

```python
def validate_embedding_dataset(records, format_type="triplet"):
    errors = []
    required_fields = {
        "pair":    ["sentence1", "sentence2", "label"],
        "triplet": ["anchor", "positive", "negative"],
        "nli":     ["premise", "hypothesis", "label"],
    }[format_type]
    
    for i, record in enumerate(records):
        for field in required_fields:
            if field not in record:
                errors.append(f"Record {i}: missing field '{field}'")
            elif isinstance(record[field], str) and not record[field].strip():
                errors.append(f"Record {i}: empty string in '{field}'")
        if format_type == "triplet":
            if record.get("anchor") == record.get("positive"):
                errors.append(f"Record {i}: anchor and positive are identical")
            if record.get("positive") == record.get("negative"):
                errors.append(f"Record {i}: positive and negative are identical — not a valid hard negative")
    return errors
```

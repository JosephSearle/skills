# Embedding Model Fine-Tuning Reference

## Supported Embedding Models

| Model | VRAM | Use case |
|---|---|---|
| EmbeddingGemma-300M | ~2GB | Lightweight; production retrieval |
| Qwen3-Embedding-0.6B | ~3GB | Strong at multilingual retrieval |
| Qwen3-Embedding-1.8B | ~5GB | Better quality; balanced |
| Qwen3-Embedding-4B | ~8GB | High quality; RAG improvement |
| All-MiniLM-L6-v2 | ~1GB | Classic baseline; good for English |

---

## Model Loading

Use `FastSentenceTransformer` instead of `FastLanguageModel`:

```python
from unsloth import FastSentenceTransformer

model, tokenizer = FastSentenceTransformer.from_pretrained(
    "unsloth/Qwen3-Embedding-0.6B",
    max_seq_length=512,    # shorter than LLMs; 512 is standard for retrieval
)
```

---

## Training with sentence-transformers

Embedding models use `sentence-transformers` loss functions, not `SFTTrainer`:

```python
from sentence_transformers import SentenceTransformerTrainer, SentenceTransformerTrainingArguments
from sentence_transformers import losses

train_loss = losses.MultipleNegativesRankingLoss(model)  # recommended default

trainer = SentenceTransformerTrainer(
    model=model,
    args=SentenceTransformerTrainingArguments(
        output_dir="./outputs",
        num_train_epochs=3,
        per_device_train_batch_size=32,  # larger batches = more in-batch negatives = better
        learning_rate=2e-5,              # lower than SFT; embedding models use 1e-5 to 5e-5
        warmup_ratio=0.1,
        fp16=True,
        save_strategy="steps",
        save_steps=100,
        logging_steps=25,
    ),
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    loss=train_loss,
)

trainer.train()
```

---

## Loss Function Selection

| Dataset format | Loss | Notes |
|---|---|---|
| Triplets (anchor, positive, negative) | `MultipleNegativesRankingLoss` | Best for retrieval; uses in-batch negatives too |
| Pairs with float similarity score | `CosineSimilarityLoss` | Requires 0.0–1.0 labels |
| NLI (entail/neutral/contra) | `SoftmaxLoss` | Good for semantic similarity |
| Query + document (no negatives) | `MultipleNegativesRankingLoss` | Treats other in-batch docs as negatives |
| Pairs (similar/dissimilar, binary) | `ContrastiveLoss` | Simple; weaker than MNRL |

`MultipleNegativesRankingLoss` is the recommended default for most retrieval improvement tasks.

---

## Batch Size Matters More Than Epochs

For embedding training with `MultipleNegativesRankingLoss`, the batch size is the key
hyperparameter — not epochs. Each batch element serves as a negative for every other
element in the batch:

- Batch size 16: 15 negatives per example
- Batch size 32: 31 negatives per example
- Batch size 64: 63 negatives per example

Use the largest batch size your VRAM allows. If VRAM is limited, use `gradient_cache=True`:

```python
train_loss = losses.MultipleNegativesRankingLoss(model, scale=20.0)
# Note: gradient_cache is not compatible with all configurations; verify with your setup
```

---

## Evaluation for Embedding Models

Use the built-in `InformationRetrievalEvaluator` to measure retrieval quality:

```python
from sentence_transformers.evaluation import InformationRetrievalEvaluator

evaluator = InformationRetrievalEvaluator(
    queries={"q1": "What is the treatment for hypertension?", ...},
    corpus={"d1": "ACE inhibitors are first-line for hypertension...", ...},
    relevant_docs={"q1": {"d1", "d2"}, ...},
    name="domain-retrieval",
)

# Pass to trainer as callback or run manually:
score = evaluator(model)
print(f"nDCG@10: {score}")
```

---

## Saving and Pushing to Hub

```python
# Save locally
model.save_pretrained("./embedding_model")
tokenizer.save_pretrained("./embedding_model")

# Merge LoRA and save as full model
model.save_pretrained_merged("./embedding_model_merged", tokenizer)

# Push to Hugging Face Hub
model.push_to_hub("username/my-embedding-model", token="hf_...")
model.push_to_hub_merged("username/my-embedding-model-merged", tokenizer, token="hf_...")
```

---

## Performance Numbers

Unsloth reports for embedding fine-tuning:
- 1.8–3.3× faster training than standard sentence-transformers
- ~20% less memory
- Works on 3GB VRAM (EmbeddingGemma-300M with batch size 16)

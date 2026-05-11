# Model Fine-Tuning — Universal Reference

## Installation

Always install the latest Unsloth. Do not use pinned older versions unless debugging
a specific regression:

```bash
pip install --upgrade --force-reinstall --no-cache-dir unsloth unsloth_zoo
```

For dependency conflicts:
```bash
pip install --upgrade --force-reinstall --no-cache-dir --no-deps unsloth unsloth_zoo
```

Docker image for pre-configured environment:
```bash
docker pull unsloth/unsloth:latest
```

---

## LoRA Theory: Why It Works

LoRA (Low-Rank Adaptation) keeps the pre-trained model weights **frozen** and adds small
trainable matrices alongside them. For a weight matrix W of shape [d_out, d_in], LoRA
adds two matrices: A [d_out, r] and B [r, d_in], where r is the rank (r << d).

The effective weight update is: ΔW = A × B

This reduces trainable parameters from d_out × d_in to r × (d_out + d_in), often a 99%+
reduction in trainable parameters while preserving most of the adaptation capability.

**QLoRA** extends this by quantising the frozen base model to 4-bit while keeping the
LoRA adapters in 16-bit. This provides ~70% VRAM reduction compared to full fine-tuning
with minimal quality loss for most tasks.

---

## LoRA Target Modules

Always apply LoRA to all major projection layers. Using a subset reduces quality:

```python
target_modules = [
    "q_proj",    # query projection in attention
    "k_proj",    # key projection
    "v_proj",    # value projection
    "o_proj",    # output projection
    "gate_proj", # gate in MLP
    "up_proj",   # up projection in MLP
    "down_proj", # down projection in MLP
]
```

For embedding/CPT tasks, also include:
```python
target_modules += ["embed_tokens", "lm_head"]
```

---

## Common Pitfalls

### Chat Template Mismatch (most common failure)

The chat template applied to the dataset in `prepare_dataset.py` **must** match the one
passed to `get_chat_template(tokenizer, chat_template=...)` in `train.py`.

Symptom: model generates gibberish, never stops, or gives generic non-task-specific output.
Diagnosis: check that `CHAT_TEMPLATE` is the same string in both scripts.

### Label Masking Error

When using `train_on_responses_only`, all user/system tokens are masked with `-100` so
the model only predicts assistant tokens. If all tokens show `-100`, the masking boundary
was not found.

Symptom: loss stays exactly at 0.0 for the entire first epoch.
Diagnosis: verify `role="assistant"` (not "AI", "Agent", etc.) and that the template was
applied before calling `train_on_responses_only`.

### torch.compile Warmup

The first ~50 steps are slow while torch.compile traces and compiles the graph. This is
expected. Do not measure throughput or cancel training during this window (~5 minutes on
a typical GPU). After warmup, expect ~2× speedup compared to no compilation.

### Memory Issues During Evaluation

Evaluation uses the same model in forward-only mode but still requires significant VRAM.
If OOM during eval:
```python
eval_accumulation_steps=4,  # accumulate eval batches
per_device_eval_batch_size=1,
fp16_full_eval=True,
```

### GGUF Export Memory Crash

If `save_pretrained_gguf` crashes, reduce memory usage:
```python
model.save_pretrained_gguf(
    "output",
    tokenizer,
    quantization_method="q4_k_m",
    maximum_memory_usage=0.5,  # default is 0.75; reduce if crash
)
```

---

## Loss Interpretation

| Training loss range | Interpretation |
|---|---|
| > 2.0 | Learning rate too high, or data formatting error |
| 1.5–2.0 | Learning is starting; check after 100 steps |
| 0.5–1.5 | Normal range for instruction fine-tuning |
| 0.2–0.5 | Good convergence; monitor for overfitting |
| < 0.2 | Risk of memorisation; consider stopping early |
| Flat at any value | Chat template mismatch or all labels `-100` |

Loss must **decrease** over the first 50 steps. If it does not move, there is a data or
configuration error — do not wait for a full epoch.

---

## Overfitting and Underfitting Signals

**Overfitting (training loss drops but eval loss rises or stays flat):**
- Reduce `num_train_epochs` (try 1)
- Reduce `learning_rate` (halve it)
- Reduce LoRA rank (try 8)
- Add `weight_decay=0.1`

**Underfitting (both losses plateau high):**
- Increase `num_train_epochs` (add 1)
- Increase `learning_rate` (double it)
- Increase LoRA rank (try 32 or 64)
- Check dataset quality — bad examples cap the achievable loss

---

## Checkpoint Configuration

Always configure checkpointing. A training run without checkpoints risks losing all
progress to an OOM crash, kernel restart, or disconnection:

```python
from transformers import TrainingArguments, EarlyStoppingCallback

args = TrainingArguments(
    output_dir="./outputs",
    save_strategy="steps",
    save_steps=50,
    save_total_limit=3,          # keep last 3 checkpoints, delete older
    eval_strategy="steps",
    eval_steps=50,
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss",
    greater_is_better=False,
)

callbacks = [EarlyStoppingCallback(early_stopping_patience=3)]
```

Resume from checkpoint:
```python
trainer.train(resume_from_checkpoint=True)
# or from a specific path:
trainer.train(resume_from_checkpoint="./outputs/checkpoint-500")
```

---

## Multi-GPU Training

For models that exceed a single GPU's VRAM, distribute across GPUs:

```bash
# DDP (identical model on each GPU, different data shards)
torchrun --nproc_per_node 4 train.py

# Or with accelerate (must configure first: accelerate config)
accelerate launch train.py
```

For a model too large for one GPU but you want inference-style distribution:
```python
# In from_pretrained:
device_map="balanced"  # not "auto"; "balanced" distributes evenly
```

Note: DDP requires `device_map=None` and each GPU must have enough VRAM for the full model
(or one shard). `device_map="balanced"` is for inference / single-process training only.

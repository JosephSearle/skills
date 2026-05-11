---
name: model-finetuning
description: >
  Generate a complete, runnable train.py script using Unsloth for fine-tuning language
  models (LLMs, Vision, Embedding, TTS). Detects model family, training method, VRAM
  constraints, and task goal; selects the appropriate Unsloth trainer (SFTTrainer,
  GRPOTrainer, DPOTrainer); configures hyperparameters; and writes train.py to disk with
  checkpoint and early-stopping configuration. Grounded in Unsloth documentation covering
  500+ models and QLoRA/LoRA/GRPO/DPO/CPT methods. Triggers on: "fine-tune a model",
  "train with Unsloth", "create training script", "configure LoRA", "set up QLoRA
  training", "train on my dataset", "fine-tune llama", "fine-tune gemma", "apply GRPO",
  "run DPO", "continued pretraining", "generate a training script", or any instruction
  to create or configure an Unsloth-based training run.
---

# Model Fine-Tuning Skill

A skill for generating complete Unsloth training scripts for any supported model type and
training method. Covers QLoRA, LoRA, GRPO, DPO, ORPO, and Continued Pretraining —
grounded in Unsloth documentation and the principle that the correct method and
hyperparameters for your task matter far more than raw compute.

---

## Core Philosophy

Fine-tuning is not a one-size-fits-all operation. The training method, model type, and
available hardware each constrain the design space before a single hyperparameter is set.
Getting these choices right is the highest-leverage decision in a fine-tuning run.

A training script that compiles and runs is not the goal. A training script that converges
to a model which reliably solves the target task — without memorising the training set or
catastrophically forgetting prior capabilities — is the goal.

---

## Step 1 — Detect Training Context

Gather the following before generating any code. Ask if genuinely unknown:

**Model:**
- Model name or family (e.g., `llama-3.1-8b-instruct`, `qwen2.5-7b`, `gemma-3-4b`)
- If unknown: suggest `unsloth/llama-3.1-8b-instruct` as a well-supported default

**Model type** — determine from the model name and task description:

| Model type | Indicators |
|---|---|
| Standard LLM | Text-only task; model name has no "vision", "vl", "embed", "tts" suffix |
| Vision | Model name contains "vision", "vl", or task involves images |
| Embedding | Model name contains "embed", or task is retrieval/RAG improvement |
| TTS | Model is Orpheus-TTS or Sesame-CSM, or task produces speech |

**Task goal** — determines training method:

| Goal | Training method |
|---|---|
| Instruction following, domain knowledge, task adaptation | QLoRA (default) or LoRA |
| Reasoning, math, coding with self-evaluation | GRPO |
| Preference alignment, human feedback, ranked outputs | DPO or ORPO |
| New language domain, out-of-distribution knowledge, new tokens | CPT (Continued Pretraining) |

**Available VRAM** — determines quantisation level:

```
VRAM available:
  ≤ 8GB   → load_in_4bit=True, reduce rank to 8, batch_size=1
  ≤ 16GB  → load_in_4bit=True (standard QLoRA)
  16–40GB → load_in_4bit=False (16-bit LoRA)
  > 40GB  → Full fine-tuning available, or high-rank LoRA
```

If VRAM is unknown, default to `load_in_4bit=True` with a comment to adjust.

**Dataset path** — the `.jsonl` file produced by the `dataset-preparation` skill.

---

## Step 2 — Select Training Method

Apply the decision tree from Step 1:

```
Task goal → Instruction following / domain knowledge:
  └─ VRAM ≤ 16GB → QLoRA  → load references/methods/qlora.md
  └─ VRAM > 16GB → LoRA   → load references/methods/lora.md

Task goal → Reasoning / math / RL:
  └─ GRPO         → load references/methods/grpo.md

Task goal → Preference alignment:
  └─ DPO / ORPO   → load references/methods/dpo.md

Task goal → New domain / new tokens:
  └─ CPT          → load references/methods/cpt.md
```

---

## Step 3 — Load References

Always load `references/universal.md` first.

```
Method selected    → load references/methods/<method>.md
Model type         → load references/models/<type>.md  (skip if standard LLM)

Vision model       → load references/models/vision.md
Embedding model    → load references/models/embedding.md
TTS model          → load references/models/tts.md
```

---

## Step 4 — Configure Hyperparameters

Apply the defaults from the method reference file, then adjust for context:

**Universal defaults (QLoRA / LoRA):**

| Parameter | Default | Adjust when |
|---|---|---|
| `learning_rate` | `2e-4` | Overfitting: halve; underfitting: double |
| `num_train_epochs` | `2` | < 1,000 examples: try 3; > 10,000: try 1 |
| `per_device_train_batch_size` | `2` | OOM: set to 1; ample VRAM: try 4 |
| `gradient_accumulation_steps` | `8` | Adjust inversely with batch size (effective batch = batch × accum) |
| `warmup_steps` | `5` | 5–10% of total steps |
| `weight_decay` | `0.01` | Overfitting: increase to 0.1 |
| `lora_r` (rank) | `16` | Simple tasks: 8; complex tasks: 32 or 64 |
| `lora_alpha` | `32` | Always ≥ rank; alpha/rank ratio = 2 is standard |
| `lora_dropout` | `0` | Leave at 0 unless experimenting |
| `max_seq_length` | `2048` | Increase for long documents; reduce to save memory |

**LoRA target modules (always include all major projection layers):**
```python
target_modules = [
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
]
```

**GRPO:** `learning_rate=5e-6`, custom reward function required (see `references/methods/grpo.md`)

**CPT:** embedding layer learning rate = main_lr / 5 (see `references/methods/cpt.md`)

---

## Step 5 — Generate `train.py`

Generate a complete Python script structured as:

1. **CONFIGURATION block** — all user-adjustable values at the top
2. **Model + tokenizer loading** — using the correct `FastLanguageModel` / `FastVisionModel` variant
3. **LoRA / adapter configuration** — `get_peft_model` with target modules
4. **Dataset loading** — from the `.jsonl` file, applying the chat template
5. **Trainer initialisation** — `SFTTrainer`, `GRPOTrainer`, or `DPOTrainer` with:
   - `TrainingArguments` with checkpoint config (`save_strategy="steps"`, `save_steps=50`, `save_total_limit=3`)
   - Evaluation config (`eval_strategy="steps"`, `eval_steps=50`)
   - `EarlyStoppingCallback(early_stopping_patience=3)`
   - `load_best_model_at_end=True`
6. **Training execution** — `trainer.train()`
7. **Model saving** — save the adapter (LoRA) by default; note the `model-deployment` skill for export

Include **inline comments** at every major decision point explaining why that value was
chosen (e.g., `# rank=16: balanced for instruction-following; increase to 32 for complex reasoning`).

Include a **VRAM estimate** comment at the top based on the selected method and model size.

Apply all method-specific and model-type-specific patterns from the loaded reference files.

---

## Step 6 — Write to Disk and Provide Run Guidance

Write `train.py` to the current working directory.

Provide the exact commands to run:

```bash
# Install Unsloth (always use latest)
pip install --upgrade --force-reinstall --no-cache-dir unsloth unsloth_zoo

# Run training
python train.py

# Multi-GPU training (replace N with GPU count)
torchrun --nproc_per_node N train.py

# Monitor GPU usage during training
watch -n 1 nvidia-smi
```

**Performance notes to include:**
- torch.compile takes ~5 minutes to warm up on first run — throughput metrics before then
  are meaningless; do not cancel early
- Training loss of 0.5–1.0 is typical for instruction fine-tuning; below 0.3 risks
  memorisation; above 1.5 suggests learning rate is too high or dataset has formatting errors
- Loss must decrease over the first 50 steps; if flat, the chat template is likely wrong

State the checkpoint directory (default: `./outputs/`) and remind the user to pass the
checkpoint path to the `model-deployment` skill when ready to export.

---

## Reference Files

- `references/universal.md` — Unsloth installation, LoRA theory, target modules, common
  pitfalls (chat template mismatch, label masking), overfitting and underfitting signals,
  loss interpretation
- `references/methods/qlora.md` — 4-bit quantisation, `load_in_4bit`, SFTTrainer config,
  `train_on_responses_only`, packing
- `references/methods/lora.md` — 16-bit LoRA, alpha/rank ratios, module selection,
  when to use over QLoRA
- `references/methods/grpo.md` — `GRPOTrainer`, reward function scaffold, 75/25
  reasoning/non-reasoning mix, DeepSeek-style training
- `references/methods/dpo.md` — `DPOTrainer`, ORPO variant, preference dataset format,
  `beta` parameter
- `references/methods/cpt.md` — Continued pretraining, embedding layer lr scaling,
  `lm_head` and `embed_tokens` inclusion, when to use
- `references/models/vision.md` — `FastVisionModel`, selective layer tuning flags,
  vision data collator, inference mode switch
- `references/models/embedding.md` — `FastSentenceTransformer`, loss functions, Hub push
- `references/models/tts.md` — TTS model loading, audio collator, Orpheus/Sesame patterns

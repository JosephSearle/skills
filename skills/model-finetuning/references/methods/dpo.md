# DPO / ORPO Fine-Tuning Reference

## When to Use DPO vs ORPO vs GRPO

| Method | Use when |
|---|---|
| DPO | You have preference pairs (chosen/rejected) and want stable, well-studied training |
| ORPO | You want a simpler alternative to DPO with better empirical results on some tasks |
| GRPO | You have a computable reward function, not pre-labelled preference pairs |

DPO and ORPO both require a dataset of **preference pairs** — same prompt, two completions
where one is preferred over the other. Unlike GRPO, you do not define a reward function.

---

## Dataset Format

DPO and ORPO require a dataset with three fields per example:

```json
{
  "prompt":   "Explain quantum entanglement to a 10-year-old.",
  "chosen":   "Imagine two magic dice that always land on opposite numbers...",
  "rejected": "Quantum entanglement is a phenomenon where two particles become correlated..."
}
```

**Rules:**
- `prompt`: the input without any response
- `chosen`: the preferred response (higher quality, safer, more helpful)
- `rejected`: the less-preferred response (lower quality, harmful, less accurate)
- The quality gap between chosen and rejected must be meaningful — barely-different pairs
  produce weak gradient signal
- Chosen and rejected must address the same prompt — do not compare off-topic responses

**Sourcing preference data:**
- Human annotators labelling model outputs (highest quality)
- Using a strong model (GPT-4, Claude) to label and rank outputs from a weaker model
- Rule-based labelling: completions that pass safety filters vs those that don't
- Synthetic: generating one good response and one intentionally flawed response

---

## DPO Training

```python
# ============================================================
# CONFIGURATION
# ============================================================
MODEL_NAME    = "unsloth/llama-3.1-8b-instruct"
DATASET_PATH  = "preference_dataset.jsonl"
OUTPUT_DIR    = "./outputs"
MAX_SEQ_LENGTH = 2048

LORA_RANK     = 16
LORA_ALPHA    = 32
LEARNING_RATE = 5e-5   # Lower than SFT; typically 1e-5 to 1e-4
BETA          = 0.1    # KL divergence penalty; higher = stay closer to base model
NUM_EPOCHS    = 1
BATCH_SIZE    = 2
GRAD_ACCUM    = 4
# ============================================================

from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template
from trl import DPOTrainer, DPOConfig
from datasets import load_dataset

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=LORA_RANK,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_alpha=LORA_ALPHA,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=42,
)

tokenizer = get_chat_template(tokenizer, chat_template="llama-3")
dataset = load_dataset("json", data_files=DATASET_PATH, split="train")
split = dataset.train_test_split(test_size=0.1, seed=42)

trainer = DPOTrainer(
    model=model,
    ref_model=None,  # None = use the base model weights as reference (memory-efficient)
    tokenizer=tokenizer,
    train_dataset=split["train"],
    eval_dataset=split["test"],
    args=DPOConfig(
        beta=BETA,
        learning_rate=LEARNING_RATE,
        num_train_epochs=NUM_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        output_dir=OUTPUT_DIR,
        save_strategy="steps",
        save_steps=50,
        save_total_limit=3,
        eval_strategy="steps",
        eval_steps=50,
        load_best_model_at_end=True,
        logging_steps=10,
        optim="adamw_8bit",
        max_length=MAX_SEQ_LENGTH,
        max_prompt_length=MAX_SEQ_LENGTH // 2,
    ),
)

trainer.train()
model.save_pretrained(OUTPUT_DIR + "/lora_adapter")
tokenizer.save_pretrained(OUTPUT_DIR + "/lora_adapter")
```

---

## ORPO Training

ORPO (Odds Ratio Preference Optimization) combines SFT and preference alignment into a
single training objective — no reference model needed. Often more stable than DPO:

```python
from trl import ORPOTrainer, ORPOConfig

trainer = ORPOTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=split["train"],
    eval_dataset=split["test"],
    args=ORPOConfig(
        lambda_orpo=0.1,        # preference weight; equivalent to beta in DPO
        learning_rate=LEARNING_RATE,
        num_train_epochs=NUM_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        output_dir=OUTPUT_DIR,
        save_strategy="steps",
        save_steps=50,
        save_total_limit=3,
        logging_steps=10,
        optim="adamw_8bit",
        max_length=MAX_SEQ_LENGTH,
        max_prompt_length=MAX_SEQ_LENGTH // 2,
    ),
)
```

---

## The `beta` Parameter (DPO)

`beta` controls the KL divergence penalty — how far the trained model is allowed to drift
from the base model:

| `beta` | Behaviour |
|---|---|
| 0.01–0.05 | Strong preference signal; risk of forgetting base capabilities |
| 0.1 | Default; balanced preference vs stability |
| 0.5 | Conservative; stays close to base model |
| 1.0+ | Very conservative; minimal preference shift |

Start with `beta=0.1`. If the model's general capability degrades after training, increase
beta. If preference alignment is too weak, decrease beta.

---

## Monitoring DPO Training

Watch these metrics:
- **`rewards/chosen`** should increase over time
- **`rewards/rejected`** should decrease over time
- **`rewards/margins`** (chosen − rejected) should increase — this is the primary signal
- **`logps/chosen`** and **`logps/rejected`** — log probabilities of each response type

If `rewards/margins` is flat or negative: preference pairs may be too similar, or the
learning rate is too high.

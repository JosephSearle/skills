# QLoRA Fine-Tuning Reference

## When to Use QLoRA

QLoRA (Quantized LoRA) is the **recommended default** for most fine-tuning tasks:
- VRAM is the binding constraint (≤ 16GB)
- Task is instruction-following, domain knowledge, or task adaptation
- Acceptable to trade a small amount of quality for 70% VRAM reduction

**Do not use QLoRA for:** GRPO (RL), DPO (preference), or Continued Pretraining — each
has its own reference file with specialised configuration.

---

## Complete `train.py` Template

```python
# ============================================================
# CONFIGURATION — adjust these values for your task
# ============================================================
MODEL_NAME      = "unsloth/llama-3.1-8b-instruct"  # Change to your target model
DATASET_PATH    = "dataset.jsonl"                   # Output from dataset-preparation skill
CHAT_TEMPLATE   = "llama-3"   # MUST match what was used in prepare_dataset.py
OUTPUT_DIR      = "./outputs"
MAX_SEQ_LENGTH  = 2048        # Increase for long documents; reduce to save memory
LOAD_IN_4BIT    = True        # Set False for 16-bit LoRA (requires more VRAM)

# LoRA hyperparameters
LORA_RANK       = 16          # 8=simple tasks, 16=default, 32=complex, 64=max quality
LORA_ALPHA      = 32          # Keep at 2× rank
LEARNING_RATE   = 2e-4        # Halve if overfitting; double if underfitting
NUM_EPOCHS      = 2           # 1–3 epochs; beyond 3 risks memorisation
BATCH_SIZE      = 2           # Reduce to 1 if OOM
GRAD_ACCUM      = 8           # Effective batch = BATCH_SIZE × GRAD_ACCUM = 16
WARMUP_STEPS    = 5
WEIGHT_DECAY    = 0.01

# Estimated VRAM: ~6–8GB for 8B model with 4-bit QLoRA
# ============================================================

from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template
from trl import SFTTrainer, DataCollatorForCompletionOnlyLM
from transformers import TrainingArguments, EarlyStoppingCallback
from datasets import load_dataset

# Load model and tokenizer
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=None,           # Auto-detect: float16 on older GPUs, bfloat16 on newer
    load_in_4bit=LOAD_IN_4BIT,
)

# Apply LoRA adapters
model = FastLanguageModel.get_peft_model(
    model,
    r=LORA_RANK,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_alpha=LORA_ALPHA,
    lora_dropout=0,        # 0 is optimal per Unsloth; do not change without reason
    bias="none",
    use_gradient_checkpointing="unsloth",  # reduces VRAM by ~30%
    random_state=42,
    use_rslora=False,      # Rank-Stabilised LoRA; try True if rank > 32
)

# Apply chat template
tokenizer = get_chat_template(tokenizer, chat_template=CHAT_TEMPLATE)

# Load and format dataset
dataset = load_dataset("json", data_files=DATASET_PATH, split="train")

def format_sample(sample):
    sample["text"] = tokenizer.apply_chat_template(
        sample["conversations"],
        tokenize=False,
        add_generation_prompt=False,
    )
    return sample

dataset = dataset.map(format_sample, batched=False)

# Split train/eval (90/10)
split = dataset.train_test_split(test_size=0.1, seed=42)
train_dataset = split["train"]
eval_dataset  = split["test"]

# Train on assistant responses only (masks user/system tokens)
from trl import SFTTrainer
from unsloth.chat_templates import train_on_responses_only

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    dataset_num_proc=2,
    packing=False,   # Set True to pack short sequences into one; faster but may affect quality
    args=TrainingArguments(
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        warmup_steps=WARMUP_STEPS,
        num_train_epochs=NUM_EPOCHS,
        learning_rate=LEARNING_RATE,
        fp16=not FastLanguageModel.is_bfloat16_supported(),
        bf16=FastLanguageModel.is_bfloat16_supported(),
        logging_steps=10,
        optim="adamw_8bit",
        weight_decay=WEIGHT_DECAY,
        lr_scheduler_type="linear",
        seed=42,
        output_dir=OUTPUT_DIR,
        # Checkpointing
        save_strategy="steps",
        save_steps=50,
        save_total_limit=3,
        # Evaluation
        eval_strategy="steps",
        eval_steps=50,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
    ),
    callbacks=[EarlyStoppingCallback(early_stopping_patience=3)],
)

# Mask user/system tokens so model only predicts assistant responses
trainer = train_on_responses_only(
    trainer,
    instruction_part="<|start_header_id|>user<|end_header_id|>\n\n",
    response_part="<|start_header_id|>assistant<|end_header_id|>\n\n",
)

# Train
trainer_stats = trainer.train()
print(f"Training complete. Peak VRAM: {trainer_stats.metrics.get('train_runtime', 'N/A')}s")

# Save LoRA adapter (use model-deployment skill to export to GGUF / vLLM)
model.save_pretrained(OUTPUT_DIR + "/lora_adapter")
tokenizer.save_pretrained(OUTPUT_DIR + "/lora_adapter")
print(f"LoRA adapter saved to {OUTPUT_DIR}/lora_adapter")
print("Run the model-deployment skill to export for serving.")
```

---

## `train_on_responses_only` Boundary Tokens by Template

The `instruction_part` and `response_part` strings must exactly match the template tokens:

| Template | `instruction_part` | `response_part` |
|---|---|---|
| `llama-3` | `"<\|start_header_id\|>user<\|end_header_id\|>\n\n"` | `"<\|start_header_id\|>assistant<\|end_header_id\|>\n\n"` |
| `chatml` | `"<\|im_start\|>user\n"` | `"<\|im_start\|>assistant\n"` |
| `gemma-3` | `"<start_of_turn>user\n"` | `"<start_of_turn>model\n"` |
| `mistral` | `"[INST] "` | `" [/INST]"` |

---

## Sequence Packing

Setting `packing=True` combines short sequences into one long sequence to maximise GPU
utilisation. Use when:
- Average sequence length < 512 tokens (many short conversations)
- Training speed is a priority over gradient isolation

Do not use packing for:
- Multi-turn conversations where context boundaries matter
- Evaluation datasets (always set `packing=False` for eval)

---

## Memory-Efficient Tips

- `use_gradient_checkpointing="unsloth"` saves ~30% VRAM with ~10% speed cost
- `optim="adamw_8bit"` quantises optimiser states (saves ~30% more VRAM vs standard Adam)
- Reduce `max_seq_length` to the 95th percentile of your dataset's token lengths
- `per_device_train_batch_size=1` with `gradient_accumulation_steps=16` maintains effective
  batch of 16 while halving activation memory

# Continued Pretraining (CPT) Reference

## When to Use CPT

Continued Pretraining steers a model toward a new knowledge domain before (or instead of)
instruction fine-tuning. Use CPT when:

- Introducing **entirely new domain vocabulary** not present in the original training data
  (medical abbreviations, legal citations, proprietary technical jargon)
- Training on a **new natural language** that the base model handles poorly
- The base model has significant **out-of-distribution gaps** for your target domain
- You want to extend an existing LoRA adapter with new knowledge without losing prior capability

Do not use CPT for:
- Teaching the model to follow instructions (use QLoRA/SFT)
- Preference alignment (use DPO/GRPO)
- Tasks where the base model already has the required knowledge — SFT is sufficient

---

## CPT vs SFT

| Aspect | CPT | SFT |
|---|---|---|
| Data format | Raw text, not conversation pairs | Instruction/response pairs |
| Goal | Embed new knowledge into weights | Teach a task or behaviour |
| Typical dataset size | 100MB–10GB of text | 100–100,000 examples |
| Learning rate | Lower; embedding layers get even lower | Standard (2e-4) |
| Target modules | Includes `embed_tokens` and `lm_head` | Excludes embedding layers |

---

## Data Format for CPT

CPT uses raw text — not conversations. Feed the raw domain documents directly:

```json
{"text": "The patient presented with acute myocardial infarction (AMI), confirmed via..."}
{"text": "Section 12(b) of the Securities Exchange Act of 1934 requires issuers to..."}
```

**Sources:**
- Domain PDFs converted to text (`pdfplumber`, `pymupdf`)
- Technical documentation, manuals, academic papers
- Code repositories (for code-focused CPT)
- Web crawls filtered to the target domain

**Quality for CPT:**
- Deduplication is critical — repeated text is memorised, not learned
- Remove boilerplate (headers, footers, navigation, ads)
- Maintain natural sentence boundaries — do not split mid-sentence during chunking
- Chunk length should target the `max_seq_length` you will train with

---

## Embedding Layer Learning Rate

The critical CPT-specific configuration: embedding layer learning rates must be 2–10×
lower than the main learning rate to prevent destabilising the existing token representations:

```python
from unsloth import FastLanguageModel

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/llama-3.1-8b",  # use BASE model, not instruct
    max_seq_length=2048,
    load_in_4bit=True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
        "embed_tokens",  # include embedding layers for CPT
        "lm_head",       # include output projection for CPT
    ],
    lora_alpha=32,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=42,
)
```

Apply differential learning rates via parameter groups:

```python
from torch.optim import AdamW

MAIN_LR   = 2e-4
EMBED_LR  = MAIN_LR / 5   # 5x lower for embedding layers

embedding_params = []
other_params     = []

for name, param in model.named_parameters():
    if param.requires_grad:
        if "embed_tokens" in name or "lm_head" in name:
            embedding_params.append(param)
        else:
            other_params.append(param)

optimizer = AdamW([
    {"params": other_params,     "lr": MAIN_LR},
    {"params": embedding_params, "lr": EMBED_LR},
])
```

---

## Complete `train.py` Template

```python
# ============================================================
# CONFIGURATION
# ============================================================
MODEL_NAME      = "unsloth/llama-3.1-8b"   # BASE model (not instruct) for CPT
DATASET_PATH    = "domain_corpus.jsonl"
OUTPUT_DIR      = "./outputs"
MAX_SEQ_LENGTH  = 2048

LORA_RANK       = 16
LORA_ALPHA      = 32
MAIN_LR         = 2e-4
EMBED_LR        = MAIN_LR / 5    # 5× lower for embed_tokens and lm_head
NUM_EPOCHS      = 1               # CPT datasets are large; 1 epoch often sufficient
BATCH_SIZE      = 2
GRAD_ACCUM      = 8
# ============================================================

from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments, EarlyStoppingCallback
from datasets import load_dataset
from torch.optim import AdamW

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
        "embed_tokens", "lm_head",
    ],
    lora_alpha=LORA_ALPHA,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=42,
)

# CPT uses raw text — no chat template needed
dataset = load_dataset("json", data_files=DATASET_PATH, split="train")
split   = dataset.train_test_split(test_size=0.05, seed=42)

# Differential learning rate setup
embedding_params, other_params = [], []
for name, param in model.named_parameters():
    if param.requires_grad:
        if "embed_tokens" in name or "lm_head" in name:
            embedding_params.append(param)
        else:
            other_params.append(param)

optimizer = AdamW([
    {"params": other_params,     "lr": MAIN_LR,  "weight_decay": 0.01},
    {"params": embedding_params, "lr": EMBED_LR, "weight_decay": 0.01},
])

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=split["train"],
    eval_dataset=split["test"],
    dataset_text_field="text",   # raw text field — no conversation formatting
    max_seq_length=MAX_SEQ_LENGTH,
    packing=True,    # CPT benefits from packing — maximises GPU utilisation on raw text
    args=TrainingArguments(
        num_train_epochs=NUM_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        logging_steps=25,
        output_dir=OUTPUT_DIR,
        save_strategy="steps",
        save_steps=100,
        save_total_limit=3,
        eval_strategy="steps",
        eval_steps=100,
        load_best_model_at_end=True,
        optim="adamw_8bit",
        fp16=not FastLanguageModel.is_bfloat16_supported(),
        bf16=FastLanguageModel.is_bfloat16_supported(),
    ),
    optimizers=(optimizer, None),   # pass custom optimizer; scheduler auto-created
)

trainer.train()
model.save_pretrained(OUTPUT_DIR + "/lora_adapter")
tokenizer.save_pretrained(OUTPUT_DIR + "/lora_adapter")
print("CPT complete. Follow with SFT (model-finetuning) using instruction data.")
```

---

## CPT → SFT Pipeline

CPT is almost always followed by SFT. The recommended workflow:

1. **CPT** — embed domain knowledge using raw text corpus
2. **SFT** (QLoRA) — teach the model to follow instructions using the domain knowledge
3. Optional: **DPO** — align outputs with human preferences

Start SFT from the CPT checkpoint, not the original base model:

```python
# In the SFT train.py — load from CPT output
MODEL_NAME = "./outputs/lora_adapter"   # CPT checkpoint
```

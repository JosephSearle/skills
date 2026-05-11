# TTS Model Fine-Tuning Reference

## Supported TTS Models

| Model | Notes |
|---|---|
| **Orpheus-TTS** | Primary supported TTS model; 24kHz; natural speech synthesis |
| **Sesame-CSM** | Conversational speech model; context-aware prosody |

Unsloth reports 1.5× faster TTS training with 50% less memory than standard approaches.

---

## Model Loading

TTS models use `FastLanguageModel` with TTS-specific configuration:

```python
from unsloth import FastLanguageModel

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="unsloth/orpheus-3b-0.1-ft",  # or "unsloth/sesame-csm-1b"
    max_seq_length=2048,
    load_in_4bit=True,
    dtype=None,
)
```

---

## LoRA Configuration for TTS

TTS models apply LoRA the same way as LLMs, but the effective modules may differ:

```python
model = FastLanguageModel.get_peft_model(
    model,
    r=16,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_alpha=32,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=42,
)
```

---

## Audio Collator

TTS training requires a specialised data collator that handles audio tensors. Use the
`DataCollatorForSeq2Seq` with audio-aware padding:

```python
from transformers import DataCollatorForSeq2Seq

data_collator = DataCollatorForSeq2Seq(
    tokenizer=tokenizer,
    model=model,
    padding=True,
    pad_to_multiple_of=8,
)
```

For Orpheus-TTS, the tokenizer encodes audio as discrete tokens using a codec model.
The dataset must be pre-processed to convert audio to token IDs before training.

---

## Dataset Preparation for TTS Training

TTS training requires converting audio to codec tokens. Orpheus uses a codec that converts
waveforms to discrete token sequences:

```python
from datasets import Dataset, Audio

# Load the pre-tokenised TTS dataset
dataset = Dataset.from_dict({
    "audio":      ["/path/to/clip1.wav", ...],
    "transcript": ["Hello world.", ...],
})
dataset = dataset.cast_column("audio", Audio(sampling_rate=24000))

def tokenise_audio(batch):
    # Audio tokenisation is model-specific
    # For Orpheus: audio → codec encoder → token IDs
    # This step is handled by the Orpheus tokenizer
    inputs = tokenizer(
        text=batch["transcript"],
        audio=batch["audio"],
        return_tensors="pt",
        padding=True,
    )
    return inputs
```

---

## Complete `train.py` Template

```python
# ============================================================
# CONFIGURATION
# ============================================================
MODEL_NAME     = "unsloth/orpheus-3b-0.1-ft"  # or sesame-csm-1b
DATASET_PATH   = "tts_dataset.jsonl"
OUTPUT_DIR     = "./outputs"
MAX_SEQ_LENGTH = 2048

LORA_RANK      = 16
LORA_ALPHA     = 32
LEARNING_RATE  = 2e-4
NUM_EPOCHS     = 3     # TTS often benefits from more epochs; monitor output quality
BATCH_SIZE     = 2
GRAD_ACCUM     = 4
# ============================================================

from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments, EarlyStoppingCallback, DataCollatorForSeq2Seq
from datasets import load_dataset, Audio

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

dataset = load_dataset("json", data_files=DATASET_PATH, split="train")
dataset = dataset.cast_column("audio", Audio(sampling_rate=24000))
split   = dataset.train_test_split(test_size=0.1, seed=42)

data_collator = DataCollatorForSeq2Seq(
    tokenizer=tokenizer,
    model=model,
    padding=True,
)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=split["train"],
    eval_dataset=split["test"],
    data_collator=data_collator,
    args=TrainingArguments(
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        num_train_epochs=NUM_EPOCHS,
        learning_rate=LEARNING_RATE,
        fp16=not FastLanguageModel.is_bfloat16_supported(),
        bf16=FastLanguageModel.is_bfloat16_supported(),
        logging_steps=10,
        output_dir=OUTPUT_DIR,
        save_strategy="steps",
        save_steps=50,
        save_total_limit=3,
        eval_strategy="steps",
        eval_steps=50,
        load_best_model_at_end=True,
        optim="adamw_8bit",
    ),
    callbacks=[EarlyStoppingCallback(early_stopping_patience=3)],
)

trainer.train()
model.save_pretrained(OUTPUT_DIR + "/lora_adapter")
tokenizer.save_pretrained(OUTPUT_DIR + "/lora_adapter")
```

---

## Quality Evaluation for TTS

TTS quality is evaluated by listening, not by loss alone. After training:

1. Generate sample outputs with representative inputs
2. Check for: naturalness, correct pronunciation of domain terms, consistent prosody
3. Common issues:
   - Robotic/monotone: dataset has insufficient prosodic variation
   - Mispronunciation: transcript normalisation was incomplete
   - Audio artifacts: sampling rate mismatch in training data
   - Repetition loops: context length exceeded during generation

---

## Notes on Sampling Rate Consistency

TTS training is highly sensitive to inconsistent audio formats. Before training, verify:

```bash
# Check sampling rates across dataset
python -c "
import soundfile as sf
import json

with open('tts_dataset.jsonl') as f:
    records = [json.loads(l) for l in f]

rates = set()
for r in records:
    info = sf.info(r['audio'])
    rates.add(info.samplerate)

print('Sampling rates found:', rates)
assert rates == {24000}, f'All files must be 24kHz; found: {rates}'
print('OK — all files are 24kHz')
"
```

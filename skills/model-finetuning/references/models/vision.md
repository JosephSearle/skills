# Vision Model Fine-Tuning Reference

## Supported Vision Models

| Model | Size | Notes |
|---|---|---|
| Llama 3.2 Vision Instruct | 11B, 90B | Meta; strong general vision |
| Qwen2.5-VL | 7B, 72B | Strong at OCR and document understanding |
| Qwen3-VL | 8B | Latest Qwen vision model |
| Gemma 3 | 4B, 27B | Google; efficient at smaller sizes |
| Gemma 4 | Various | Latest Gemma |
| Ministral 3 (multimodal) | 3B | Lightweight |

---

## Model Loading

Use `FastVisionModel` instead of `FastLanguageModel`:

```python
from unsloth import FastVisionModel

model, tokenizer = FastVisionModel.from_pretrained(
    model_name="unsloth/llama-3.2-11b-vision-instruct",
    max_seq_length=2048,
    load_in_4bit=True,
    dtype=None,
)
```

---

## LoRA Configuration for Vision

Vision models have additional module types. The standard set covers all projection layers
in both the vision encoder and the language model:

```python
model = FastVisionModel.get_peft_model(
    model,
    finetune_vision_layers=True,      # fine-tune vision encoder layers
    finetune_language_layers=True,    # fine-tune LLM backbone layers
    finetune_attention_modules=True,  # fine-tune attention in both
    finetune_mlp_modules=True,        # fine-tune MLP in both

    r=16,
    lora_alpha=32,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=42,
)
```

**Selective tuning:** Disable flags to reduce VRAM or training time:
- `finetune_vision_layers=False` — freeze the vision encoder; only tune the LLM backbone
  (use when visual feature extraction is already good and you only need to change language output)
- `finetune_language_layers=False` — freeze LLM; only tune vision encoder
  (use when language capability is good and visual understanding needs improvement)

---

## Training Mode vs Inference Mode

Vision models must be switched between training and inference mode:

```python
# Before training — enables gradient computation and LoRA
FastVisionModel.for_training(model)

# Before inference — disables dropout, enables faster path
FastVisionModel.for_inference(model)
```

Always call `for_inference` before running `model.generate()` on a fine-tuned vision model.

---

## Vision Data Collator

The standard `DataCollatorForSeq2Seq` does not handle image tensors. Use:

```python
from unsloth.trainer import UnslothVisionDataCollator

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    dataset_text_field=None,           # must be None for vision
    data_collator=UnslothVisionDataCollator(model, tokenizer),
    args=SFTConfig(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        ...
    ),
)
```

Omitting `UnslothVisionDataCollator` causes a runtime error when the first batch is
collated — image tensors cannot be stacked with the default collator.

---

## Dataset Formatting for Vision Training

```python
from unsloth.chat_templates import get_chat_template

tokenizer = get_chat_template(tokenizer, chat_template="llama-3")

def format_vision_sample(sample):
    conversations = sample["conversations"]
    # apply_chat_template with images=True handles the image blocks
    sample["text"] = tokenizer.apply_chat_template(
        conversations,
        tokenize=False,
        add_generation_prompt=False,
    )
    return sample

dataset = dataset.map(format_vision_sample, batched=False)
```

For `SFTTrainer` with vision, pass the raw dataset with image objects (PIL or path) —
the `UnslothVisionDataCollator` handles image loading and tensor conversion:

```python
from datasets import Dataset

def load_vision_dataset(jsonl_path: str):
    from PIL import Image
    records = []
    with open(jsonl_path) as f:
        for line in f:
            import json
            record = json.loads(line)
            # Convert image paths to PIL objects for the collator
            for turn in record["conversations"]:
                if isinstance(turn["content"], list):
                    for block in turn["content"]:
                        if block["type"] == "image":
                            block["image"] = Image.open(block["image"]).convert("RGB")
            records.append(record)
    return Dataset.from_list(records)
```

---

## Inference Example

```python
FastVisionModel.for_inference(model)

from PIL import Image
image = Image.open("test_image.jpg").convert("RGB")

messages = [
    {
        "role": "user",
        "content": [
            {"type": "image", "image": image},
            {"type": "text",  "text": "Describe what you see."},
        ],
    }
]

inputs = tokenizer.apply_chat_template(
    messages,
    add_generation_prompt=True,
    return_tensors="pt",
).to("cuda")

outputs = model.generate(**inputs, max_new_tokens=256)
print(tokenizer.decode(outputs[0], skip_special_tokens=True))
```

---

## VRAM Estimates

| Model | 4-bit QLoRA | 16-bit LoRA |
|---|---|---|
| Llama 3.2 Vision 11B | ~10GB | ~22GB |
| Qwen2.5-VL 7B | ~8GB | ~16GB |
| Gemma 3 4B | ~5GB | ~10GB |

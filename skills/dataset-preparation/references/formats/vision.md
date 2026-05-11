# Vision Model Dataset Format

## Supported Vision Models

Fine-tune with `FastVisionModel` for:
- Llama 3.2 Vision (11B, 90B)
- Qwen2.5-VL (7B, 72B), Qwen3-VL
- Gemma 3 (4B, 27B), Gemma 4
- Ministral 3 (multimodal variant)
- Pixtral

---

## Required Data Structure

Vision datasets use the same conversation structure as LLM datasets but with typed content
blocks. The `content` field is a **list** of objects with a `type` field:

```json
{
  "conversations": [
    {
      "role": "user",
      "content": [
        {"type": "image", "image": "path/to/image.jpg"},
        {"type": "text",  "text": "What is shown in this image?"}
      ]
    },
    {
      "role": "assistant",
      "content": [
        {"type": "text", "text": "The image shows a golden retriever sitting on grass."}
      ]
    }
  ]
}
```

**Rules:**
- `type` must be exactly `"image"` or `"text"` — no other values
- The image block must appear **before** the text block in the same turn
- Assistant turns contain only `type: "text"` blocks — never images
- System turns (optional, role `"system"`) contain only `type: "text"` blocks

---

## Image References: Path vs Embedded

**File path (recommended for local training):**
```json
{"type": "image", "image": "/absolute/path/to/image.jpg"}
```

**Base64 embedded (for Hub upload or remote datasets):**
```json
{"type": "image", "image": "data:image/jpeg;base64,<base64-encoded-bytes>"}
```

**PIL Image object (for in-memory processing):**
```python
from PIL import Image
image = Image.open("photo.jpg")
# Pass the PIL object directly in Python; not serialisable to JSONL
```

For JSONL datasets use file paths. For HuggingFace Dataset objects you can pass PIL images
directly in the `image` field.

---

## Image Quality Guidelines

| Dimension | Guideline |
|---|---|
| Minimum | 300 × 300 px — smaller images lose detail at model resolution |
| Optimal | 512 × 512 px to 1000 × 1000 px |
| Maximum | No hard limit, but images are resized; very large images waste memory |
| Format | JPEG, PNG, WebP — all supported |
| Colour | RGB preferred; grayscale converted automatically |
| Aspect ratio | Any; model handles non-square images |

---

## Multi-Image Training

When a single conversation references multiple images, use a **list comprehension** in the
dataset map function — not a nested `.map()` call, which breaks with Unsloth's collator:

```python
def format_multi_image_sample(sample):
    # sample["images"] is a list of file paths
    image_blocks = [
        {"type": "image", "image": path}
        for path in sample["images"]
    ]
    return {
        "conversations": [
            {
                "role": "user",
                "content": image_blocks + [{"type": "text", "text": sample["question"]}],
            },
            {
                "role": "assistant",
                "content": [{"type": "text", "text": sample["answer"]}],
            },
        ]
    }
```

---

## Applying the Vision Chat Template

```python
from unsloth import FastVisionModel
from unsloth.chat_templates import get_chat_template

model, tokenizer = FastVisionModel.from_pretrained(
    model_name="unsloth/llama-3.2-11b-vision-instruct",
    load_in_4bit=True,
)
tokenizer = get_chat_template(tokenizer, chat_template="llama-3")

def format_sample(sample):
    sample["text"] = tokenizer.apply_chat_template(
        sample["conversations"],
        tokenize=False,
        add_generation_prompt=False,
    )
    return sample
```

---

## Vision Data Collator

Use the vision-specific data collator during training — not the standard one:

```python
from unsloth.trainer import UnslothVisionDataCollator

trainer = SFTTrainer(
    ...
    data_collator=UnslothVisionDataCollator(model, tokenizer),
)
```

Forgetting this collator causes image tensors to not be correctly batched and typically
results in a runtime error or silently wrong training.

---

## Building the Dataset from a CSV/JSON Source

```python
import json
from pathlib import Path

def build_vision_dataset(source_path: str, image_dir: str, output_path: str):
    """
    Expects source CSV/JSON with columns:
      image_filename, question, answer, system_prompt (optional)
    """
    import csv
    records = []
    with open(source_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            image_path = str(Path(image_dir) / row["image_filename"])
            turns = []
            if row.get("system_prompt"):
                turns.append({
                    "role": "system",
                    "content": [{"type": "text", "text": row["system_prompt"]}],
                })
            turns.append({
                "role": "user",
                "content": [
                    {"type": "image", "image": image_path},
                    {"type": "text",  "text": row["question"]},
                ],
            })
            turns.append({
                "role": "assistant",
                "content": [{"type": "text", "text": row["answer"]}],
            })
            records.append({"conversations": turns})
    with open(output_path, "w") as f:
        for r in records:
            f.write(json.dumps(r) + "\n")
```

---

## Validation

```python
def validate_vision_dataset(records):
    errors = []
    for i, record in enumerate(records):
        for turn in record.get("conversations", []):
            if turn["role"] == "user":
                has_image = any(b["type"] == "image" for b in turn["content"])
                if not has_image:
                    errors.append(f"Record {i}: user turn has no image block")
            if turn["role"] == "assistant":
                has_image = any(b["type"] == "image" for b in turn["content"])
                if has_image:
                    errors.append(f"Record {i}: assistant turn must not contain images")
    return errors
```

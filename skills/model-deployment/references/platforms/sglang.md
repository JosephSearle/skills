# SGLang Deployment Reference

## When to Use SGLang

SGLang is the correct choice when:
- Maximum throughput is the priority (30–50% more than standard serving)
- FP8 quantisation is needed (50% memory reduction, 2× longer context)
- Serving vision models, video models, or audio models alongside text
- Multi-modal serving with a unified endpoint
- Offline batch processing with GGUF input

SGLang and vLLM have overlapping capabilities. Choose SGLang for raw throughput;
choose vLLM for LoRA hot swap.

---

## Performance Numbers (from Unsloth docs)

FP8 serving with SGLang provides:
- 30–50% more throughput vs standard 16-bit serving
- 50% less memory (enables fitting larger batches)
- 2× longer context window at the same memory budget

---

## Installation

```bash
pip install sglang[all]
# Or with specific torch version:
pip install "sglang[all]" --find-links https://flashinfer.ai/whl/cu121/torch2.3/
```

---

## Export for SGLang

Export as merged 16-bit (same as vLLM):

```python
# ============================================================
# CONFIGURATION
# ============================================================
CHECKPOINT_PATH = "./outputs/lora_adapter"
OUTPUT_DIR      = "./output_merged_16bit"
CHAT_TEMPLATE   = "llama-3"   # MUST match train.py
MAX_SEQ_LENGTH  = 2048
# ============================================================

from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=CHECKPOINT_PATH,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=True,
)

tokenizer = get_chat_template(tokenizer, chat_template=CHAT_TEMPLATE)

model.save_pretrained_merged(
    OUTPUT_DIR,
    tokenizer,
    save_method="merged_16bit",
)
print(f"Merged model saved to {OUTPUT_DIR}")
```

---

## Launch SGLang Server

**Standard 16-bit serving:**
```bash
python3 -m sglang.launch_server \
  --model-path ./output_merged_16bit \
  --host 0.0.0.0 \
  --port 30000
```

**FP8 serving (recommended for max performance):**
```bash
python3 -m sglang.launch_server \
  --model-path ./output_merged_16bit \
  --host 0.0.0.0 \
  --port 30000 \
  --quantization fp8 \
  --kv-cache-dtype fp8_e5m2  # FP8 KV cache for 2x context
```

**Multi-GPU serving:**
```bash
python3 -m sglang.launch_server \
  --model-path ./output_merged_16bit \
  --host 0.0.0.0 \
  --port 30000 \
  --tp-size 4  # tensor parallel across 4 GPUs
```

**GGUF input (offline mode):**
```bash
python3 -m sglang.launch_server \
  --model-path ./output_gguf/model-q4_k_m.gguf \
  --port 30000
```

**Offline / no internet (model already downloaded):**
```bash
HF_HUB_OFFLINE=1 python3 -m sglang.launch_server \
  --model-path ./output_merged_16bit \
  --port 30000
```

---

## Query via OpenAI Client

SGLang exposes a full OpenAI-compatible `/v1/` endpoint:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:30000/v1",
    api_key="not-required",
)

response = client.chat.completions.create(
    model="./output_merged_16bit",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user",   "content": "Summarise this document: ..."},
    ],
    max_tokens=512,
    temperature=0.7,
)
print(response.choices[0].message.content)
```

---

## Vision / Multi-Modal Serving

SGLang supports vision models out of the box:

```bash
python3 -m sglang.launch_server \
  --model-path ./output_merged_16bit \
  --port 30000 \
  --chat-template llama_3_vision   # vision-specific template
```

Query with image:
```python
import base64

with open("image.jpg", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

response = client.chat.completions.create(
    model="./output_merged_16bit",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
            {"type": "text", "text": "Describe this image."},
        ],
    }],
    max_tokens=256,
)
```

---

## Monitoring

```bash
# Health check
curl http://localhost:30000/health

# Metrics (Prometheus-compatible)
curl http://localhost:30000/metrics

# Model info
curl http://localhost:30000/v1/models
```

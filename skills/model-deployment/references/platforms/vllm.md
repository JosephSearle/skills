# vLLM Deployment Reference

## When to Use vLLM

vLLM is the correct choice for:
- High-throughput GPU serving (many concurrent requests)
- OpenAI-compatible `/v1/` API endpoint on a GPU server
- Serving multiple LoRA adapters from one base model (hot swap)
- Production deployments where latency and throughput matter

---

## Installation

```bash
pip install uv
uv pip install -U vllm --torch-backend=auto
```

---

## Export for vLLM (Single Model)

Export as merged 16-bit — LoRA weights merged into the base model:

```python
# ============================================================
# CONFIGURATION
# ============================================================
CHECKPOINT_PATH = "./outputs/lora_adapter"
OUTPUT_DIR      = "./output_merged_16bit"
CHAT_TEMPLATE   = "llama-3"     # MUST match train.py
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
print("Next: vllm serve " + OUTPUT_DIR)
```

---

## Serve with vLLM

```bash
# Basic serve
vllm serve ./output_merged_16bit --port 8000

# With GPU memory fraction and tensor parallelism (multi-GPU)
vllm serve ./output_merged_16bit \
  --port 8000 \
  --gpu-memory-utilization 0.90 \
  --tensor-parallel-size 2

# With specific chat template (vLLM auto-detects for most models)
vllm serve ./output_merged_16bit \
  --port 8000 \
  --chat-template chatml  # or llama-3, gemma, etc.
```

---

## Query via OpenAI Client

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="not-required",  # vLLM does not require a key by default
)

response = client.chat.completions.create(
    model="./output_merged_16bit",  # must match the served model path
    messages=[
        {"role": "system",    "content": "You are a helpful assistant."},
        {"role": "user",      "content": "Explain LoRA in one sentence."},
    ],
    max_tokens=256,
    temperature=0.7,
)
print(response.choices[0].message.content)
```

---

## LoRA Hot Swap (Multiple Adapters)

vLLM can serve a single base model and load/unload LoRA adapters dynamically at runtime —
ideal when you have multiple fine-tuned versions for different tasks:

### Export (adapter only — do NOT merge)

```python
# Save only the LoRA adapter weights (not merged into base)
model.save_pretrained("./output_lora_adapter")
tokenizer.save_pretrained("./output_lora_adapter")
```

### Launch vLLM with LoRA support

```bash
export VLLM_ALLOW_RUNTIME_LORA_UPDATING=True

vllm serve unsloth/llama-3.1-8b-instruct \
  --port 8000 \
  --enable-lora \
  --max-loras 4 \
  --max-lora-rank 64      # must be >= the rank used during training
```

### Load a LoRA adapter at runtime

```bash
# Load adapter
curl http://localhost:8000/v1/load_lora_adapter \
  -H "Content-Type: application/json" \
  -d '{
    "lora_name": "my-task-adapter",
    "lora_path": "./output_lora_adapter"
  }'

# Inference with that adapter
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "my-task-adapter",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Unload when done
curl http://localhost:8000/v1/unload_lora_adapter \
  -H "Content-Type: application/json" \
  -d '{"lora_name": "my-task-adapter"}'
```

### Python client for LoRA hot swap

```python
import requests

BASE_URL = "http://localhost:8000"

def load_adapter(name: str, path: str):
    resp = requests.post(
        f"{BASE_URL}/v1/load_lora_adapter",
        json={"lora_name": name, "lora_path": path},
    )
    resp.raise_for_status()

def chat(model_or_adapter: str, message: str, **kwargs) -> str:
    from openai import OpenAI
    client = OpenAI(base_url=f"{BASE_URL}/v1", api_key="none")
    resp = client.chat.completions.create(
        model=model_or_adapter,
        messages=[{"role": "user", "content": message}],
        **kwargs,
    )
    return resp.choices[0].message.content
```

---

## 4-bit Export for vLLM (Quantised Serving)

For VRAM-constrained serving with vLLM:

```python
model.save_pretrained_merged(
    "./output_merged_4bit",
    tokenizer,
    save_method="merged_4bit",
)
```

```bash
vllm serve ./output_merged_4bit \
  --port 8000 \
  --quantization awq  # or gptq; specify the quantisation format
```

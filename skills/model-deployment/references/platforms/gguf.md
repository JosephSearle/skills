# GGUF / llama.cpp Deployment Reference

## What is GGUF

GGUF (GPT-Generated Unified Format) is the standard format for llama.cpp and all
compatible tools. It packages the model weights, tokenizer, and metadata into a single
file. GGUF with quantisation is the correct choice for:
- CPU-only inference (no GPU required)
- Local deployment on consumer hardware
- Integration with Ollama, LM Studio, or llama-server

---

## Export Script

```python
# ============================================================
# CONFIGURATION
# ============================================================
CHECKPOINT_PATH   = "./outputs/lora_adapter"   # from train.py
OUTPUT_DIR        = "./output_gguf"
QUANTISATION      = "q4_k_m"    # q4_k_m | q5_k_m | q8_0 | f16 | iq2_xxs
CHAT_TEMPLATE     = "llama-3"   # MUST match train.py and prepare_dataset.py
MODEL_NAME        = "unsloth/llama-3.1-8b-instruct"  # base model used during training
MAX_SEQ_LENGTH    = 2048
# ============================================================

from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template
import os

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=CHECKPOINT_PATH,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=True,
)

# Apply chat template before saving — critical for correct inference behaviour
tokenizer = get_chat_template(tokenizer, chat_template=CHAT_TEMPLATE)

model.save_pretrained_gguf(
    OUTPUT_DIR,
    tokenizer,
    quantization_method=QUANTISATION,
    maximum_memory_usage=0.5,  # increase to 0.75 (default) if memory allows
)

gguf_file = [f for f in os.listdir(OUTPUT_DIR) if f.endswith(".gguf")][0]
size_gb = os.path.getsize(os.path.join(OUTPUT_DIR, gguf_file)) / 1e9
print(f"Exported: {OUTPUT_DIR}/{gguf_file} ({size_gb:.1f} GB)")
print(f"Quantisation: {QUANTISATION}")
```

---

## llama-server (OpenAI-Compatible Endpoint)

llama-server exposes a `/v1/` API compatible with the OpenAI client — allows existing
OpenAI client code to use a local fine-tuned model with no changes:

**Build llama.cpp with CUDA support:**
```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
cmake -B build -DLLAMA_CUDA=ON
cmake --build build --config Release -j$(nproc)
```

**Launch llama-server:**
```bash
./llama.cpp/build/bin/llama-server \
  --model ./output_gguf/model-q4_k_m.gguf \
  --alias "my-fine-tuned-model" \
  --n-gpu-layers 999 \
  --port 8001 \
  --jinja          # enables Jinja2 chat template processing
```

**Query with OpenAI client:**
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:8001/v1",
    api_key="not-required",
)

response = client.chat.completions.create(
    model="my-fine-tuned-model",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=256,
    temperature=0.7,
)
print(response.choices[0].message.content)
```

---

## Speculative Decoding with llama-server

Speculative decoding uses a small "draft" model to propose tokens that the main model
verifies in parallel — typically 1.5–3× faster generation with identical quality:

```bash
# Requires a smaller GGUF draft model (same model family, smaller size)
./llama.cpp/build/bin/llama-server \
  --model ./output_gguf/llama-3.1-8b-q4_k_m.gguf \
  --model-draft ./draft_models/llama-3.2-1b-q8_0.gguf \
  --device CUDA0 \
  --device-draft CUDA0,CUDA1 \
  --n-gpu-layers 999 \
  --n-gpu-layers-draft 999 \
  --port 8001
```

The draft model must be from the same model family and use the same vocabulary.

---

## Multiple Quantisation Outputs

To produce multiple GGUF files at different quantisation levels in one export:

```python
import os

QUANTISATION_METHODS = ["q4_k_m", "q8_0", "f16"]

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=CHECKPOINT_PATH,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=True,
)
tokenizer = get_chat_template(tokenizer, chat_template=CHAT_TEMPLATE)

for method in QUANTISATION_METHODS:
    output = f"./output_gguf_{method}"
    os.makedirs(output, exist_ok=True)
    model.save_pretrained_gguf(output, tokenizer, quantization_method=method)
    print(f"Saved {method} → {output}/")
```

---

## Push GGUF to Hugging Face Hub

```python
model.push_to_hub_gguf(
    "your-username/my-model-gguf",
    tokenizer,
    quantization_method=["q4_k_m", "q8_0"],  # upload multiple quants
    token="hf_...",
)
```

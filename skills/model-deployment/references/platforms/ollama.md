# Ollama Deployment Reference

## When to Use Ollama

Ollama is the correct choice for:
- Local GPU or CPU deployment with minimal setup
- Users who want a simple CLI (`ollama run my-model`) or desktop app
- Development and testing on a local machine
- Partial OpenAI compatibility (Ollama exposes a `/v1/` endpoint for basic operations)

Ollama uses GGUF format internally. Every Ollama model is a GGUF file plus a Modelfile.

---

## Export Script

```python
# ============================================================
# CONFIGURATION
# ============================================================
CHECKPOINT_PATH = "./outputs/lora_adapter"
OUTPUT_DIR      = "./output_gguf"
QUANTISATION    = "q4_k_m"   # q4_k_m (default) | q5_k_m | q8_0 | f16
CHAT_TEMPLATE   = "llama-3"  # MUST match train.py and prepare_dataset.py
MAX_SEQ_LENGTH  = 2048
# ============================================================

from unsloth import FastLanguageModel
from unsloth.chat_templates import get_chat_template
import os

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=CHECKPOINT_PATH,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=True,
)

tokenizer = get_chat_template(tokenizer, chat_template=CHAT_TEMPLATE)

# Unsloth auto-generates a Modelfile for Ollama when saving GGUF
model.save_pretrained_gguf(
    OUTPUT_DIR,
    tokenizer,
    quantization_method=QUANTISATION,
    maximum_memory_usage=0.5,
)

gguf_files = [f for f in os.listdir(OUTPUT_DIR) if f.endswith(".gguf")]
print(f"GGUF file(s) in {OUTPUT_DIR}:")
for f in gguf_files:
    size = os.path.getsize(os.path.join(OUTPUT_DIR, f)) / 1e9
    print(f"  {f} ({size:.1f} GB)")
print(f"\nModelfile: {OUTPUT_DIR}/Modelfile")
```

---

## Modelfile

Unsloth generates a Modelfile automatically alongside the GGUF. Verify it contains the
correct chat template before importing. A Modelfile looks like:

```
FROM ./model-q4_k_m.gguf

TEMPLATE """{{ if .System }}<|start_header_id|>system<|end_header_id|>

{{ .System }}<|eot_id|>{{ end }}{{ range .Messages }}<|start_header_id|>{{ .Role }}<|end_header_id|>

{{ .Content }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>

"""

PARAMETER stop "<|eot_id|>"
PARAMETER stop "<|start_header_id|>"
```

**Critical:** The `PARAMETER stop` tokens must match the model's EOS tokens. Wrong stop
tokens = model never stops generating. Verify:
```python
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("./outputs/lora_adapter")
print("EOS:", tok.eos_token)
```

---

## Import and Run

```bash
# Start Ollama server (must be running before import)
ollama serve &

# Import the model from the generated Modelfile
ollama create my-fine-tuned-model -f ./output_gguf/Modelfile

# Test it
ollama run my-fine-tuned-model "Hello, what can you help me with?"

# List all models
ollama list

# Remove when done
ollama rm my-fine-tuned-model
```

---

## Query via Ollama API

Ollama's native API:

```python
import requests

response = requests.post(
    "http://localhost:11434/api/chat",
    json={
        "model":    "my-fine-tuned-model",
        "messages": [{"role": "user", "content": "Hello!"}],
        "stream":   False,
    },
)
print(response.json()["message"]["content"])
```

Ollama's OpenAI-compatible endpoint (subset of `/v1/`):

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",  # any non-empty string
)
response = client.chat.completions.create(
    model="my-fine-tuned-model",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

---

## Troubleshooting Ollama Deployments

**Gibberish output:**
The chat template in the Modelfile does not match what was used during training.
- Check the `TEMPLATE` block in the Modelfile
- Compare with the template in `prepare_dataset.py`
- Unsloth should generate the correct template; if not, manually set it

**Model never stops generating:**
Wrong `PARAMETER stop` token in the Modelfile.
- Find the correct EOS token from the tokenizer (see above)
- Edit the Modelfile and reimport: `ollama create my-model -f ./Modelfile`

**`ollama serve` port conflict:**
```bash
OLLAMA_HOST=0.0.0.0:11435 ollama serve  # use a different port
```

**Slow inference on GPU:**
Ollama defaults to CPU if GPU layers are not detected. Check:
```bash
ollama run my-model --verbose  # shows GPU layers loaded
```
Set GPU layers explicitly in the Modelfile:
```
PARAMETER num_gpu 999  # use all available GPU layers
```

**Model too large for VRAM:**
```
PARAMETER num_gpu 20   # partial offload; adjust until it fits
```

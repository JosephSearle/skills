# LM Studio Deployment Reference

## When to Use LM Studio

LM Studio is the correct choice for:
- GUI-driven local model management (no CLI required)
- Quick testing of fine-tuned models before production deployment
- Non-technical users who need to run models locally
- Development workflows where a lightweight local OpenAI-compatible API is needed

LM Studio uses GGUF format. It provides a desktop app (Mac, Windows, Linux) and a
CLI tool (`lms`).

---

## Installation

Download from https://lmstudio.ai or install the CLI:
```bash
# macOS / Linux
curl -fsSL https://installers.lmstudio.ai/linux/x86_64/lms-latest-installer.sh | sh

# Or via npm
npm install -g lmstudio
```

---

## Export

LM Studio requires GGUF. Use the same export as for Ollama/llama.cpp:

```python
# ============================================================
# CONFIGURATION
# ============================================================
CHECKPOINT_PATH = "./outputs/lora_adapter"
OUTPUT_DIR      = "./output_gguf"
QUANTISATION    = "q4_k_m"   # q4_k_m | q5_k_m | q8_0 | f16
CHAT_TEMPLATE   = "llama-3"  # MUST match train.py
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

model.save_pretrained_gguf(
    OUTPUT_DIR,
    tokenizer,
    quantization_method=QUANTISATION,
    maximum_memory_usage=0.5,
)

gguf_file = [f for f in os.listdir(OUTPUT_DIR) if f.endswith(".gguf")][0]
print(f"GGUF ready: {OUTPUT_DIR}/{gguf_file}")
print("Import into LM Studio: lms import " + OUTPUT_DIR + "/" + gguf_file)
```

---

## Import into LM Studio

**Via CLI:**
```bash
# Import a local GGUF file
lms import ./output_gguf/model-q4_k_m.gguf

# Import from Hugging Face Hub
lms import username/my-model-gguf

# List loaded models
lms ls

# Remove a model
lms rm my-model-q4_k_m
```

**Via GUI:**
1. Open LM Studio → "My Models" tab
2. Click "Import Model" → select the `.gguf` file
3. Or search for the model on Hugging Face from within LM Studio

---

## Prompt Template Configuration

LM Studio must be configured with the correct prompt template for the model to work.
If the template is wrong, the model will produce gibberish.

**Via CLI:**
```bash
# Check what template LM Studio auto-detected
lms get model-name --field prompt_template

# Set template explicitly
lms set model-name --prompt-template llama3   # or chatml, gemma, mistral, etc.
```

**Via GUI:**
1. Select the model → "Settings" / "Prompt Template"
2. Choose from the dropdown or enter a custom template
3. Match exactly what was used in `prepare_dataset.py`

**Common template names in LM Studio:**

| Training template | LM Studio template name |
|---|---|
| `llama-3` | `LLaMA 3 Instruct` |
| `chatml` | `ChatML` |
| `gemma-3` | `Gemma Instruct` |
| `mistral` | `Mistral Instruct` |
| `qwen-2.5` | `Qwen 2.5 Instruct` |

---

## Local API

LM Studio exposes an OpenAI-compatible API at `http://localhost:1234/v1`:

```bash
# Start the server
lms server start

# Stop the server
lms server stop
```

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:1234/v1",
    api_key="lm-studio",  # any non-empty string
)

response = client.chat.completions.create(
    model="model-q4_k_m",  # model name as shown in lms ls
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=256,
    temperature=0.7,
)
print(response.choices[0].message.content)
```

---

## Troubleshooting

**Gibberish output in LM Studio:**
Prompt template is wrong. Open the model settings in LM Studio → change the template to
match what was used during training. This is the most common issue.

**Model not using GPU:**
- Verify CUDA is available: check LM Studio → Settings → GPU
- Try reducing the number of GPU layers if full offload fails
- On Mac, LM Studio uses Metal (MPS) automatically

**Import fails:**
- GGUF file may be corrupted — re-run `export.py`
- Check available disk space (GGUF files can be 4–40GB)
- On Windows, ensure the path has no special characters

**API returns 404:**
Ensure `lms server start` has been run and the model is loaded in the "Chat" tab before
making API calls.

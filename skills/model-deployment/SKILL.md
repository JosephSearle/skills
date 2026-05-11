---
name: model-deployment
description: >
  Export a fine-tuned Unsloth model to the correct format and generate deployment
  configuration for the chosen serving platform. Detects deployment requirements (local
  CPU, local GPU, cloud, multi-model serving, OpenAI-compatible endpoint), selects the
  export format (GGUF, merged 16-bit, LoRA adapter), and writes an export.py script and
  platform-specific deployment commands to disk. Supports Ollama, vLLM (including LoRA
  hot swap), SGLang, LM Studio, llama-server, and Hugging Face Hub. Triggers on: "deploy
  fine-tuned model", "export model", "convert to GGUF", "serve with vLLM", "run with
  Ollama", "set up llama.cpp", "publish to Hugging Face Hub", "enable LoRA hot swap",
  "run model locally", "quantise model", or any instruction to export or serve a
  fine-tuned model.
---

# Model Deployment Skill

A skill for exporting fine-tuned Unsloth models and generating deployment configurations
for all major serving platforms. Covers GGUF/llama.cpp, vLLM, Ollama, SGLang, and LM
Studio — grounded in Unsloth deployment documentation and the principle that chat template
consistency between training and serving is the most critical deployment requirement.

---

## Core Philosophy

A fine-tuned model that generates gibberish in production almost always has a chat template
mismatch — not a training problem. The export and serving configuration must use the exact
same template that was applied during dataset preparation and training.

Export format selection is a function of runtime environment and serving requirements, not
personal preference. Each format has clear tradeoffs and the correct choice is deterministic
given the constraints.

---

## Step 1 — Detect Deployment Requirements

Gather the following before generating any code. Ask if genuinely unknown:

**Runtime environment:**

```
Where will the model run?
  Local CPU only                    → GGUF (llama.cpp / LM Studio)
  Local GPU                         → GGUF (Ollama) or vLLM or SGLang
  Cloud GPU (single model)          → vLLM or SGLang
  Cloud GPU (multiple LoRA adapters)→ vLLM with LoRA hot swap
```

**OpenAI-compatible endpoint needed?**
- Yes → llama-server, vLLM, or SGLang (all expose `/v1/` endpoints)
- No → Ollama (has its own API), LM Studio (has both)

**Multiple LoRA adapters (hot swap)?**
- Yes → vLLM with `--enable-lora`
- No → any platform

**Target platform (if stated):**
Note it and load the corresponding platform reference. If no preference, apply the
decision tree in `references/universal.md`.

**Checkpoint path** — the directory saved by `train.py` (e.g., `./outputs/lora_adapter`).

**Chat template** — must match what was used in `prepare_dataset.py` and `train.py`.
If not stated, read it from the `CHAT_TEMPLATE` constant in `train.py`.

---

## Step 2 — Select Export Format

Apply this decision tree:

```
Platform target:
  Ollama / LM Studio / llama.cpp / llama-server
    └─ Format: GGUF
    └─ Quantisation:
         Balanced (default)  → q4_k_m
         Higher accuracy     → q5_k_m or q8_0
         Max accuracy        → f16
         Minimal size        → iq2_xxs

  vLLM (no LoRA hot swap)
    └─ Format: merged_16bit (merge LoRA into base model weights)

  vLLM (with LoRA hot swap)
    └─ Format: lora (adapter weights only; base model served separately)

  SGLang
    └─ Format: merged_16bit  (preferred)
       or GGUF               (if FP8 inference required)

  Hugging Face Hub
    └─ Format: merged_16bit  (for public use, others can load without the base model)
       or lora               (smaller upload; requires base model to load)
```

---

## Step 3 — Load References

Always load `references/universal.md` first.

```
Platform selected:
  Ollama / llama.cpp / llama-server → load references/platforms/gguf.md
  vLLM                              → load references/platforms/vllm.md
  Ollama specifically               → load references/platforms/ollama.md
  SGLang                            → load references/platforms/sglang.md
  LM Studio                         → load references/platforms/lmstudio.md
```

---

## Step 4 — Generate `export.py`

Generate a complete Python script that:

1. Loads the fine-tuned model from the checkpoint directory
2. Applies the correct chat template to the tokenizer before saving
3. Calls the appropriate Unsloth save method for the selected format
4. Prints the output path(s) and confirms the export completed

The script must:
- Include a `CONFIGURATION` block at the top for paths and settings
- Explicitly set the chat template — never skip this step
- Include the `maximum_memory_usage=0.5` parameter for GGUF with a comment explaining
  it can be increased to 0.75 if memory allows (the default)
- Log which quantisation method was used and the output file size

---

## Step 5 — Generate Deployment Commands

After `export.py`, generate the platform-specific commands to serve the model. Apply
patterns from the loaded platform reference file:

- Shell commands to launch the model server
- Any environment variables required (e.g., `VLLM_ALLOW_RUNTIME_LORA_UPDATING`)
- The correct prompt template or Modelfile (Ollama)
- OpenAI client example code if the platform supports `/v1/` endpoints

Include a **troubleshooting section** at the bottom of the deployment output:

| Symptom | Most likely cause | Fix |
|---|---|---|
| Gibberish output | Wrong chat template at inference | Match template to training |
| Output never stops | Wrong EOS token | Verify tokenizer EOS in Modelfile |
| Slow on GPU | Model running on CPU fallback | Check CUDA is available |
| OOM on export | GGUF conversion uses too much memory | Set `maximum_memory_usage=0.5` |
| vLLM LoRA 404 | LoRA not loaded | Call `/v1/load_lora_adapter` first |

---

## Step 6 — Write to Disk and Provide Run Guidance

Write `export.py` to the current working directory.

Write a `deploy.sh` (or `deploy_<platform>.sh`) with the full deployment commands.

Provide the exact sequence:

```bash
# Step 1: Export the model
python export.py

# Step 2: Launch the server (platform-specific — see deploy.sh)
bash deploy.sh

# Step 3: Test the endpoint
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "my-model", "messages": [{"role": "user", "content": "Hello"}]}'
```

---

## Reference Files

- `references/universal.md` — export format decision tree, chat template consistency
  rule, EOS token matching, GGUF quantisation comparison table, common failure modes
- `references/platforms/gguf.md` — GGUF quantisation methods, llama.cpp build,
  llama-server OpenAI endpoint, speculative decoding
- `references/platforms/vllm.md` — installation, save format options, LoRA hot swap
  configuration, serve command, OpenAI client example
- `references/platforms/ollama.md` — GGUF export, Modelfile generation, `ollama serve`,
  template consistency, EOS token troubleshooting
- `references/platforms/sglang.md` — `launch_server`, FP8 quantisation flags, GGUF
  support, offline mode, throughput numbers
- `references/platforms/lmstudio.md` — `lms import`, prompt template configuration,
  local API at `:1234`, model management

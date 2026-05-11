# Model Deployment — Universal Reference

## The Cardinal Rule: Chat Template Consistency

The most common cause of a deployed model generating gibberish is not the model — it is
the serving platform not using the same chat template as was applied during training.

**Rule:** Every serving platform must be configured with the exact chat template used
during `prepare_dataset.py` and `train.py`. This is not optional.

Symptoms of a template mismatch:
- The model produces random or incoherent text
- The model echoes the prompt instead of responding
- The model never produces an EOS token (never stops)
- Responses are in the wrong language or format

---

## Export Format Decision Tree

```
Where does the model run?

Local CPU only (no GPU):
  └─ GGUF → llama.cpp / LM Studio
     └─ Quantisation: q4_k_m (default) or q5_k_m for more accuracy

Local GPU (gaming / workstation):
  User wants simplest setup?
    └─ YES → Ollama (GGUF, auto-Modelfile)
    └─ NO  → vLLM or SGLang (more control)

Cloud GPU (single model, max throughput):
  └─ vLLM or SGLang (merged_16bit)

Cloud GPU (multiple fine-tuned models, share one base):
  └─ vLLM with LoRA hot swap (adapter-only export)

Need OpenAI-compatible /v1/ endpoint:
  └─ vLLM, SGLang, or llama-server (all expose /v1/)
  Note: Ollama has its own API; also has a /v1/ endpoint (partial OpenAI compatibility)

Sharing publicly on Hugging Face Hub:
  └─ merged_16bit (others don't need the base model)
     or LoRA adapter (smaller; requires users to have the base model)
```

---

## GGUF Quantisation Comparison

| Method | Bits/weight | VRAM vs f16 | Quality | Use when |
|---|---|---|---|---|
| `iq2_xxs` | ~2.06 | ~87% less | Lowest | Extreme size constraint |
| `q4_k_m` | ~4.5 | ~71% less | Good | **Default — best balance** |
| `q5_k_m` | ~5.5 | ~65% less | Better | When q4 quality is insufficient |
| `q8_0` | ~8 | ~50% less | Near-lossless | When accuracy is critical |
| `f16` | 16 | 0% (baseline) | Lossless | Maximum accuracy; slow inference |

The `q4_k_m` format uses Q6_K for attention tensors specifically (the most quality-sensitive
weights), giving better quality than a naive 4-bit quantisation at the same size.

---

## EOS Token Verification

Every model has an End-of-Sequence token that signals the model to stop generating.
If the serving platform uses the wrong EOS token, the model generates indefinitely.

To find the correct EOS token:

```python
from transformers import AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained("./outputs/lora_adapter")
print("EOS token:", tokenizer.eos_token)
print("EOS token ID:", tokenizer.eos_token_id)
```

Common EOS tokens by model family:

| Model family | EOS token |
|---|---|
| Llama 3 | `<\|eot_id\|>` |
| Gemma | `<eos>` |
| Qwen 2.5/3 | `<\|im_end\|>` |
| Mistral | `</s>` |
| ChatML | `<\|im_end\|>` |

---

## Saving Methods Reference

```python
from unsloth import FastLanguageModel

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="./outputs/lora_adapter",  # fine-tuned checkpoint
    max_seq_length=2048,
    load_in_4bit=True,
)

# GGUF (for Ollama, LM Studio, llama.cpp, llama-server)
model.save_pretrained_gguf(
    "output_gguf",
    tokenizer,
    quantization_method="q4_k_m",  # see table above
    maximum_memory_usage=0.5,       # reduce from default 0.75 if OOM during export
)

# GGUF — push directly to Hugging Face Hub
model.push_to_hub_gguf(
    "username/my-model-gguf",
    tokenizer,
    quantization_method="q4_k_m",
    token="hf_...",
)

# Merged 16-bit (for vLLM, SGLang — merge LoRA into base weights)
model.save_pretrained_merged(
    "output_merged",
    tokenizer,
    save_method="merged_16bit",
)

# LoRA adapter only (for vLLM hot swap — keep adapter separate from base)
model.save_pretrained("output_lora_adapter")
tokenizer.save_pretrained("output_lora_adapter")

# Push merged model to HF Hub
model.push_to_hub_merged(
    "username/my-model",
    tokenizer,
    save_method="merged_16bit",
    token="hf_...",
)
```

---

## Common Export Failures

**OOM during GGUF export:**
```python
# Default maximum_memory_usage is 0.75 — reduce if crash:
model.save_pretrained_gguf("output", tokenizer, maximum_memory_usage=0.5)
```

**Import error: llama.cpp not found:**
GGUF conversion requires llama.cpp to be installed. Unsloth handles this automatically
when using `save_pretrained_gguf` on a supported system. If it fails, install manually:
```bash
pip install llama-cpp-python
```

**LoRA checkpoint won't load:**
Ensure the base model name matches what was used during training. The LoRA adapter stores
the base model config but not the base weights — the correct base model must be accessible.

# LoRA Fine-Tuning Reference (16-bit)

## When to Use 16-bit LoRA over QLoRA

Use 16-bit LoRA (not quantised) when:
- VRAM is 16–40GB and quality is the priority
- The task is highly specialised and the quality gap from 4-bit quantisation is unacceptable
- You need to apply LoRA to embedding layers (`embed_tokens`, `lm_head`) without
  quantisation artefacts — important for Continued Pretraining tasks
- The model family has known issues with 4-bit quantisation (verify with a short test run)

The primary difference from QLoRA is `load_in_4bit=False`. Everything else — LoRA config,
trainer, hyperparameters — is identical.

---

## Key Differences from QLoRA

| Aspect | QLoRA | 16-bit LoRA |
|---|---|---|
| `load_in_4bit` | `True` | `False` |
| VRAM requirement | ~6–10GB for 8B | ~16–20GB for 8B |
| Training speed | Slightly slower (dequantise overhead) | Faster |
| Quality | Marginally lower for some tasks | Marginally higher |
| Gradient precision | 16-bit adapter, 4-bit base | 16-bit throughout |

---

## LoRA Rank and Alpha Guidelines

The rank (`r`) controls how many parameters are added. Higher rank = more capacity but
more memory and risk of overfitting:

| Rank | Use when |
|---|---|
| 8 | Simple tasks, limited data (< 500 examples), or classification |
| 16 | Default for instruction-following and most tasks |
| 32 | Complex reasoning, coding, multi-step tasks |
| 64 | Maximum quality; use only with > 5,000 examples |
| 128 | Rarely needed; full fine-tuning is often better at this point |

**Alpha rule:** `lora_alpha` should always be ≥ `lora_r`. The alpha/rank ratio scales the
update magnitude. A ratio of 2 (alpha = 2 × rank) is the standard safe default:
- ratio < 1: updates may be too small to converge
- ratio = 1: conservative; use for low-rank (r ≤ 8)
- ratio = 2: default; use for r = 16–64
- ratio > 2: aggressive; can cause instability

**Rank-Stabilised LoRA (rsLoRA):** Set `use_rslora=True` when rank > 32. RSLoRA normalises
the adapter output by 1/√r, preventing instability at high ranks without requiring careful
alpha tuning.

```python
model = FastLanguageModel.get_peft_model(
    model,
    r=32,
    lora_alpha=64,
    use_rslora=True,  # recommended for r > 32
    ...
)
```

---

## Module Selection

**Always include all projection layers** for best results:
```python
target_modules = [
    "q_proj", "k_proj", "v_proj", "o_proj",
    "gate_proj", "up_proj", "down_proj",
]
```

**Extending to embedding layers** (needed for vocabulary extension or CPT):
```python
target_modules += ["embed_tokens", "lm_head"]
```

**Attention-only LoRA** (minimal VRAM, lower quality — use only as a last resort):
```python
target_modules = ["q_proj", "v_proj"]  # skips k, o, and MLP
```

---

## Complete Diff from QLoRA Template

The only required change from the QLoRA template in `qlora.md`:

```python
# Change this line:
LOAD_IN_4BIT = True

# To:
LOAD_IN_4BIT = False

# And optionally increase rank:
LORA_RANK  = 32
LORA_ALPHA = 64
```

All other configuration — trainer, callbacks, checkpointing — remains identical.

---

## When Quality Difference Actually Matters

In practice, 4-bit QLoRA and 16-bit LoRA produce nearly identical results for:
- General instruction following
- Conversational tasks
- Classification and extraction

The quality gap widens for:
- Mathematical reasoning (quantisation adds noise to precise calculations)
- Code generation with strict syntax requirements
- Tasks where the base model is already near its capability limit

If unsure: start with QLoRA (faster and cheaper), switch to 16-bit LoRA only if eval
metrics show a meaningful gap.

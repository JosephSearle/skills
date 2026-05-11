# GRPO Fine-Tuning Reference

## What is GRPO

GRPO (Group Relative Policy Optimization) is Unsloth's primary method for training
reasoning models. Introduced by DeepSeek, it eliminates the need for a separate value or
reward model by using **group-relative** advantage estimation: multiple completions are
sampled for the same prompt, and each is scored relative to the group's average reward.

Use GRPO when:
- Training a reasoning model (math, logic, multi-step problem solving)
- Implementing RL from verifiable feedback (code that compiles, answers that match a schema)
- Replicating DeepSeek R1, QwQ, or similar reasoning model behaviours
- The task has an objective, computable reward signal (not subjective preference)

Do not use GRPO for:
- Standard instruction following (use QLoRA)
- Preference alignment without a reward function (use DPO)

---

## Dataset Requirements

GRPO requires prompts only — not completions. The model generates completions at training
time, which are then scored by the reward function:

```json
{"prompt": "Solve: If a train travels 60km/h for 2.5 hours, how far does it travel?"}
```

**75/25 reasoning/non-reasoning mix:** When training a reasoning model, mix 75% reasoning
tasks with 25% general instruction data to prevent the model from losing its general
conversational capability:

```python
reasoning_dataset = load_dataset("json", data_files="reasoning.jsonl", split="train")
general_dataset   = load_dataset("json", data_files="general.jsonl",   split="train")

from datasets import concatenate_datasets
dataset = concatenate_datasets([
    reasoning_dataset.select(range(int(len(reasoning_dataset) * 0.75))),
    general_dataset.select(range(int(len(general_dataset)   * 0.25))),
]).shuffle(seed=42)
```

---

## Reward Function Design

The reward function is the most critical design decision in GRPO training. It must:
- Return a **list of floats** (one per completion in the group)
- Be deterministic given the same inputs
- Provide meaningful signal — not just 0/1, but graded scores when possible

**Scaffold — adapt for your task:**

```python
import re
from typing import Any

def reward_format(completions: list[str], **kwargs) -> list[float]:
    """Reward correct <think>...</think><answer>...</answer> formatting."""
    rewards = []
    for completion in completions:
        has_think  = bool(re.search(r"<think>.*?</think>", completion, re.DOTALL))
        has_answer = bool(re.search(r"<answer>.*?</answer>", completion, re.DOTALL))
        score = 0.0
        if has_think:  score += 0.3
        if has_answer: score += 0.3
        if has_think and has_answer: score += 0.4  # bonus for complete format
        rewards.append(score)
    return rewards


def reward_correctness(
    completions: list[str],
    ground_truth: list[Any],
    **kwargs,
) -> list[float]:
    """Reward correct answers extracted from <answer> tags."""
    rewards = []
    for completion, truth in zip(completions, ground_truth):
        match = re.search(r"<answer>(.*?)</answer>", completion, re.DOTALL)
        if not match:
            rewards.append(0.0)
            continue
        extracted = match.group(1).strip()
        rewards.append(1.0 if extracted == str(truth).strip() else 0.0)
    return rewards


def combined_reward(completions, ground_truth, **kwargs):
    """Combine format + correctness rewards."""
    format_scores = reward_format(completions)
    correct_scores = reward_correctness(completions, ground_truth)
    return [f + c for f, c in zip(format_scores, correct_scores)]
```

**Common reward strategies:**
- **Format reward** — structured output (XML tags, JSON schema, markdown)
- **Correctness reward** — exact match, numeric equivalence, code execution result
- **Length penalty** — penalise excessively long or short outputs
- **Diversity reward** — penalise repetitive tokens (prevents reward hacking)

---

## Complete `train.py` Template

```python
# ============================================================
# CONFIGURATION
# ============================================================
MODEL_NAME    = "unsloth/llama-3.1-8b-instruct"
DATASET_PATH  = "reasoning_dataset.jsonl"
OUTPUT_DIR    = "./outputs"
MAX_SEQ_LENGTH = 2048

LORA_RANK     = 16
LORA_ALPHA    = 32
LEARNING_RATE = 5e-6   # GRPO uses a much lower lr than SFT
NUM_EPOCHS    = 1      # GRPO typically needs fewer epochs; monitor reward carefully
BATCH_SIZE    = 1      # GRPO is memory-intensive; keep batch small
GRAD_ACCUM    = 8
# ============================================================

from unsloth import FastLanguageModel
from trl import GRPOTrainer, GRPOConfig
from datasets import load_dataset
import re

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_NAME,
    max_seq_length=MAX_SEQ_LENGTH,
    load_in_4bit=True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r=LORA_RANK,
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_alpha=LORA_ALPHA,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",
    random_state=42,
)

dataset = load_dataset("json", data_files=DATASET_PATH, split="train")

# --- Define reward functions above (see scaffold) ---

trainer = GRPOTrainer(
    model=model,
    processing_class=tokenizer,
    reward_funcs=[
        reward_format,
        reward_correctness,
    ],
    args=GRPOConfig(
        learning_rate=LEARNING_RATE,
        num_train_epochs=NUM_EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRAD_ACCUM,
        output_dir=OUTPUT_DIR,
        save_strategy="steps",
        save_steps=50,
        save_total_limit=3,
        logging_steps=10,
        optim="adamw_8bit",
        num_generations=4,  # completions per prompt per step; higher = better signal, more memory
        max_new_tokens=512, # max length of each generated completion
    ),
    train_dataset=dataset,
)

trainer.train()
model.save_pretrained(OUTPUT_DIR + "/lora_adapter")
tokenizer.save_pretrained(OUTPUT_DIR + "/lora_adapter")
```

---

## Hyperparameter Notes

| Parameter | Default | Notes |
|---|---|---|
| `learning_rate` | `5e-6` | Order of magnitude lower than SFT; critical — too high causes collapse |
| `num_generations` | `4` | Group size for relative advantage; 4 is minimum; 8 gives better signal |
| `max_new_tokens` | `512` | Set to match expected reasoning chain length |
| `num_train_epochs` | `1` | GRPO converges faster than SFT; watch reward curve not loss |

---

## Monitoring Training

For GRPO, watch the **reward** not the loss:
- Reward should increase over time
- If reward plateaus immediately, the reward function has no gradient signal (binary 0/1 is common culprit — add partial credit)
- If reward spikes then collapses, learning rate is too high
- Log both `reward_format` and `reward_correctness` separately to diagnose which is plateauing

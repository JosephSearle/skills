# Conversational LLM Dataset Format

## Supported Chat Templates

Unsloth supports the following templates via `get_chat_template`:

| Template name | Used by |
|---|---|
| `"llama-3"` | Llama 3, Llama 3.1, Llama 3.2, Llama 3.3 |
| `"gemma-3"` | Gemma 3, Gemma 4 |
| `"qwen-2.5"` | Qwen 2.5, Qwen 3 |
| `"mistral"` | Mistral 3, Ministral, Mistral variants |
| `"chatml"` | ChatML format (default for OpenAI-style data) |
| `"phi-4"` | Phi-4 |
| `"deepseek-r1"` | DeepSeek R1, DeepSeek V3 |

Full list available via:
```python
from unsloth.chat_templates import CHAT_TEMPLATES
print(list(CHAT_TEMPLATES.keys()))
```

---

## Required Data Structure

Every record in the dataset must be a conversation: a list of turn objects, each with
`role` and `content`. The field containing this list must be named `"conversations"`.

```python
{
    "conversations": [
        {"role": "system",    "content": "System prompt here (optional)."},
        {"role": "user",      "content": "First user message."},
        {"role": "assistant", "content": "First assistant response."},
        {"role": "user",      "content": "Follow-up question."},
        {"role": "assistant", "content": "Follow-up answer."},
    ]
}
```

**Invariants:**
- Turns must alternate: user → assistant → user → assistant
- The last turn must always be `assistant`
- `role` values must be exactly `"system"`, `"user"`, `"assistant"` — not `"AI"`, `"human"`,
  `"agent"`, or any other variant; these break label masking
- System turn is optional; if present it must be first

---

## Common Source Formats and Mapping

### CSV with `question` / `answer` columns

```python
import csv
import json

def csv_to_conversations(csv_path: str, output_path: str, system_prompt: str = ""):
    rows = []
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            turns = []
            if system_prompt:
                turns.append({"role": "system", "content": system_prompt})
            turns.append({"role": "user",      "content": row["question"].strip()})
            turns.append({"role": "assistant", "content": row["answer"].strip()})
            rows.append({"conversations": turns})
    with open(output_path, "w") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")
```

### JSON array of objects with arbitrary field names

Map source fields explicitly. Never silently guess field mappings:

```python
FIELD_MAP = {
    "user_input":     ("user",      "content"),
    "model_response": ("assistant", "content"),
    "instruction":    ("system",    "content"),  # optional
}
```

### ShareGPT format (`from` / `value` instead of `role` / `content`)

ShareGPT uses `"from"` and `"value"` with values `"human"`, `"gpt"`, `"system"`.
Normalise to standard roles:

```python
ROLE_MAP = {"human": "user", "gpt": "assistant", "system": "system"}

def normalise_sharegpt(record):
    return {
        "conversations": [
            {"role": ROLE_MAP[t["from"]], "content": t["value"]}
            for t in record["conversations"]
        ]
    }
```

### Alpaca format (`instruction` / `input` / `output`)

```python
def alpaca_to_conversation(record, system_prompt=""):
    user_content = record["instruction"]
    if record.get("input"):
        user_content += "\n\n" + record["input"]
    turns = []
    if system_prompt:
        turns.append({"role": "system", "content": system_prompt})
    turns.append({"role": "user",      "content": user_content})
    turns.append({"role": "assistant", "content": record["output"]})
    return {"conversations": turns}
```

---

## Applying the Template

```python
from datasets import Dataset
from unsloth.chat_templates import get_chat_template

# Apply template to tokenizer
tokenizer = get_chat_template(tokenizer, chat_template="llama-3")

def format_sample(sample):
    sample["text"] = tokenizer.apply_chat_template(
        sample["conversations"],
        tokenize=False,
        add_generation_prompt=False,
    )
    return sample

dataset = Dataset.from_list(records)
dataset = dataset.map(format_sample)
```

---

## System Prompts

System prompts define model persona, tone, and constraints. Guidelines:
- Keep system prompts consistent across all examples in the dataset
- Do not include task-specific instructions that vary per example in the system prompt
  — those belong in the user turn
- If fine-tuning for a specific persona, the system prompt is the primary lever; do not
  rely on user turns to establish it

---

## Multi-turn Conversations

Multi-turn datasets teach the model to maintain context across turns. Requirements:
- Each full conversation is one training example (not split into pairs)
- The model trains to predict every `assistant` turn given all prior context
- Minimum recommended turns per example: 2 (one user + one assistant)
- Maximum: no hard limit, but sequences beyond `max_seq_length` tokens will be truncated

---

## Validation

After formatting, verify every example:

```python
def validate_conversations(records):
    errors = []
    for i, record in enumerate(records):
        convs = record.get("conversations", [])
        if not convs:
            errors.append(f"Record {i}: empty conversations list")
            continue
        if convs[-1]["role"] != "assistant":
            errors.append(f"Record {i}: last turn is not 'assistant'")
        for turn in convs:
            if turn["role"] not in {"system", "user", "assistant"}:
                errors.append(f"Record {i}: invalid role '{turn['role']}'")
            if not turn["content"].strip():
                errors.append(f"Record {i}: empty content in {turn['role']} turn")
    return errors
```

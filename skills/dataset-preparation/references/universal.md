# Dataset Preparation — Universal Reference

## The Cardinal Rule: Chat Template Consistency

The single most common cause of a broken fine-tuned model is a mismatch between the chat
template used to prepare the dataset and the template applied at training time. The tokenizer
sees different special tokens, the model learns wrong boundaries, and the result generates
gibberish or never stops.

**Rule:** The chat template applied in `prepare_dataset.py` must be identical to the one
passed to `get_chat_template(tokenizer, chat_template=...)` in `train.py`.

Always record which template was used and document it prominently in the output script:

```python
CHAT_TEMPLATE = "llama-3"  # IMPORTANT: match this exactly in train.py
```

---

## Quality Over Quantity

From Unsloth documentation: "quality and amount will largely reflect the end result."

Guidelines:
- **Below 100 examples** — warn the user; the model may memorise rather than generalise
- **100–1,000 examples** — viable for narrow task adaptation
- **1,000–10,000 examples** — solid for most instruction-following tasks
- **10,000+ examples** — diminishing returns; quality review becomes critical

Prioritise:
- Diverse inputs that cover the full range of expected use cases
- Correct, complete assistant responses
- Balanced turn lengths (extremely short or extremely long responses skew training)
- No duplicate or near-duplicate examples

---

## Label Masking: `train_on_responses_only`

Unsloth's `train_on_responses_only` function masks all user/system tokens so the model
only predicts assistant tokens. This is the correct default for instruction-following.

**The `-100` pitfall:** If all token labels in a sample show `-100`, the model trains on
nothing for that sample. This happens when:
- The response boundary tokens (e.g., `<|start_header_id|>assistant`) are not present
  in the tokenised output
- The chat template was not applied before tokenisation
- The role field uses a non-standard value (e.g., `"Agent"` instead of `"assistant"`)

Detection in `prepare_dataset.py`:

```python
def validate_dataset(dataset, tokenizer):
    for i, sample in enumerate(dataset[:5]):
        labels = sample["labels"]
        if all(l == -100 for l in labels):
            raise ValueError(
                f"Sample {i} has all labels masked to -100. "
                "Check that the chat template is applied before tokenisation "
                "and that role='assistant' (not 'Agent' or 'AI')."
            )
```

---

## Dataset Format Requirements by Model Type

### Standard LLM

Required structure — a list of turn objects:

```json
{
  "conversations": [
    {"role": "system",    "content": "You are a helpful assistant."},
    {"role": "user",      "content": "What is the capital of France?"},
    {"role": "assistant", "content": "Paris."}
  ]
}
```

- `role` must be exactly: `"system"`, `"user"`, or `"assistant"` — lowercase, no variants
- System turn is optional but must be first if present
- Conversations must alternate: user → assistant → user → assistant
- Never end with a `user` turn (the model has nothing to predict)

### Vision

```json
{
  "conversations": [
    {
      "role": "user",
      "content": [
        {"type": "image", "image": "path/to/image.jpg"},
        {"type": "text",  "text": "Describe this image."}
      ]
    },
    {
      "role": "assistant",
      "content": [{"type": "text", "text": "The image shows..."}]
    }
  ]
}
```

### TTS

```json
{
  "audio": "path/to/clip.wav",
  "transcript": "The normalised text of what was spoken."
}
```

### Embedding

```json
{
  "anchor":   "The query or anchor sentence.",
  "positive": "A semantically similar sentence.",
  "negative": "A semantically dissimilar sentence."
}
```

---

## Applying the Chat Template in Code

```python
from unsloth.chat_templates import get_chat_template

tokenizer = get_chat_template(tokenizer, chat_template="llama-3")

def format_conversation(conversations):
    return tokenizer.apply_chat_template(
        conversations,
        tokenize=False,
        add_generation_prompt=False,
    )
```

Do not use `tokenizer.apply_chat_template` without first calling `get_chat_template` —
the default tokenizer template may not match the Unsloth-expected format for that model.

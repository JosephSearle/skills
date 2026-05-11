---
name: dataset-preparation
description: >
  Transform raw data sources into Unsloth-compatible training datasets with the correct chat
  template applied. Reads source files (CSV, JSON, JSONL, PDF, plain text, images, audio),
  detects the target model type (LLM, Vision, TTS, Embedding), maps fields to the required
  Unsloth format, and writes a prepare_dataset.py script to disk. Triggers on: "prepare
  training data", "format dataset for fine-tuning", "convert data for Unsloth", "create
  chat template", "build training dataset", "format my data as ChatML", "convert CSV to
  training format", "prepare my conversations for training", or any instruction to turn
  raw data into a training-ready dataset for model fine-tuning.
---

# Dataset Preparation Skill

A skill for transforming raw data into Unsloth-compatible training datasets. Handles
conversational LLMs, vision models, text-to-speech models, and embedding models —
grounded in Unsloth dataset format requirements and the principle that dataset quality
directly determines fine-tuning outcome.

---

## Core Philosophy

The most common cause of poor fine-tuning results is not hyperparameters or model choice
— it is dataset quality. A thousand high-quality, correctly-formatted examples consistently
outperform ten thousand noisy or misformatted ones.

Every generated dataset must answer: **what is the model learning to predict, from what
input, and is the format the model's tokenizer expects?** A mismatch between the chat
template used during dataset preparation and the one used during training is the single
largest source of broken fine-tuned models.

---

## Step 1 — Detect Data Sources and Target Model Type

Scan all provided file paths, descriptions, or data samples to determine:

**Source format detection:**

| Indicator | Format |
|---|---|
| `.csv` file | Tabular data — map columns to fields |
| `.json` / `.jsonl` file | JSON records — inspect field names |
| `.pdf` file | Unstructured document — extract text, generate Q&A pairs |
| Plain text / `.txt` | Prose — chunk and format as instruction/completion pairs |
| Image files (`.jpg`, `.png`, `.webp`) | Vision training data |
| Audio files (`.wav`, `.mp3`, `.flac`) | TTS training data |
| Already-structured conversation list | Validate and reformat as needed |

**Target model type detection:**

```
Does the data include image files or image paths?
  └─ YES → Vision model dataset
  
Does the data include audio files or audio transcripts?
  └─ YES → TTS model dataset
  
Is the goal to improve retrieval or embeddings?
  └─ YES → Embedding model dataset

Otherwise:
  └─ Standard LLM conversational dataset
```

**Chat template detection (LLM only):**

If the target model name is provided, infer the template:

| Model family | Default template |
|---|---|
| Llama 3, Llama 3.1, Llama 3.2 | `llama-3` |
| Gemma 3, Gemma 4 | `gemma-3` |
| Qwen 3, Qwen 2.5 | `qwen-2.5` |
| Mistral, Ministral | `mistral` |
| ChatGPT-style or unknown | `chatml` |

If no model name is provided and the template cannot be inferred, ask before proceeding.
Using the wrong template is a critical error — it will produce a model that generates
gibberish or never stops generating.

---

## Step 2 — Load References

Always load `references/universal.md` first.

```
Target model type:
  LLM (conversational)    → load references/formats/conversational.md
  Vision (image + text)   → load references/formats/vision.md
  TTS (audio + text)      → load references/formats/tts.md
  Embedding               → load references/formats/embedding.md
```

---

## Step 3 — Analyse Existing Data Structure

Before generating any code, read sample entries from the provided data:

1. **Inspect field names** — identify which fields map to: user input, assistant response,
   system prompt, image path, audio path, transcript, similarity label.

2. **Check for quality issues** and flag them in the output:
   - Missing assistant responses (empty `content` fields)
   - Unpaired roles (a `user` turn with no following `assistant` turn)
   - Responses that are copies of the input (data leakage)
   - Inconsistent sampling rates across audio files (TTS)
   - Images outside the 300–1000px recommended range (Vision)
   - Labels that are all `-100` (means `train_on_responses_only` is misconfigured)

3. **Estimate dataset size** — report the number of examples found. Flag if fewer than
   100 examples are present; quality matters but volume below ~100 risks poor generalisation.

4. **Map fields to the target format** — write out the explicit field mapping before generating
   code:
   ```
   source field "question"   → role: "user",      content: <value>
   source field "answer"     → role: "assistant",  content: <value>
   source field "context"    → role: "system",     content: <value>  (optional)
   ```

---

## Step 4 — Generate `prepare_dataset.py`

Generate a complete, runnable Python script that:

1. **Loads the raw source data** from the provided file path(s)
2. **Maps fields** to the Unsloth-expected format per the mapping from Step 3
3. **Applies the correct chat template** using `unsloth.chat_templates.get_chat_template`
4. **Writes `dataset.jsonl`** to the working directory in the correct format
5. **Validates the output** — prints 3 sample rows and raises an assertion if all token
   labels in any sample are `-100` (which would mean the model trains on nothing)

The script must include:
- A clear `CONFIGURATION` block at the top for the user to adjust file paths and settings
- The full field mapping as a comment so the user can verify it matches their data
- A `validate_dataset()` function that runs automatically after preparation

Apply the format-specific patterns from the loaded reference file for the correct data
structure (conversation list, image+text, audio+text, or semantic pairs).

---

## Step 5 — Write to Disk and Provide Run Guidance

Write `prepare_dataset.py` to the current working directory.

Provide the exact commands to run and verify:

```bash
# Install dependencies
pip install unsloth datasets

# Prepare the dataset
python prepare_dataset.py

# Verify output
python -c "
import json
with open('dataset.jsonl') as f:
    rows = [json.loads(l) for l in f]
print(f'Total examples: {len(rows)}')
print('Sample:', json.dumps(rows[0], indent=2))
"
```

State the output file produced (`dataset.jsonl`) and confirm it is ready to be passed as
the `dataset_path` argument to the `model-finetuning` skill.

---

## Reference Files

- `references/universal.md` — chat template theory, quality-over-quantity principle, label
  masking (`train_on_responses_only`), the `-100` label pitfall, dataset size guidance
- `references/formats/conversational.md` — ChatML, Llama-3, Gemma, Mistral chat templates;
  role mapping; system prompt handling; multi-turn conversation structure
- `references/formats/vision.md` — image path vs embedded image; multi-image via list
  comprehensions; 300–1000px guidance; vision data collator requirements
- `references/formats/tts.md` — audio-text pairs; 24kHz sampling rate normalisation;
  transcript normalisation; Orpheus and Sesame-CSM format requirements
- `references/formats/embedding.md` — semantic pairs format; hard negatives; similarity
  scoring; triplet format for contrastive learning

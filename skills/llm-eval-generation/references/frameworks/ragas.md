# RAGAS Framework Reference

RAGAS is the standard framework for RAG pipeline evaluation. It is reference-free for most
metrics — no labelled ground truth is required during development.

Model: Open-source
Install: `pip install ragas`
Docs: https://docs.ragas.io

---

## When to Use RAGAS

Use RAGAS when the primary scenario is RAG. RAGAS is the best starting point for development
iteration because it requires no ground truth labels. Combine with DeepEval for CI gating
(DeepEval enforces thresholds in pytest; RAGAS alone does not block CI by default).

Do not use RAGAS for non-RAG scenarios — it is purpose-built for retrieval-augmented systems.

---

## Core Metrics

| Metric | Import | Requires ground truth? | What it measures |
|---|---|---|---|
| `faithfulness` | `from ragas.metrics import faithfulness` | No | Claims in answer are supported by context |
| `answer_relevancy` | `from ragas.metrics import answer_relevancy` | No | Answer addresses the question |
| `context_precision` | `from ragas.metrics import context_precision` | No | Retrieved context is useful |
| `context_recall` | `from ragas.metrics import context_recall` | Yes | All needed info was retrieved |
| `answer_correctness` | `from ragas.metrics import answer_correctness` | Yes | Factual accuracy vs. reference |
| `context_entity_recall` | `from ragas.metrics import context_entity_recall` | Yes | Key entities are in retrieved context |

---

## Basic Evaluation

```python
# evals/eval_<module>_rag.py
from ragas import evaluate
from ragas.metrics import (
    faithfulness,
    answer_relevancy,
    context_precision,
    context_recall,
)
from datasets import Dataset

# Build evaluation dataset
eval_data = [
    {
        "question": "What is the return policy for online orders?",
        "answer": rag_pipeline.query("What is the return policy for online orders?"),
        "contexts": rag_pipeline.retrieve("What is the return policy for online orders?"),
        # "ground_truth" required only for context_recall and answer_correctness
        "ground_truth": "Items can be returned within 30 days with original receipt.",
    },
    # 10–20 cases minimum
]

dataset = Dataset.from_list(eval_data)

result = evaluate(
    dataset=dataset,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
    llm=your_llm_instance,       # The LLM used as judge
    embeddings=your_embeddings,  # Embeddings model for semantic similarity
)

print(result)
# {'faithfulness': 0.87, 'answer_relevancy': 0.79, 'context_precision': 0.82, ...}

# Enforce thresholds manually (RAGAS does not block CI natively)
assert result["faithfulness"] >= 0.8, f"Faithfulness {result['faithfulness']:.2f} below 0.8"
assert result["context_precision"] >= 0.7, f"Context precision below 0.7"
```

---

## LangChain / LlamaIndex Integration

```python
# LangChain native integration
from ragas.integrations.langchain import EvaluatorChain
from ragas.metrics import faithfulness

evaluator = EvaluatorChain(metric=faithfulness)
result = evaluator({"question": query, "context": context, "answer": answer})

# LlamaIndex native integration
from ragas.integrations.llama_index import evaluate as llama_evaluate

result = llama_evaluate(
    query_engine=index.as_query_engine(),
    metrics=[faithfulness, answer_relevancy],
    questions=["What is...?", "How does...?"],
)
```

---

## Synthetic Test Set Generation

When you have documents but no labelled Q&A pairs, RAGAS can generate a synthetic eval dataset.
Human review of generated cases is required before using them in CI.

```python
from ragas.testset.generator import TestsetGenerator
from ragas.testset.evolutions import simple, reasoning, multi_context
from langchain_community.document_loaders import DirectoryLoader

# Load your documents
loader = DirectoryLoader("./docs", glob="**/*.md")
documents = loader.load()

# Generate synthetic test set
generator = TestsetGenerator.with_openai()
testset = generator.generate_with_langchain_docs(
    documents=documents,
    test_size=20,
    distributions={
        simple: 0.5,        # Simple factual questions
        reasoning: 0.25,    # Multi-hop reasoning questions
        multi_context: 0.25, # Questions requiring multiple documents
    },
)

# Export for review and version control
testset.to_pandas().to_json("evals/datasets/synthetic_rag_golden.json", orient="records")
```

**Always review synthetic cases before committing them to your eval dataset.** Synthetic
generation can introduce questions that are ambiguous, unanswerable, or have incorrect
ground truth answers.

---

## Evaluating Retriever vs. Generator Separately

```python
from ragas.metrics import context_precision, context_recall, faithfulness, answer_relevancy

# Step 1: Evaluate the retriever only
retriever_metrics = evaluate(
    dataset=dataset,
    metrics=[context_precision, context_recall],
)
print("Retriever:", retriever_metrics)

# Step 2: Evaluate the generator only (given retrieved context)
generator_metrics = evaluate(
    dataset=dataset,
    metrics=[faithfulness, answer_relevancy],
)
print("Generator:", generator_metrics)
```

If retriever scores are low (context_precision < 0.7), fix retrieval before optimising the
generator — bad retrieval caps generator quality regardless of model capability.

---

## Integrating RAGAS Thresholds into DeepEval CI

RAGAS does not natively block CI. Wrap RAGAS in a pytest test to enforce thresholds:

```python
# evals/eval_rag_ci.py
import pytest
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision

THRESHOLDS = {
    "faithfulness": 0.8,
    "answer_relevancy": 0.7,
    "context_precision": 0.7,
}

def test_rag_metrics_meet_thresholds():
    result = evaluate(dataset=load_eval_dataset(), metrics=list(THRESHOLDS.keys()))
    for metric_name, threshold in THRESHOLDS.items():
        score = result[metric_name]
        assert score >= threshold, \
            f"RAGAS {metric_name} = {score:.2f}, below threshold {threshold}"
```

Run: `pytest evals/eval_rag_ci.py -v`

---

## Judge Model Configuration

```python
from ragas import evaluate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# Use a different, more capable model as judge
judge_llm = ChatOpenAI(model="gpt-4o")
judge_embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

result = evaluate(
    dataset=dataset,
    metrics=[faithfulness, answer_relevancy],
    llm=judge_llm,
    embeddings=judge_embeddings,
)
```

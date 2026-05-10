# RAG Eval Reference

Load this file when the code under test performs retrieval-augmented generation: vector store
queries, document loading, embedding operations, retriever chains, or any pattern that retrieves
context before generating a response.

---

## Failure Modes

- **Irrelevant retrieval** — retrieved chunks do not relate to the query; generation quality is
  capped regardless of model capability
- **Hallucination beyond context** — model generates claims not present in retrieved documents
- **Incomplete answers** — relevant information was retrieved but not incorporated into the response
- **Stale documents** — retriever returns outdated content; model answers confidently from it
- **Context overflow** — too much retrieved context; model attends to irrelevant sections

---

## Required Metrics (The RAGAS Triad)

These five metrics cover the full RAG evaluation surface. Faithfulness and Answer Relevance are
the minimum viable set; add Context Precision and Context Recall for production systems.

| Metric | Definition | Requires ground truth? | Tool |
|---|---|---|---|
| **Faithfulness** | Claims in the answer are supported by retrieved context | No | RAGAS, DeepEval, TruLens |
| **Answer Relevance** | Response addresses what the user actually asked | No | RAGAS, DeepEval, TruLens |
| **Context Precision** | Fraction of retrieved context that is useful for the answer | No | RAGAS, DeepEval |
| **Context Recall** | Fraction of needed information that was retrieved | Yes (reference answer) | RAGAS, DeepEval |
| **Context Relevance** | Retrieved chunks relate to the query | No | TruLens |

> RAGAS is reference-free for Faithfulness, Answer Relevance, and Context Precision — no
> labelled ground truth required. Context Recall requires a reference answer.

---

## Evaluation Strategy

### Evaluate the retriever and generator separately

A RAG pipeline has two failure surfaces. Diagnose them independently before optimising either.

```
Retriever evaluation:
  - Context Precision — are the right chunks being returned?
  - Context Recall — is all necessary information being retrieved?
  - Context Relevance — are chunks topically relevant?

Generator evaluation (given retrieved context):
  - Faithfulness — does the answer stay within the context?
  - Answer Relevance — does the answer address the question?
```

### Development vs. CI strategy

| Phase | Approach | Why |
|---|---|---|
| Development | RAGAS reference-free metrics | No ground truth required; iterate fast |
| CI gate | DeepEval with fixed thresholds | Deterministic pass/fail; blocks regressions |
| Critical paths | Reference-based with golden answers | Highest confidence; requires labelled dataset |

### Multi-trial requirement

RAG outputs are non-deterministic. Run each eval case ≥ 3 trials and average metric scores.
A single-trial faithfulness score of 0.9 is not a reliable result.

---

## DeepEval Example

```python
# evals/eval_rag_pipeline.py
import pytest
from deepeval import assert_test
from deepeval.metrics import FaithfulnessMetric, AnswerRelevancyMetric, ContextualPrecisionMetric
from deepeval.test_case import LLMTestCase

@pytest.mark.parametrize("test_case", [
    LLMTestCase(
        input="What is the return policy for online orders?",
        actual_output=rag_pipeline.query("What is the return policy for online orders?"),
        expected_output="Items can be returned within 30 days with original receipt.",  # for recall
        retrieval_context=rag_pipeline.retrieve("What is the return policy for online orders?"),
    ),
])
def test_rag_faithfulness(test_case):
    assert_test(test_case, [
        FaithfulnessMetric(threshold=0.8, model="gpt-4o"),
        AnswerRelevancyMetric(threshold=0.7, model="gpt-4o"),
        ContextualPrecisionMetric(threshold=0.7, model="gpt-4o"),
    ])
```

---

## RAGAS Example

```python
# evals/eval_rag_pipeline_rag.py
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from datasets import Dataset

eval_dataset = Dataset.from_list([
    {
        "question": "What is the return policy for online orders?",
        "answer": rag_pipeline.query("What is the return policy for online orders?"),
        "contexts": rag_pipeline.retrieve("What is the return policy for online orders?"),
        "ground_truth": "Items can be returned within 30 days with original receipt.",
    },
    # Add 10-20 cases minimum
])

result = evaluate(
    dataset=eval_dataset,
    metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
)

print(result)
assert result["faithfulness"] >= 0.8, "Faithfulness below threshold"
assert result["context_precision"] >= 0.7, "Context precision below threshold"
```

---

## CI Thresholds

| Metric | Minimum | Block deploy if below |
|---|---|---|
| Faithfulness | 0.8 | Yes |
| Answer Relevance | 0.7 | Yes |
| Context Precision | 0.7 | Yes |
| Context Recall | 0.7 | Warning only (requires labelled data) |

---

## Eval Dataset Requirements

Minimum 15 cases. Must include:
- Queries with clear answers in the document set (happy path)
- Queries where the answer is partially in the context (coverage test)
- Queries with no answer in the document set (should produce a graceful "I don't know")
- Queries designed to elicit hallucination (adversarial)
- Edge cases: very short queries, queries with typos, multi-part questions

---

## Recommended Stack

| Layer | Tool | Reason |
|---|---|---|
| Development eval | RAGAS | Reference-free; no ground truth needed |
| CI gating | DeepEval | pytest-native; threshold enforcement |
| Step-level diagnosis | TruLens | Pinpoints whether failure is in retrieval or generation |
| Production monitoring | Langfuse or Braintrust | Trace storage; online eval sampling |

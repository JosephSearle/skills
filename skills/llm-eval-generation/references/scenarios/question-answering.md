# Question Answering Eval Reference

Load this file when the code under test performs direct question answering: `qa_chain`, knowledge-
grounded Q&A without retrieval, fact-based response patterns, or any system where the LLM answers
questions directly from its parametric knowledge or a fixed context window.

Distinct from RAG: QA eval applies when there is no runtime retrieval step. If retrieval is
present, load `scenarios/rag.md` instead or alongside this file.

---

## Failure Modes

- **Factually incorrect answers** — model states wrong facts with confidence
- **Over-confident wrong answers** — model is certain about incorrect information
- **Hedging when confidence is warranted** — model is unnecessarily uncertain about correct facts
  (calibration failure in the opposite direction)
- **Question not addressed** — response is on topic but does not answer the specific question asked
- **Misconception propagation** — model repeats common misconceptions (TruthfulQA failure mode)
- **Outdated information** — model answers from stale parametric knowledge

---

## Required Metrics

| Metric | Definition | Requires ground truth? | Tool |
|---|---|---|---|
| **Exact Match (EM)** | Output exactly matches reference answer | Yes | Standard; DeepEval |
| **F1** | Token-level overlap between output and reference | Yes | Standard; DeepEval |
| **Answer Correctness** | Factual accuracy assessed by LLM-as-judge | Yes (reference) | DeepEval, RAGAS |
| **Answer Relevance** | Response addresses the actual question asked | No | RAGAS, DeepEval |
| **Calibration (ECE)** | Model confidence matches actual accuracy | Yes | HELM methodology |

> Exact Match and F1 are appropriate for short, closed-form answers. For open-domain or
> conversational Q&A, LLM-as-judge (Answer Correctness) is the primary metric.

---

## Evaluation Strategy

### Match metric to answer type

| Answer type | Primary metric | Secondary metric |
|---|---|---|
| Short factual (dates, names, numbers) | Exact Match | F1 |
| Multi-sentence factual | F1 + Answer Correctness (G-Eval) | Answer Relevance |
| Open-ended / explanatory | Answer Correctness (G-Eval) | Coherence |
| Yes/No | Exact Match | — |

### TruthfulQA alignment

TruthfulQA tests whether models repeat common misconceptions and false beliefs. Include questions
from domains where your system is likely to encounter misconceptions (medicine, law, science,
history). A system that achieves high F1 on general QA but fails on TruthfulQA-style questions
is over-confident on false beliefs.

### Calibration measurement

A well-calibrated model is confident when correct and uncertain when incorrect. Calibration
failure (high confidence on wrong answers) is a safety issue in high-stakes QA systems.

```python
def compute_ece(confidences: list[float], accuracies: list[bool], n_bins: int = 10) -> float:
    """Expected Calibration Error — lower is better."""
    bin_size = 1.0 / n_bins
    ece = 0.0
    for bin_idx in range(n_bins):
        bin_lower = bin_idx * bin_size
        bin_upper = bin_lower + bin_size
        in_bin = [i for i, c in enumerate(confidences) if bin_lower <= c < bin_upper]
        if not in_bin:
            continue
        bin_accuracy = sum(accuracies[i] for i in in_bin) / len(in_bin)
        bin_confidence = sum(confidences[i] for i in in_bin) / len(in_bin)
        ece += (len(in_bin) / len(confidences)) * abs(bin_accuracy - bin_confidence)
    return ece
```

---

## DeepEval Example

```python
# evals/eval_question_answering.py
import pytest
from deepeval import assert_test
from deepeval.metrics import AnswerRelevancyMetric, GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

answer_correctness = GEval(
    name="Answer Correctness",
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT,
        LLMTestCaseParams.EXPECTED_OUTPUT,
    ],
    criteria="The answer is factually correct and fully addresses the question.",
    evaluation_steps=[
        "Read the question.",
        "Read the reference answer.",
        "Read the model's answer.",
        "Identify any factual claims in the model's answer that contradict the reference.",
        "Identify any aspects of the question that the model's answer fails to address.",
        "Score 1–10: 10 = completely correct and complete, 1 = incorrect or completely misses the question.",
    ],
    model="gpt-4o",
    threshold=0.7,
)

QA_TEST_CASES = [
    {
        "question": "What year was the Eiffel Tower constructed?",
        "expected": "The Eiffel Tower was constructed in 1889.",
    },
    {
        "question": "Does the Great Wall of China form a continuous wall?",
        "expected": "No. The Great Wall is a series of fortifications with gaps, not a single continuous wall.",
        # TruthfulQA-style: many models incorrectly say it is visible from space
    },
    # 10–20 cases minimum
]

@pytest.mark.parametrize("case", QA_TEST_CASES)
def test_answer_correctness(case):
    actual_output = qa_system.answer(case["question"])
    test_case = LLMTestCase(
        input=case["question"],
        actual_output=actual_output,
        expected_output=case["expected"],
    )
    assert_test(test_case, [
        answer_correctness,
        AnswerRelevancyMetric(threshold=0.7, model="gpt-4o"),
    ])
```

---

## RAGAS Answer Correctness

```python
from ragas import evaluate
from ragas.metrics import answer_correctness, answer_relevancy
from datasets import Dataset

eval_dataset = Dataset.from_list([
    {
        "question": "What year was the Eiffel Tower constructed?",
        "answer": qa_system.answer("What year was the Eiffel Tower constructed?"),
        "ground_truth": "The Eiffel Tower was constructed in 1889.",
    },
    # 10–20 cases
])

result = evaluate(
    dataset=eval_dataset,
    metrics=[answer_correctness, answer_relevancy],
)
assert result["answer_correctness"] >= 0.7
```

---

## Eval Dataset Requirements

Minimum 15 cases. Must include:
- Straightforward factual questions with clear correct answers (happy path)
- Questions where common misconceptions exist — test truthfulness, not just fluency
- Questions that the system should decline or express uncertainty about (abstention cases)
- Questions with multiple valid correct answers (test for rigidity)
- Edge cases: ambiguous questions, questions with embedded false premises

---

## CI Thresholds

| Metric | Minimum | Notes |
|---|---|---|
| Answer Correctness (G-Eval) | 0.7 | Primary gate |
| Answer Relevance | 0.7 | Did it actually answer the question? |
| Exact Match (closed-form QA) | 0.8 | For yes/no or short factual answers |
| Calibration (ECE) | < 0.1 | Lower is better; 0 = perfect calibration |

---

## Recommended Stack

| Layer | Tool | Reason |
|---|---|---|
| Answer correctness | DeepEval GEval | LLM-as-judge with explicit CoT steps |
| Relevance | RAGAS answer_relevancy | Reference-free; good for iterative development |
| Truthfulness | TruthfulQA benchmark | Alignment with factual knowledge across domains |
| Regression tracking | Braintrust | Score tracking as knowledge base or model evolves |

# Summarization Eval Reference

Load this file when the code under test produces summaries: document summarization chains,
`MapReduceDocumentsChain`, explicit summary prompts, or any pipeline that compresses longer
content into a shorter form.

---

## Failure Modes

- **Hallucinated content** — summary includes claims not present in the source document
- **Key information omitted** — important facts from the source are absent from the summary
- **Wrong emphasis** — minor details are elevated; major points are buried or absent
- **Excessive length** — summary is not meaningfully shorter than the source
- **Factual distortion** — paraphrasing changes the meaning of the original claim
- **Loss of nuance** — hedged or conditional statements in the source are restated as absolute facts

---

## Required Metrics

| Metric | Definition | Requires ground truth? | Tool |
|---|---|---|---|
| **Faithfulness** | Summary contains only information present in source | No | RAGAS, DeepEval |
| **Coverage / Recall** | Key points from the source are captured | Optional (better with ref) | ROUGE-L, G-Eval |
| **Conciseness** | Summary is appropriately shorter than the source | No | Length ratio + G-Eval |
| **Coherence** | Summary is well-structured, readable, and internally consistent | No | G-Eval |

> ROUGE-L and BLEU are weak proxies for summarization quality and have poor correlation with
> human judgment. Use G-Eval (LLM-as-judge with CoT) for coverage and coherence instead.
> Faithfulness is the critical metric — hallucinated summaries are often worse than no summary.

---

## G-Eval Configuration

G-Eval is the recommended approach for subjective summarization metrics. Configure evaluation
steps explicitly — vague steps produce inconsistent scores.

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams

faithfulness_metric = GEval(
    name="Summarization Faithfulness",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    criteria="The summary contains only information that is present in the source document.",
    evaluation_steps=[
        "Read the source document carefully.",
        "Read the summary.",
        "Identify every factual claim in the summary.",
        "For each claim, determine whether it is supported by the source document.",
        "Penalise claims that are not present in the source, even if they seem plausible.",
        "Score 1–10: 10 = all claims supported, 1 = major hallucinations present.",
    ],
    model="gpt-4o",
    threshold=0.8,
)

coverage_metric = GEval(
    name="Summarization Coverage",
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
    criteria="The summary captures the key points from the source document.",
    evaluation_steps=[
        "Read the source document and identify the 3–5 most important points.",
        "Read the summary.",
        "For each important point, determine whether it is present in the summary.",
        "Score 1–10 based on the fraction of key points captured.",
        "Do not penalise the summary for omitting minor details.",
    ],
    model="gpt-4o",
    threshold=0.7,
)

coherence_metric = GEval(
    name="Summarization Coherence",
    evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT],
    criteria="The summary is logically structured, readable, and internally consistent.",
    evaluation_steps=[
        "Read the summary.",
        "Check whether the summary has a logical flow.",
        "Identify any contradictions within the summary itself.",
        "Identify any grammatical errors or unclear phrasing.",
        "Score 1–10: 10 = clear, logical, no contradictions.",
    ],
    model="gpt-4o",
    threshold=0.7,
)
```

---

## DeepEval Example

```python
# evals/eval_summarization.py
import pytest
from deepeval import assert_test
from deepeval.metrics import FaithfulnessMetric
from deepeval.test_case import LLMTestCase

SOURCE_DOCUMENTS = [
    {
        "source": "The quarterly earnings report showed a 12% increase in revenue...[full text]",
        "expected_key_points": ["12% revenue increase", "Q3 results", "expansion plans"],
    },
    # 10–20 cases minimum
]

@pytest.mark.parametrize("doc", SOURCE_DOCUMENTS)
def test_summarization_faithfulness(doc):
    summary = summarizer.summarize(doc["source"])
    test_case = LLMTestCase(
        input=doc["source"],
        actual_output=summary,
        context=[doc["source"]],
    )
    assert_test(test_case, [
        FaithfulnessMetric(threshold=0.8, model="gpt-4o"),
        faithfulness_metric,
        coverage_metric,
        coherence_metric,
    ])

def test_summary_conciseness():
    """Summary should be meaningfully shorter than source."""
    for doc in SOURCE_DOCUMENTS:
        source_len = len(doc["source"].split())
        summary = summarizer.summarize(doc["source"])
        summary_len = len(summary.split())
        compression_ratio = summary_len / source_len
        assert compression_ratio <= 0.5, \
            f"Summary is {compression_ratio:.0%} of source length — not concise enough"
```

---

## Domain-Critical Summarization

For legal, medical, or financial summarization — where a missed detail or distorted claim has
real consequences — build a human-annotated golden dataset:

```json
// evals/datasets/summarization_golden.json
[
  {
    "source": "Full source document text...",
    "reference_summary": "Human-authored reference summary...",
    "required_facts": [
      "Fact 1 that must appear in any valid summary",
      "Fact 2 that must appear in any valid summary"
    ],
    "forbidden_claims": [
      "Claim that would be a hallucination if it appeared"
    ]
  }
]
```

For `required_facts`, write a deterministic check:
```python
def test_required_facts_present(golden_case):
    summary = summarizer.summarize(golden_case["source"])
    for fact in golden_case["required_facts"]:
        assert fact.lower() in summary.lower() or \
               fact_present_via_llm_judge(fact, summary), \
               f"Required fact missing from summary: {fact!r}"
```

---

## Eval Dataset Requirements

Minimum 15 cases. Must include:
- Documents with clear, unambiguous main points (happy path)
- Documents containing hedged or conditional statements (test for distortion)
- Documents where some information should be omitted (minor details — test for over-inclusion)
- Very long documents (test for information loss at scale)
- Documents containing numbers, dates, or named entities (common hallucination targets)
- Edge cases: very short documents, documents with contradictory statements

---

## CI Thresholds

| Metric | Minimum | Notes |
|---|---|---|
| Faithfulness | 0.8 | Hard gate — hallucinated summaries are worse than no summary |
| Coverage (G-Eval) | 0.7 | Key points captured |
| Coherence (G-Eval) | 0.7 | Readable and consistent |
| Compression ratio | ≤ 0.5 | Summary must be less than 50% of source length |

---

## Recommended Stack

| Layer | Tool | Reason |
|---|---|---|
| Faithfulness | DeepEval FaithfulnessMetric + RAGAS | Cross-check; RAGAS is reference-free |
| Coverage + coherence | G-Eval (DeepEval) | LLM-as-judge with explicit CoT steps |
| Domain-critical | Human-annotated golden dataset | Required for legal, medical, financial |
| Production monitoring | Langfuse | Trace-level visibility into summarization quality |

# DeepEval Framework Reference

DeepEval is the default CI/CD eval framework for this skill. It provides pytest-native LLM
evaluation with 50+ pre-built metrics, G-Eval for custom criteria, and the DAG metric for
structured agent evaluation.

Model: Open-source (MIT) + optional Confident AI cloud
Install: `pip install deepeval`
Docs: https://docs.confident-ai.com

---

## When to Use DeepEval

Use DeepEval as the primary CI/CD gating framework for all scenarios. It is the broadest-
coverage option with native pytest integration. Combine with RAGAS for RAG-specific development
evaluation and Promptfoo for adversarial testing.

---

## Core Concepts

**LLMTestCase** — the unit of evaluation. Contains the input, actual output, optional expected
output, and optional retrieval context.

**Metric** — a scorer applied to a test case. Each metric has a `threshold` and produces a
`score` and `reason`.

**assert_test** — the pytest-integrated assertion function. Fails the test if any metric score
falls below its threshold.

**GEval** — custom LLM-as-judge metric using Chain-of-Thought reasoning. Use for subjective
criteria where no pre-built metric exists.

**DAG metric** — scores multi-step agent behaviour as a decision tree. Use for tool-calling
and agentic workflows.

---

## Basic Test Structure

```python
# evals/eval_<module>.py
import pytest
from deepeval import assert_test
from deepeval.metrics import (
    FaithfulnessMetric,
    AnswerRelevancyMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
    HallucinationMetric,
    ToxicityMetric,
    BiasMetric,
)
from deepeval.test_case import LLMTestCase

# Configure the judge model (use a different, more capable model)
JUDGE_MODEL = "gpt-4o"

@pytest.mark.parametrize("test_case", [
    LLMTestCase(
        input="user query here",
        actual_output=pipeline.run("user query here"),
        expected_output="optional reference answer",
        retrieval_context=["retrieved doc 1", "retrieved doc 2"],  # RAG only
    ),
])
def test_pipeline_quality(test_case):
    assert_test(test_case, [
        FaithfulnessMetric(threshold=0.8, model=JUDGE_MODEL),
        AnswerRelevancyMetric(threshold=0.7, model=JUDGE_MODEL),
    ])
```

---

## Pre-Built Metrics Reference

| Metric class | Scenario | Key parameters |
|---|---|---|
| `FaithfulnessMetric` | RAG, Summarization | `threshold`, `model` |
| `AnswerRelevancyMetric` | RAG, QA | `threshold`, `model` |
| `ContextualPrecisionMetric` | RAG | `threshold`, `model` |
| `ContextualRecallMetric` | RAG | `threshold`, `model`, requires `expected_output` |
| `HallucinationMetric` | RAG, Structured Output | `threshold`, `model` |
| `ToxicityMetric` | Safety | `threshold=0.0`, `model` |
| `BiasMetric` | Safety, Fairness | `threshold`, `model` |
| `TaskCompletionMetric` | Agent / Tool-use | `threshold`, `model` |
| `GEval` | Any custom criteria | `criteria`, `evaluation_steps`, `model`, `threshold` |

---

## G-Eval for Custom Criteria

G-Eval uses Chain-of-Thought reasoning before scoring. Always provide explicit `evaluation_steps`
— vague criteria produce inconsistent scores.

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams

custom_metric = GEval(
    name="Response Conciseness",
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT,
    ],
    criteria="The response answers the question without unnecessary padding or repetition.",
    evaluation_steps=[
        "Read the input question.",
        "Read the response.",
        "Identify any sentences that do not contribute information relevant to the question.",
        "Identify any repetition of the same point across sentences.",
        "Score 1–10: 10 = direct and concise, 1 = heavily padded or repetitive.",
    ],
    model="gpt-4o",
    threshold=0.7,
)
```

---

## DAG Metric for Agent Evaluation

The DAG (Directed Acyclic Graph) metric models the expected tool-calling flow as a decision
tree and scores the agent's actual trace against it.

```python
from deepeval.metrics.dag import DAGMetric, TaskNode, ToolCallNode, NonToolCallNode

# Define the expected agent decision flow
expected_flow = DAGMetric(
    name="Research and Summarise Flow",
    dag=TaskNode(
        children=[
            ToolCallNode(
                tool="web_search",
                expected_params={"query": str},
                expected_output_contains=["results"],
                children=[
                    NonToolCallNode(
                        # Agent should synthesise before calling summarise
                        children=[
                            ToolCallNode(
                                tool="summarise",
                                expected_params={"text": str},
                            )
                        ]
                    )
                ],
            )
        ]
    ),
    threshold=0.8,
)
```

---

## Conversational Test Case

```python
from deepeval.test_case import ConversationalTestCase, Message

conversational_case = ConversationalTestCase(
    turns=[
        LLMTestCase(
            input="What is your return policy?",
            actual_output=agent.chat("What is your return policy?"),
        ),
        LLMTestCase(
            input="I bought it 25 days ago.",
            actual_output=agent.chat("I bought it 25 days ago."),
        ),
    ]
)

assert_test(conversational_case, [coherence_metric, helpfulness_metric])
```

---

## Multi-Trial Configuration

```python
# Run each test case 3 times and report the average score
from deepeval.evaluate import evaluate

results = evaluate(
    test_cases=test_cases,
    metrics=metrics,
    run_async=True,
    # DeepEval does not natively support multi-trial averaging —
    # implement pass@k manually (see universal.md and agent-tool-use.md)
)
```

---

## CI Integration

```bash
# Run all evals
deepeval test run evals/

# Block on metric failure
deepeval test run evals/ --fail-on-metric-below 0.8

# Verbose output — shows score and reason per metric
deepeval test run evals/ --verbose

# Run in CI (GitHub Actions)
- name: Run LLM Evals
  run: deepeval test run evals/ --fail-on-metric-below 0.8
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

---

## Configuration

```python
# deepeval.config.py or conftest.py
import deepeval

# Set the default judge model globally
deepeval.login_with_confident_api_key("...")  # Optional: Confident AI cloud

# Or configure per-metric via model= parameter (preferred for clarity)
```

---

## Judge Model Selection

| Your model | Recommended judge model | Reason |
|---|---|---|
| GPT-3.5 | GPT-4o | More capable judge than evaluated model |
| GPT-4o | GPT-4o | Acceptable; ideally use a different provider |
| Claude Haiku | Claude Sonnet or Opus | Same provider, more capable tier |
| Claude Sonnet | Claude Opus or GPT-4o | Cross-provider reduces self-preference bias |
| Open-source (Llama, Mistral) | GPT-4o or Claude | Proprietary judge for open-source model evals |

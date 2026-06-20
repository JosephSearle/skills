---
name: llm-evaluation
description: >
  Design and implement LLM evaluation suites for agentcraft agents using DeepEval and RAGAS,
  with MLflow as the experiment tracking backend. Covers independent eval-repo architecture,
  metrics selection, test case construction, CI gating, and synthetic dataset generation.
  Triggers on: deepeval, ragas, LLMTestCase, ConversationalTestCase, EvaluationDataset, Golden,
  GEval, AnswerRelevancyMetric, FaithfulnessMetric, HallucinationMetric, ToolCorrectnessMetric,
  TaskCompletionMetric, context_precision, context_recall, faithfulness, answer_relevancy,
  answer_correctness, TestsetGenerator, eval repo, eval-repo architecture, independent eval,
  deepeval test run, @observe, @pytest.mark.eval, judge LLM, judge model, CI eval gate,
  "evaluate my agent", "test LLM output", "RAG evaluation", "hallucination check",
  "set up eval", "eval pipeline".
---

## Core Philosophy

LLM evaluation lives in a **separate eval repo** (or isolated eval package) that imports the
agent via a stable, versioned contract. This decoupling means the eval suite can evolve
independently, run on a schedule, and gate releases without being tangled in agent code changes.

Two complementary frameworks serve different evaluation layers:

| Framework | Layer | What it measures |
|---|---|---|
| **DeepEval** | Generation layer | Answer quality, faithfulness, tool correctness, task completion |
| **RAGAS** | Retrieval layer | Context precision, context recall, retrieval relevance |

Both integrate with MLflow as scorers (since 3.8): `from mlflow.genai.scorers import deepeval, ragas`.

**Judge-LLM cost guidance**: use Claude Haiku (`claude-haiku-4-5-20251001`) or GPT-4o-mini as
the judge for 60–80% cost reduction; reserve full models for final release gates.

---

## Step 1 — Determine Context

| Intent | Signals | Action |
|---|---|---|
| **SETUP** | "set up eval", "eval repo structure", "eval architecture" | Load `references/eval-repo-architecture.md`; emit repo/contract scaffold |
| **DEEPEVAL** | "deepeval", "LLMTestCase", "GEval", "ToolCorrectnessMetric" | Load `references/deepeval.md`; emit test cases and metrics |
| **RAGAS** | "ragas", "context precision", "context recall", "TestsetGenerator" | Load `references/ragas.md`; emit eval code |
| **CI GATE** | "CI eval", "fail on score", "threshold", "pre-release gate" | Load `references/ci-gates.md`; emit threshold config |
| **DATASETS** | "synthetic dataset", "TestsetGenerator", "golden dataset" | Load `references/ragas.md` §TestsetGenerator + `references/deepeval.md` §EvaluationDataset |

---

## Step 2 — Load References

| Reference file | Load when |
|---|---|
| `references/eval-repo-architecture.md` | Any eval-repo setup, agent contract design, loose coupling |
| `references/deepeval.md` | Any DeepEval metric, LLMTestCase, ConversationalTestCase, CI command |
| `references/ragas.md` | Any RAGAS metric, v0.4 API, TestsetGenerator, judge LLM config |
| `references/ci-gates.md` | Any CI threshold, schedule, pre-release gate, MLflow comparison |

Cross-reference `observability` for MLflow experiment logging of eval results.
Cross-reference `testing-foundations` for pytest marker setup (`@pytest.mark.eval`) and `uv run`.
Cross-reference `langchain-rag` for the `retrieval_context` exposure contract.

---

## Step 3 — Apply Patterns

### Agent contract (required in the agent codebase)

The eval repo cannot reach into the agent's internals. The agent MUST expose:

```python
# src/myagent/contract.py
from dataclasses import dataclass
from typing import Any

@dataclass
class AgentOutput:
    answer: str
    retrieval_context: list[str]    # chunks fed to LLM (for RAG metrics)
    tools_called: list[dict]        # [{name, args, output}, ...] (for tool metrics)
    metadata: dict[str, Any]

async def run_agent(user_input: str) -> AgentOutput:
    """Stable entrypoint for the eval repo to call."""
    ...
```

### DeepEval test case

```python
from deepeval import evaluate
from deepeval.test_case import LLMTestCase
from deepeval.metrics import (
    AnswerRelevancyMetric, FaithfulnessMetric, ToolCorrectnessMetric
)

from myagent.contract import run_agent

async def build_test_case(question: str, expected: str) -> LLMTestCase:
    output = await run_agent(question)
    return LLMTestCase(
        input=question,
        actual_output=output.answer,
        expected_output=expected,
        retrieval_context=output.retrieval_context,
        tools_called=output.tools_called,
    )

# Run with the DeepEval test runner (not plain pytest — for caching + cost tracking)
# deepeval test run tests/eval/test_agent.py
```

### RAGAS evaluation

```python
from ragas import evaluate
from ragas.metrics import context_precision, faithfulness
from ragas.llms import LangchainLLMWrapper
from langchain_anthropic import ChatAnthropic
from datasets import Dataset

judge_llm = LangchainLLMWrapper(ChatAnthropic(model="claude-haiku-4-5-20251001"))

dataset = Dataset.from_list([
    {
        "question": "What is LangGraph?",
        "answer": output.answer,
        "contexts": output.retrieval_context,
        "ground_truth": expected_answer,
    }
    for output, expected_answer in zip(outputs, expected_answers)
])

results = evaluate(
    dataset,
    metrics=[context_precision, faithfulness],
    llm=judge_llm,
)
# results.scores — list of dicts with per-row scores
```

### Which metrics for which concern?

| Concern | Framework | Metrics |
|---|---|---|
| Answer quality | DeepEval | `AnswerRelevancyMetric`, `GEval` |
| Hallucination | DeepEval | `HallucinationMetric`, `FaithfulnessMetric` |
| Tool use correctness | DeepEval | `ToolCorrectnessMetric`, `TaskCompletionMetric` |
| Multi-turn quality | DeepEval | `ConversationalTestCase` + `GEval` |
| Retrieval quality | RAGAS | `context_precision`, `context_recall` |
| Generation groundedness | RAGAS | `faithfulness`, `answer_relevancy` |
| Dataset coverage | RAGAS | `TestsetGenerator` for synthetic QA pairs |

---

## Step 4 — Output & Verification

```bash
# Install eval group
uv sync --group eval

# Run DeepEval tests (use deepeval CLI, not pytest directly)
deepeval test run tests/eval/test_agent.py

# Run specific metric
deepeval test run tests/eval/test_faithfulness.py -v

# Run RAGAS eval inline
uv run python tests/eval/run_ragas.py

# CI gate check (exit code 1 on threshold breach)
deepeval test run tests/eval/ --fail-on-metric-below 0.7
```

---

## Reference Files

| File | Domain |
|---|---|
| [references/eval-repo-architecture.md](references/eval-repo-architecture.md) | Agent contract, repo structure, import patterns, independence principle |
| [references/deepeval.md](references/deepeval.md) | LLMTestCase, metrics catalogue, ConversationalTestCase, EvaluationDataset, CI command |
| [references/ragas.md](references/ragas.md) | v0.4 API, metrics, TestsetGenerator, LangchainLLMWrapper, NaN guards |
| [references/ci-gates.md](references/ci-gates.md) | Threshold config, schedule patterns, pre-release gates, MLflow comparison |

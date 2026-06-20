# DeepEval Reference

**Version**: ≥ 3.9.9 (Apache 2.0)

## Core test case types

### LLMTestCase — single-turn

```python
from deepeval.test_case import LLMTestCase, ToolCall

test_case = LLMTestCase(
    input="What is the capital of France?",
    actual_output="The capital of France is Paris.",
    expected_output="Paris",                         # optional — for correctness metrics
    retrieval_context=["France is a country..."],    # chunks fed to LLM — required for RAG metrics
    tools_called=[
        ToolCall(name="search", input_parameters={"query": "capital of France"}, output="Paris")
    ],  # required for tool metrics
)
```

### ConversationalTestCase — multi-turn

```python
from deepeval.test_case import ConversationalTestCase, LLMTestCase, Turn

test_case = ConversationalTestCase(
    turns=[
        Turn(role="user", content="Who are you?"),
        Turn(role="assistant", content="I am an AI assistant."),
        Turn(role="user", content="Can you help me with Python?"),
        Turn(role="assistant", content="Yes, I can help with Python programming."),
    ]
)
```

## Metrics

```python
from deepeval.metrics import (
    AnswerRelevancyMetric,
    FaithfulnessMetric,
    HallucinationMetric,
    ContextualPrecisionMetric,
    ContextualRecallMetric,
    ContextualRelevancyMetric,
    ToolCorrectnessMetric,
    TaskCompletionMetric,
    GEval,
)

# Most metrics take model= (judge LLM) and threshold=
faithfulness = FaithfulnessMetric(
    threshold=0.7,
    model="claude-haiku-4-5-20251001",   # judge LLM — use Haiku for cost
    include_reason=True,
)

# GEval — custom criteria in natural language
custom_metric = GEval(
    name="Conciseness",
    criteria="The output should be concise and not include unnecessary filler text.",
    evaluation_params=["actual_output"],
    threshold=0.7,
    model="claude-haiku-4-5-20251001",
)
```

## EvaluationDataset — batch evaluation

```python
from deepeval.dataset import EvaluationDataset, Golden

dataset = EvaluationDataset(
    goldens=[
        Golden(input="Question 1", expected_output="Expected answer 1"),
        Golden(input="Question 2", expected_output="Expected answer 2"),
    ]
)

# Load from file
dataset.add_goldens_from_json_file("datasets/golden_rag.json")

# Evaluate entire dataset
dataset.evaluate(
    metrics=[faithfulness, AnswerRelevancyMetric(threshold=0.7)],
    run_async=True,   # parallel evaluation
)
```

## CI runner — always use deepeval CLI, not plain pytest

```bash
# Run eval tests (with caching, parallelisation, cost tracking)
deepeval test run tests/eval/test_agent.py

# With verbosity
deepeval test run tests/eval/ -v

# Fail if any metric below threshold (for CI gate)
deepeval test run tests/eval/ --fail-on-metric-below 0.7

# Specify judge model
deepeval test run tests/eval/ --model claude-haiku-4-5-20251001
```

Plain `pytest tests/eval/` works but loses DeepEval's:
- Response caching (re-uses LLM calls for unchanged test cases)
- Parallel evaluation across test cases
- Cost tracking per run
- Dashboard integration

## @observe decorator — span-level metrics

```python
from deepeval.tracing import observe, TraceType

@observe(type=TraceType.RETRIEVER, name="vector_search")
async def retrieve_docs(query: str) -> list[str]:
    # This span is captured by DeepEval for component-level metrics
    ...

@observe(type=TraceType.LLM)
async def generate_answer(context: list[str], question: str) -> str:
    ...
```

## assert_test — pytest integration

```python
from deepeval import assert_test

async def test_rag_faithfulness(test_case):
    metric = FaithfulnessMetric(threshold=0.7, model="claude-haiku-4-5-20251001")
    assert_test(test_case, [metric])
    # Raises AssertionError with detailed failure reason if metric score < threshold
```

## Gotchas

- `RagasMetric` wrapper inside DeepEval can emit NaN on invalid judge JSON — prefer native
  DeepEval RAG metrics or standalone RAGAS.
- Judge-LLM token cost is the primary operational expense — use Haiku or GPT-4o-mini as judges
  for 60–80% cost reduction.
- Use `deepeval test run` not `pytest` to get caching — without caching, re-running the suite
  after a single code change re-evaluates ALL test cases.

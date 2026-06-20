# MLflow GenAI Evaluation Reference

## mlflow.genai.evaluate() — core API

```python
import mlflow
from mlflow.genai.scorers import (
    Correctness, RelevanceToQuery, Safety, Guidelines,
    RetrievalGroundedness, RetrievalRelevance, RetrievalSufficiency,
    ToolCallCorrectness, ToolCallEfficiency,
)

eval_data = [
    {
        "inputs": {"messages": [{"role": "user", "content": "What is the capital of France?"}]},
        "expected_outputs": {"answer": "Paris"},
        "retrieved_context": [{"content": "France is a country in Western Europe..."}],
    },
]

results = mlflow.genai.evaluate(
    data=eval_data,
    predict_fn=your_agent,      # callable: input dict → output dict
    scorers=[
        Correctness(),
        RelevanceToQuery(),
        Safety(),
        RetrievalGroundedness(),
        ToolCallCorrectness(),
    ],
)

# Inspect results
print(results.metrics_summary())
print(results.tables["eval_results"])  # pd.DataFrame
```

## Built-in scorer reference

| Scorer | Required input fields | Description |
|---|---|---|
| `Correctness()` | `inputs`, `expected_outputs` | Answer matches ground truth |
| `RelevanceToQuery()` | `inputs` | Answer addresses the question |
| `Safety()` | (none extra) | No harmful/toxic content |
| `Guidelines(guidelines=[...])` | (none extra) | Follows custom rules |
| `RetrievalGroundedness()` | `retrieved_context` | Answer grounded in context |
| `RetrievalRelevance()` | `inputs`, `retrieved_context` | Docs relevant to query |
| `RetrievalSufficiency()` | `inputs`, `retrieved_context`, `expected_outputs` | Docs contain enough info |
| `ToolCallCorrectness()` | `expected_tool_calls` | Called right tools with right args |
| `ToolCallEfficiency()` | (none extra) | No unnecessary tool calls |

## DeepEval metrics via MLflow (3.8+)

```python
from mlflow.genai.scorers import deepeval

results = mlflow.genai.evaluate(
    data=eval_data,
    predict_fn=your_agent,
    scorers=[
        deepeval.answer_relevancy(),
        deepeval.faithfulness(),
        deepeval.hallucination(),
        deepeval.tool_correctness(),
    ],
)
```

Requires `deepeval>=3.9.9` installed in the same environment.

## RAGAS metrics via MLflow (3.8+)

```python
from mlflow.genai.scorers import ragas

results = mlflow.genai.evaluate(
    data=eval_data,
    predict_fn=your_agent,
    scorers=[
        ragas.context_precision(),
        ragas.context_recall(),
        ragas.faithfulness(),
        ragas.answer_relevancy(),
    ],
)
```

Requires `ragas>=0.4.3`. RAGAS scorers need `retrieved_context` in the eval data.

## Custom scorer with @scorer

```python
from mlflow.entities import Feedback
from mlflow.genai.scorers import scorer


@scorer
def response_length_check(inputs, outputs, **kwargs) -> Feedback:
    answer = outputs.get("answer", "")
    passed = 50 <= len(answer) <= 2000
    return Feedback(
        name="response_length",
        value=1.0 if passed else 0.0,
        rationale=f"Length {len(answer)} {'OK' if passed else 'out of range'}",
    )

results = mlflow.genai.evaluate(
    data=eval_data,
    predict_fn=your_agent,
    scorers=[Correctness(), response_length_check],
)
```

## Eval data format

Data can be a list of dicts or a pandas DataFrame:

```python
import pandas as pd

eval_df = pd.DataFrame([
    {
        "inputs": {"messages": [...]},
        "expected_outputs": {"answer": "..."},
        "retrieved_context": [{"content": "..."}],
        "expected_tool_calls": [{"name": "search", "args": {"query": "..."}}],
    }
])

results = mlflow.genai.evaluate(data=eval_df, predict_fn=your_agent, scorers=[...])
```

## Setting pass/fail thresholds

```python
# After evaluation, check thresholds for CI gate
summary = results.metrics_summary()
assert summary["correctness/mean"] >= 0.80, "Correctness below threshold"
assert summary["safety/mean"] == 1.0, "Safety check failed"
```

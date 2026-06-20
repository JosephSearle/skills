# Eval Repo Architecture Reference

## Principle: loose coupling via stable contract

The eval repo imports the agent as a library. The agent exposes one stable entrypoint.
Neither repo knows about the other's internals.

```
agent-repo/
  src/
    myagent/
      contract.py     ← stable entrypoint the eval repo imports
      graph.py
      tools.py
  pyproject.toml

eval-repo/
  tests/
    eval/
      test_faithfulness.py
      test_tool_correctness.py
      test_rag_retrieval.py
  pyproject.toml   ← depends on agent-repo as a package
```

## Agent contract (define in agent-repo)

```python
# src/myagent/contract.py
from dataclasses import dataclass, field
from typing import Any

@dataclass
class ToolCall:
    name: str
    args: dict[str, Any]
    output: str | None = None

@dataclass
class AgentOutput:
    answer: str
    retrieval_context: list[str] = field(default_factory=list)
    tools_called: list[ToolCall] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

async def run_agent(user_input: str, *, config: dict | None = None) -> AgentOutput:
    """
    Stable, deterministic entrypoint for evaluation.

    - Must be callable without knowledge of internal graph structure.
    - Must return retrieval_context (chunks fed to LLM) separately from answer.
    - Must return tools_called with name, args, and output per call.
    """
    from myagent.graph import compiled_graph
    from myagent.output_parser import parse_output

    result = await compiled_graph.ainvoke(
        {"messages": [{"role": "user", "content": user_input}]},
        config=config or {},
    )
    return parse_output(result)
```

## The four contract requirements

| Requirement | Why |
|---|---|
| **Deterministic callable** `run_agent(input) -> AgentOutput` | Eval repo calls it without internal knowledge |
| **`retrieval_context: list[str]`** separate from answer | Required for `FaithfulnessMetric`, `context_precision`, `RetrievalGroundedness` |
| **`tools_called: list[ToolCall]`** per invocation | Required for `ToolCorrectnessMetric`, `TaskCompletionMetric`, `ToolCallCorrectness` |
| **Pydantic/dataclass structured output** | Eval repo can assert on fields, not raw strings |

## Eval repo pyproject.toml

```toml
[project]
name = "myagent-eval"
requires-python = ">=3.11"
dependencies = [
  "myagent @ git+ssh://git@github.com/org/myagent.git@v1.2.0",
]

[dependency-groups]
eval = [
  "deepeval>=3.9.9",
  "ragas>=0.4.3",
  "mlflow>=3.14.0",
  "pytest>=8.4.0",
  "pytest-asyncio>=1.4.0",
]
```

## Eval test file structure

```python
# tests/eval/test_faithfulness.py
import pytest
from deepeval.test_case import LLMTestCase
from deepeval.metrics import FaithfulnessMetric
from deepeval import assert_test

from myagent.contract import run_agent

GOLDEN_DATASET = [
    {
        "input": "What are the main features of LangGraph?",
        "expected_output": "LangGraph is a framework for building...",
    },
]

@pytest.mark.eval
@pytest.mark.parametrize("case", GOLDEN_DATASET)
async def test_faithfulness(case):
    output = await run_agent(case["input"])
    test_case = LLMTestCase(
        input=case["input"],
        actual_output=output.answer,
        retrieval_context=output.retrieval_context,
    )
    metric = FaithfulnessMetric(threshold=0.7, model="claude-haiku-4-5-20251001")
    assert_test(test_case, [metric])
```

## Dataset management

Keep evaluation datasets in the eval repo under `datasets/`:
```
eval-repo/
  datasets/
    golden_rag.json       # human-verified QA pairs
    generated_rag.json    # RAGAS TestsetGenerator output
    regression.json       # cases from production bugs
```

Version datasets with git. Rebuild generated datasets periodically — synthetic datasets
drift from real user behaviour over time.

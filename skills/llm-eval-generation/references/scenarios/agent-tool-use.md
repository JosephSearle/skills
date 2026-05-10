# Agent / Tool-Use Eval Reference

Load this file when the code under test involves tool or function calling: `@tool` decorators,
`bind_tools`, `ToolCall` objects, `AgentExecutor`, tool schemas, or any agent loop that selects
and invokes tools based on LLM output.

---

## Failure Modes

- **Wrong tool selected** — agent invokes the wrong tool for the task
- **Correct tool, wrong parameters** — tool is correct but arguments are malformed or incorrect
- **Wrong tool sequence** — in multi-step tasks, tools called in the wrong order
- **Unnecessary tool calls** — agent calls tools when it already has sufficient information
- **Missing tool calls** — agent skips a required tool and produces an incomplete result
- **Cascading failure** — an error in one tool call invalidates all subsequent steps

---

## Required Metrics

| Metric | Definition | Requires ground truth? | Tool |
|---|---|---|---|
| **Tool Selection Accuracy** | Correct tool invoked per step | Yes | DeepEval, Arize Phoenix, custom |
| **Parameter F1** | Partial credit for correct vs. incorrect parameters | Yes | Custom, DeepEval DAG |
| **Tool Call Sequence Accuracy** | Tools called in the correct order for multi-step tasks | Yes | DeepEval DAG, Arize Phoenix |
| **Task Completion Rate** | Agent ultimately completes the goal | Yes | DeepEval, LangSmith |
| **pass@k** | Probability of task completion in k attempts | Yes | Custom with multi-trial |

> All agent/tool-use eval requires a labelled dataset of tasks with known correct tool sequences.
> Reference-free evaluation is not sufficient — you must define what the correct tool usage looks like.

---

## Evaluation Strategy

### Two-level evaluation

Evaluate at both step level and outcome level. A task that completes successfully via the wrong
path may still fail on step-level metrics — both matter.

```
Step-level:
  - Was the correct tool invoked at each step?
  - Were the parameters correct?
  - Was the sequence correct?

Outcome-level:
  - Did the agent complete the task goal?
  - Was the final output correct?
```

### Multi-trial is mandatory

Agent behaviour is stochastic. A single trial is insufficient for any reliability claim.

- Run each task ≥ 5 trials for pass@k measurement
- τ-benchmark's pass^k metric is the reference standard for reliability
- A task that succeeds 1/5 times is not reliable, even if it succeeds

### DeepEval DAG metric for structured agent evaluation

The DAG (Directed Acyclic Graph) metric models the expected tool-calling flow as a decision
tree and scores the agent's actual trace against it. Use this for multi-step tool chains where
order and branching matter.

---

## DeepEval Example

```python
# evals/eval_agent_tool_use.py
import pytest
from deepeval import assert_test
from deepeval.metrics import TaskCompletionMetric
from deepeval.metrics.dag import DAGMetric, TaskNode, ToolCallNode
from deepeval.test_case import LLMTestCase

# Define expected tool-calling flow as a DAG
search_then_summarise = DAGMetric(
    name="Search then Summarise Flow",
    dag=TaskNode(
        children=[
            ToolCallNode(
                tool="web_search",
                expected_params={"query": str},
                children=[
                    ToolCallNode(
                        tool="summarise",
                        expected_params={"text": str},
                    )
                ],
            )
        ]
    ),
    threshold=0.8,
)

@pytest.mark.parametrize("input_query,expected_final_output", [
    ("Summarise recent news about LLM evaluation", "A summary of recent LLM evaluation news"),
])
def test_agent_tool_sequence(input_query, expected_final_output):
    actual_output, tool_calls = agent.run(input_query)  # returns output + trace
    test_case = LLMTestCase(
        input=input_query,
        actual_output=actual_output,
        tools_called=tool_calls,
    )
    assert_test(test_case, [search_then_summarise, TaskCompletionMetric(threshold=0.8)])
```

---

## Arize Phoenix Agent Evaluators

Arize Phoenix provides four dedicated agent evaluators. Use these alongside DeepEval for
comprehensive agent evaluation.

```python
# Arize Phoenix agent evaluators
from phoenix.evals import (
    FunctionCallingEvaluator,    # Was the correct function called with correct args?
    PathConvergenceEvaluator,    # Did different paths converge on the same correct outcome?
    PlanningEvaluator,           # Was the task decomposition logical?
    ReflectionEvaluator,         # Did the agent self-correct appropriately?
)
```

---

## Eval Dataset Requirements

Minimum 15 cases. Must include:
- Tasks with a single, clear correct tool sequence (happy path)
- Tasks where multiple valid tool sequences exist (test for goal completion, not path)
- Tasks designed to trigger the wrong tool (adversarial)
- Tasks that require the agent to abstain or ask for clarification
- Multi-step tasks requiring 3+ tool calls in sequence
- Edge cases: ambiguous inputs, missing required context, conflicting instructions

Label each case with:
- Expected tool(s) and their order
- Expected parameters (exact or schema)
- Expected final output or acceptance criteria

---

## pass@k Implementation

```python
import statistics

def pass_at_k(task_fn, input_query, k: int = 5) -> float:
    """Run task k times and return the pass rate."""
    results = [task_fn(input_query) for _ in range(k)]
    successes = sum(1 for r in results if evaluate_success(r))
    return successes / k

# Report pass@1, pass@3, pass@5
for k in [1, 3, 5]:
    rate = pass_at_k(agent.run, "Book a flight from LHR to JFK for next Monday", k=k)
    print(f"pass@{k}: {rate:.2f}")
```

CI gate: require pass@3 ≥ 0.8 before merging changes to agent logic.

---

## Recommended Stack

| Layer | Tool | Reason |
|---|---|---|
| CI gating | DeepEval (DAG metric) | Structured decision-tree scoring for multi-step tool chains |
| Agent evaluators | Arize Phoenix | 4 dedicated evaluators: function calling, path convergence, planning, reflection |
| Trace inspection | LangSmith or Langfuse | Tool call visibility; step-level trace debugging |
| Adversarial | Promptfoo | Tool injection and prompt injection testing |
| Reliability | Custom pass@k (≥5 trials) | τ-benchmark standard for stochastic agent reliability |

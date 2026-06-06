# Evaluation Reference — LangSmith Datasets, Experiments & Evaluators

## Offline vs Online Evaluation Decision Table

| Dimension | Offline (`evaluate` / `aevaluate` / pytest) | Online (UI rule automations) |
|---|---|---|
| When to use | Pre-deploy: CI, PR gates, backtesting | Live production traffic monitoring |
| Input source | Dataset examples (curated, with optional reference outputs) | Incoming runs/threads (no reference) |
| Reference outputs available | Yes | No — reference-free judges only |
| Setup path | Python SDK (`evaluate`, `aevaluate`) | LangSmith UI / API — **no SDK method to create rules** |
| Filter and sampling | `data=` param + `num_repetitions` | UI rule: filter expression + sampling rate |
| Cost driver | Judge tokens × dataset size (bounded) | Judge tokens × sampled live volume (unbounded) + extended-retention upgrade per matched trace |
| Use cases | Benchmarking, regression, unit evals, backtesting | Drift/anomaly detection, real-time quality monitoring |
| Plus/Enterprise required | No (basic evaluate on any tier) | Multi-turn Evals: Plus/Enterprise only |

---

## Packages

openevals and agentevals are **separate packages**, not part of `langsmith`:

```bash
uv add langsmith
uv add openevals           # LLM-as-judge evaluators
uv add agentevals          # trajectory evaluators for agents
```

---

## Datasets

### Create from Scratch

```python
from langsmith import Client

client = Client()

ds = client.create_dataset(
    "checkout-agent-suite",
    description="Checkout agent correctness benchmark",
)
client.create_examples(
    dataset_id=ds.id,
    inputs=[
        {"question": "What is the return policy?"},
        {"question": "How long does shipping take?"},
    ],
    outputs=[
        {"answer": "30 days no-questions-asked."},
        {"answer": "3–5 business days for standard shipping."},
    ],
)
```

### Create from Production Traces

```python
from langsmith import Client

client = Client()

# Pull runs with poor feedback from production
runs = client.list_runs(
    project_name="checkout-agent-prod",
    filter='and(eq(feedback_key, "user_score"), eq(feedback_score, 0))',
    is_root=True,
    error=False,
)

# Create or get existing dataset
try:
    ds = client.read_dataset(dataset_name="from-production-failures")
except Exception:
    ds = client.create_dataset("from-production-failures")

for run in runs:
    client.create_example(
        inputs=run.inputs,
        outputs=run.outputs,
        dataset_id=ds.id,
    )
```

### Dataset Schema and Splits

Each example: `inputs` (dict), `outputs` (dict, optional reference), `metadata` (dict).
Datasets carry `inputs_schema` / `outputs_schema`. Datasets are append-only with automatic
versioning on every edit/deletion; use `as_of` tags/timestamps to pin a version.

```python
# List and update splits
splits = client.list_dataset_splits(dataset_id=ds.id)
client.update_dataset_splits(
    dataset_id=ds.id,
    split_name="test",
    examples=[example_id_1, example_id_2],
)

# Upload from CSV or DataFrame
client.upload_csv(
    csv_file="eval_data.csv",
    input_keys=["question"],
    output_keys=["answer"],
    name="uploaded-suite",
)
```

---

## evaluate() and aevaluate()

### Full Signature

```python
from langsmith import evaluate, aevaluate

results = evaluate(
    target,                          # Callable[[dict], dict] | Runnable | experiment_id | (exp1, exp2)
    data="checkout-agent-suite",     # dataset name | id | iterable of examples
    evaluators=[...],                # list[Callable | Evaluator]
    summary_evaluators=[...],        # list[Callable] for dataset-level metrics
    metadata={"model": "gpt-4o", "prompt_version": "v2.1"},
    experiment_prefix="baseline",    # str prefix for the experiment name
    description="Baseline eval run",
    max_concurrency=8,               # int; see GOTCHA below
    num_repetitions=1,               # int; run each example N times
    blocking=True,                   # bool; wait for all results before returning
)
```

> **⚠️ GOTCHA — max_concurrency default is 0:** In `langsmith>=0.2`, `aevaluate()` (and
> `evaluate()`) default `max_concurrency=0`, which means **no concurrency** — examples are
> evaluated sequentially. For any non-trivial dataset this will be extremely slow. Always set
> `max_concurrency` explicitly for production use. A value of 4–16 is a reasonable starting
> point; tune based on your target callable and judge model rate limits.

```python
# WRONG — silently runs sequentially on large datasets
results = await aevaluate(target, data="agent-suite", evaluators=[judge])

# CORRECT — always set max_concurrency explicitly
results = await aevaluate(
    target,
    data="agent-suite",
    evaluators=[judge],
    max_concurrency=10,
)
```

### aevaluate() Additional Parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `error_handling` | `Literal["log", "ignore"]` | `"log"` | How to handle exceptions from the target callable |
| `max_concurrency` | `int` | **0 (no concurrency)** | Concurrent target invocations — set this explicitly |

### Target Callable Shapes

```python
# Minimal: inputs only
def target(inputs: dict) -> dict:
    return {"answer": run_model(inputs["question"])}


# With reference outputs (for evaluators that need them)
def target_with_ref(inputs: dict, reference_outputs: dict) -> dict:
    return {"answer": run_model(inputs["question"])}


# Async target for LangGraph
async def async_target(inputs: dict) -> dict:
    return await graph.ainvoke(inputs)


# Runnable (LangChain) — passes invoke result as outputs
chain = prompt | model | parser
results = evaluate(chain, data="checkout-agent-suite", evaluators=[judge])
```

### Iterating Results

```python
from langsmith import evaluate
from langsmith import Client

client = Client()

results = evaluate(
    target,
    data="checkout-agent-suite",
    evaluators=[correctness_judge],
    max_concurrency=8,
)

for row in results:
    run = row["run"]
    example = row["example"]
    eval_results = row["evaluation_results"]
    print(f"Run {run.id}: {eval_results}")

# Query feedback programmatically after the fact
feedback_items = client.list_feedback(
    run_ids=[r["run"].id for r in results],
    feedback_key="correctness",
)
scores = [f.score for f in feedback_items if f.score is not None]
print(f"Mean correctness: {sum(scores)/len(scores):.3f}")
```

### Comparing Experiments (Pairwise)

```python
from langsmith import evaluate_comparative

comparison = evaluate_comparative(
    (baseline_experiment_id, candidate_experiment_id),
    evaluators=[pairwise_preference_judge],
    randomize_order=True,
    max_concurrency=5,
)
```

---

## Evaluators

### Evaluator Selection Table

| Use case | Package | Function / class |
|---|---|---|
| Exact string match | `langsmith` | `LangChainStringEvaluator("exact_match")` |
| Embedding cosine distance | `langsmith` | `LangChainStringEvaluator("embedding_distance")` |
| Levenshtein / Jaro distance | `langsmith` (+ `rapidfuzz`) | `LangChainStringEvaluator("string_distance")` |
| Regex match | `langsmith` | `LangChainStringEvaluator("regex_match")` |
| LLM rubric (criteria-based) | `langsmith` | `LangChainStringEvaluator("criteria")` |
| Natural-language quality (correctness, hallucination, conciseness) | `openevals` | `create_llm_as_judge` |
| Structured / Pydantic output | `openevals` | `create_json_match_evaluator` |
| Agent tool-call sequence (deterministic) | `agentevals` | `create_trajectory_match_evaluator` |
| Agent tool-call sequence (LLM-judged) | `agentevals` | `create_trajectory_llm_as_judge` |
| Bespoke business logic / multi-metric | — | Custom `(inputs, outputs, reference_outputs) -> bool \| float \| dict` |
| Dataset-level metrics (precision, recall) | — | Summary evaluator `(runs, examples) -> EvaluationResult` |

### Built-in String Evaluators

```python
import re
from langsmith.evaluation import LangChainStringEvaluator

# 0 = identical, 1 = maximally different (cosine distance)
embedding_eval = LangChainStringEvaluator("embedding_distance")

string_eval = LangChainStringEvaluator("string_distance")  # requires: uv add rapidfuzz

exact_eval = LangChainStringEvaluator("exact_match")

regex_eval = LangChainStringEvaluator(
    "regex_match",
    config={"flags": re.IGNORECASE},
)

# Multi-key dataset: map run/example keys → prediction/reference/input
criteria_eval = LangChainStringEvaluator(
    "criteria",
    config={"criteria": "helpfulness"},
    prepare_data=lambda run, example: {
        "prediction": run.outputs.get("answer"),
        "reference": example.outputs.get("answer"),
        "input": example.inputs.get("question"),
    },
)
```

### openevals: create_llm_as_judge

`openevals` is a **separate package** (`uv add openevals`), not part of `langsmith`.

```python
from openevals.llm import create_llm_as_judge, create_async_llm_as_judge
from openevals.prompts import (
    CORRECTNESS_PROMPT,
    CONCISENESS_PROMPT,
    HALLUCINATION_PROMPT,
)

correctness_judge = create_llm_as_judge(
    prompt=CORRECTNESS_PROMPT,       # f-string template with {inputs}, {outputs}, {reference_outputs}
    feedback_key="correctness",      # names the feedback metric in LangSmith
    model="openai:o3-mini",          # provider:model via init_chat_model
)

# Returns: {"key": "correctness", "score": True | 0.0–1.0, "comment": "<reasoning>"}
result = correctness_judge(
    inputs={"question": "What is the return policy?"},
    outputs={"answer": "30 days."},
    reference_outputs={"answer": "30 days no-questions-asked."},
)
assert result["score"]

# Async variant
async_judge = create_async_llm_as_judge(
    prompt=CORRECTNESS_PROMPT,
    feedback_key="correctness",
    model="openai:gpt-4o-mini",
)
result = await async_judge(inputs=..., outputs=..., reference_outputs=...)
```

### create_llm_as_judge() Signature

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `prompt` | `str \| ChatPromptTemplate` | required | Judge prompt template |
| `feedback_key` | `str` | required | Metric name stored in LangSmith |
| `model` | `str` | required | `"provider:model"` string (e.g. `"openai:gpt-4o-mini"`) |
| `few_shot_examples` | `list[dict] \| None` | `None` | Few-shot examples inserted into the prompt |
| `judge` | `OpenAI \| AsyncOpenAI \| None` | `None` | Use a raw OpenAI client instead of `init_chat_model` |
| `continuous` | `bool` | `False` | If `True`, returns a float score; if `False`, returns a boolean |

Prebuilt prompts: `CORRECTNESS_PROMPT`, `CONCISENESS_PROMPT`, `HALLUCINATION_PROMPT`.
Pass a `StructuredPrompt` pulled from LangSmith Hub and its output schema becomes the judge schema.

### Custom Evaluators

```python
from langsmith.schemas import Run, Example
from langsmith.evaluation import EvaluationResult


# Simplified form — return bool, float, or dict
def exact_match(inputs: dict, outputs: dict, reference_outputs: dict) -> bool:
    return outputs["answer"].strip() == reference_outputs["answer"].strip()


# Full dict form — use when you need key, score, comment
def length_penalty(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    score = 1.0 if len(outputs["answer"]) <= 500 else 0.0
    return {
        "key": "length_ok",
        "score": score,
        "comment": f"Answer length: {len(outputs['answer'])} chars",
    }


# Run/Example form — use when you need trace internals or run metadata
def check_tool_usage(run: Run, example: Example) -> dict:
    child_names = [c.name for c in (run.child_runs or [])]
    used_search = "web_search" in child_names
    return {
        "key": "used_web_search",
        "score": int(used_search),
        "comment": f"Tool calls: {child_names}",
        "source_run_id": run.id,
    }
```

### EvaluationResult Fields

| Field | Type | Purpose |
|---|---|---|
| `key` | `str` | Metric name (required) |
| `score` | `float \| int \| bool \| None` | Numeric or boolean score |
| `value` | `str \| dict \| None` | Non-numeric label |
| `comment` | `str \| None` | Free-text explanation / judge reasoning |
| `correction` | `dict \| None` | Suggested correction to the output |
| `source_run_id` | `UUID \| None` | ID of the run that generated this evaluation |

### Summary Evaluators (Dataset-Level)

```python
from langsmith.schemas import Run, Example
from langsmith.evaluation import EvaluationResult
from statistics import mean


def precision_at_threshold(
    runs: list[Run], examples: list[Example]
) -> EvaluationResult:
    """Dataset-level precision: fraction of runs with score >= 0.8."""
    scores = []
    for run in runs:
        fb = run.feedback_stats or {}
        if "correctness" in fb:
            scores.append(fb["correctness"].get("avg", 0.0))
    precision = mean(1.0 if s >= 0.8 else 0.0 for s in scores) if scores else 0.0
    return EvaluationResult(
        key="precision_at_0.8",
        score=precision,
        comment=f"{len(scores)} runs evaluated",
    )
```

---

## agentevals: Trajectory Evaluators

`agentevals` is a **separate package** (`uv add agentevals`), not part of `langsmith`.

```python
from agentevals.trajectory.match import create_trajectory_match_evaluator
from agentevals.trajectory.llm import (
    create_trajectory_llm_as_judge,
    create_async_trajectory_llm_as_judge,
    TRAJECTORY_ACCURACY_PROMPT_WITH_REFERENCE,
)
from langsmith import Client

client = Client()

# Deterministic: match actual tool-call sequence against a reference trajectory
strict_match = create_trajectory_match_evaluator(
    trajectory_match_mode="strict",   # "strict" | "unordered" | "subset" | "superset"
)

# LLM-judged (reference optional)
traj_judge = create_trajectory_llm_as_judge(
    prompt=TRAJECTORY_ACCURACY_PROMPT_WITH_REFERENCE,
    model="openai:o3-mini",
)

# Dataset schema: inputs={"messages":[...]}, outputs={"messages":[...]}
# messages include tool_call dicts (OpenAI format) or LangChain BaseMessages
results = evaluate(
    lambda inputs: agent.invoke(inputs),
    data="agent-trajectory-suite",
    evaluators=[strict_match, traj_judge],
    max_concurrency=5,
)
```

### Trajectory Match Modes

| Mode | Behaviour |
|---|---|
| `"strict"` | Actual trajectory must exactly equal reference (same tools, same order) |
| `"unordered"` | Same tools called, order ignored |
| `"subset"` | All reference tool calls appear in actual (actual may have extras) |
| `"superset"` | All actual tool calls appear in reference (reference may have extras) |

For LangGraph agents: use graph-trajectory variants that check node sequence rather than
raw message tool calls.

---

## Multi-turn Evaluators

Plus/Enterprise plan only (GA Oct 24 2025). Thread-level evaluators that score completed
conversations using an LLM-as-judge prompt you define. They run automatically when a thread
completes. Evaluate: semantic intent, task completion (and why not), and agent trajectory.
Configured via the LangSmith UI — no SDK method for creation.

---

## Online Evaluation (Production)

Configured as Rule Automations at the project level in the LangSmith UI. **There is no SDK
method to create automation rules as of 2026.**

- A rule specifies a **filter** (which runs to target) and a **sampling rate** (0.0–1.0).
- Online evaluators are reference-free (relevance, faithfulness, safety, format validation).
- Feedback is written back to the trace asynchronously.
- Matched traces are auto-upgraded to **extended retention (400 days)**.

> **⚠️ Cost:** online LLM-as-judge bills judge-model tokens for every sampled trace AND
> upgrades the entire matching trace to extended retention. At high throughput this is the
> dominant cost. Mitigate: low sampling rate (0.01–0.05), narrow filter, cheap judge model.

---

## pytest Plugin

Bundled with `langsmith>=0.3.4`; enabled by default when `LANGSMITH_API_KEY` is set.

```python
# tests/test_checkout_agent.py
import pytest
from langsmith import testing as t
from openevals.llm import create_llm_as_judge
from openevals.prompts import CORRECTNESS_PROMPT


correctness = create_llm_as_judge(
    prompt=CORRECTNESS_PROMPT,
    feedback_key="correctness",
    model="openai:gpt-4o-mini",
)


@pytest.mark.langsmith
def test_return_policy_question() -> None:
    inputs = "What is the return policy?"
    outputs = my_app(inputs)
    reference = "30 days no-questions-asked."

    t.log_inputs({"question": inputs})
    t.log_outputs({"answer": outputs})
    t.log_reference_outputs({"answer": reference})

    result = correctness(
        inputs=inputs,
        outputs=outputs,
        reference_outputs=reference,
    )
    t.log_feedback(key="correctness", score=result["score"], comment=result.get("comment"))
    assert result["score"], f"Correctness judge failed: {result.get('comment')}"


@pytest.mark.langsmith
@pytest.mark.parametrize(
    "question,expected",
    [
        ("Shipping time?", "3–5 business days"),
        ("Return window?", "30 days"),
    ],
)
def test_parametrized(question: str, expected: str) -> None:
    answer = my_app(question)
    t.log_inputs({"question": question})
    t.log_outputs({"answer": answer})
    t.log_reference_outputs({"answer": expected})
    assert expected.lower() in answer.lower()
```

### pytest Plugin API

| Function / decorator | Purpose |
|---|---|
| `@pytest.mark.langsmith` | Marks test for LangSmith upload; each run = one experiment result |
| `t.log_inputs(dict)` | Record test inputs (synced as example `inputs`) |
| `t.log_outputs(dict)` | Record test outputs |
| `t.log_reference_outputs(dict)` | Record reference outputs |
| `t.log_feedback(key, score, comment=None)` | Add extra metric feedback |
| `t.trace_feedback()` | Trace the judge computation as a child span |
| `langsmith.expect(x).to_contain(...)` | Rich assertion helpers |
| `expect.embedding_distance(...).to_be_less_than(...)` | Semantic distance assertion |
| `LANGSMITH_TEST_TRACKING=false` | Disable upload (local-only run) |
| `LANGSMITH_TEST_CACHE` (+ `langsmith[vcr]`) | Cache LLM API calls for fast / cheap CI reruns |

Session-scoped metadata: add a `langsmith_experiment_metadata` fixture returning a dict, or set `LANGSMITH_EXPERIMENT_METADATA` as a JSON env var.

---

## GitHub Actions Integration

```yaml
name: eval
on: [pull_request]

jobs:
  langsmith-eval:
    runs-on: ubuntu-latest
    env:
      LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_API_KEY }}
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      LANGSMITH_TEST_SUITE: "checkout-agent CI"
      LANGSMITH_EXPERIMENT: "pr-${{ github.event.number }}"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - uses: astral-sh/setup-uv@v4
        with:
          version: "latest"
      - name: Install dependencies
        run: uv sync --frozen
      - name: Run evals
        run: uv run pytest tests/evals/ --langsmith-output -v
```

### Aggregate Score Gate (CI Script)

```python
# scripts/eval_gate.py
from statistics import mean
from langsmith import Client, evaluate
from openevals.llm import create_llm_as_judge
from openevals.prompts import CORRECTNESS_PROMPT

THRESHOLD = 0.85

client = Client()

correctness = create_llm_as_judge(
    prompt=CORRECTNESS_PROMPT,
    feedback_key="correctness",
    model="openai:gpt-4o-mini",
)


def target(inputs: dict) -> dict:
    return {"answer": my_app(inputs["question"])}


results = evaluate(
    target,
    data="checkout-agent-suite",
    evaluators=[correctness],
    experiment_prefix="candidate",
    max_concurrency=8,
    metadata={"pr": "pr-123", "model": "gpt-4o"},
)

feedback_items = list(
    client.list_feedback(
        run_ids=[row["run"].id for row in results],
        feedback_key="correctness",
    )
)
scores = [f.score for f in feedback_items if f.score is not None]
mean_score = mean(scores)

print(f"Mean correctness: {mean_score:.3f} (threshold: {THRESHOLD})")
if mean_score < THRESHOLD:
    raise SystemExit(
        f"Quality gate failed: {mean_score:.3f} < {THRESHOLD}"
    )
```

---

## Backtesting and Regression

### Backtesting Pattern

Run a new model or prompt against recent production traces.

```python
from langsmith import Client, evaluate
from datetime import datetime, timedelta

client = Client()

# Pull recent root runs from production
prod_runs = client.list_runs(
    project_name="checkout-agent-prod",
    start_time=datetime.now() - timedelta(days=7),
    is_root=True,
    limit=200,
)

# Populate a dataset from those runs
try:
    ds = client.read_dataset(dataset_name="backtest-recent-prod")
except Exception:
    ds = client.create_dataset("backtest-recent-prod")

for run in prod_runs:
    client.create_example(
        inputs=run.inputs,
        outputs=run.outputs,
        dataset_id=ds.id,
    )

# Evaluate the candidate against that dataset
results = evaluate(
    new_model_target,
    data="backtest-recent-prod",
    evaluators=[correctness_judge],
    experiment_prefix="new-model-backtest",
    max_concurrency=8,
)
```

### Regression Gate (Baseline vs Candidate)

```python
from langsmith import Client
from statistics import mean

client = Client()
REGRESSION_THRESHOLD = 0.03  # block if candidate drops more than 3 percentage points


def get_mean_score(experiment_name: str, feedback_key: str) -> float:
    runs = list(client.list_runs(project_name=experiment_name, is_root=True))
    feedback = list(
        client.list_feedback(
            run_ids=[r.id for r in runs],
            feedback_key=feedback_key,
        )
    )
    scores = [f.score for f in feedback if f.score is not None]
    return mean(scores) if scores else 0.0


baseline = get_mean_score("baseline-experiment", "correctness")
candidate = get_mean_score("candidate-experiment", "correctness")

if candidate < baseline - REGRESSION_THRESHOLD:
    raise SystemExit(
        f"Regression detected: baseline={baseline:.3f}, candidate={candidate:.3f} "
        f"(delta={candidate - baseline:.3f}, threshold=-{REGRESSION_THRESHOLD})"
    )
```

---

## Production Gotchas

| Gotcha | Symptom | Fix |
|---|---|---|
| `aevaluate` / `evaluate` `max_concurrency=0` | Dataset of 100 examples takes hours | Always set `max_concurrency` explicitly (8–16 is a good starting point) |
| openevals not installed | `ModuleNotFoundError: No module named 'openevals'` | `uv add openevals` — it is a separate package |
| agentevals not installed | `ModuleNotFoundError: No module named 'agentevals'` | `uv add agentevals` — it is a separate package |
| Online eval rule created via SDK | Feature does not exist | Use LangSmith UI or direct API call — no SDK method |
| Multi-turn Evals not available | Feature absent from UI | Requires Plus or Enterprise plan (GA Oct 24 2025) |
| Online eval triggers extended retention | Unexpected $5.00/1k billing | Expected behaviour — any automation rule match upgrades the whole trace |
| `LANGSMITH_TEST_CACHE` not installed | VCR caching silently disabled | `uv add "langsmith[vcr]"` |
| Evaluate results empty after run | `results` iterates lazily | Iterate fully or wrap in `list(results)` before querying |

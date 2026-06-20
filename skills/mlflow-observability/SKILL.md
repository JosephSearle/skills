---
name: mlflow-observability
description: >
  Instrument, track, and evaluate agentcraft LangChain/LangGraph applications with MLflow 3.x.
  Covers tracing, Prompt Registry, experiment tracking, and GenAI evaluation. Fully replaces
  LangSmith for all observability concerns. Triggers on: mlflow, mlflow.langchain, autolog,
  mlflow.langchain.autolog, mlflow.genai, mlflow.genai.evaluate, tracing, experiment tracking,
  prompt registry, prompts:/, register_prompt, load_prompt, set_prompt_alias, mlflow.start_run,
  log_params, log_metrics, log_artifact, Correctness, RelevanceToQuery, Safety, Guidelines,
  RetrievalGroundedness, ToolCallCorrectness, ToolCallEfficiency, @scorer, mlflow server,
  MLFLOW_TRACKING_URI, "instrument agent", "trace LangGraph", "prompt versioning",
  "track experiments", "MLflow setup".
---

## Core Philosophy

MLflow 3.x is the **single observability platform** for agentcraft — it replaces LangSmith for
tracing, prompt management, and evaluation. One call enables full instrumentation:

```python
import mlflow
mlflow.langchain.autolog()   # covers both LangChain chains AND LangGraph graphs
```

Three integrated subsystems — instrument once, use all three:

| Subsystem | MLflow API | Replaces |
|---|---|---|
| Tracing | `mlflow.langchain.autolog()` | LangSmith run tracing |
| Prompt Registry | `mlflow.genai.register_prompt()` | LangSmith prompt hub |
| Experiment tracking | `mlflow.start_run()` + `log_*` | LangSmith datasets/results |
| GenAI evaluation | `mlflow.genai.evaluate()` | LangSmith evaluation runs |

Do **not** co-install `mlflow` and `mlflow-tracing` — they conflict.

---

## Step 1 — Determine Context

| Intent | Signals | Action |
|---|---|---|
| **INSTRUMENT** | "add tracing", "trace my agent", "autolog", "instrument" | Load `references/tracing.md`; emit autolog setup |
| **PROMPTS** | "version my prompts", "prompt registry", "prompts:/", "staging prompt" | Load `references/prompt-registry.md`; emit register/load patterns |
| **TRACK** | "log metrics", "experiment", "compare runs", "track eval results" | Load `references/experiment-tracking.md`; emit run patterns |
| **EVALUATE** | "mlflow evaluate", "genai scorers", "built-in scorers", "custom scorer" | Load `references/genai-eval.md`; emit evaluation code |
| **SETUP** | "set up MLflow", "self-hosted MLflow", "Postgres backend", "mlflow server" | Load all references; emit full server setup |

---

## Step 2 — Load References

| Reference file | Load when |
|---|---|
| `references/tracing.md` | Any tracing, autolog, tracking URI, span-level instrumentation |
| `references/prompt-registry.md` | Any prompt versioning, register, load, alias, brace-format |
| `references/experiment-tracking.md` | Any run logging, params, metrics, artifacts, comparison |
| `references/genai-eval.md` | Any mlflow.genai.evaluate(), built-in/custom scorers, DeepEval/RAGAS via MLflow |

---

## Step 3 — Apply Patterns

### Minimal setup (add to agent entrypoint)

```python
import mlflow

mlflow.set_tracking_uri("http://localhost:5000")   # or "databricks" for managed
mlflow.set_experiment("my-agent-experiment")
mlflow.langchain.autolog()
```

Place this in your agent's `__init__.py` or startup module — before any LangChain/LangGraph
objects are constructed.

### Prompt Registry workflow

```python
# Register a new prompt version (immutable)
mlflow.genai.register_prompt(
    name="agent-system-prompt",
    template="You are a helpful assistant. Context: {{context}}",
    commit_message="Initial production version",
)

# Tag for environment routing
mlflow.genai.set_prompt_alias("agent-system-prompt", alias="production", version=1)
mlflow.genai.set_prompt_alias("agent-system-prompt", alias="staging", version=2)

# Load in agent code (always load by alias for production safety)
prompt = mlflow.genai.load_prompt("prompts:/agent-system-prompt@production")
lc_prompt = prompt.to_single_brace_format()   # {{context}} → {context} for LangChain
```

### GenAI evaluation (built-in scorers)

```python
from mlflow.genai.scorers import (
    Correctness, RelevanceToQuery, Safety, Guidelines,
    RetrievalGroundedness, RetrievalRelevance, RetrievalSufficiency,
    ToolCallCorrectness, ToolCallEfficiency,
)

results = mlflow.genai.evaluate(
    data=eval_dataset,          # list[dict] or pd.DataFrame
    predict_fn=your_agent,      # callable: input dict → output dict
    scorers=[
        Correctness(),
        RelevanceToQuery(),
        Safety(),
        RetrievalGroundedness(),
        ToolCallCorrectness(),
    ],
)
print(results.metrics_summary())
```

### Which scorer for which concern?

| Scorer | Tests |
|---|---|
| `Correctness` | Answer matches ground truth |
| `RelevanceToQuery` | Answer addresses the user's question |
| `Safety` | No harmful or toxic content |
| `Guidelines` | Custom rules (inject via `guidelines=` param) |
| `RetrievalGroundedness` | Answer grounded in retrieved context |
| `RetrievalRelevance` | Retrieved docs are relevant to the query |
| `RetrievalSufficiency` | Retrieved docs contain enough info to answer |
| `ToolCallCorrectness` | Agent called the right tools with right args |
| `ToolCallEfficiency` | Agent didn't make unnecessary tool calls |

For DeepEval and RAGAS metrics via MLflow scorers, see `references/genai-eval.md` and the
`llm-evaluation` skill.

---

## Step 4 — Output & Verification

```bash
# Start local MLflow server (SQLite + local filesystem — dev only)
mlflow server --host 0.0.0.0 --port 5000

# Production: Postgres + S3
mlflow server \
  --backend-store-uri postgresql://user:pass@localhost/mlflow \
  --artifact-root s3://my-mlflow-artifacts \
  --host 0.0.0.0 --port 5000

# Verify tracing works
uv run python -c "
import mlflow
mlflow.set_tracking_uri('http://localhost:5000')
mlflow.langchain.autolog()
from langchain.chat_models import init_chat_model
model = init_chat_model('anthropic:claude-haiku-4-5-20251001')
model.invoke('test')
print('Check http://localhost:5000 for trace')
"

# List registered prompts
uv run python -c "
import mlflow
client = mlflow.MlflowClient()
for p in client.search_prompts():
    print(p.name, p.latest_versions)
"
```

---

## Reference Files

| File | Domain |
|---|---|
| [references/tracing.md](references/tracing.md) | autolog, tracking URI, span-level @observe, sampling |
| [references/prompt-registry.md](references/prompt-registry.md) | register, load, alias, to_single_brace_format |
| [references/experiment-tracking.md](references/experiment-tracking.md) | start_run, log_params/metrics/artifacts, run comparison |
| [references/genai-eval.md](references/genai-eval.md) | mlflow.genai.evaluate(), scorer catalogue, DeepEval/RAGAS integration, custom @scorer |

# Observability Platform Reference

The CI/CD gating layer (DeepEval, RAGAS, Promptfoo) and the observability layer serve different
purposes. Most mature LLM teams run both.

| Layer | Purpose | Tools |
|---|---|---|
| CI/CD gating | Catch regressions before deploy; enforce metric thresholds | DeepEval, RAGAS, Promptfoo |
| Observability | Trace production behaviour; human annotation; dataset management | Langfuse, LangSmith, Braintrust, Arize Phoenix, W&B Weave |

This reference covers when and how to add an observability platform alongside the gating layer.

---

## Platform Selection Decision Matrix

| Need | Recommended platform |
|---|---|
| Self-hosted, open-source, no vendor lock-in | **Langfuse** |
| LangChain or LangGraph is the primary framework | **LangSmith** |
| CI/CD merge-blocking on score regression + failure → test case conversion | **Braintrust** |
| OTel-native, vendor-neutral agent tracing | **Arize Phoenix** |
| Already on W&B for ML experiment tracking | **W&B Weave** |
| Zero budget, full features, self-hosted | **DeepEval + Arize Phoenix** |
| Expert consensus pairing (2026) | **DeepEval or RAGAS** (gating) **+ Braintrust or Langfuse** (observability) |

---

## Langfuse

**Best for:** Infrastructure-savvy teams with data residency requirements; self-hosted deployments;
framework-agnostic stacks; teams wanting open-source without vendor lock-in.

Model: Open-source (MIT, fully open after June 2025; acquired by ClickHouse January 2026)
Free tier: 50K traces/month (hobby); no per-seat pricing on Pro
Install: `pip install langfuse`

```python
from langfuse import Langfuse
from langfuse.decorators import observe, langfuse_context

langfuse = Langfuse()

@observe()  # Auto-traces every call to this function
def rag_pipeline(query: str) -> str:
    # Langfuse captures inputs, outputs, and latency automatically
    retrieved = retriever.retrieve(query)
    langfuse_context.update_current_observation(
        metadata={"retrieved_chunks": len(retrieved)}
    )
    return generator.generate(query, retrieved)

# Score a trace (e.g. from a user feedback signal)
langfuse.score(
    trace_id=trace_id,
    name="user-satisfaction",
    value=1,  # 1 = positive, 0 = negative
    comment="User clicked thumbs up",
)

# Run LLM-as-judge evaluation on a trace
langfuse.score(
    trace_id=trace_id,
    name="faithfulness",
    value=0.87,
    data_type="NUMERIC",
)
```

Langfuse also supports annotation queues, prompt management, A/B testing, and dataset management
for building and versioning eval datasets from production traces.

---

## LangSmith

**Best for:** Teams built entirely on LangChain or LangGraph — zero-config instrumentation makes
it the lowest-friction choice for those stacks. Non-LangChain teams should evaluate alternatives.

Model: Closed-source SaaS; Enterprise self-host available
Free tier: 5K traces/month, 1 user
Pricing: $39/seat/month (Plus)
Install: `pip install langsmith`

```python
# Zero-config for LangChain: set env vars only
import os
os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_API_KEY"] = "your-api-key"
os.environ["LANGCHAIN_PROJECT"] = "your-project-name"

# All LangChain/LangGraph calls are now automatically traced
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

chain = ChatPromptTemplate.from_template("Answer: {question}") | ChatOpenAI()
result = chain.invoke({"question": "What is RAG?"})
# Automatically logged to LangSmith
```

LangSmith multi-turn evaluation scores complete conversation sessions:

```python
from langsmith.evaluation import evaluate as ls_evaluate
from langsmith import Client

client = Client()

def conversation_evaluator(run, example):
    """Score the full conversation trajectory."""
    return {
        "score": evaluate_trajectory(run.outputs["messages"]),
        "comment": "Evaluated full session coherence and goal completion",
    }

ls_evaluate(
    target=agent_fn,
    data="my-conversation-dataset",
    evaluators=[conversation_evaluator],
    experiment_prefix="session-eval",
)
```

---

## Braintrust

**Best for:** Teams where eval results must gate what ships to production; production failure →
regression test conversion; framework-agnostic stacks.

Model: Closed-source SaaS; unlimited users on all plans
Free tier: 1GB data, 14-day retention
Install: `pip install braintrust` / `npm install braintrust`

```python
import braintrust
from braintrust import Eval

# Define eval experiment
async def run_eval():
    experiment = await Eval(
        name="rag-pipeline-eval",
        data=load_golden_dataset,          # Function returning [{input, expected}]
        task=rag_pipeline.query,           # Function to evaluate
        scores=[
            LLMClassifier(
                name="Faithfulness",
                prompt_template="Is the answer supported by the context? Answer YES or NO.\nContext: {{context}}\nAnswer: {{output}}",
                choice_scores={"YES": 1, "NO": 0},
            ),
        ],
    )
    return experiment
```

Native GitHub Action for merge-blocking on score regression:

```yaml
# .github/workflows/eval.yml
- name: Run Braintrust Eval
  uses: braintrustdata/eval-action@v1
  with:
    api_key: ${{ secrets.BRAINTRUST_API_KEY }}
    project: your-project-name
    eval_file: evals/eval_pipeline.py
    # Blocks merge if score drops below baseline
    fail_on_regression: true
    regression_threshold: 0.05  # Block if score drops > 5%
```

One-click conversion from production trace to regression test:
In the Braintrust UI → select a failing production trace → "Add to dataset" → automatically
creates a labelled eval case from the failure.

---

## Arize Phoenix

**Best for:** OTel-native, vendor-neutral instrumentation; self-hosted setups; structured agent
evaluation with dedicated evaluators; teams requiring no proprietary tracing layer.

Model: Open-source (Elastic License 2.0); managed cloud via Arize AX
Free tier: Fully free self-hosted
Install: `pip install arize-phoenix openinference-instrumentation-openai`

```python
import phoenix as px
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

# Launch Phoenix (self-hosted)
px.launch_app()

# Set up OTel tracing — works with any LLM SDK
provider = TracerProvider()
provider.add_span_processor(
    SimpleSpanProcessor(OTLPSpanExporter(endpoint="http://localhost:6006/v1/traces"))
)
trace.set_tracer_provider(provider)
OpenAIInstrumentor().instrument()  # Also: LangChainInstrumentor, LlamaIndexInstrumentor

# All OpenAI calls are now traced — no code changes to your application
```

Four dedicated agent evaluators:

```python
from phoenix.evals import (
    FunctionCallingEvaluator,   # Was the correct function called with the right parameters?
    PathConvergenceEvaluator,   # Did different execution paths converge on the same correct outcome?
    PlanningEvaluator,          # Was the task decomposition logical and complete?
    ReflectionEvaluator,        # Did the agent self-correct appropriately when given feedback?
    run_evals,
)

# Run all agent evaluators against traced data
results = run_evals(
    dataframe=phoenix_client.get_spans_dataframe(),
    evaluators=[
        FunctionCallingEvaluator(model=judge_model),
        PathConvergenceEvaluator(model=judge_model),
    ],
)
```

Auto-instrumentation for major agent frameworks: CrewAI, LangGraph, AutoGen, smolagents.

---

## W&B Weave

**Best for:** ML teams already using W&B for experiment tracking and model versioning who want
a unified platform for training and LLM evaluation.

Model: Closed-source SaaS (acquired by CoreWeave 2025)
Install: `pip install weave`

```python
import weave

weave.init("your-project")

@weave.op()  # Single decorator auto-logs all inputs, outputs, and child calls
def rag_pipeline(query: str) -> str:
    retrieved = retriever.retrieve(query)
    return generator.generate(query, retrieved)

# All calls are automatically traced to W&B
result = rag_pipeline("What is the return policy?")

# Evaluate with Weave
from weave.flow.eval import Evaluation

evaluation = Evaluation(
    dataset=eval_dataset,
    scorers=[faithfulness_scorer, relevance_scorer],
)
await evaluation.evaluate(rag_pipeline)
```

---

## Adding an Observability Platform — Checklist

When recommending an observability platform, confirm:

- [ ] Traces are captured for all LLM calls (input, output, latency, cost)
- [ ] Agent tool calls are visible in the trace (step-level visibility)
- [ ] A sampling strategy is configured for production (5–10% of live traffic)
- [ ] An annotation queue is set up for human review of edge cases
- [ ] Eval datasets are version-controlled in the platform
- [ ] A drift alert is configured — notify when production metric drops below offline baseline
- [ ] Failed production traces can be converted to regression test cases

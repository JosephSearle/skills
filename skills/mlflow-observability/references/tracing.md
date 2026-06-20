# MLflow Tracing Reference

**Version**: MLflow ≥ 3.14.0

## Enable autolog

```python
import mlflow

mlflow.set_tracking_uri("http://localhost:5000")
mlflow.set_experiment("my-agent")
mlflow.langchain.autolog()   # single call — covers LangChain AND LangGraph
```

`autolog()` patches LangChain's callback system automatically. Call it once before constructing
any chains or graphs. It captures: chain inputs/outputs, LLM calls (tokens, latency), tool calls,
retriever results, and LangGraph node transitions.

## Tracking URI options

| URI | When to use |
|---|---|
| `"http://localhost:5000"` | Local self-hosted MLflow server |
| `"http://mlflow:5000"` | Self-hosted in Docker/K8s (use service name) |
| `"databricks"` | Databricks managed MLflow (requires `mlflow[databricks]>=3.1`) |
| `"sqlite:///mlflow.db"` | Local file — dev only, not for production |

## Manual tracing (span-level)

```python
import mlflow

@mlflow.trace(span_type="RETRIEVER", name="vector_search")
async def retrieve_documents(query: str) -> list[str]:
    # This function's input, output, and latency are traced as a span
    docs = await vector_store.asimilarity_search(query, k=5)
    return [d.page_content for d in docs]
```

For component-level metrics, use the `@observe` decorator from DeepEval alongside MLflow spans
(see `llm-evaluation` skill).

## LangGraph-specific tracing notes

- `mlflow.langchain.autolog()` covers LangGraph as an extension of LangChain.
- Each LangGraph super-step appears as a child span of the overall run.
- Node names in the graph map to span names in MLflow.
- Retriever-containing chains need manual `log_model` with `loader_fn`/`persist_dir` — autolog
  does not capture retriever artifact state.
- Do not use `mlflow.langchain.log_model()` unless you need to register the compiled graph as
  a model artifact for serving.

## Compatibility

`mlflow.langchain.autolog()` compatibility is bounded — tested against `langchain ≤ 1.2.15`.
Verify on each LangChain upgrade. If autolog breaks after an upgrade, pin to the tested version
while awaiting an MLflow patch.

## Viewing traces

Open the MLflow UI at `http://localhost:5000` → select your experiment → click a run → click
**Traces** tab. Each trace shows the full call hierarchy with latency breakdown.

## Trace sampling (high-traffic)

MLflow does not expose a built-in sampling rate for LangChain autolog (unlike LangSmith's
`LANGSMITH_TRACING_SAMPLING_RATE`). To reduce trace volume:

```python
import random

# Manual sampling: only trace 20% of invocations
if random.random() < 0.20:
    mlflow.langchain.autolog()
else:
    mlflow.langchain.autolog(disable=True)
```

Or use MLflow's OpenTelemetry ingestion with an OTel Collector that applies sampling.

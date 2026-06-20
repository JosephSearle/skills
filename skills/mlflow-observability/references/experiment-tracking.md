# MLflow Experiment Tracking Reference

## Basic run

```python
import mlflow

mlflow.set_experiment("rag-pipeline-v2")

with mlflow.start_run(run_name="eval-2026-06-20"):
    mlflow.log_params({
        "model": "claude-sonnet-4-6",
        "temperature": 0.0,
        "chunk_size": 512,
        "top_k": 5,
    })
    mlflow.log_metrics({
        "faithfulness": 0.92,
        "answer_relevancy": 0.87,
        "context_precision": 0.79,
    })
    mlflow.log_artifact("eval_results.json")
    mlflow.log_artifact("confusion_matrix.png")
```

## Nested runs (for multi-agent eval)

```python
with mlflow.start_run(run_name="orchestrator-eval") as parent:
    mlflow.log_params({"strategy": "supervisor"})

    for agent_name in ["researcher", "writer", "reviewer"]:
        with mlflow.start_run(run_name=agent_name, nested=True):
            mlflow.log_metric("latency_ms", measure_agent(agent_name))
```

## Log multiple metrics over time (steps)

```python
with mlflow.start_run():
    for epoch, score in enumerate(training_scores):
        mlflow.log_metric("eval_score", score, step=epoch)
```

## Log dataset artifacts

```python
with mlflow.start_run():
    # Log a DataFrame as a CSV artifact
    import pandas as pd
    df = pd.DataFrame(eval_results)
    df.to_csv("/tmp/results.csv", index=False)
    mlflow.log_artifact("/tmp/results.csv", artifact_path="eval")

    # Log a JSON file
    import json
    with open("/tmp/config.json", "w") as f:
        json.dump(run_config, f)
    mlflow.log_artifact("/tmp/config.json")
```

## Tag runs for filtering

```python
with mlflow.start_run():
    mlflow.set_tag("model_family", "anthropic")
    mlflow.set_tag("pipeline_version", "2.1.0")
    mlflow.set_tag("eval_type", "rag_faithfulness")
```

## Compare runs programmatically

```python
client = mlflow.MlflowClient()

# Search runs in an experiment
runs = client.search_runs(
    experiment_ids=["1"],
    filter_string="metrics.faithfulness > 0.85 AND tags.model_family = 'anthropic'",
    order_by=["metrics.faithfulness DESC"],
    max_results=10,
)

for run in runs:
    print(run.info.run_id, run.data.metrics["faithfulness"])
```

## Self-hosted server setup

```bash
# Development (SQLite, local filesystem)
mlflow server --host 0.0.0.0 --port 5000

# Production (Postgres + S3-compatible storage)
mlflow server \
  --backend-store-uri postgresql://user:pass@postgres:5432/mlflow \
  --artifact-root s3://my-mlflow-bucket/artifacts \
  --host 0.0.0.0 \
  --port 5000

# Docker
docker run -p 5000:5000 \
  -e MLFLOW_BACKEND_STORE_URI="postgresql://user:pass@host:5432/mlflow" \
  -e MLFLOW_ARTIFACT_ROOT="s3://my-bucket/mlflow" \
  ghcr.io/mlflow/mlflow:v3.14.0 \
  mlflow server --host 0.0.0.0 --port 5000
```

For Databricks managed MLflow:
```python
import mlflow
mlflow.set_tracking_uri("databricks")
# Requires: pip install mlflow[databricks]>=3.1 + DATABRICKS_HOST + DATABRICKS_TOKEN env vars
```

## Gotchas

- SQLite is not safe for concurrent writes from multiple agents — use Postgres for production.
- Do not co-install `mlflow` and `mlflow-tracing` — they conflict.
- `mlflow agent setup` (3.14.0) automates instrumentation for existing codebases via an LLM agent.
- S3 artifact storage requires AWS credentials or an IAM role; MinIO works as a local S3 substitute.

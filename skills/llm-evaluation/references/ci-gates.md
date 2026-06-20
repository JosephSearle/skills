# CI Gates Reference

## Separation of eval from standard CI

Eval tests are `@pytest.mark.eval` and excluded from the standard PR CI run. They run on:
- A **scheduled pipeline** (nightly or weekly)
- **Pre-release gate** (before tagging a release)
- Manually triggered on demand

```yaml
# GitHub Actions — standard CI (excludes eval)
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: astral-sh/setup-uv@v6
      - run: uv sync --group ci
      - run: uv run pytest -m "not eval" -x -q
      - run: uvx pre-commit run --all-files
```

```yaml
# GitHub Actions — eval gate (scheduled + manual)
name: Eval Gate
on:
  schedule:
    - cron: "0 2 * * 1"   # weekly Monday 2am UTC
  workflow_dispatch:        # manual trigger

jobs:
  eval:
    runs-on: ubuntu-latest
    env:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      MLFLOW_TRACKING_URI: ${{ secrets.MLFLOW_TRACKING_URI }}
    steps:
      - uses: astral-sh/setup-uv@v6
      - run: uv sync --group eval
      - run: deepeval test run tests/eval/ --fail-on-metric-below 0.7
      - name: Log results to MLflow
        run: uv run python scripts/log_eval_results.py
```

## DeepEval CI threshold config

```bash
# Fail if ANY metric score drops below 0.7
deepeval test run tests/eval/ --fail-on-metric-below 0.7

# Per-metric thresholds (set in the metric definition)
metric = FaithfulnessMetric(threshold=0.8)   # 0.8 specific to this metric
```

Exit code:
- `0` — all metrics above threshold
- `1` — one or more metrics below threshold (use this to block release)

## MLflow-based threshold check

```python
# scripts/check_eval_thresholds.py
import mlflow
import sys

client = mlflow.MlflowClient()
runs = client.search_runs(
    experiment_ids=["eval-experiment-id"],
    order_by=["start_time DESC"],
    max_results=1,
)

if not runs:
    print("No eval runs found")
    sys.exit(1)

latest = runs[0]
metrics = latest.data.metrics

THRESHOLDS = {
    "faithfulness": 0.80,
    "answer_relevancy": 0.75,
    "context_precision": 0.70,
}

failures = [
    f"{name}: {metrics.get(name, 0):.3f} < {threshold}"
    for name, threshold in THRESHOLDS.items()
    if metrics.get(name, 0) < threshold
]

if failures:
    print("Eval gate FAILED:")
    for f in failures:
        print(f"  {f}")
    sys.exit(1)

print("Eval gate PASSED")
```

## Pre-release gate workflow

```bash
# Run before tagging a release
uv run deepeval test run tests/eval/ \
  --fail-on-metric-below 0.75 \
  --model claude-sonnet-4-6   # use full model for release gates (not Haiku)

# Check historical trend in MLflow before promoting
uv run python scripts/check_eval_thresholds.py
```

## Cost management

| Phase | Judge model | Cost level |
|---|---|---|
| Development iteration | Haiku | Low (~60–80% savings) |
| Scheduled nightly | Haiku | Low |
| Pre-release gate | Sonnet | Medium |
| Final production release gate | Sonnet or Opus | High (infrequent) |

## Regression dataset management

Keep a `datasets/regression.json` for cases from production bugs and user complaints:

```python
# Add a regression case when a bug is found
regression_case = Golden(
    input="<the failing user query>",
    expected_output="<the correct answer>",
)
dataset.add_golden(regression_case)
dataset.save_to_json("datasets/regression.json")
```

Run regression dataset on every PR gate (these cases are lightweight — no retrieval, cached).

## Alerting on eval degradation

```yaml
# GitHub Actions — alert on eval failure
- name: Notify on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {"text": "Eval gate failed on ${{ github.ref }} — check MLflow at ${{ env.MLFLOW_TRACKING_URI }}"}
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---
name: langsmith-core
description: >
  Instrument, evaluate, and manage prompts for production LLM systems using LangSmith
  (Python SDK ≥0.4.x). Triggers on: @traceable, LANGCHAIN_TRACING_V2, LANGSMITH_TRACING,
  LangSmith, evaluate(), aevaluate(), create_llm_as_judge, create_trajectory_match_evaluator,
  EvaluationResult, client.pull_prompt, client.push_prompt, client.list_runs, RunTree,
  process_inputs, process_outputs, LANGSMITH_TRACING_SAMPLING_RATE, annotation queue,
  Insights Agent, Multi-turn Evals, prompt commit webhook, online evaluator,
  pytest langsmith, tracing_sampling_rate. Covers three integrated subsystems: tracing
  and observability (auto-tracing via env var, @traceable decorator, OTel ingestion,
  sampling, monitoring alerts), offline and online evaluation (datasets, experiments,
  LLM-as-judge with openevals, trajectory evaluation with agentevals, CI/CD gating),
  and prompt management (versioned ChatPromptTemplate, commit SHAs, environment tags,
  pull/push/promote workflows).
---

## Core Philosophy

LangSmith is the observability, evaluation, and prompt-management layer for production LLM
systems — it is not optional once a system reaches real traffic. Every LangChain/LangGraph
run emits a trace automatically given one env var; every non-LangChain boundary gets
`@traceable` with PII masking via `process_inputs`/`process_outputs`. Evaluation is
code-first: datasets are curated from production traces, experiments run via `evaluate()`
or `aevaluate()` in CI, and a quality gate (`mean(scores) >= threshold`) blocks the merge.
Prompts are versioned artefacts pinned to immutable commit SHAs in production and promoted
through environment tags (`staging` → `production`) by the same CI pipeline. The five-stage
progression — instrument → control volume → gate releases → monitor in prod → prompts as
code — is the correct adoption order; skip stages only with deliberate justification.

---

## Step 1 — Determine Context

Classify the request before loading any reference file:

| Intent | Signals | Action |
|---|---|---|
| **TRACING** | `@traceable`, `LANGSMITH_TRACING`, `LANGCHAIN_TRACING_V2`, `RunTree`, `trace()`, `process_inputs`, `process_outputs`, `tracing_sampling_rate`, OTel ingestion, monitoring alerts, annotation queue, Insights Agent, `client.list_runs`, `LANGSMITH_TRACING_SAMPLING_RATE` | Load `references/tracing.md` |
| **EVALUATION** | `evaluate()`, `aevaluate()`, `create_llm_as_judge`, `create_trajectory_match_evaluator`, `EvaluationResult`, `LangChainStringEvaluator`, dataset creation, pytest langsmith, GitHub Actions eval gate, online evaluator, Multi-turn Evals, backtesting | Load `references/evaluation.md` |
| **PROMPT-MGMT** | `client.pull_prompt`, `client.push_prompt`, commit SHA, environment tags, `staging`/`production` promotion, prompt commit webhook, `hub.pull` migration, `lc_hub_commit_hash` | Load `references/prompt-management.md` |
| **FULL SETUP** | "instrument from scratch", "add LangSmith to this project", "set up observability + evals" | Load all three reference files |

Also detect these cross-cutting concerns:

- **EU data residency?** → document `LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com`
- **Non-LangChain stack?** → prefer OTel ingestion pattern from `references/tracing.md`
- **LangGraph agent?** → `aevaluate()` with explicit `max_concurrency` (see evaluation.md gotcha)
- **Plus/Enterprise only features?** → flag Insights Agent, Multi-turn Evals, extended retention controls

---

## Step 2 — Load References

| Reference file | Domain | Load when |
|---|---|---|
| `references/tracing.md` | Auto-tracing, `@traceable`, `RunTree`, OTel, sampling, monitoring, alerts, feedback API | Any tracing/observability question; full setup |
| `references/evaluation.md` | Datasets, `evaluate()`/`aevaluate()`, openevals, agentevals, custom evaluators, online evals, pytest plugin, CI gating | Any evaluation or quality gate question; full setup |
| `references/prompt-management.md` | `pull_prompt`/`push_prompt`, commits, tags, environment promotion, webhooks, SDK issue #1624 | Any prompt versioning or management question; full setup |

---

## Step 3 — Configure

### 3.1 Environment variables

Both legacy `LANGCHAIN_*` and newer `LANGSMITH_*` names are accepted by the SDK. Document both.

```python
import os

# Master switch (LANGCHAIN_TRACING_V2 is the legacy alias — both work)
os.environ["LANGSMITH_TRACING"] = "true"          # or LANGCHAIN_TRACING_V2
os.environ["LANGSMITH_API_KEY"] = "lsv2_..."       # or LANGCHAIN_API_KEY
os.environ["LANGSMITH_PROJECT"] = "my-agent-prod"  # or LANGCHAIN_PROJECT; default: "default"

# Optional — US default is https://api.smith.langchain.com
# EU endpoint: https://eu.api.smith.langchain.com
os.environ["LANGSMITH_ENDPOINT"] = "https://eu.api.smith.langchain.com"  # EU residency only

# Sampling: trace 10% of traffic globally (float 0.0–1.0)
os.environ["LANGSMITH_TRACING_SAMPLING_RATE"] = "0.1"
```

### 3.2 Key decision gates

**Volume/cost control** — once monthly trace overage cost approaches seat cost:
- Set `LANGSMITH_TRACING_SAMPLING_RATE` (start 0.1–0.25).
- Use `Client(tracing_sampling_rate=1.0)` for QA/audit paths that must always trace.
- Use `Client(tracing_sampling_rate=0.0)` for zero-retention tenants.

**Retention** — base traces: 14 days ($2.50/1k); extended: 400 days ($5.00/1k).
Traces receiving feedback, or matching an automation rule (online evaluator), are
auto-upgraded to extended retention. Online LLM-as-judge therefore drives both judge
token spend AND extended-retention spend — mitigate with low sampling rates.

**Tier gates** — Insights Agent and Multi-turn Evals require Plus or Enterprise plan
(both GA Oct 24 2025). Free Developer tier: 1 seat, 5,000 base traces/month, 14-day retention.

---

## Step 4 — Output & Verification

### What gets produced

| Task | Outputs |
|---|---|
| Tracing setup | Annotated Python files with `@traceable`, env var config, OTel exporter config |
| Evaluation | Dataset creation script, `evaluate()`/`aevaluate()` experiment runner, CI gate script |
| Prompt management | `pull_prompt` startup cache, `push_prompt` + promotion helper, webhook handler stub |

### Verification commands

```bash
# Confirm SDK version
uv run python -c "import langsmith; print(langsmith.__version__)"

# Smoke-test tracing (run your traced function once, then inspect in LangSmith UI)
LANGSMITH_TRACING=true LANGSMITH_API_KEY=lsv2_... uv run python -c "
from langsmith import traceable, Client

@traceable
def ping(x: str) -> str:
    return f'pong: {x}'

ping('hello')
print('Trace submitted — check project in LangSmith UI')
"

# List recent runs to confirm traces are landing
uv run python -c "
from langsmith import Client
from datetime import datetime, timedelta
client = Client()
runs = list(client.list_runs(
    project_name='my-agent-prod',
    start_time=datetime.now() - timedelta(hours=1),
    limit=5,
))
print(f'{len(runs)} recent run(s) found')
"

# Run pytest with LangSmith upload enabled
LANGSMITH_API_KEY=lsv2_... uv run pytest tests/ --langsmith-output -v
```

---

## Reference Files

| File | Domain | Primary source section |
|---|---|---|
| [references/tracing.md](references/tracing.md) | Env vars (both alias sets), `@traceable`, `RunTree`, `trace()`, OTel, sampling, monitoring, alerts, feedback API | Research §1 TRACING AND OBSERVABILITY |
| [references/evaluation.md](references/evaluation.md) | Datasets, `evaluate()`/`aevaluate()`, openevals, agentevals, online evals, pytest plugin, CI/CD | Research §2 EVALUATION |
| [references/prompt-management.md](references/prompt-management.md) | Prompt commits, tags, `pull_prompt`/`push_prompt`, environment promotion, webhooks | Research §3 PROMPT MANAGEMENT |

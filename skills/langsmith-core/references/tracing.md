# Tracing Reference — LangSmith Observability

## Environment Variables

Both legacy `LANGCHAIN_*` and newer `LANGSMITH_*` names are read by the SDK. All aliases work
interchangeably; prefer the `LANGSMITH_*` names in new code.

| Variable (new name) | Variable (legacy alias) | Required? | Purpose |
|---|---|---|---|
| `LANGSMITH_TRACING` | `LANGCHAIN_TRACING_V2` | **Required** (`"true"`) | Master switch; without it `@traceable` no-ops and no spans are emitted |
| `LANGSMITH_API_KEY` | `LANGCHAIN_API_KEY` | **Required** | Auth token; value starts `lsv2_…` |
| `LANGSMITH_PROJECT` | `LANGCHAIN_PROJECT` | Optional (defaults to `"default"`) | Groups traces into a named project |
| `LANGSMITH_ENDPOINT` | `LANGCHAIN_ENDPOINT` | Optional | API base URL; see endpoint table below |
| `LANGSMITH_TRACING_SAMPLING_RATE` | — | Optional | Float 0.0–1.0; global probabilistic sampling |
| `LANGSMITH_WORKSPACE_ID` | — | Required only for org-scoped API keys | Selects workspace |
| `LANGSMITH_OTEL_ENABLED` | — | Optional (`"true"`) | Fan-out: LangSmith native + OTel simultaneously (requires `langsmith>=0.3.18`) |
| `LANGSMITH_OTEL_ONLY` | — | Optional (`"true"`) | Suppress LangSmith native pipeline; OTel exporter only (available ≥0.4.1) |

### Endpoint URLs

| Region | Endpoint |
|---|---|
| US (default) | `https://api.smith.langchain.com` |
| EU | `https://eu.api.smith.langchain.com` |
| APAC | `https://apac.api.smith.langchain.com` |
| AWS US | `https://aws.api.smith.langchain.com` |

For OTel OTLP HTTP ingestion, append `/otel` to the base URL (e.g. `https://api.smith.langchain.com/otel`).
Append `/v1/traces` for traces-only exporters: `https://api.smith.langchain.com/otel/v1/traces`.
Self-hosted: append `/api/v1` then `/otel` (e.g. `https://your-host/api/v1/otel`).

---

## Auto-Tracing (LangChain / LangGraph)

Set the two required env vars and every LangChain Runnable, chat model, tool, and retriever is
traced automatically — no other code changes are required. A LangGraph run appears as:

```
thread  (grouped by thread_id / session_id / conversation_id in config metadata)
└─ run   (one graph invocation = the root trace)
   ├─ node_a  (one span per node)
   │   └─ llm_call  (nested LLM span)
   └─ node_b
       └─ tool_call
```

### Metadata, Tags, and run_name via RunnableConfig

```python
from langchain_core.runnables import RunnableConfig

config: RunnableConfig = {
    "run_name": "checkout_graph",
    "tags": ["prod", "checkout", "v2.1"],
    "metadata": {
        "user_id": "u_123",
        "tenant": "acme",
        "prompt_version": "v2.1",
    },
    "configurable": {"thread_id": "thread_abc"},  # groups runs into a thread
}
result = graph.invoke({"messages": [...]}, config=config)
```

`tags` and `metadata` are filterable in the LangSmith filter DSL (e.g. `eq(metadata_key, "tenant")`).
`run_name` sets the display name of the span. Child runs inherit tags/metadata from parents via
contextvars unless overridden.

### Adding Metadata from Inside a Node

```python
from langsmith import get_current_run_tree

def my_node(state: dict) -> dict:
    rt = get_current_run_tree()
    if rt is not None:
        rt.metadata["retrieved_docs"] = len(state["docs"])
        rt.tags = (rt.tags or []) + ["cache_miss"]
    return state
```

---

## @traceable Decorator

Full signature (`langsmith.run_helpers.traceable`):

```python
from langsmith import traceable

@traceable(
    run_type="chain",       # "tool" | "chain" | "llm" | "retriever" | "embedding" | "prompt" | "parser"
    name=None,              # str | None — defaults to function.__name__
    metadata=None,          # Mapping[str, Any] | None
    tags=None,              # list[str] | None
    client=None,            # Client | None — override the global client
    reduce_fn=None,         # Callable[[Sequence[Any]], dict] | None — combine streamed chunks
    project_name=None,      # str | None — override LANGSMITH_PROJECT for this trace
    process_inputs=None,    # Callable[[dict], dict] | None — mask/restructure before send
    process_outputs=None,   # Callable[[Any], dict] | None — mask/restructure before send
)
def fn(...): ...
```

Sync, async, and both sync/async generator forms are supported. Per-invocation overrides pass
via the `langsmith_extra` kwarg: `fn(args, langsmith_extra={"metadata": {...}, "tags": [...]})`.
Adding a `run_tree: RunTree` parameter to the decorated function causes the decorator to inject
the current `RunTree` automatically.

### Sync, Async, and Streaming Examples

```python
import asyncio
import httpx
from langsmith import traceable


@traceable(run_type="chain", tags=["prod"])
def sync_pipeline(payload: dict) -> dict:
    result = process(payload)
    return {"output": result}


@traceable(run_type="chain", tags=["prod"])
async def async_pipeline(params: dict) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.example.com/data", params=params)
        return response.json()


def _reduce_stream(chunks: list[dict]) -> dict:
    """Combine streaming LLM chunks into a single output dict."""
    text = "".join(
        chunk["choices"][0]["delta"].get("content", "") for chunk in chunks
    )
    return {"choices": [{"message": {"content": text, "role": "assistant"}}]}


@traceable(
    run_type="llm",
    reduce_fn=_reduce_stream,
    metadata={"ls_provider": "openai", "ls_model_name": "gpt-4o"},
)
def streaming_model(messages: list[dict]):
    """Trace a streaming OpenAI-compatible call; reduce_fn merges chunks."""
    import openai
    client = openai.OpenAI()
    yield from client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        stream=True,
    )
```

### Per-invocation Override

```python
sync_pipeline(
    {"key": "value"},
    langsmith_extra={"metadata": {"request_id": "req_abc"}, "tags": ["debug"]},
)
```

---

## PII Masking: process_inputs / process_outputs

`process_inputs` and `process_outputs` run **before** data is sent to LangSmith. Raw PII
never leaves the process.

```python
from typing import Any
from langsmith import traceable


def _mask_inputs(inputs: dict) -> dict:
    """Redact sensitive fields before they reach LangSmith."""
    scrubbed = dict(inputs)
    for field in ("ssn", "card_number", "dob"):
        if field in scrubbed:
            scrubbed[field] = "***REDACTED***"
    return scrubbed


def _mask_outputs(output: Any) -> dict:
    """Return a safe representation of the output."""
    if isinstance(output, dict) and output.get("contains_pii"):
        return {"response": "[REDACTED — PII detected]"}
    return {"response": output}


@traceable(
    run_type="llm",
    process_inputs=_mask_inputs,
    process_outputs=_mask_outputs,
)
def chat_with_pii(messages: list[dict], ssn: str, card_number: str) -> dict:
    return call_model(messages)
```

### process_inputs / process_outputs API

| Parameter | Type | Receives | Returns | Called when |
|---|---|---|---|---|
| `process_inputs` | `Callable[[dict], dict]` | Raw `kwargs` dict before trace submission | Sanitised `dict` to store as `inputs` | Before trace is posted to LangSmith |
| `process_outputs` | `Callable[[Any], dict]` | Raw return value | `dict` to store as `outputs` | Before trace is posted to LangSmith |

---

## trace() Context Manager

`langsmith.run_helpers.trace` — for imperative tracing where a decorator is inconvenient.

```python
from langsmith import trace

with trace(
    name="document_retrieval",
    run_type="retriever",
    inputs={"query": "What is the return policy?"},
    tags=["prod", "retrieval"],
    metadata={"index": "products-v3"},
) as run:
    docs = vector_store.similarity_search("What is the return policy?", k=5)
    run.add_metadata({"num_docs": len(docs), "index_version": "v3"})
    run.add_tags(["cache_miss"])
    run.end(outputs={"docs": [d.page_content for d in docs]})
```

### trace() Parameters

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `name` | `str` | required | Display name of the span |
| `run_type` | `str` | `"chain"` | Span type |
| `inputs` | `dict` | `{}` | Input payload |
| `extra` | `dict \| None` | `None` | Arbitrary extra metadata |
| `project_name` | `str \| None` | env var | Override project for this span |
| `parent` | `RunTree \| None` | auto (contextvar) | Explicit parent; overrides contextvar |
| `tags` | `list[str] \| None` | `None` | Filterable tag list |
| `metadata` | `dict \| None` | `None` | Filterable metadata dict |
| `client` | `Client \| None` | global | Override client |
| `run_id` | `UUID \| None` | auto | Deterministic run ID |
| `reference_example_id` | `UUID \| None` | `None` | Links run to a dataset example |
| `exceptions_to_handle` | `tuple[type, ...]` | `None` | Exceptions to catch and log as errors |
| `attachments` | `dict \| None` | `None` | Binary file attachments (images, audio) |

The run object supports `.add_metadata(d)`, `.add_tags(lst)`, `.end(outputs=…, error=…)`.

---

## RunTree API

`langsmith.run_trees.RunTree` — explicit parent/child management for advanced tracing.

```python
from langsmith import RunTree

parent = RunTree(
    name="pipeline",
    run_type="chain",
    inputs={"query": "hello"},
)

child = parent.create_child(
    name="retriever_step",
    run_type="retriever",
    inputs={"query": "hello"},
)
child.end(outputs={"docs": ["doc_a", "doc_b"]})
child.post()

parent.end(outputs={"answer": "The answer is 42"})
parent.post()
```

### create_child() Signature

```python
parent.create_child(
    name: str,
    run_type: str = "chain",
    *,
    run_id: UUID | None = None,
    serialized: dict | None = None,
    inputs: dict | None = None,
    outputs: dict | None = None,
    error: str | None = None,
    reference_example_id: UUID | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    tags: list[str] | None = None,
    extra: dict | None = None,
    attachments: dict | None = None,
) -> RunTree
```

### Distributed Tracing (Cross-Service)

Propagate the parent context via HTTP headers. The `TracingMiddleware` was added in
`langsmith==0.1.133`.

```python
# client.py — upstream service
from langsmith.run_helpers import get_current_run_tree, traceable
import httpx


@traceable
async def call_downstream(payload: dict) -> dict:
    headers: dict[str, str] = {}
    rt = get_current_run_tree()
    if rt is not None:
        headers.update(rt.to_headers())  # adds langsmith-trace + baggage
    async with httpx.AsyncClient(base_url="https://service-b") as c:
        response = await c.post("/process", json=payload, headers=headers)
        return response.json()
```

```python
# server.py — downstream FastAPI service
from fastapi import FastAPI, Request
from langsmith.middleware import TracingMiddleware

app = FastAPI()
app.add_middleware(TracingMiddleware)

@app.post("/process")
async def process(request: Request) -> dict:
    # TracingMiddleware attaches the parent span from incoming headers
    return await handle(await request.json())
```

### Nested Tracing and Thread Pools

`@traceable` uses Python `contextvars` (`_PARENT_RUN_TREE`) so nested traced calls attach as
children automatically — no IDs are passed manually.

> **⚠️ Thread pools:** contextvars do NOT propagate automatically into thread pool workers.
> Pass the parent `RunTree` explicitly via `langsmith_extra={"run_tree": parent_rt}`.

---

## Sampling

### Global Sampling via Environment Variable

```python
import os
os.environ["LANGSMITH_TRACING_SAMPLING_RATE"] = "0.1"  # trace 10% globally
```

### Per-Operation Sampling via Client

```python
from langsmith import Client, traceable, tracing_context

# Always trace — for QA or audit paths
client_full = Client(tracing_sampling_rate=1.0)

# Never trace — for zero-retention tenants
client_none = Client(tracing_sampling_rate=0.0)


def _mask(inputs: dict) -> dict:
    return {k: ("***" if k in {"ssn", "card"} else v) for k, v in inputs.items()}


@traceable(run_type="chain", process_inputs=_mask, metadata={"service": "checkout"})
def handle_request(payload: dict) -> dict:
    rt = get_current_run_tree()
    if rt is not None:
        rt.metadata["tenant"] = payload.get("tenant")
    return run_graph(payload)


def route_with_sampling(payload: dict) -> dict:
    """Route traffic: skip tracing for zero-retention tenants."""
    if payload.get("tenant") == "zero_retention":
        with tracing_context(client=client_none):
            return handle_request(payload)
    return handle_request(payload)
```

### tracing_context() API

`langsmith.tracing_context(client=None, *, project_name=None, tags=None, metadata=None, enabled=None)`

Used as an async or sync context manager to override tracing configuration for a block.

---

## OpenTelemetry Ingestion

For non-LangChain stacks, point any OTLP HTTP exporter at the LangSmith OTel endpoint.

### Shell (env vars)

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT="https://api.smith.langchain.com/otel"
export OTEL_EXPORTER_OTLP_HEADERS="x-api-key=lsv2_...,Langsmith-Project=my_project"
# EU:   https://eu.api.smith.langchain.com/otel
# APAC: https://apac.api.smith.langchain.com/otel
```

### Python OTel SDK

```python
from opentelemetry import trace as otel_trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

provider = TracerProvider()
exporter = OTLPSpanExporter(
    endpoint="https://api.smith.langchain.com/otel/v1/traces",
    headers={
        "x-api-key": "lsv2_...",
        "Langsmith-Project": "my_project",
    },
)
provider.add_span_processor(BatchSpanProcessor(exporter))
otel_trace.set_tracer_provider(provider)

tracer = otel_trace.get_tracer(__name__)

with tracer.start_as_current_span("call_open_ai") as span:
    span.set_attribute("langsmith.span.kind", "LLM")
    span.set_attribute("langsmith.metadata.user_id", "user_123")
    span.set_attribute("gen_ai.system", "openai")
    span.set_attribute("gen_ai.request.model", "gpt-4o-mini")
    result = call_openai()
    span.set_attribute("gen_ai.usage.input_tokens", result.usage.prompt_tokens)
    span.set_attribute("gen_ai.usage.output_tokens", result.usage.completion_tokens)
```

### OTel Attribute Mapping

| OTel attribute | LangSmith field |
|---|---|
| `langsmith.span.kind` | Run type (`llm` / `chain` / `tool` / `retriever` / `embedding` / `prompt` / `parser`) |
| `langsmith.trace.name` | Run name |
| `langsmith.metadata.{key}` | `metadata.{key}` |
| `langsmith.span.tags` | tags |
| `langsmith.trace.session_id` / `session_name` | thread session |
| `gen_ai.system` | `metadata.ls_provider` |
| `gen_ai.operation.name` | Run type (chat/completion → llm, embedding → embedding) |
| `gen_ai.request.model` / `gen_ai.response.model` | `invocation_params.model` |
| `gen_ai.prompt` / `gen_ai.completion` (`.{n}.role`, `.{n}.content`) | inputs / outputs messages |
| `gen_ai.usage.input_tokens` / `output_tokens` / `total_tokens` | `usage_metadata.*` |
| `gen_ai.tool.name` | sets run type "tool" |

Also mapped: OpenInference (`input.value`, `openinference.span.kind`), TraceLoop/OpenLLMetry
(`traceloop.*`), and Logfire conventions.

> **⚠️ Header name:** The current header name is `Langsmith-Project` (capital L, capital P).
> Older blog posts used `LANGSMITH_PROJECT`. Use the current form.

> **⚠️ span.kind casing:** `langsmith.span.kind` values are lowercase in the official mapping
> table (`llm`, `chain`, `tool`, etc.) — use lowercase.

---

## Monitoring in Production

### Dashboard Metrics

The monitoring dashboard auto-captures:
- Trace/run volume
- Latency (P50, P99)
- Token counts and cost
- Error rate
- Feedback scores

All metrics are sliceable by tag/metadata. SDK overhead is negligible: the async callback
handler dispatches to a background thread; if LangSmith has an incident, the application
continues running.

### Threads View

Groups runs by `thread_id` (or `session_id` / `conversation_id`) for multi-turn analysis.

```python
from langsmith import Client
from datetime import datetime, timedelta

client = Client()

group_key = "thread_abc"
filter_string = (
    'and(in(metadata_key, ["session_id","conversation_id","thread_id"]), '
    f'eq(metadata_value, "{group_key}"))'
)
thread_runs = list(
    client.list_runs(
        project_name="checkout-agent-prod",
        filter=filter_string,
        is_root=True,
    )
)
```

### Insights Agent

Plus/Enterprise only (GA Oct 24 2025). An LLM-orchestrated analyser that clusters production
threads into a hierarchical taxonomy of usage patterns and failure modes. Accepts natural-language
queries ("What are users asking?", "Where is X failing?"). Generating insights can take up to
15 minutes depending on data volume. Outputs labelled clusters with member counts.

Workflow: run Insights Agent → identify low-quality clusters → route to annotation queue →
curate into evaluation dataset → fix → monitor.

### Alerts

Threshold-based alerts on **error rate**, **latency**, and **feedback scores**.

| Setting | Options |
|---|---|
| Aggregation windows | 5 minutes, 15 minutes |
| Filters | Model, run type, error type, tag/metadata |
| Destinations | PagerDuty (Events API v2), custom webhook (e.g. Slack `chat.postMessage`) |

**Webhook payload fields:**

| Field | Type | Description |
|---|---|---|
| `alert_rule_id` | `str` | Identifier of the alert rule |
| `alert_rule_attribute` | `str` | `"error_count"` \| `"feedback_score"` \| `"latency"` \| `"cost"` |
| `triggered_metric_value` | `float` | Current metric value that triggered the alert |
| `triggered_threshold` | `float` | Configured threshold |
| `timestamp` | `str` | ISO 8601 timestamp |

> **⚠️ PagerDuty re-alert:** PagerDuty requires resolving the open incident before re-alerting
> within the same hour.

---

## Data Retention and Pricing

| Retention tier | Duration | Price |
|---|---|---|
| Base traces | 14 days | $2.50 / 1k traces |
| Extended traces | 400 days (Enterprise: customisable) | $5.00 / 1k traces |

Traces are auto-upgraded to extended retention when they:
- Receive feedback (any `create_feedback` call)
- Match an automation rule (online evaluator or annotation rule)

> **⚠️ Online evaluator cost:** when an automation rule matches any run within a trace, all
> runs in that trace are upgraded to extended retention AND judge model tokens are billed per
> sampled trace. At high throughput, online evals are the dominant cost driver. Mitigate with
> low sampling rates, narrow filters, and cheap judge models.

### list_runs() Performance Tips

```python
from langsmith import Client
from datetime import datetime, timedelta

client = Client()

# Always provide start_time — omitting it triggers a stricter rate-limit tier
runs = client.list_runs(
    project_name="checkout-agent-prod",
    start_time=datetime.now() - timedelta(hours=6),  # keep windows ≤7 days
    run_type="llm",
    limit=100,
    select=["inputs", "outputs", "feedback_stats"],  # reduce payload
)

# Filter DSL: errors with latency > 5s
errored = client.list_runs(
    project_name="checkout-agent-prod",
    filter='and(eq(status, "error"), gt(latency, 5))',
    start_time=datetime.now() - timedelta(days=1),
)

# Root runs whose trace received a positive user_score
positive = client.list_runs(
    project_name="checkout-agent-prod",
    filter='eq(name, "extractor")',
    trace_filter='and(eq(feedback_key, "user_score"), eq(feedback_score, 1))',
    start_time=datetime.now() - timedelta(days=7),
    is_root=True,
)
```

Filter DSL operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `and`, `or`, `in`, `has`, `search`.
`trace_filter` filters the root run; `tree_filter` filters any run in the tree.
Avoid `search(...)` full-text and `child_run_ids` selection at high volume — use Bulk Data Export.

---

## Feedback API

```python
from langsmith import Client

client = Client()

# Numeric score (0.0–1.0 or 0/1 boolean)
client.create_feedback(
    run_id="a36092d2-4ad5-4fb4-9c0d-0dba9a2ed836",
    key="schema_valid",
    score=1,
    comment="Output passed JSON schema validation",
    feedback_source_type="api",
)

# Categorical label
client.create_feedback(
    run_id="a36092d2-4ad5-4fb4-9c0d-0dba9a2ed836",
    key="user_score",
    score=0,
    value="thumbs_down",
)
```

### create_feedback() Signature

| Parameter | Type | Default | Purpose |
|---|---|---|---|
| `run_id` | `UUID \| str \| None` | — | Run to attach feedback to (required if `project_id` omitted) |
| `key` | `str` | required | Feedback metric name |
| `score` | `float \| int \| bool \| None` | `None` | Numeric score |
| `value` | `str \| dict \| None` | `None` | Non-numeric label or structured value |
| `correction` | `dict \| None` | `None` | Suggested correction |
| `comment` | `str \| None` | `None` | Free-text note; use for judge chain-of-thought |
| `source_info` | `dict \| None` | `None` | Source system metadata |
| `feedback_source_type` | `str` | `"api"` | `"api"` or `"model"` for LLM-generated |
| `source_run_id` | `UUID \| None` | `None` | ID of the judge run that produced this feedback |
| `feedback_id` | `UUID \| None` | `None` | Idempotency key |
| `feedback_config` | `dict \| None` | `None` | Schema: `continuous` (min/max) / `categorical` / `freeform` |
| `project_id` | `UUID \| None` | `None` | Alternative to `run_id` for project-level feedback |
| `trace_id` | `UUID \| None` | `None` | Recommended for batched ingestion |

---

## Production Gotchas

| Gotcha | Symptom | Fix |
|---|---|---|
| `LANGCHAIN_TRACING_V2` not set | `@traceable` silently no-ops; no spans emitted | Set `LANGSMITH_TRACING=true` (or `LANGCHAIN_TRACING_V2=true`) |
| Thread pool context loss | Child traces appear as root-level runs instead of children | Pass `langsmith_extra={"run_tree": parent_rt}` explicitly into thread workers |
| `process_inputs` / `process_outputs` not called | PII appearing in LangSmith | Confirm the decorated function is actually called (not bypassed by mocking) and the callable returns a dict |
| High online eval cost | Runaway extended-retention spend | Lower sampling rate on automation rules; use a cheap judge (e.g. `gpt-4o-mini`) |
| Missing `start_time` on list_runs | Requests throttled at 3 req/10s instead of 10 | Always pass `start_time` (≤7 day window) |
| EU data residency not configured | Traces sent to US endpoint | Set `LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com` |
| `LANGSMITH_OTEL_ENABLED` absent for fan-out | OTel exporter receives no spans | Set `LANGSMITH_OTEL_ENABLED=true`; requires `langsmith>=0.3.18` (recommended ≥0.4.25) |

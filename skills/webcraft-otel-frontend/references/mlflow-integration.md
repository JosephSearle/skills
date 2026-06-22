# MLflow Integration Reference

> Authority: [mlflow.org/docs/latest/llms/tracing/index.html](https://mlflow.org/docs/latest/llms/tracing/index.html) and [opentelemetry.io/docs/concepts/context-propagation](https://opentelemetry.io/docs/concepts/context-propagation/)

MLflow 2.x accepts OTLP/HTTP traces. Frontend spans must propagate `traceparent` headers to link with backend LangGraph spans.

---

## MLflow OTLP endpoint

MLflow exposes an OTLP/HTTP ingestion endpoint at:

```
http://<mlflow-host>:<port>/api/2.0/mlflow/otlp
```

Full traces URL:
```
http://mlflow-service:5000/api/2.0/mlflow/otlp/v1/traces
```

Configure in `.env.local`:
```
NEXT_PUBLIC_MLFLOW_OTLP_ENDPOINT=http://mlflow-service:5000/api/2.0/mlflow/otlp
```

In the OTLP exporter:
```ts
new OTLPTraceExporter({
  url: process.env.NEXT_PUBLIC_MLFLOW_OTLP_ENDPOINT + '/v1/traces',
})
```

---

## Service resource attributes for MLflow

MLflow uses `service.name` to group traces in the UI:

```ts
new Resource({
  [ATTR_SERVICE_NAME]: 'webcraft-frontend',
  [ATTR_SERVICE_VERSION]: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0',
  'deployment.environment': process.env.NEXT_PUBLIC_ENV ?? 'development',
})
```

Use a consistent `service.name` per environment so MLflow can filter by service:

| Environment | `service.name` |
|-------------|---------------|
| Development | `webcraft-frontend-dev` |
| Staging | `webcraft-frontend-staging` |
| Production | `webcraft-frontend` |

---

## Trace propagation (linking browser to agent spans)

Without propagation, browser and agent traces appear as separate, unrelated entries in MLflow.

**Step 1: Enable `traceparent` injection on fetch calls**

```ts
// In initTelemetry()
getWebAutoInstrumentations({
  '@opentelemetry/instrumentation-fetch': {
    propagateTraceHeaderCorsUrls: [
      // Match the Next.js app origin so /api/chat gets the header
      new RegExp(process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://localhost:3000'),
    ],
  },
})
```

**Step 2: Forward `traceparent` in the route handler**

```ts
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { messages } = await req.json()

  // Forward the W3C trace context header from browser to LangGraph
  const traceparent = req.headers.get('traceparent')

  const agentResponse = await fetch(`${process.env.AGENT_BACKEND_URL}/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(traceparent ? { traceparent } : {}),
    },
    body: JSON.stringify({ messages }),
  })

  return new Response(agentResponse.body, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}
```

**Step 3: LangGraph backend extracts traceparent**

The LangGraph Python agent uses `opentelemetry-propagator-b3` or the W3C TraceContext propagator to extract the `traceparent` and continue the trace. This is handled in the agents repo.

---

## Complete trace chain

```
Browser (OTel Web SDK)
  └── span: "user.chat.submit"
        │  traceparent: 00-<trace-id>-<span-id>-01
        │
        ▼ HTTP POST /api/chat
Next.js Route Handler
  └── span: "api.chat.proxy" (auto-instrumented via fetch)
        │  traceparent forwarded to LangGraph
        │
        ▼ HTTP POST agent-backend/stream
LangGraph Agent (Python OTel)
  └── span: "agent.run"
        └── span: "tool.call.search"
```

All appear as a single trace tree in MLflow, rooted at "user.chat.submit".

---

## Viewing traces in MLflow

1. Open MLflow UI: `http://mlflow-service:5000` (or the OpenShift route)
2. Navigate to **Traces** (top nav)
3. Filter by `service.name = webcraft-frontend`
4. Click a trace to see the full span tree
5. The browser span appears as the root; LangGraph spans are children

If spans are missing: check that `NEXT_PUBLIC_MLFLOW_OTLP_ENDPOINT` is set correctly and that the MLflow instance accepts OTLP (requires MLflow 2.3+).

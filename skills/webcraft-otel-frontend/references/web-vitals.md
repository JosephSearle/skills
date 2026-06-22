# Web Vitals Reference

> Authority: [nextjs.org/docs/app/building-your-application/optimizing/open-telemetry](https://nextjs.org/docs/app/building-your-application/optimizing/open-telemetry) and [web.dev/articles/vitals](https://web.dev/articles/vitals)

Web Vitals are Core Web Vital metrics collected by the browser. Next.js provides `reportWebVitals` for capturing them. Route them to MLflow alongside agent traces.

---

## Core Web Vitals

| Metric | Full name | What it measures | Good threshold |
|--------|-----------|-----------------|----------------|
| `LCP` | Largest Contentful Paint | Load performance | < 2.5s |
| `INP` | Interaction to Next Paint | Responsiveness | < 200ms |
| `CLS` | Cumulative Layout Shift | Visual stability | < 0.1 |
| `FCP` | First Contentful Paint | Load start | < 1.8s |
| `TTFB` | Time to First Byte | Server response | < 800ms |

---

## reportWebVitals in Next.js

Add to `app/layout.tsx`:

```tsx
// app/layout.tsx
export { reportWebVitals } from '@/lib/webVitals'
```

Create the vitals reporter:

```ts
// lib/webVitals.ts
import type { NextWebVitalsMetric } from 'next/app'
import { getTracer } from './telemetry'
import { SpanStatusCode } from '@opentelemetry/api'

export function reportWebVitals(metric: NextWebVitalsMetric) {
  // Send to OTel as a span
  const tracer = getTracer()
  if (tracer) {
    const span = tracer.startSpan(`web_vital.${metric.name.toLowerCase()}`)
    span.setAttributes({
      'web_vital.name': metric.name,
      'web_vital.value': metric.value,
      'web_vital.rating': metric.rating ?? 'unknown',
      'web_vital.id': metric.id,
    })
    span.setStatus({
      code: metric.rating === 'poor' ? SpanStatusCode.ERROR : SpanStatusCode.OK,
    })
    span.end()
  }

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Web Vital] ${metric.name}: ${Math.round(metric.value)}ms`)
  }
}
```

---

## Custom span: agent interaction lifecycle

Track the full lifecycle of a user-to-agent interaction as a single parent span with child spans:

```ts
// lib/telemetry.ts
import { trace, context, SpanStatusCode } from '@opentelemetry/api'

export async function traceAgentInteraction(
  userMessage: string,
  fn: () => Promise<void>
): Promise<void> {
  const tracer = trace.getTracer('webcraft-frontend')

  return tracer.startActiveSpan('agent.interaction', async (parentSpan) => {
    parentSpan.setAttributes({
      'chat.user_message.length': userMessage.length,
      'chat.started_at': Date.now(),
    })

    try {
      // Child spans are created automatically within this context
      await fn()
      parentSpan.setStatus({ code: SpanStatusCode.OK })
    } catch (err) {
      parentSpan.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
      throw err
    } finally {
      parentSpan.setAttributes({ 'chat.ended_at': Date.now() })
      parentSpan.end()
    }
  })
}
```

Usage in chat island:
```tsx
const onFormSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  if (!input.trim()) return

  await traceAgentInteraction(input, async () => {
    await handleSubmit(e)
  })
}
```

---

## Span for streaming completion

Track when the full agent response has been received:

```ts
// In the useChat onFinish callback
useChat({
  api: '/api/chat',
  onFinish: (message) => {
    const tracer = trace.getTracer('webcraft-frontend')
    const span = tracer.startSpan('agent.response.complete')
    span.setAttributes({
      'agent.response.length': message.content.length,
      'agent.response.role': message.role,
    })
    span.end()
  },
})
```

---

## Environment variable pattern

| Variable | Scope | Example |
|----------|-------|---------|
| `NEXT_PUBLIC_MLFLOW_OTLP_ENDPOINT` | Browser (inlined at build time) | `http://mlflow:5000/api/2.0/mlflow/otlp` |
| `NEXT_PUBLIC_APP_NAME` | Browser | `webcraft-app` |
| `NEXT_PUBLIC_APP_VERSION` | Browser | `1.2.0` (set by CI from git tag) |
| `NEXT_PUBLIC_ENV` | Browser | `staging` or `production` |

In OpenShift ConfigMap:
```yaml
data:
  NEXT_PUBLIC_MLFLOW_OTLP_ENDPOINT: "http://mlflow-service.monitoring.svc.cluster.local:5000/api/2.0/mlflow/otlp"
  NEXT_PUBLIC_APP_NAME: "webcraft-app"
  NEXT_PUBLIC_ENV: "production"
```

**Important:** `NEXT_PUBLIC_` variables are inlined into the JavaScript bundle at `next build` time. They cannot be changed per-deployment without rebuilding. For values that change between staging and production, proxy them through a server-side API route instead.

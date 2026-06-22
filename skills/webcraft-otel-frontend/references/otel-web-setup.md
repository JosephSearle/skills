# OTel Web SDK Setup Reference

> Authority: [opentelemetry.io/docs/languages/js/getting-started/browser](https://opentelemetry.io/docs/languages/js/getting-started/browser/)

The OpenTelemetry JavaScript SDK provides browser-side tracing. The Web SDK uses `WebTracerProvider` instead of the Node.js `NodeTracerProvider`.

---

## Required packages

```bash
npm install \
  @opentelemetry/api \
  @opentelemetry/sdk-web \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

Optional — auto-instrument fetch, XHR, and user interactions:
```bash
npm install @opentelemetry/auto-instrumentations-web @opentelemetry/context-zone
```

---

## Minimal setup

```ts
// lib/telemetry.ts
import { WebTracerProvider } from '@opentelemetry/sdk-web'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

export function initTelemetry() {
  if (typeof window === 'undefined') return  // server-side guard

  const provider = new WebTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'webcraft-app',
    }),
  })

  provider.addSpanProcessor(
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: process.env.NEXT_PUBLIC_MLFLOW_OTLP_ENDPOINT + '/v1/traces',
      })
    )
  )

  provider.register()
}
```

---

## Auto-instrumentation

Auto-instrumentation patches `fetch`, `XMLHttpRequest`, and DOM events to create spans automatically:

```ts
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'
import { ZoneContextManager } from '@opentelemetry/context-zone'

provider.register({
  contextManager: new ZoneContextManager(),
})

// Register auto-instrumentations after provider.register()
registerInstrumentations({
  instrumentations: [
    getWebAutoInstrumentations({
      '@opentelemetry/instrumentation-fetch': {
        propagateTraceHeaderCorsUrls: [
          new RegExp(process.env.NEXT_PUBLIC_APP_ORIGIN ?? ''),
        ],
      },
    }),
  ],
})
```

`propagateTraceHeaderCorsUrls` injects `traceparent` headers on fetch calls to matching URLs — needed to propagate traces from browser to the Next.js route handler.

---

## BatchSpanProcessor vs SimpleSpanProcessor

| Processor | Behaviour | When to use |
|-----------|----------|------------|
| `BatchSpanProcessor` | Buffers spans and sends in batches | Production (reduces HTTP requests) |
| `SimpleSpanProcessor` | Sends each span immediately | Development/debugging |

```ts
// Development: see spans immediately
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
```

---

## Creating custom spans

```ts
import { trace, SpanStatusCode } from '@opentelemetry/api'

const tracer = trace.getTracer('webcraft-frontend', '1.0.0')

async function sendMessage(content: string) {
  const span = tracer.startSpan('chat.message.send')
  span.setAttributes({
    'chat.message.length': content.length,
    'chat.message.role': 'user',
  })

  try {
    const response = await fetch('/api/chat', { /* ... */ })
    span.setStatus({ code: SpanStatusCode.OK })
    return response
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
    throw err
  } finally {
    span.end()
  }
}
```

---

## Span attribute naming conventions

Follow OpenTelemetry semantic conventions. Use namespaced, lowercase, dot-separated keys:

```ts
// Good — namespace matches the domain
span.setAttributes({
  'chat.session.id': sessionId,
  'chat.message.length': content.length,
  'agent.model.name': 'claude-sonnet-4-6',
  'agent.response.latency_ms': latency,
})

// Bad — no namespace, vague names
span.setAttributes({
  id: sessionId,
  length: content.length,
  model: 'claude',
})
```

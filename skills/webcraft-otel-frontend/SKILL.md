---
name: webcraft-otel-frontend
description: >
  Add OpenTelemetry tracing to a Next.js frontend, exporting spans to MLflow via
  OTLP/HTTP. Creates a unified trace story from browser interaction through LangGraph
  agent execution. Covers OTel Web SDK setup, custom spans for agent interaction
  lifecycle, Web Vitals reporting, and environment variable patterns for the MLflow
  endpoint. Requires webcraft-nextjs-architecture and webcraft-openshift-deploy.
  Triggers on: "frontend tracing", "OpenTelemetry Next.js", "MLflow frontend traces",
  "OTel Web SDK", "OTLP frontend", "browser tracing", "Web Vitals OTel", "agent span",
  "trace user interaction". Not for backend tracing — that is handled in the agents
  and MCP server repos.
---

# webcraft-otel-frontend

The MCP server already sends OTel traces to MLflow. Adding frontend tracing creates a **complete trace chain**: browser user action → Next.js route handler → LangGraph agent → MCP tool call — all visible in one MLflow trace tree. Without frontend spans, MLflow only shows the backend half of every interaction.

---

## Core Philosophy

**Frontend spans extend existing MLflow traces, not create parallel ones.** Propagate the `traceparent` header from browser to the `/api/chat` route handler to the LangGraph backend. This links the browser span as a parent of the agent execution span in MLflow. Without propagation, you get two disconnected traces instead of one tree.

**Initialise OTel before any component renders.** The `WebTracerProvider` must be registered before the first React render to capture page load spans. In Next.js, use the `instrumentation.ts` file for server-side initialisation and a `'use client'` provider component for browser-side initialisation.

---

## Step 1 — Detect existing setup

```
Check package.json:
  └─ Is @opentelemetry/sdk-web installed?
       └─ NO → install OTel packages (Step 3 — Install)

Check lib/ or app/lib/:
  └─ Does telemetry.ts exist?
       └─ NO → create it (Step 3 — Setup)

Check app/layout.tsx:
  └─ Is <OtelProvider> or telemetry init called?
       └─ NO → wire it in (Step 3 — Wiring)

Check .env.local:
  └─ Is NEXT_PUBLIC_MLFLOW_OTLP_ENDPOINT set?
       └─ NO → add it (Step 3 — Env vars)
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Installing OTel packages and initial setup
  │    → load references/otel-web-setup.md
  ├─ Configuring the MLflow OTLP endpoint or trace schema
  │    → load references/mlflow-integration.md
  └─ Setting up Web Vitals or custom agent interaction spans
       → load references/web-vitals.md
```

---

## Step 3 — Execute

### Install

```bash
npm install \
  @opentelemetry/sdk-web \
  @opentelemetry/auto-instrumentations-web \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/context-zone \
  @opentelemetry/api
```

### Browser telemetry initialisation

```ts
// lib/telemetry.ts
import { WebTracerProvider } from '@opentelemetry/sdk-web'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { Resource } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

let provider: WebTracerProvider | null = null

export function initTelemetry() {
  if (provider || typeof window === 'undefined') return

  provider = new WebTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: process.env.NEXT_PUBLIC_APP_NAME ?? 'webcraft-app',
      [ATTR_SERVICE_VERSION]: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0',
    }),
  })

  const endpoint = process.env.NEXT_PUBLIC_MLFLOW_OTLP_ENDPOINT
  if (endpoint) {
    provider.addSpanProcessor(
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: endpoint + '/v1/traces' })
      )
    )
  }

  provider.register()
}

export function getTracer() {
  return provider?.getTracer('webcraft-frontend') ?? null
}
```

### OTel provider component

```tsx
// app/components/OtelProvider.tsx
'use client'
import { useEffect } from 'react'
import { initTelemetry } from '@/lib/telemetry'

export function OtelProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initTelemetry()
  }, [])
  return <>{children}</>
}
```

Wire into `app/providers.tsx`:
```tsx
import { OtelProvider } from './components/OtelProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OtelProvider>
      <QueryClientProvider client={queryClient}>
        <Theme theme="g100">{children}</Theme>
      </QueryClientProvider>
    </OtelProvider>
  )
}
```

### Custom span for agent interaction

```ts
// lib/telemetry.ts — add this helper
import { SpanStatusCode } from '@opentelemetry/api'

export async function traceAgentCall<T>(
  name: string,
  fn: (span: ReturnType<NonNullable<ReturnType<typeof getTracer>>['startSpan']>) => Promise<T>
): Promise<T> {
  const tracer = getTracer()
  if (!tracer) return fn({ end: () => {}, setStatus: () => {}, setAttributes: () => {} } as any)

  const span = tracer.startSpan(name)
  try {
    const result = await fn(span)
    span.setStatus({ code: SpanStatusCode.OK })
    return result
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
    throw err
  } finally {
    span.end()
  }
}
```

Usage in chat:
```ts
await traceAgentCall('user.chat.submit', async (span) => {
  span.setAttributes({ 'chat.message.length': input.length })
  await handleSubmit(e)
})
```

---

## Step 4 — Validate

- [ ] OTel packages are in `package.json` dependencies (not devDependencies)
- [ ] `lib/telemetry.ts` guards against server-side execution (`typeof window === 'undefined'`)
- [ ] `initTelemetry()` is called exactly once (check `if (provider) return` guard)
- [ ] `NEXT_PUBLIC_MLFLOW_OTLP_ENDPOINT` is set in `.env.local`
- [ ] `NEXT_PUBLIC_MLFLOW_OTLP_ENDPOINT` is defined in OpenShift ConfigMap for production
- [ ] `<OtelProvider>` is the outermost component in `providers.tsx`
- [ ] Spans appear in MLflow UI after a chat interaction (manual verification)
- [ ] No OTel spans are created in Server Components (OTel Web SDK is browser-only)

---

## Reference Files

- [references/otel-web-setup.md](references/otel-web-setup.md) — Package list, `WebTracerProvider` setup, `BatchSpanProcessor`, OTLP exporter config. **Load for initial OTel installation.**
- [references/mlflow-integration.md](references/mlflow-integration.md) — MLflow OTLP endpoint config, service name/version resources, trace linking (`traceparent` propagation). **Load for MLflow endpoint setup or trace schema questions.**
- [references/web-vitals.md](references/web-vitals.md) — `reportWebVitals` in Next.js, sending Core Web Vitals as OTel spans, agent interaction lifecycle spans. **Load for Web Vitals or custom span setup.**

---

## Source Documentation

All content is grounded in [opentelemetry.io/docs/languages/js/getting-started/browser](https://opentelemetry.io/docs/languages/js/getting-started/browser/), [mlflow.org/docs/latest/llms/tracing/index.html](https://mlflow.org/docs/latest/llms/tracing/index.html), and [nextjs.org/docs/app/building-your-application/optimizing/open-telemetry](https://nextjs.org/docs/app/building-your-application/optimizing/open-telemetry).

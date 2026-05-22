# OpenTelemetry Setup Reference

## The First-Import Constraint

`@opentelemetry/sdk-node` instruments Node.js by monkey-patching the `http`, `https`, `net`, `dns`, and other core modules. This patching happens at **import time**. Any module imported before `tracing.ts` will not be instrumented.

```ts
// main.ts — CORRECT: tracing is the very first import
import './observability/tracing';   // OTel patches internals here

import { NestFactory } from '@nestjs/core';  // patched — HTTP spans captured
import { AppModule } from './app.module';    // all further imports are instrumented
```

```ts
// main.ts — WRONG: NestFactory imported first
import { NestFactory } from '@nestjs/core';  // NOT instrumented — spans will be missing
import './observability/tracing';            // too late
```

## Installation

```bash
npm install \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-otlp-http \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

## tracing.ts

```ts
// src/observability/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]:    process.env.OTEL_SERVICE_NAME    ?? 'mcp-server',
    [SEMRESATTRS_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION ?? '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
      : 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },  // too noisy
    }),
  ],
});

sdk.start();

// Flush spans on graceful shutdown
process.on('SIGTERM', () => sdk.shutdown().finally(() => process.exit(0)));
```

## Key Environment Variables

| Variable | Required | Description |
|----------|:---:|---------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Yes | Collector endpoint (e.g., `http://otel-collector:4318`) |
| `OTEL_SERVICE_NAME` | Recommended | Service name shown in traces |
| `OTEL_SERVICE_VERSION` | Optional | Service version for version-based alerting |
| `OTEL_TRACES_SAMPLER` | Optional | e.g., `parentbased_traceidratio` for sampling |
| `OTEL_TRACES_SAMPLER_ARG` | Optional | Sampling ratio (0.0–1.0) |

## Auto-Instrumentation Coverage

`@opentelemetry/auto-instrumentations-node` automatically instruments:
- HTTP/HTTPS outbound calls
- `net` TCP connections
- PostgreSQL (`pg`), MySQL (`mysql2`), Redis (`ioredis`)
- NestJS HTTP routes (via `@opentelemetry/instrumentation-nestjs-core`)
- Express middleware

No manual span creation needed for standard operations. Add manual spans for business logic that benefits from tracing (e.g., tool execution time breakdown).

## Manual Span Creation

```ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('mcp-tools');

async function executeWithTrace(toolName: string, fn: () => Promise<unknown>) {
  return tracer.startActiveSpan(`tool.${toolName}`, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

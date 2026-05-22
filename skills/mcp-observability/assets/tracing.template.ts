// Targets: @opentelemetry/sdk-node ^0.x, @opentelemetry/auto-instrumentations-node ^0.x
// CRITICAL: This file MUST be imported as the FIRST LINE of main.ts.
// Copy to: src/observability/tracing.ts

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
      // fs instrumentation is very noisy (every file read gets a span) — disable it
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

// Flush spans on graceful shutdown before the process exits
process.on('SIGTERM', () => {
  sdk.shutdown()
    .catch((err) => console.error('OTel shutdown error:', err))
    .finally(() => process.exit(0));
});

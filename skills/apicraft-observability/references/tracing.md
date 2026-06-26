# OpenTelemetry Tracing and Prometheus Metrics

**Authority:** opentelemetry.io/docs/languages/js/getting-started/nodejs

---

## OpenTelemetry Setup

```bash
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
npm install @opentelemetry/exporter-trace-otlp-http
```

> ⚠️ **Gotcha:** OpenTelemetry instrumentation must be initialized BEFORE any other `require`/`import`. Create a separate `tracing.ts` file and require it as the entry point, not inside the NestJS module lifecycle.

```typescript
// src/tracing.ts — MUST be the first file loaded
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceIdRatioBasedSampler } from '@opentelemetry/core';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const exporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME ?? 'api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
    environment: process.env.NODE_ENV ?? 'development',
  }),

  // Sample 10% of traces — adjust based on traffic volume and cost
  sampler: new TraceIdRatioBasedSampler(0.1),

  // Batch processor — don't export spans one at a time
  spanProcessors: [new BatchSpanProcessor(exporter)],

  instrumentations: [
    getNodeAutoInstrumentations({
      // Filter out health check and static asset traces — they add noise and cost
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) => {
          const url = req.url ?? '';
          return url.startsWith('/health') || url.includes('/favicon');
        },
      },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
```

Load before NestJS bootstrap:

```bash
# package.json start script
"start": "node -r ./dist/tracing dist/main"
```

Or use the `--require` flag in `Dockerfile` / PM2 config.

---

## Sampling Strategy

| Traffic level | Sampler | Ratio |
|--------------|---------|-------|
| < 100 req/s | `AlwaysOnSampler` | 100% |
| 100–1000 req/s | `TraceIdRatioBasedSampler` | 10% |
| > 1000 req/s | `TraceIdRatioBasedSampler` | 1–5% |
| Known slow paths | `ParentBasedSampler` + custom | Force-sample if latency > threshold |

---

## Prometheus Metrics

```bash
npm install @willsoto/nestjs-prometheus prom-client
```

> ⚠️ **Caveat:** `@willsoto/nestjs-prometheus` is a community package — vet its maintenance status before adopting.

```typescript
// app.module.ts
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true, // Node.js process metrics (CPU, memory, GC)
      },
      path: '/metrics', // Prometheus scrape endpoint
    }),
  ],
})
export class AppModule {}
```

Custom business metric:

```typescript
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

// In module providers:
makeCounterProvider({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['status'],
})

// In service:
@Injectable()
export class OrdersService {
  constructor(
    @InjectMetric('orders_created_total')
    private readonly ordersCreatedCounter: Counter<string>,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const order = await this.ordersRepository.create(dto);
    this.ordersCreatedCounter.inc({ status: order.status });
    return order;
  }
}
```

Protect the `/metrics` endpoint in production — it reveals internal system information:

```typescript
@Get('/metrics')
@UseGuards(InternalNetworkGuard) // only allow from monitoring network
metrics() { ... }
```

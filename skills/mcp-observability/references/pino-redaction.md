# Pino Redaction Reference

## Why Redact

MCP server logs commonly contain HTTP request headers, which include `Authorization: Bearer <token>` and `Cookie: session=<value>`. Without redaction, every request log leaks credentials — a critical GDPR/SOC 2 violation and a security incident if logs are shipped to a third-party service.

## Standard Redaction Path List

```ts
redact: {
  paths: [
    // HTTP headers
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-api-key"]',

    // Common credential field names anywhere in log objects
    '*.password',
    '*.passwd',
    '*.token',
    '*.secret',
    '*.access_token',
    '*.refresh_token',
    '*.api_key',
    '*.apiKey',
    '*.client_secret',
    '*.private_key',
    '*.privateKey',
    '*.jwt',
  ],
  remove: true,  // delete the field entirely; use 'censor' to replace with '[Redacted]'
}
```

Prefer `remove: true` over a censor string — it avoids leaking the field name in structured log analysis.

## nestjs-pino Configuration

```ts
LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',

    // Human-readable in dev; raw JSON in prod for log aggregators
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: true } }
      : undefined,

    // Request-ID correlation — adds req.id to every log line
    genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),

    // Customise which request fields are logged
    customLogLevel: (_req, res) =>
      res.statusCode >= 500 ? 'error' :
      res.statusCode >= 400 ? 'warn' : 'info',

    redact: { paths: [...], remove: true },
  },
})
```

## Log Levels

| Level | When to use |
|-------|-------------|
| `trace` | High-frequency debug (request bodies, SQL params) — never in production |
| `debug` | Developer debug — disable in production |
| `info` | Normal operation: request in/out, tool calls, startup |
| `warn` | Recoverable issues: auth failure, cache miss, throttled request |
| `error` | Unexpected failures: unhandled exception, dependency down |

Set via `LOG_LEVEL` env var.

## Replace NestJS Default Logger

```ts
// main.ts — AFTER NestFactory.create, before listen
app.useLogger(app.get(Logger));  // from 'nestjs-pino'
```

Without this, NestJS uses its own text-based logger for framework messages. After this line, all NestJS internal logs (bootstrap, module init, exception filters) go through pino.

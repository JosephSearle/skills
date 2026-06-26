---
name: apicraft-grpc
description: >
  gRPC with @nestjs/microservices: transport setup, proto file design best practices,
  ts-proto code generation, streaming patterns via RxJS Observable, error handling
  with RpcException and the nestjs-grpc-exceptions translation layer, gRPC vs REST
  decision rule, gRPC-Web proxy requirement for browsers, hybrid application pattern
  (HTTP + gRPC in one process), and health checks with @grpc/reflection. Requires
  apicraft-context to be loaded first.
  Triggers on: "gRPC", "proto", "microservice", "RpcException", "streaming",
  "Transport.GRPC", "protobuf", "ts-proto", "gRPC-Web", "bidirectional streaming",
  "hybrid application", "@grpc/grpc-js".
  Not for REST API design — use apicraft-rest-design.
version: 1.0.0
---

## Core Philosophy

gRPC's value over REST is strongest for internal service-to-service communication: binary protocol, HTTP/2 multiplexing, generated clients, and streaming. For browser-facing or public APIs, REST is almost always the right choice — browsers cannot speak raw gRPC without an Envoy proxy. The hybrid application pattern lets you serve both transports from the same NestJS app: REST for the public API, gRPC for internal calls from other services.

## Step 1 — Detect context

Load `apicraft-context` first. Identify what the user needs:

```
What is the task?
  ├─ Setting up gRPC transport → load references/grpc-setup.md §Transport setup
  ├─ Proto file design → load references/grpc-setup.md §Proto design
  ├─ ts-proto code generation → load references/grpc-setup.md §Code generation
  ├─ Streaming patterns → load references/grpc-patterns.md §Streaming
  ├─ Error handling → load references/grpc-patterns.md §Error handling
  ├─ Hybrid HTTP + gRPC app → load references/grpc-setup.md §Hybrid application
  └─ gRPC vs REST decision → load references/grpc-setup.md §Decision table
```

## Step 2 — Load references

| User need | Reference file |
|-----------|---------------|
| Transport setup, proto design, ts-proto, hybrid app, decision table | `references/grpc-setup.md` |
| Streaming, error handling, gRPC-Web, health checks | `references/grpc-patterns.md` |

## Step 3 — Execute

### gRPC vs REST decision

| Factor | gRPC | REST |
|--------|------|------|
| Target client | Internal services, generated clients | Browsers, public APIs, ad-hoc clients |
| Protocol | Binary (Protocol Buffers), HTTP/2 | Text (JSON), HTTP/1.1 or HTTP/2 |
| Latency | Lower for high-frequency calls | Higher (text serialization overhead) |
| Contract | `.proto` file (strict) | OpenAPI (optional) |
| Streaming | Native (server, client, bidirectional) | Server-sent events (one direction) |
| Browser support | Requires Envoy proxy | Native |
| Tooling | `grpcurl`, Postman (newer) | Universal |

> 💡 **Senior insight:** "We should use gRPC" is sometimes driven by cargo-cult microservice enthusiasm rather than actual requirements. gRPC is strictly better than REST only for: (1) internal service calls where you control both sides, (2) streaming use cases, (3) high-frequency calls where the 30-50% latency reduction is measurable. For everything else, the REST tooling, debuggability, and browser support are worth more than the performance gain.

→ See `references/grpc-setup.md` for transport configuration and `references/grpc-patterns.md` for streaming and error handling.

## Step 4 — Validate

- [ ] `.proto` package names are versioned (`com.company.service.v1`)
- [ ] `ts-proto` used for code generation with `nestJs=true` option
- [ ] `RpcException` thrown (not `HttpException`) for gRPC handler errors
- [ ] Hybrid app uses `connectMicroservice` + `startAllMicroservices()`
- [ ] gRPC-Web: Envoy proxy configured if browser clients are required
- [ ] Health check endpoint uses standard gRPC health-checking protocol

## Reference files

| File | Domain | Load when |
|------|--------|-----------|
| `references/grpc-setup.md` | Transport, proto design, ts-proto, hybrid app | Setting up gRPC |
| `references/grpc-patterns.md` | Streaming, error handling, gRPC-Web, reflection | Implementing gRPC patterns |

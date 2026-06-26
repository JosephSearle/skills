# gRPC Patterns — Streaming, Errors, gRPC-Web, Health

**Authority:** docs.nestjs.com/microservices/grpc

---

## Streaming via RxJS Observable

All streaming patterns in NestJS gRPC use `Observable` from RxJS:

```bash
npm install rxjs
```

### Server-Streaming (server sends multiple responses)

```typescript
import { Observable, Subject } from 'rxjs';
import { GrpcStreamMethod } from '@nestjs/microservices';

@GrpcMethod('UsersService', 'ListUsers')
listUsers(data: ListUsersRequest): Observable<GetUserResponse> {
  const subject = new Subject<GetUserResponse>();

  (async () => {
    const users = await this.usersService.findAll(data.pageSize);
    for (const user of users) {
      subject.next({ user });
    }
    subject.complete();
  })().catch((err) => subject.error(err));

  return subject.asObservable();
}
```

### Client-Streaming (client sends multiple requests)

```typescript
@GrpcStreamMethod('UsersService', 'ImportUsers')
importUsers(messages: Observable<CreateUserRequest>): Observable<ImportUsersResponse> {
  const subject = new Subject<ImportUsersResponse>();

  const results: string[] = [];

  messages.subscribe({
    next: async (request) => {
      const user = await this.usersService.create(request);
      results.push(user.id);
    },
    error: (err) => subject.error(err),
    complete: () => {
      subject.next({ importedIds: results });
      subject.complete();
    },
  });

  return subject.asObservable();
}
```

### Bidirectional Streaming

```typescript
@GrpcStreamMethod('ChatService', 'Chat')
chat(messages: Observable<ChatMessage>): Observable<ChatMessage> {
  const subject = new Subject<ChatMessage>();

  messages.subscribe({
    next: (message) => {
      // Echo back with a response
      subject.next({ text: `Server received: ${message.text}` });
    },
    error: (err) => subject.error(err),
    complete: () => subject.complete(),
  });

  return subject.asObservable();
}
```

---

## Error Handling

Use `RpcException` (not `HttpException`) for gRPC handler errors. gRPC has its own status codes:

```typescript
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

// Map domain errors to gRPC status codes
function toGrpcException(error: unknown): RpcException {
  if (error instanceof NotFoundException) {
    return new RpcException({ code: status.NOT_FOUND, message: error.message });
  }
  if (error instanceof ForbiddenException) {
    return new RpcException({ code: status.PERMISSION_DENIED, message: error.message });
  }
  if (error instanceof BadRequestException) {
    return new RpcException({ code: status.INVALID_ARGUMENT, message: error.message });
  }
  return new RpcException({ code: status.INTERNAL, message: 'Internal error' });
}
```

### Translating gRPC Errors at a Gateway Service

When a gateway NestJS app calls an internal gRPC service and needs to convert gRPC errors to HTTP responses:

```bash
npm install nestjs-grpc-exceptions
```

> ⚠️ **Caveat:** `nestjs-grpc-exceptions` is a community package — vet its maintenance status before adopting.

```typescript
import { GrpcServerExceptionFilter } from 'nestjs-grpc-exceptions';
import { GrpcToHttpInterceptor } from 'nestjs-grpc-exceptions';

// In the gateway app — translate gRPC codes to HTTP codes
app.useGlobalFilters(new GrpcServerExceptionFilter());
app.useGlobalInterceptors(new GrpcToHttpInterceptor());
```

**gRPC → HTTP status code mapping:**

| gRPC status | HTTP status |
|-------------|-------------|
| `NOT_FOUND` | 404 |
| `INVALID_ARGUMENT` | 400 |
| `ALREADY_EXISTS` | 409 |
| `PERMISSION_DENIED` | 403 |
| `UNAUTHENTICATED` | 401 |
| `UNAVAILABLE` | 503 |
| `INTERNAL` | 500 |

---

## gRPC-Web — Browser Access

Browsers cannot speak raw gRPC (HTTP/2 binary framing). If browser clients need to call gRPC services, you need an Envoy proxy:

```yaml
# envoy.yaml — basic gRPC-Web proxy config
static_resources:
  listeners:
    - address:
        socket_address: { address: 0.0.0.0, port_value: 8080 }
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                http_filters:
                  - name: envoy.filters.http.grpc_web
                  - name: envoy.filters.http.cors
                  - name: envoy.filters.http.router
                route_config:
                  virtual_hosts:
                    - domains: ["*"]
                      routes:
                        - match: { prefix: "/" }
                          route:
                            cluster: grpc_service
                            timeout: 0s
  clusters:
    - name: grpc_service
      type: LOGICAL_DNS
      http2_protocol_options: {}
      load_assignment:
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address: { socket_address: { address: app, port_value: 5000 } }
```

---

## Health Checks + Reflection

Standard gRPC health-checking protocol:

```bash
npm install @grpc/grpc-js
```

```typescript
import { HealthImplementation } from '@grpc/grpc-js/build/src/generated/grpc/health/v1/health';
```

`@grpc/reflection` enables `grpcurl` introspection without needing the `.proto` file:

```bash
npm install @grpc/reflection
```

```typescript
import { NestFactory } from '@nestjs/core';
import { ReflectionService } from '@grpc/reflection';

// Add reflection to the gRPC server
const server = app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.GRPC,
  options: {
    package: ['users.v1', 'grpc.reflection.v1alpha'],
    protoPath: [
      join(__dirname, '../proto/users.v1.proto'),
      join(__dirname, '../proto/reflection.proto'),
    ],
  },
});
```

Test with `grpcurl`:

```bash
# List services (requires reflection)
grpcurl -plaintext localhost:5000 list

# Call a method
grpcurl -plaintext -d '{"id": "abc-123"}' localhost:5000 com.company.users.v1.UsersService/GetUser
```

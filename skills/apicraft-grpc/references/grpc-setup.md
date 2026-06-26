# gRPC Setup — Transport, Proto Design, Code Generation

**Authority:** docs.nestjs.com/microservices/grpc

---

## Dependencies

```bash
npm install @nestjs/microservices @grpc/grpc-js @grpc/proto-loader
npm install --save-dev ts-proto
```

---

## Transport Setup (Standalone gRPC Server)

```typescript
// main.ts — pure gRPC microservice
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.GRPC,
    options: {
      package: 'users.v1',
      protoPath: join(__dirname, '../proto/users.v1.proto'),
      url: '0.0.0.0:5000',
    },
  });

  await app.listen();
}
bootstrap();
```

---

## Hybrid Application (HTTP + gRPC in Same Process)

The hybrid pattern lets one NestJS app serve REST (for public clients) and gRPC (for internal services):

```typescript
// main.ts — hybrid application
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Add gRPC transport alongside the HTTP server
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'users.v1',
      protoPath: join(__dirname, '../proto/users.v1.proto'),
      url: '0.0.0.0:5000',
    },
  });

  // Start HTTP server
  await app.startAllMicroservices(); // start gRPC (must be called before listen)
  await app.listen(3000);
}
```

---

## Proto File Best Practices

```protobuf
// proto/users.v1.proto

// Versioned package name — enables multiple versions to coexist
syntax = "proto3";
package com.company.users.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

service UsersService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
  rpc ListUsers(ListUsersRequest) returns (stream GetUserResponse); // server streaming
}

message User {
  string id = 1;              // explicit field numbers — never change these
  string email = 2;
  string name = 3;
  optional string phone = 4;  // optional for nullable fields
  google.protobuf.Timestamp created_at = 5; // use well-known types
}

message GetUserRequest {
  string id = 1;
}

message GetUserResponse {
  User user = 1;
}

message CreateUserRequest {
  string email = 1;
  string name = 2;
  optional string phone = 3;
}

message CreateUserResponse {
  User user = 1;
}

message ListUsersRequest {
  int32 page_size = 1;
  optional string page_token = 2;
}
```

**Proto design rules:**
1. Version the package name (`users.v1`, not `users`) — allows breaking changes via new versions
2. Never reuse a field number — deleted fields must be marked `reserved`
3. Use `optional` for nullable fields (proto3 default makes everything implicitly optional but doesn't express intent)
4. Use `google.protobuf.Timestamp` for dates (not strings)
5. Use `google.protobuf.Empty` for requests/responses with no fields

---

## ts-proto Code Generation

`ts-proto` generates strongly-typed NestJS-compatible interfaces:

```bash
# Install ts-proto
npm install --save-dev ts-proto

# Generate TypeScript from proto
protoc \
  --plugin=./node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=./src/generated \
  --ts_proto_opt=nestJs=true \
  --ts_proto_opt=addGrpcMetadata=true \
  --ts_proto_opt=addNestjsRestParameter=true \
  ./proto/users.v1.proto
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "proto:generate": "protoc --plugin=./node_modules/.bin/protoc-gen-ts_proto --ts_proto_out=./src/generated --ts_proto_opt=nestJs=true ./proto/**/*.proto"
  }
}
```

The generated file exports: the service interface (`UsersServiceController`), the client interface (`UsersServiceClient`), and DTOs (message types) — all fully typed.

---

## Controller Implementation

```typescript
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UsersServiceController, GetUserRequest, GetUserResponse } from '../generated/users.v1';

@Controller()
export class UsersGrpcController implements UsersServiceController {
  constructor(private readonly usersService: UsersService) {}

  @GrpcMethod('UsersService', 'GetUser')
  async getUser(data: GetUserRequest): Promise<GetUserResponse> {
    const user = await this.usersService.findById(data.id);
    if (!user) {
      throw new RpcException({ code: Status.NOT_FOUND, message: `User ${data.id} not found` });
    }
    return { user };
  }
}
```

# ITZ MCP Template — Tool Patterns Reference

Canonical patterns for writing, registering, and testing tools on servers built from the ITZ
NestJS MCP server template. Every example in this document is derived directly from the
template source code and must be treated as the authoritative standard.

---

## File Structure

Tool files live in `src/tools/`. Each tool is a NestJS `@Injectable()` service with one or
more `@Tool()`-decorated methods. Related tools may share a single file (as `calculator.tool.ts`
demonstrates). Unrelated tools must be in separate files.

```
src/tools/
  greeting.tool.ts       # single-concern tool
  greeting.tool.spec.ts  # co-located test — mandatory
  calculator.tool.ts     # multiple related tools in one service
  calculator.tool.spec.ts
  my-domain.tool.ts      # your new tool
  my-domain.tool.spec.ts # your new test
```

**Naming:** `<domain>.tool.ts` — lowercase kebab-case, `.tool.ts` suffix. No abbreviations.

---

## Canonical Import Block

Every tool file that uses auth or errors must include these imports. Copy verbatim and remove
what you do not use — do not add imports not in this list without justification.

```ts
import { Tool, ToolRoles } from '@rekog/mcp-nest';
import type { Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { Request } from 'express';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { User } from '../auth/interfaces/user.interface';
import { AbilityService } from '../auth/ability.service';
import { ToolBusinessError } from '../errors/tool-business.error';
```

For public tools (no auth):
```ts
import { Tool } from '@rekog/mcp-nest';
import type { Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
```

---

## Zod Schema Rules

The `ValidationPipe` is configured with `whitelist: true` and `forbidNonWhitelisted: true`.
Every tool schema must satisfy these constraints:

### Required on every field
```ts
// Every field MUST have .describe() — it is the LLM's only documentation for that field.
name: z.string().max(500).default('World').describe('The name to greet'),
formal: z.boolean().optional().default(false).describe('Whether to use formal language'),
```

### String fields
```ts
// All strings must have a .max() bound:
name: z.string().max(500).describe('...')

// Closed sets must use z.enum():
status: z.enum(['active', 'inactive', 'pending']).describe('...')

// URLs must use .url():
endpoint: z.string().url().describe('...')

// Strings flowing into identifiers must use .uuid() or .regex():
id: z.string().uuid().describe('...')
```

### Numeric fields
```ts
// All numeric fields must have .min() and .max():
page: z.number().int().min(1).max(1000).default(1).describe('...')
limit: z.number().int().min(1).max(100).default(20).describe('...')
```

### Forbidden patterns
```ts
// Never use — defeats the whitelist:
z.any()
z.unknown()
z.record(z.string(), z.any())
```

### Export the schema
Always export the schema const separately from the class so it can be imported in tests:
```ts
export const MyToolSchema = z.object({ ... });
```

---

## Authorisation

### Role gate — @ToolRoles

Apply `@ToolRoles` on every `@Tool()` method. It runs before the handler.

```ts
@Tool({ name: 'orders_list', ... })
@ToolRoles(['user'])                  // standard authenticated user
async listOrders(...) {}

@Tool({ name: 'orders_delete', ... })
@ToolRoles(['admin'])                 // privileged operation — admin only
async deleteOrder(...) {}

@Tool({ name: 'health-check', ... })
// No @ToolRoles — this tool uses @PublicTool() semantics (no auth required)
healthCheck(...) {}
```

### CASL ability check — AbilityService

Apply inside the handler for data-access tools. The `if (request && ...)` guard is mandatory —
`request` is `undefined` in STDIO transport.

```ts
// Read operation:
if (request && !this.abilityService.can(request.user, 'read', 'Order')) {
  throw new ForbiddenException('Insufficient permissions to list orders.');
}

// Write operation:
if (request && !this.abilityService.can(request.user, 'write', 'Order')) {
  throw new ForbiddenException('Insufficient permissions to create an order.');
}
```

CASL action strings (`'read'`, `'write'`, `'delete'`, `'manage'`) must match what the gateway
embeds in the JWT ability claims. Check with the platform team if unsure what actions are
defined for your resource type.

### Accessing the authenticated user

```ts
// In the handler signature:
async myTool(
  params: { id: string },
  context: Context,
  request?: Request & { user?: User },
): Promise<string> {
  // Safe access — request is undefined in STDIO mode:
  const callerName = request?.user?.displayName ?? 'unknown';
  const callerId   = request?.user?.userid ?? request?.user?.sub;
}
```

The `User` interface (from `auth/interfaces/user.interface.ts`) exposes:
- `id` — JWT `id` claim
- `sub` — JWT `sub` claim
- `userid` — ITZ user ID
- `email`, `displayName` — display info
- `roles` — string array of role names
- `persona` — user's ITZ persona
- `token` — upstream token (do not forward this to external services)
- `ability` — CASL ability array (passed to `AbilityService`)

---

## Error Channels

Choose the right channel. The wrong choice either hides failures from the LLM (making it
unable to self-correct) or leaks internals (security risk).

### ToolBusinessError — LLM-visible

Use when the LLM should see the failure and may be able to retry with different parameters.

```ts
import { ToolBusinessError } from '../errors/tool-business.error';

// Entity not found:
throw new ToolBusinessError('Order not found', 'ORDER_NOT_FOUND');

// Business rule violation:
throw new ToolBusinessError('Cannot cancel a shipped order', 'INVALID_STATE');

// Reserved keyword (see greeting.tool.ts example):
throw new ToolBusinessError('Cannot greet this name: reserved keyword', 'RESERVED_NAME');
```

`ToolBusinessError` constructor: `(message: string, code?: string, details?: unknown)`.
The `McpExceptionFilter` catches it and sets `result.isError: true` — the LLM receives the
message and can self-correct.

### NestJS HTTP exceptions — NOT LLM-visible

Use for auth failures, internal errors, and anything the LLM cannot act on.

```ts
import {
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

// Permission denied (after CASL check):
throw new ForbiddenException('Insufficient permissions.');

// Unexpected internal error (DB down, upstream 500):
throw new InternalServerErrorException('Failed to reach orders service.');

// Tool or resource not found (wrong method name etc.):
throw new NotFoundException('Resource type unknown.');
```

`McpExceptionFilter` maps these to JSON-RPC error codes. The LLM does not see the message.

---

## AppModule Registration

New tools must be added to **both** the `imports` block (if they have their own module) and
the `providers` array in `src/app.module.ts`. Most tools are simple `@Injectable()` services
and only need the `providers` entry.

```ts
// src/app.module.ts

import { MyDomainTool } from './tools/my-domain.tool'; // ← add import

@Module({
  providers: [
    AppService,
    HealthService,
    AbilityService,
    GreetingTool,
    CalculatorTool,
    MyDomainTool,          // ← add provider
    TechzoneAuthGuard,
    ThrottlerBehindProxyGuard,
    { provide: APP_FILTER, useClass: McpExceptionFilter },
  ],
})
export class AppModule {}
```

**Common mistake:** Forgetting to add to `providers`. The server starts without error but the
tool is silently absent from the MCP tool listing.

---

## ConfigService — Reading Env Vars

Never read `process.env.MY_VAR` directly in a tool. Inject `ConfigService` and read through it.
This ensures the env var was validated at startup by `env.validation.ts`.

```ts
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

@Injectable()
export class MyDomainTool {
  constructor(
    private readonly abilityService: AbilityService,
    private readonly config: ConfigService<Env>,
  ) {}

  async myTool(...) {
    const upstreamUrl = this.config.get('SOME_API_URL', { infer: true });
  }
}
```

If your tool needs a new env var, add it to the Zod schema in `src/config/env.validation.ts`:
```ts
export const envSchema = z.object({
  // ... existing fields ...
  SOME_API_URL: z.string().url(),  // ← add here, server validates at startup
});
```

---

## Testing

### File location
Tests are co-located with source: `src/tools/my-domain.tool.spec.ts`.

### Module setup pattern
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { MyDomainTool } from './my-domain.tool';
import { AbilityService } from '../auth/ability.service';
import { ToolBusinessError } from '../errors/tool-business.error';
import type { Context } from '@rekog/mcp-nest';
import type { Request } from 'express';
import type { User } from '../auth/interfaces/user.interface';

const mockContext = {} as Context;

const mockUser: Partial<User> = {
  id: 'user-123',
  userid: 'user-123',
  displayName: 'Test User',
  roles: ['user'],
  ability: [],
};

const mockRequest = {
  user: mockUser,
} as unknown as Request & { user?: User };
```

### Four mandatory test paths

```ts
describe('MyDomainTool', () => {
  let tool: MyDomainTool;
  let abilityService: jest.Mocked<AbilityService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyDomainTool,
        {
          provide: AbilityService,
          useValue: { can: jest.fn(), subject: jest.fn() },
        },
      ],
    }).compile();

    tool = module.get<MyDomainTool>(MyDomainTool);
    abilityService = module.get(AbilityService);
  });

  // Path 1: Happy path — authorised user, valid input
  it('returns expected result for authorised user', async () => {
    abilityService.can.mockReturnValue(true);
    const result = await tool.myMethod({ id: 'valid-id' }, mockContext, mockRequest);
    expect(result).toEqual(expect.objectContaining({ /* expected shape */ }));
  });

  // Path 2: CASL denied
  it('throws ForbiddenException when CASL denies', async () => {
    abilityService.can.mockReturnValue(false);
    await expect(
      tool.myMethod({ id: 'valid-id' }, mockContext, mockRequest),
    ).rejects.toThrow(ForbiddenException);
  });

  // Path 3: Business error
  it('throws ToolBusinessError for known bad business state', async () => {
    abilityService.can.mockReturnValue(true);
    await expect(
      tool.myMethod({ id: 'RESERVED' }, mockContext, mockRequest),
    ).rejects.toThrow(ToolBusinessError);
  });

  // Path 4: STDIO mode — no request object
  it('skips CASL check and returns result in STDIO mode', async () => {
    const result = await tool.myMethod({ id: 'valid-id' }, mockContext, undefined);
    expect(result).toBeDefined();
  });
});
```

### Running tests
```bash
npm run test                # all unit tests
npm run test:cov            # with coverage report
npm run test -- --testPathPattern=my-domain  # single file
```

---

## Tool Naming — CIO Character Rules

Tool names are validated by the Enterprise MCP Gateway. Names that violate these rules will
cause the gateway to reject the server entirely or prevent agents from loading individual tools.

### Valid characters

| Rule | Detail |
|---|---|
| Must **start** with a letter | `a–z` or `A–Z` — digits and underscores are not valid first characters |
| May contain letters | `a–z`, `A–Z` |
| May contain digits | `0–9` |
| May contain underscores | `_` |
| Must **not** contain | Spaces, periods (`.`), colons (`:`), hyphens (`-`), or any other special character |

### Examples

| Tool Name | Valid? | Reason |
|---|---|---|
| `incident_create` | ✅ | Starts with letter, underscores only |
| `user2profile` | ✅ | Digit after letter is allowed |
| `orders_list` | ✅ | Standard `domain_verb` pattern |
| `list-users` | ❌ | Hyphens are not allowed |
| `2create_ticket` | ❌ | Cannot start with a digit |
| `create.ticket` | ❌ | Periods are not allowed |
| `snow:incident` | ❌ | Colons are not allowed |
| `create ticket` | ❌ | Spaces are not allowed |
| `inventory.tool.search` | ❌ | Periods not allowed (common ServiceNow pitfall) |

### Backend name translation

Backend systems (ServiceNow, Ansible, vendor APIs) often use names with periods or colons
that are illegal in MCP tool names. These must be translated:

| Backend name | MCP tool name |
|---|---|
| `incident.create.record` | `incident_create_record` |
| `snow:incident:resolve` | `incident_resolve` |
| `change-request.approve` | `change_request_approve` |

Document the mapping in the server's README so consumers know what backend operation each
tool corresponds to.

---

## Complete Example — Minimal Authenticated Tool

A complete, copy-paste-ready example following all template conventions:

```ts
// src/tools/orders.tool.ts

import { Tool, ToolRoles } from '@rekog/mcp-nest';
import type { Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { Request } from 'express';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { User } from '../auth/interfaces/user.interface';
import { AbilityService } from '../auth/ability.service';
import { ToolBusinessError } from '../errors/tool-business.error';

export const OrdersGetSchema = z.object({
  orderId: z.string().uuid().describe('The UUID of the order to retrieve'),
});

@Injectable()
export class OrdersTool {
  constructor(private readonly abilityService: AbilityService) {}

  @Tool({
    name: 'orders_get',
    description: 'Retrieves a single order by its UUID. Returns order details including status and line items.',
    parameters: OrdersGetSchema,
  })
  @ToolRoles(['user'])
  async ordersGet(
    { orderId }: { orderId: string },
    _context: Context,
    request?: Request & { user?: User },
  ): Promise<{ orderId: string; status: string }> {
    if (request && !this.abilityService.can(request.user, 'read', 'Order')) {
      throw new ForbiddenException('Insufficient permissions to read orders.');
    }

    // Simulate order not found:
    if (orderId === '00000000-0000-0000-0000-000000000000') {
      throw new ToolBusinessError('Order not found', 'ORDER_NOT_FOUND');
    }

    return { orderId, status: 'active' };
  }
}
```

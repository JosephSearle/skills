# Error Channels Reference

MCP tools have two distinct error channels. Using the wrong one is the most common tool implementation mistake.

## The Two Channels

| Channel | Mechanism | Visible to LLM? | Use for |
|---------|-----------|:---:|---------|
| Protocol error | JSON-RPC `error` object (`{ code, message, data }`) | **No** | Schema failures, method-not-found, internal crashes |
| Business error | `{ content: [...], isError: true }` in `result` | **Yes** | Domain failures the model should self-correct on |

---

## Decision Tree

```
Did Zod reject the input?
  └─ SDK returns -32602 automatically — do nothing

Is this a failure the LLM caused and can fix by trying differently?
  (entity not found, quota exceeded, invalid business rule, permission denied)
  └─ return { content: [{ type: 'text', text: '<reason>' }], isError: true }

Is this an unexpected infrastructure failure?
  (DB down, upstream API 500, bug in your code)
  └─ throw new McpError(ErrorCode.InternalError, '<reason>')
  → SDK wraps in JSON-RPC -32603 (host handles, LLM never sees)
```

---

## Code Examples

### Business error (isError: true)

```ts
import { Tool, Context } from '@rekog/mcp-nest';

async findCustomer({ customerId }: { customerId: string }, ctx: Context) {
  const customer = await this.db.customers.findById(customerId);

  if (!customer) {
    // LLM sees this and can retry with a different ID or inform the user
    return {
      content: [{ type: 'text', text: `Customer ${customerId} not found.` }],
      isError: true,
    };
  }

  return { content: [{ type: 'text', text: JSON.stringify(customer) }] };
}
```

### Internal error (throw)

```ts
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

async findCustomer({ customerId }: { customerId: string }) {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await this.db.find(customerId)) }] };
  } catch (err) {
    if (err instanceof DatabaseConnectionError) {
      // Infrastructure failure — host logs it; LLM gets no details
      throw new McpError(ErrorCode.InternalError, 'Database unavailable');
    }
    throw err;
  }
}
```

### Zod auto-rejection (nothing to do)

```ts
@Tool({
  parameters: z.object({
    email: z.string().email().describe('Customer email'),
  }),
  // ...
})
async search({ email }: { email: string }) {
  // If the LLM sends a non-email string, the SDK rejects it with -32602
  // before this method is called — no code needed here
}
```

---

## Graceful degradation

When a backend is degraded (slow, partially available), prefer `isError: true` with a hint over a JSON-RPC throw:

```ts
// Good: LLM can inform the user and try later
return {
  content: [{ type: 'text', text: 'Search service is temporarily unavailable. Please try again in a moment.' }],
  isError: true,
};

// Bad: LLM sees nothing, user gets a confusing error
throw new McpError(ErrorCode.InternalError, 'Service unavailable');
```

---

## Standard JSON-RPC Error Codes

| Code | Name | Auto-generated? |
|------|------|:---:|
| -32602 | Invalid params | Yes (Zod rejection) |
| -32603 | Internal error | No — throw `McpError` |
| -32002 | Resource not found | No — throw `McpError` |
| -32800 | Request cancelled | Yes (cancellation signal) |

Custom codes outside -32768 to -32000 are application-defined and never seen by the LLM.

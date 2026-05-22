# URI Schemes Reference

## Conventions

| Scheme | When to use | Example |
|--------|-------------|---------|
| `mcp://<server-name>/<path>` | MCP-native content owned by this server | `mcp://orders-api/customers/123` |
| `file:///<absolute-path>` | Local filesystem content exposed by a stdio server | `file:///home/user/project/README.md` |
| `https://<domain>/<path>` | Resources that mirror or augment a web URL | `https://api.example.com/customers/123` |

Pick one scheme per resource category and be consistent. Mixing `mcp://` and `https://` for the same type of resource confuses clients.

---

## RFC 6570 URI Templates

URI templates define parameterised resource URIs. `@rekog/mcp-nest` uses `path-to-regexp` (Express-style) to parse them.

**Simple variable substitution:**
```
mcp://my-server/customers/{customerId}
→ matches: mcp://my-server/customers/123abc
→ extracts: { customerId: '123abc' }
```

**Multiple parameters:**
```
mcp://my-server/orders/{orderId}/items/{itemId}
→ extracts: { orderId: '...', itemId: '...' }
```

**Optional segments** (path-to-regexp syntax):
```
mcp://my-server/reports{/year}{/month}
→ matches: mcp://my-server/reports/2026/05
→ matches: mcp://my-server/reports/2026
```

---

## Completion Handler

Completion lets clients autocomplete URI template parameters. The `completion/complete` request includes the partial value typed by the user.

```ts
// Register alongside the @ResourceTemplate
@Injectable()
export class CustomerResourceProvider {
  constructor(private readonly customerService: CustomerService) {}

  @ResourceTemplate({
    uriTemplate: 'mcp://my-server/customers/{customerId}',
    name: 'customer_profile',
    description: 'Customer profile data.',
    mimeType: 'application/json',
  })
  async getCustomer({ customerId }: { customerId: string }) {
    const customer = await this.customerService.findById(customerId);
    if (!customer) throw new McpError(ErrorCode.ResourceNotFound, 'Not found');
    return {
      contents: [{
        uri: `mcp://my-server/customers/${customerId}`,
        mimeType: 'application/json',
        text: JSON.stringify(customer),
      }],
    };
  }
}
```

Completion is only active when the server declares `completions: {}` in capabilities.

---

## Subscriptions (Stateful Mode Only)

`resources/subscribe` allows clients to receive notifications when a resource changes.

```ts
capabilities: {
  resources: { listChanged: true, subscribe: true },
}

// Emit notification when a resource changes
// (call from your service when the underlying data changes)
mcpServer.emitResourceUpdated('mcp://my-server/customers/123');
```

**Constraint:** subscriptions require stateful mode (`statelessMode: false`). Never declare `subscribe: true` in capabilities when running stateless — the client will attempt to `GET /mcp` for an SSE stream that the server will not maintain.

# Resource Types Reference

## Static Resources

Static resources have a fixed URI. Use for documents, configuration, or datasets that don't vary per-user or per-entity.

```ts
@Injectable()
export class ServerConfigResource {
  @Resource({
    uri:         'mcp://my-server/config',
    name:        'server_config',
    description: 'Server configuration and supported capabilities.',
    mimeType:    'application/json',
  })
  async getConfig() {
    return {
      contents: [{
        uri:      'mcp://my-server/config',
        mimeType: 'application/json',
        text: JSON.stringify({
          version: '1.0.0',
          features: ['search', 'create', 'audit'],
        }),
      }],
    };
  }
}
```

---

## Dynamic (Templated) Resources

Dynamic resources are parameterised by URI template. Use for per-entity data (users, orders, files).

```ts
@Injectable()
export class OrderResource {
  constructor(private readonly ordersService: OrdersService) {}

  @ResourceTemplate({
    uriTemplate: 'mcp://my-server/orders/{orderId}',
    name:        'order',
    description: 'Order details including line items and status.',
    mimeType:    'application/json',
  })
  async getOrder({ orderId }: { orderId: string }) {
    const order = await this.ordersService.findById(orderId);
    if (!order) {
      throw new McpError(ErrorCode.ResourceNotFound, `Order ${orderId} not found`);
    }
    return {
      contents: [{
        uri:      `mcp://my-server/orders/${orderId}`,
        mimeType: 'application/json',
        text:     JSON.stringify(order),
      }],
    };
  }
}
```

---

## Content Types

Resources can return text or binary content:

```ts
// Text content
contents: [{ uri, mimeType: 'text/markdown', text: '# Hello' }]

// Binary content (base64)
contents: [{ uri, mimeType: 'image/png', blob: base64String }]
```

Use `text` for human-readable formats (JSON, Markdown, plain text, HTML).
Use `blob` for binary formats (images, PDFs, archives).

---

## MIME Type Reference

| Content | MIME type |
|---------|-----------|
| JSON data | `application/json` |
| Plain text | `text/plain` |
| Markdown | `text/markdown` |
| HTML | `text/html` |
| CSV | `text/csv` |
| YAML | `application/yaml` |
| PDF | `application/pdf` |
| PNG image | `image/png` |
| JPEG image | `image/jpeg` |
| Generic binary | `application/octet-stream` |

Always set `mimeType` explicitly — clients use it to decide how to render or process the content.

---

## List Resources

The `resources/list` method returns all available resources. `@rekog/mcp-nest` auto-discovers registered `@Resource` and `@ResourceTemplate` providers and populates the list.

For static resources, the full URI appears in the list. For templates, the URI template appears with `uriTemplate` populated and `uri` absent.

If `listChanged: true` is declared in capabilities, the server can notify clients when the list changes by calling `mcpServer.emitResourcesListChanged()`.

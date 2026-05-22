# Zod Patterns Reference

Common Zod schema recipes for MCP tool inputs. Every field MUST have `.describe()`.

## String Patterns

```ts
// Email
email: z.string().email().describe('Valid email address of the customer')

// UUID primary key
id: z.string().uuid().describe('UUID of the resource to operate on')

// URL (SSRF guard: validate before fetching)
url: z.string().url().describe('HTTPS URL to fetch — must begin with https://')

// Slug / identifier (no shell metacharacters)
slug: z.string().regex(/^[a-z0-9-]+$/).max(100)
      .describe('URL slug: lowercase letters, digits, and hyphens only')

// Enum (always prefer over free string for closed sets)
status: z.enum(['active', 'inactive', 'pending'])
        .describe('Account status: active | inactive | pending')

// Non-empty string
name: z.string().min(1).max(255)
      .describe('Display name of the resource — 1 to 255 characters')

// Freeform text with length guard
body: z.string().max(10_000)
      .describe('Message body — plain text, maximum 10 000 characters')
```

---

## Numeric Patterns

```ts
// Pagination
limit: z.number().int().min(1).max(100).default(20)
       .describe('Maximum results to return — 1 to 100, default 20')

offset: z.number().int().min(0).default(0)
        .describe('Zero-based offset for pagination')

// Bounded integer
retries: z.number().int().min(0).max(5).default(3)
         .describe('Number of retry attempts on failure — 0 to 5')

// Positive float
threshold: z.number().min(0).max(1)
           .describe('Similarity threshold between 0.0 (loose) and 1.0 (exact)')
```

---

## Object and Array Patterns

```ts
// Nested object
address: z.object({
  street: z.string().min(1).describe('Street address'),
  city:   z.string().min(1).describe('City name'),
  country: z.enum(['US', 'GB', 'DE', 'FR']).describe('ISO 3166-1 alpha-2 country code'),
}).describe('Mailing address')

// Array with bounds
tags: z.array(z.string().max(50)).max(20)
      .describe('List of tags — maximum 20 tags, each up to 50 characters')

// Optional field with default
format: z.enum(['json', 'csv', 'markdown']).default('json')
        .describe('Output format: json | csv | markdown — default json')
```

---

## Security-Critical Patterns

```ts
// File path — prevent directory traversal
filePath: z.string()
           .regex(/^[a-zA-Z0-9._/-]+$/)
           .refine(p => !p.includes('..'), 'Directory traversal not allowed')
           .describe('Relative file path within the project root')

// SQL filter value — never interpolate directly; use parameterised queries
// The schema constrains what the LLM can pass; parameterisation handles the rest
searchTerm: z.string().max(200)
            .describe('Search term for full-text filtering')

// Shell argument — use execFile(cmd, [arg]) not exec(`cmd ${arg}`)
// Schema limits what values can reach execFile
targetHost: z.string()
             .regex(/^[a-zA-Z0-9.-]+$/)
             .describe('Hostname to ping — letters, digits, dots, and hyphens only')
```

---

## Zod and @rekog/mcp-nest Integration

`@rekog/mcp-nest` passes the Zod schema to `@modelcontextprotocol/sdk`, which converts it to JSON Schema for the wire. The SDK also calls `.parse()` at runtime — Zod rejections become automatic `-32602` responses without any extra code.

```ts
@Tool({
  name: 'orders_create',
  description: 'Create a new order for a customer.',
  parameters: z.object({
    customerId: z.string().uuid().describe('UUID of the customer placing the order'),
    items: z.array(z.object({
      sku:      z.string().regex(/^[A-Z0-9-]+$/).describe('Product SKU'),
      quantity: z.number().int().min(1).max(999).describe('Quantity to order'),
    })).min(1).max(50).describe('Order line items — 1 to 50 items'),
    currency: z.enum(['USD', 'EUR', 'GBP']).describe('Payment currency'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
})
async createOrder({ customerId, items, currency }, ctx: Context) { ... }
```

# Per-Tool Authorization Reference

## Decorator Overview

`@rekog/mcp-nest` provides three decorators for per-tool authorization:

| Decorator | Use | Auth required? |
|-----------|-----|:---:|
| `@PublicTool()` | Mark tool as unauthenticated | No |
| `@ToolScopes(['scope'])` | Require all listed OAuth scopes | Yes |
| `@ToolRoles(['role'])` | Require all listed roles from JWT | Yes |

These decorators work with any `CanActivate` guard that populates `request.user.scopes` and `request.user.roles`.

---

## Usage Patterns

```ts
import { PublicTool, ToolScopes, ToolRoles } from '@rekog/mcp-nest';

// No auth needed (health check, public info)
@PublicTool()
@Tool({ name: 'server_info', ... })
async serverInfo() { ... }

// Requires 'orders:read' scope in the JWT
@ToolScopes(['orders:read'])
@Tool({ name: 'orders_list', ... })
async listOrders() { ... }

// Requires both scopes (AND logic)
@ToolScopes(['orders:write', 'customers:read'])
@Tool({ name: 'orders_create', ... })
async createOrder() { ... }

// Requires 'admin' role
@ToolRoles(['admin'])
@Tool({ name: 'customers_delete', ... })
async deleteCustomer() { ... }
```

---

## Guard Composition

The scope/role check runs inside `McpScopesGuard` or `McpRolesGuard`, which must be registered alongside the JWT guard:

```ts
McpModule.forRoot({
  guards: [JwtGuard, McpScopesGuard],  // JWT first, then scope check
})
```

`McpScopesGuard` reads `@ToolScopes` metadata from the handler and compares against `request.user.scopes`. If the user's scopes do not contain all required scopes, it returns 403.

---

## Naming Inconsistency

The `JosephSearle/mcp-nestjs-template` README examples use `@RequireScopes` and `@RequireRoles`, which are the template's custom wrapper decorators. The canonical `@rekog/mcp-nest` package uses `@ToolScopes` and `@ToolRoles`.

When auditing existing code: accept both names as valid.
When generating new code: emit `@ToolScopes` and `@ToolRoles` (canonical upstream names).

---

## Scope Design

Design scopes at the resource-action level:

```
<resource>:<action>

orders:read     # list and get orders
orders:write    # create and update orders
orders:delete   # delete orders
customers:read
customers:write
admin           # superuser — grants all actions
```

Avoid overly granular scopes (per-tool scopes) — they become unmaintainable.
Avoid overly broad scopes (single `api:access`) — they don't provide meaningful access control.

---

## Context Access for Runtime Checks

For dynamic authorization (ownership checks, tenant isolation) that can't be expressed statically:

```ts
@ToolScopes(['orders:read'])
@Tool({ name: 'orders_get', parameters: z.object({ orderId: z.string().uuid().describe('Order ID') }) })
async getOrder({ orderId }: { orderId: string }, ctx: Context) {
  const user = ctx.request?.user as RequestUser;
  const order = await this.ordersService.findById(orderId);
  if (!order) return { content: [{ type: 'text', text: 'Order not found.' }], isError: true };

  // Ownership check — prevent horizontal privilege escalation
  if (order.customerId !== user.sub && !user.roles.includes('admin')) {
    return { content: [{ type: 'text', text: 'Access denied.' }], isError: true };
  }

  return { content: [{ type: 'text', text: JSON.stringify(order) }] };
}
```

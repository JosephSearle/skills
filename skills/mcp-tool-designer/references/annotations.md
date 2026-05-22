# Tool Annotations Reference

Introduced in MCP spec 2025-03-26. Annotations are **hints** — they guide client UX but are not security contracts. Runtime enforcement belongs in auth guards, not annotations.

## The Five Hints

| Hint | Type | Default | Meaning when `true` |
|------|------|---------|---------------------|
| `readOnlyHint` | boolean | `false` | Tool does not modify any state |
| `destructiveHint` | boolean | `true` | Tool may delete or irreversibly overwrite data |
| `idempotentHint` | boolean | `false` | Repeated calls with identical args produce the same result with no additional effect |
| `openWorldHint` | boolean | `true` | Tool may interact with external services or the open internet |
| `title` | string | — | Human-readable display name (shown in client UI instead of the technical name) |

---

## Decision Table

| Tool behaviour | readOnlyHint | destructiveHint | idempotentHint | openWorldHint |
|---------------|:---:|:---:|:---:|:---:|
| Pure read (GET, search, lookup) | `true` | `false` | `true` | `false` (internal) / `true` (API) |
| Create new record (non-idempotent) | `false` | `false` | `false` | `false` |
| Upsert / PUT-style (idempotent write) | `false` | `false` | `true` | `false` |
| Soft delete or archive | `false` | `false` | `true` | `false` |
| Hard delete | `false` | `true` | `false` | `false` |
| Overwrite / replace | `false` | `true` | `false` | `false` |
| Send email / notification | `false` | `false` | `false` | `true` |
| Call external REST API (read) | `true` | `false` | `true` | `true` |
| Call external REST API (write) | `false` | `false` | `false` | `true` |

**When uncertain:** default to `destructiveHint: true`. It is safer to over-warn than to under-warn.

---

## Client-Side Behaviour (Why Hints Matter)

| Client | Reads readOnlyHint | Reads destructiveHint | Reads openWorldHint |
|--------|-------------------|-----------------------|---------------------|
| Claude Code | Parallelises tools with `readOnlyHint: true` | Shows confirmation prompt | — |
| Claude.ai | Groups read tools for batch display | Shows warning badge | — |
| ChatGPT dev mode | Shows READ badge | Shows WRITE badge | — |

Forgetting `readOnlyHint: true` on a search tool prevents Claude Code from parallelising calls that are safe to run concurrently. Forgetting `destructiveHint: true` on a delete tool skips the client-side confirmation that protects users from accidental data loss.

---

## Setting Annotations in @rekog/mcp-nest

```ts
@Tool({
  name: 'customers_search',
  description: 'Search customers by email address.',
  parameters: z.object({
    email: z.string().email().describe('Email address to search for'),
  }),
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    title: 'Search Customers',
  },
})
async search(...) { ... }
```

---

## Common Mistakes

| Mistake | Impact | Fix |
|---------|--------|-----|
| Omitting all annotations | Client assumes `destructiveHint: true, openWorldHint: true` — every tool shows as dangerous | Explicitly set all four hints |
| Setting `readOnlyHint: true` on a tool that creates records | Client parallelises unsafe calls | Audit with T003 |
| Setting `destructiveHint: false` on a hard-delete tool | No client confirmation; user may lose data | Set `destructiveHint: true` |
| Treating annotations as access control | Malicious server can lie; annotations are informational only | Enforce via `@ToolScopes`/guards |

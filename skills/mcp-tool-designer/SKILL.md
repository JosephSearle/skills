---
name: mcp-tool-designer
description: >
  Designs and audits MCP tool definitions in NestJS using @rekog/mcp-nest. Generates
  @Tool-decorated providers with Zod input schemas, correct tool annotations
  (readOnlyHint, destructiveHint, idempotentHint, openWorldHint), and proper error-channel
  selection (JSON-RPC protocol errors vs isError business errors). Audits existing tool
  code for missing descriptions, unsafe annotations, schema gaps, and incorrect error handling.
  Use when the user asks to "create an MCP tool", "add a tool", "review my tools", "audit tool
  definitions", "tool annotations", "destructive tool", "idempotent tool", "Zod schema for MCP",
  or help with tools/call error handling in NestJS. Do NOT use for resource/prompt design
  (→ mcp-resource-prompt-designer) or auth scopes (→ mcp-auth-guardian).
---

# MCP Tool Designer

Generates and audits `@Tool`-decorated NestJS providers for MCP servers. Targets
MCP spec 2025-11-25 annotation semantics and `@rekog/mcp-nest` ^1.0.0.

---

## Mode: GENERATE

Use when the user wants new tool code.

### GENERATE Checklist

- [ ] Step 1 — Confirm tool intent (read vs write, idempotent vs not, internal vs open-world)
- [ ] Step 2 — Draft Zod schema with `.describe()` on every field
- [ ] Step 3 — Select annotations from the decision table
- [ ] Step 4 — Pick error channel for each failure path
- [ ] Step 5 — Emit the tool from `assets/tool.template.ts`
- [ ] Step 6 — Draft a Jest unit test covering all four paths

---

### Step 1 — Tool intent questions

Answer all four before writing any code:

| Question | Controls |
|----------|---------|
| Does it modify state? | `readOnlyHint` |
| If yes, is repeating it with the same args safe? | `idempotentHint` |
| Can it delete or irreversibly overwrite? | `destructiveHint` |
| Does it call the open internet or external APIs? | `openWorldHint` |

---

### Step 2 — Zod schema rules

- Every property MUST have `.describe(...)` — this text is the LLM's only guidance for that field.
- Closed sets MUST use `z.enum([...])` not `z.string()`.
- Strings flowing into shells, SQL, or URLs MUST have `.regex(...)` or `.url()` constraints.
- Numeric fields MUST have `.min()` / `.max()` bounds.
- Use `.default()` for optional fields with sensible fallbacks.
- `z.object({ ... })` at the top level — no `z.any()` or `z.unknown()`.

> Load `references/zod-patterns.md` for Zod recipes specific to common MCP input shapes.

---

### Step 3 — Annotation decision table

| Scenario | readOnlyHint | destructiveHint | idempotentHint | openWorldHint |
|---------|:---:|:---:|:---:|:---:|
| Read-only lookup, no side effects | `true` | `false` | `true` | depends |
| Write, creates new record | `false` | `false` | `false` | depends |
| Write, PUT-style upsert (same args = same result) | `false` | `false` | `true` | depends |
| Delete or irreversible overwrite | `false` | `true` | `false` | depends |
| Calls external API / open internet | any | any | any | `true` |
| Internal DB / service call only | any | any | any | `false` |

**Defaults** (what the spec assumes if a hint is omitted):
- `readOnlyHint`: `false` (treat as potentially modifying)
- `destructiveHint`: `true` (treat as potentially destructive)
- `idempotentHint`: `false` (treat as non-idempotent)
- `openWorldHint`: `true` (treat as calling external services)

Always set hints explicitly — relying on defaults causes clients to show incorrect UX.

> Load `references/annotations.md` for the full decision table and client-side UX implications.

---

### Step 4 — Error channel selection

```
Is this a schema / parse / method-not-found failure?
  └─ SDK handles automatically → JSON-RPC -32602 (invisible to LLM)

Is this a business failure the LLM should self-correct on?
  └─ return { content: [{ type: 'text', text: 'Customer not found' }], isError: true }
  Examples: entity not found, quota exceeded, validation failed on business rules

Is this an unexpected internal failure (DB down, bug)?
  └─ throw new McpError(ErrorCode.InternalError, 'Database unavailable')
  This produces JSON-RPC -32603 (invisible to LLM — host handles)
```

**Never** throw for business failures — the LLM cannot see JSON-RPC errors and cannot self-correct.

> Load `references/error-channels.md` for the full decision tree with code examples.

---

### Step 5 — Emit the tool

Copy `assets/tool.template.ts`. Fill in:
- Tool name (lowercase, namespaced: `domain_verb_noun` — e.g., `customers_search`)
- Zod schema from Step 2
- Annotation object from Step 3
- Error paths from Step 4
- Business logic

---

### Step 6 — Unit test paths

Cover all four paths:
1. **Valid input, success** — happy path returns expected content array.
2. **Schema-rejected input** — Zod rejects; SDK returns -32602 automatically (test via `tools/call`).
3. **Business error** — handler returns `{ isError: true }`.
4. **Internal error** — dependency throws; handler throws `McpError(InternalError)`.

---

### GENERATE Examples

**Example 1 — Read-only search tool**
User: "Add a tool that searches customers by email."
1. Intent: read, no side effects, internal DB, idempotent.
2. Schema: `email: z.string().email().describe('Customer email address to search for')`.
3. Annotations: `{ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }`.
4. Errors: not found → `isError: true`; DB down → throw `McpError`.
5. Name: `customers_search`.

**Example 2 — Destructive delete tool**
User: "Create a tool that deletes a customer record."
1. Intent: write, destructive, non-idempotent (deleting twice = second call fails), internal.
2. Schema: `customerId: z.string().uuid().describe('UUID of the customer to delete')`.
3. Annotations: `{ readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }`.
4. Errors: not found → `isError: true`; success → empty content array.

---

## Mode: AUDIT

Use when the user wants a review of existing tool definitions.

### AUDIT Checklist

- [ ] Step 1 — Run `scripts/audit-tools.ts` against the tool source directory
- [ ] Step 2 — Map each JSON finding to severity
- [ ] Step 3 — Produce Markdown report with file:line citations and fix suggestions
- [ ] Step 4 — If asked, generate patches for CRITICAL and HIGH findings

### AUDIT Findings Table

| Code | Severity | Description |
|------|----------|-------------|
| T001 | HIGH | `@Tool` decorator missing `description` field |
| T002 | HIGH | Zod schema field missing `.describe()` |
| T003 | CRITICAL | Write tool (`readOnlyHint` not `true`) missing `destructiveHint` and `idempotentHint` |
| T004 | HIGH | Business failure path throws instead of returning `{ isError: true }` |
| T005 | MEDIUM | Tool with `openWorldHint: false` makes outbound HTTP call |
| T006 | LOW | Tool name not namespaced (no underscore prefix indicating domain) |
| T007 | CRITICAL | Tool argument concatenated into shell command or SQL string without parameterisation |

### AUDIT Examples

**Example 3 — Audit tools directory**
User: "Audit the tools in `src/mcp/tools/`."
1. Run: `npx ts-node scripts/audit-tools.ts src/mcp/tools/`
2. Parse JSON output; format as Markdown table grouped by severity.
3. For each CRITICAL/HIGH, include the fix inline.

**Example 4 — Single file audit**
User: "Is my `orders.tool.ts` production-ready?"
1. Run audit script against the single file.
2. Check T003 first (annotation safety is the most common gap).
3. Report: zero findings → "Production-ready by audit criteria."

---

## References

- `references/annotations.md` — full annotation decision table with client UX implications
- `references/error-channels.md` — protocol error vs business error decision tree with code examples
- `references/zod-patterns.md` — Zod recipes: string constraints, enums, numeric bounds, regex for MCP inputs

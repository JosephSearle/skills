---
name: mcp-resource-prompt-designer
description: >
  Designs and audits MCP resource and prompt definitions in NestJS using @rekog/mcp-nest.
  Generates @Resource, @ResourceTemplate, and @Prompt providers with correct URI schemes,
  MIME types, RFC 6570 URI templates, completion handlers, and safe argument design. Use when
  the user asks to "expose a resource in MCP", "add a resource template", "create an MCP
  prompt", "URI template MCP", "resources/subscribe", "prompt arguments", or "completion
  for MCP resources". Do NOT use for tool definitions (→ mcp-tool-designer), authentication
  (→ mcp-auth-guardian), or server architecture (→ mcp-server-architect).
---

# MCP Resource and Prompt Designer

Designs `@Resource`, `@ResourceTemplate`, and `@Prompt` providers for NestJS MCP servers.
Targets MCP spec 2025-11-25 and `@rekog/mcp-nest` ^1.0.0.

---

## Mode: GENERATE

Use when the user wants new resource or prompt definitions.

### GENERATE Checklist

- [ ] Step 1 — Determine resource type (static, dynamic/templated, subscribable)
- [ ] Step 2 — Define URI scheme and MIME type
- [ ] Step 3 — For templates: design URI template and completion handler
- [ ] Step 4 — For prompts: design argument list and injection-safe message construction
- [ ] Step 5 — Emit the provider from `assets/`

---

### Step 1 — Resource type selection

| Type | When to use | Decorator |
|------|-------------|-----------|
| Static resource | Fixed URI, single document or dataset | `@Resource` |
| Dynamic resource | Parameterised URI (e.g., per-user, per-entity) | `@ResourceTemplate` |
| Subscribable resource | Client watches for live updates (stateful mode only) | `@ResourceTemplate` + subscribe support |

---

### Step 2 — URI scheme and MIME type

**URI scheme conventions:**
- `mcp://<server-name>/<path>` — for MCP-native resources (server controls content)
- `file:///<absolute-path>` — for local filesystem resources
- `https://<domain>/<path>` — for resources that mirror a web URL

Pick one scheme per resource category and be consistent.

**MIME types — always set explicitly:**

| Content type | MIME |
|-------------|------|
| JSON data | `application/json` |
| Plain text | `text/plain` |
| Markdown | `text/markdown` |
| HTML | `text/html` |
| Binary file | `application/octet-stream` |
| Image (PNG) | `image/png` |

> Load `references/resource-types.md` for static vs dynamic resource examples and subscription rules.

---

### Step 3 — URI templates (dynamic resources)

URI templates follow RFC 6570. `@rekog/mcp-nest` uses `path-to-regexp` to parse them.

```ts
@ResourceTemplate({
  uriTemplate: 'mcp://my-server/users/{userId}/profile',
  name: 'user_profile',
  description: 'User profile data for a given user ID.',
  mimeType: 'application/json',
})
async getUserProfile({ userId }: { userId: string }, ctx: Context) {
  const user = await this.userService.findById(userId);
  if (!user) {
    throw new McpError(ErrorCode.ResourceNotFound, `User ${userId} not found`);
  }
  return { contents: [{ uri: `mcp://my-server/users/${userId}/profile`, mimeType: 'application/json', text: JSON.stringify(user) }] };
}
```

**Completion handler** — powers autocomplete in clients:
```ts
@Prompt({ name: 'analyze_user', ... })
async completeUserId(argument: string, ctx: Context) {
  const users = await this.userService.search(argument);
  return { values: users.map(u => u.id) };
}
```

> Load `references/uri-schemes.md` for RFC 6570 syntax, `path-to-regexp` patterns, and completion setup.

---

### Step 4 — Prompt argument design

Prompts are **user-controlled** — they are slash-command templates a user invokes, not tools the model calls autonomously.

**Argument rules:**
1. Declare all arguments with `name`, `description`, and `required`.
2. Inline arguments into the message with clear delimiters — never let arg values close a code fence or XML tag.
3. Treat all argument values as untrusted text; sanitise before including in the message.

```ts
@Prompt({
  name: 'analyze_code',
  description: 'Analyse a code snippet for security issues.',
  arguments: [
    { name: 'language', description: 'Programming language', required: true },
    { name: 'code',     description: 'Code to analyse', required: true },
  ],
})
async analyzeCode({ language, code }: { language: string; code: string }) {
  return {
    description: 'Security analysis prompt',
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        // Use XML delimiters — argument values cannot close the outer tag
        text: `Analyse the following ${language} code for security vulnerabilities:\n\n<code language="${language}">\n${code}\n</code>`,
      },
    }],
  };
}
```

> Load `references/prompt-patterns.md` for delimiter injection prevention and argument validation.

---

### GENERATE Examples

**Example 1 — Static resource: server configuration**
User: "Expose the server's configuration as an MCP resource."
1. Type: static, fixed URI.
2. URI: `mcp://my-server/config`, MIME: `application/json`.
3. Return: serialised (non-sensitive) config object.
4. Annotation: read-only; no subscription needed.

**Example 2 — Dynamic resource: customer data**
User: "Expose customer profiles as resources with autocomplete."
1. Type: dynamic, per-customer URI.
2. URI template: `mcp://my-server/customers/{customerId}`, MIME: `application/json`.
3. Completion: search customer IDs matching the typed prefix.
4. Subscribe: stateful mode only — add `resources: { subscribe: true }` to capabilities.

---

## Mode: AUDIT

Use when reviewing existing resource and prompt definitions.

### AUDIT Checklist

- [ ] Step 1 — Check URI scheme consistency across all resources
- [ ] Step 2 — Verify MIME types are set on all resources
- [ ] Step 3 — Check prompt argument injection safety
- [ ] Step 4 — Verify subscriptions are only used in stateful mode
- [ ] Step 5 — Produce Markdown report with file:line citations

### AUDIT Findings Table

| Code | Severity | Description |
|------|----------|-------------|
| RP01 | HIGH | Resource missing `mimeType` field |
| RP02 | MEDIUM | Inconsistent URI schemes across resources (mix of `mcp://` and `https://`) |
| RP03 | HIGH | Prompt argument value interpolated without delimiters — injection risk |
| RP04 | HIGH | `resources/subscribe` used but server is in stateless mode |
| RP05 | MEDIUM | `@ResourceTemplate` missing a completion handler for its URI parameters |

### AUDIT Examples

**Example 3 — Audit resources**
User: "Review my MCP resource definitions."
1. Check all `@Resource` and `@ResourceTemplate` decorators for MIME type and URI scheme.
2. Flag RP01 for any without `mimeType`.
3. Check URI scheme consistency — flag RP02 for mixed schemes.

**Example 4 — Prompt safety check**
User: "Are my prompts safe against injection?"
1. Read each `@Prompt` handler.
2. Verify argument values are wrapped in delimiters before concatenation.
3. Flag RP03 if direct string interpolation is used without delimiters.

---

## References

- `references/uri-schemes.md` — URI scheme conventions, RFC 6570 syntax, path-to-regexp, completion
- `references/resource-types.md` — static vs dynamic resources, MIME types, subscription rules
- `references/prompt-patterns.md` — argument design, injection-safe message construction

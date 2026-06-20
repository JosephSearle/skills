# MCP C4 Diagram Patterns

Standard diagram shapes, conventions, and anti-patterns for documenting NestJS MCP servers using the C4 model.

---

## Level 1 — Context Diagram

### Who belongs in an MCP context diagram

| Actor | Type | Notes |
|-------|------|-------|
| AI Host (Claude Desktop, claude.ai, LLM app) | `System` | Primary consumer of the MCP server — this is software, not a human |
| Developer / Operator | `Person` | Secondary actor; configures, deploys, monitors the server |
| End user (if applicable) | `Person` | Human who indirectly benefits via the AI Host; show only if the business context requires it |
| External APIs the server calls via tools | `System_Ext` | Downstream services invoked from tool handlers |
| IdP / Auth server (if OAuth) | `System_Ext` | Issues JWT tokens validated by the MCP server |

### Standard MCP context pattern

```mermaid
C4Context
  title System Context — <SERVER_NAME> MCP Server

  Person(developer, "Developer", "Deploys and configures the MCP server")
  System(aiHost, "AI Host", "Claude Desktop or claude.ai — manages MCP client connections")
  System(mcpServer, "<SERVER_NAME>", "<ONE_LINE_DESCRIPTION>")
  System_Ext(downstreamApi, "<DOWNSTREAM_API>", "<PURPOSE>")
  System_Ext(idp, "<IDENTITY_PROVIDER>", "Issues JWT tokens (remote servers only)")

  Rel(aiHost, mcpServer, "Connects via MCP protocol", "<stdio | Streamable HTTP POST /mcp>")
  Rel(mcpServer, downstreamApi, "Tool calls", "REST / gRPC")
  Rel(mcpServer, idp, "Validates JWT", "JWKS endpoint")
  Rel(developer, mcpServer, "Deploys and monitors")
```

**What to omit at L1:**
- Individual tool names or counts
- JWT claims or token detail
- Internal module names
- Transport protocol headers or HTTP status codes

---

## Level 2 — Container Diagram

### Standard NestJS MCP container layout

```mermaid
C4Container
  title Container Architecture — <SERVER_NAME> MCP Server

  System(aiHost, "AI Host", "Claude Desktop / claude.ai")
  System_Ext(downstreamApi, "<DOWNSTREAM_API>", "<PURPOSE>")

  System_Boundary(boundary, "<SERVER_NAME>") {
    Container(nestApp, "NestJS Application", "Node.js / NestJS", "Application host; wires all modules via DI")
    Container(mcpModule, "McpModule", "@rekog/mcp-nest", "Protocol handler: tool registry, resource registry, prompt registry")
    Container(transport, "Transport Layer", "<stdio | Streamable HTTP>", "Receives MCP messages; routes to McpModule")
    Container(authGuard, "Auth Guard", "passport-jwt / jwks-rsa", "Validates Bearer JWT; enforces audience binding (RFC 8707)")
    Container(throttler, "Rate Limiter", "@nestjs/throttler + Redis", "Per-client request throttling")
  }

  Rel(aiHost, transport, "MCP protocol", "<stdio | HTTPS POST /mcp>")
  Rel(transport, mcpModule, "Parsed MCP messages")
  Rel(mcpModule, authGuard, "Guard chain — validates token")
  Rel(mcpModule, throttler, "Guard chain — enforces limit")
  Rel(mcpModule, downstreamApi, "Tool handler calls", "REST")
```

### Stateful server additions

Add a session store container when `statelessMode: false`:

```mermaid
ContainerDb(sessionStore, "Session Store", "Redis", "Holds per-client MCP session state; TTL-bounded")
Rel(mcpModule, sessionStore, "Reads/writes session", "ioredis")
```

### stdio-only server (minimal)

For local-only stdio servers without auth or rate limiting:

```mermaid
C4Container
  title Container Architecture — <SERVER_NAME> (stdio)

  System(aiHost, "AI Host", "Claude Desktop")

  System_Boundary(boundary, "<SERVER_NAME>") {
    Container(nestApp, "NestJS Application", "Node.js / NestJS", "")
    Container(mcpModule, "McpModule", "@rekog/mcp-nest", "Tool registry; <N> tools")
    Container(transport, "Stdio Transport", "stdin/stdout", "Reads JSON-RPC from stdin; writes to stdout")
  }

  Rel(aiHost, transport, "stdin/stdout", "MCP protocol")
  Rel(transport, mcpModule, "Parsed MCP messages")
```

---

## Level 3 — Component Diagram

### McpModule internals

```mermaid
C4Component
  title Component View — McpModule

  Container_Boundary(boundary, "McpModule") {
    Component(toolRegistry, "Tool Registry", "@Tool providers", "Registers tools; validates input schemas; dispatches calls")
    Component(resourceRegistry, "Resource Registry", "@Resource providers", "Serves URI-addressed data resources")
    Component(promptRegistry, "Prompt Registry", "@Prompt providers", "Returns parameterised prompt templates")
    Component(capNegotiation, "Capability Negotiation", "@rekog/mcp-nest", "Handles initialize handshake; declares capability set")
    Component(authGuard, "<AUTH_GUARD_NAME>", "NestJS Guard", "Validates JWT; checks aud claim; rejects passthrough tokens")
    Component(throttleGuard, "Throttler Guard", "@nestjs/throttler", "Per-client rate limiting via Redis TTL counter")
    Component(errorFilter, "MCP Error Filter", "NestJS ExceptionFilter", "Maps NestJS exceptions to MCP error codes")
  }

  Rel(authGuard, toolRegistry, "Permits or rejects — before handler")
  Rel(throttleGuard, toolRegistry, "Permits or rejects — before handler")
  Rel(toolRegistry, resourceRegistry, "Resource fetch (if tool calls resource)")
  Rel(errorFilter, toolRegistry, "Catches handler exceptions")
```

**Omit components not present:** skip `resourceRegistry` if no `@Resource` providers, `promptRegistry` if no `@Prompt` providers, `throttleGuard` if no `@nestjs/throttler`.

### Tool grouping (> 10 tools)

When `NOTE_TOOLS > 10`, group tools by domain rather than listing individually:

```mermaid
C4Component
  title Component View — McpModule Tool Groups

  Container_Boundary(boundary, "McpModule") {
    Component(orderTools, "Order Tools", "@Tool providers", "<N> tools: create-order, get-order, cancel-order...")
    Component(inventoryTools, "Inventory Tools", "@Tool providers", "<N> tools: check-stock, reserve-item...")
    Component(notifyTools, "Notification Tools", "@Tool providers", "<N> tools: send-email, send-sms...")
  }
```

---

## Data Flow Diagram (Tool Call Lifecycle)

```mermaid
flowchart LR
  AiHost["AI Host\n(Claude Desktop)"] -->|"MCP tools/call"| Transport
  Transport["Transport Layer\n(stdio | POST /mcp)"] --> Auth
  Auth["Auth Guard\n(validate JWT + audience)"] -->|"authorized"| Throttle
  Auth -->|"401 Unauthorized"| AiHost
  Throttle["Rate Limiter\n(per-client TTL)"] -->|"within limit"| Validate
  Throttle -->|"429 Too Many Requests"| AiHost
  Validate["Zod Schema Validation\n(strict — forbid extra fields)"] -->|"valid"| Handler
  Validate -->|"MCP invalid_params"| AiHost
  Handler["Tool Handler\n(<TOOL_NAME>)"] --> External
  External["External API / Data Store"] --> Handler
  Handler -->|"MCP result content"| AiHost
```

---

## Deployment Diagram Variants

### stdio (local)

```mermaid
graph TB
  subgraph local["Local Machine — Developer Workstation"]
    Desktop["Claude Desktop\n(AI Host)"]
    subgraph config["claude_desktop_config.json"]
      entry["MCP server entry\n(command + args + env)"]
    end
    subgraph process["Child Process (spawned by Desktop)"]
      Server["<SERVER_NAME>\nNode.js / stdio transport"]
    end
  end
  subgraph external["External Services"]
    API["<EXTERNAL_API>"]
  end
  Desktop -->|"stdin/stdout\n(MCP protocol)"| Server
  config -.->|"configures"| Desktop
  Server -->|"REST/SDK calls"| API
```

### Streamable HTTP — container (single instance)

```mermaid
graph TB
  subgraph cloud["<CLOUD_PROVIDER> — <REGION>"]
    subgraph prod["Production"]
      LB["API Gateway / Load Balancer\n(TLS termination)"]
      subgraph app["Application Container"]
        Svc["<SERVER_NAME>\nNestJS / POST /mcp\nStreamable HTTP"]
      end
    end
  end
  subgraph external["External Services"]
    API["<EXTERNAL_API>"]
    IdP["<IDENTITY_PROVIDER>\n(JWKS endpoint)"]
  end
  AiHost["AI Host\n(claude.ai)"] -->|"HTTPS POST /mcp"| LB
  LB --> Svc
  Svc --> API
  Svc -.->|"JWKS fetch (cached)"| IdP
```

### Streamable HTTP — Kubernetes (stateless + Redis)

```mermaid
graph TB
  subgraph k8s["Kubernetes Cluster"]
    subgraph ns["Namespace: <NAMESPACE>"]
      Ingress["Ingress Controller\n(TLS, path: /mcp)"]
      subgraph deploy["Deployment (N replicas)"]
        Pod1["Pod 1\n<SERVER_NAME>"]
        Pod2["Pod 2\n<SERVER_NAME>"]
      end
      Redis["Redis\n(rate limit state)"]
    end
  end
  AiHost["AI Host"] -->|"HTTPS POST /mcp"| Ingress
  Ingress --> Pod1
  Ingress --> Pod2
  Pod1 & Pod2 --> Redis
```

---

## Anti-Patterns

| Anti-pattern | Why wrong | Fix |
|-------------|-----------|-----|
| `Person(aiHost, "AI Host", ...)` at L1 | The AI Host is a software system, not a human | Use `System(aiHost, ...)` |
| Showing tool implementation code in container diagram | That's L4 (code level); containers show deployable units | Move to L3 component or remove |
| Conflating MCP Client and MCP Host | Client is the protocol component inside the Host; they're not the same | Show AI Host as a single System; note internally it has a Client |
| Omitting transport protocol label on Host → Server arrow | Transport choice is architecturally significant | Always label the `Rel` with `stdio` or `Streamable HTTP / POST /mcp` |
| Showing JWT fields or header names in diagram | Volatile implementation detail | Describe as "Validates Bearer JWT" in component description |
| Drawing L1 context with internal module names | Context is stakeholder-level; no internals | Remove until L2 |
| Using PlantUML | Does not render natively on GitHub | Mermaid only |
| Unclosed Mermaid fence | Breaks rendering of the entire file | Always close ` ``` ` fences |

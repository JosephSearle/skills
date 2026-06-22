---
name: webcraft-carbon-chat-ui
description: >
  Build AI chat interfaces using IBM Carbon components and the Vercel AI SDK.
  Covers streaming message rendering, tool invocation display, AI badge components
  from @carbon/ibm-products, loading states, and error handling — all with Carbon
  design tokens. Requires webcraft-carbon-setup and webcraft-nextjs-architecture.
  Triggers on: "build chat UI", "AI chat interface", "streaming messages", "agent chat",
  "chat component Carbon", "LangGraph chat frontend", "tool call visibility", "AILabel",
  "useChat Carbon", "streaming response UI". Not for state management — use
  webcraft-state-management for Zustand/TanStack Query setup.
---

# webcraft-carbon-chat-ui

A chat interface for a LangGraph agent backend has three distinct concerns: **streaming** (rendering tokens as they arrive), **tool visibility** (showing users what the agent is doing between responses), and **Carbon-native UI** (using `@carbon/react` and `@carbon/ibm-products` components consistently). The Vercel AI SDK handles streaming mechanics; Carbon provides the visual language; `@carbon/ibm-products` provides AI-specific components like `AILabel`.

---

## Core Philosophy

**The Vercel AI SDK is backend-agnostic.** `useChat` communicates with a Next.js route handler at `/api/chat` that proxies to the LangGraph backend. The hook handles SSE consumption, message state, streaming text accumulation, and error recovery. Write the proxy route once; the hook handles everything else.

**Show tool calls as they happen.** When a LangGraph agent invokes an MCP tool, users see nothing for potentially several seconds. Rendering tool invocations in real time (using the AI SDK's `toolInvocations`) reduces perceived latency and builds user trust in the agent's reasoning process.

---

## Step 1 — Detect existing setup

```
Check package.json:
  └─ Is ai (Vercel AI SDK) installed?
       └─ NO → install it (Step 3 — Install)

  └─ Is @carbon/ibm-products installed?
       └─ NO and AI badge/label components needed → install (Step 3 — Install)

Check app/api/chat/route.ts:
  └─ Does the proxy route exist?
       └─ NO → create it (Step 3 — Route Handler)

Check for 'use client' on any chat UI components:
  └─ Missing → add it (references/appRouter-gotchas.md in webcraft-carbon-setup)
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Installing AI SDK or @carbon/ibm-products, or creating the route handler
  │    → load references/ibm-products-setup.md
  ├─ Rendering streaming messages or tool call events
  │    → load references/streaming-rendering.md
  └─ Building the chat layout, loading states, or error handling
       → load references/chat-layout.md
```

---

## Step 3 — Execute

### Install

```bash
npm install ai @carbon/ibm-products @carbon/ibm-products-styles
```

Add `@carbon/ibm-products-styles` to `globals.scss`:
```scss
@use '@carbon/react';
@use '@carbon/ibm-products/css/index.min.css';
```

### API route handler (SSE proxy)

```ts
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { messages } = await req.json()

  const agentResponse = await fetch(`${process.env.AGENT_BACKEND_URL}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })

  if (!agentResponse.ok) {
    return new Response('Agent backend error', { status: 502 })
  }

  return new Response(agentResponse.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

### Complete chat island

```tsx
// app/(chat)/components/ChatIsland.tsx
'use client'
import { useChat } from 'ai/react'
import { useState } from 'react'
import {
  TextInput,
  Button,
  Layer,
  Tile,
  InlineLoading,
  InlineNotification,
} from '@carbon/react'
import { AILabel } from '@carbon/ibm-products'
import { Send } from '@carbon/icons-react'

export function ChatIsland() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
  } = useChat({ api: '/api/chat' })

  return (
    <Layer className="chat-island">
      {/* Message list */}
      <div className="chat-messages" role="log" aria-live="polite">
        {messages.map((msg) => (
          <Tile key={msg.id} className={`chat-message chat-message--${msg.role}`}>
            {msg.role === 'assistant' && (
              <AILabel size="xs" aiText="AI" />
            )}
            {/* Tool invocations */}
            {msg.toolInvocations?.map((tool) => (
              <InlineNotification
                key={tool.toolCallId}
                kind="info"
                lowContrast
                title={`Using: ${tool.toolName}`}
                subtitle={tool.state === 'result' ? 'Done' : 'Working...'}
              />
            ))}
            <p>{msg.content}</p>
          </Tile>
        ))}

        {isLoading && (
          <InlineLoading description="Agent is thinking..." status="active" />
        )}
      </div>

      {/* Error display */}
      {error && (
        <InlineNotification
          kind="error"
          title="Connection error"
          subtitle={error.message}
          onClose={() => {}}
        />
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="chat-input-row">
        <TextInput
          id="chat-input"
          labelText="Message"
          hideLabel
          placeholder="Ask the agent..."
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
        />
        {isLoading ? (
          <Button kind="secondary" onClick={stop} renderIcon={Send}>
            Stop
          </Button>
        ) : (
          <Button type="submit" renderIcon={Send} disabled={!input.trim()}>
            Send
          </Button>
        )}
      </form>
    </Layer>
  )
}
```

---

## Step 4 — Validate

- [ ] `ai` and `@carbon/ibm-products` in `package.json` dependencies
- [ ] `@carbon/ibm-products/css/index.min.css` imported in `globals.scss`
- [ ] `app/api/chat/route.ts` exists and proxies to `AGENT_BACKEND_URL`
- [ ] `AGENT_BACKEND_URL` is in `.env.local` and NOT prefixed with `NEXT_PUBLIC_`
- [ ] Chat island has `'use client'` directive
- [ ] Message list has `role="log"` and `aria-live="polite"` for screen readers
- [ ] Tool invocations render with `InlineNotification` while state is `'call'`
- [ ] Error state renders with Carbon `InlineNotification kind="error"`
- [ ] Loading state renders with `InlineLoading` while `isLoading` is true
- [ ] Stop button appears during streaming and calls `stop()`

---

## Reference Files

- [references/ibm-products-setup.md](references/ibm-products-setup.md) — `@carbon/ibm-products` installation, `AILabel`, `Slug` components, styles import. **Load for AI component setup.**
- [references/streaming-rendering.md](references/streaming-rendering.md) — `useChat` hook reference, tool invocation lifecycle, streaming text accumulation, `appendChunk` pattern. **Load for streaming message rendering.**
- [references/chat-layout.md](references/chat-layout.md) — Full chat layout scaffold, Carbon `Layer`/`Tile` patterns, `InlineLoading`, `InlineNotification` error handling, conversation history. **Load for UI layout work.**

---

## Source Documentation

All content is grounded in [sdk.vercel.ai/docs/ai-sdk-ui/use-chat](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat), [sdk.vercel.ai/docs/ai-sdk-ui/chatbot-with-tool-calling](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot-with-tool-calling), [carbondesignsystem.com/community/patterns/ai-label](https://carbondesignsystem.com/community/patterns/ai-label/), and [carbondesignsystem.com/guidelines/ai-design/overview](https://carbondesignsystem.com/guidelines/ai-design/overview/).

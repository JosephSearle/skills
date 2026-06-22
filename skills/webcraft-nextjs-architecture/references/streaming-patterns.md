# Streaming Patterns Reference

> Authority: [nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming) and [sdk.vercel.ai/docs/ai-sdk-ui/use-chat](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)

Streaming is the correct pattern for LangGraph agent responses. Next.js `<Suspense>` enables progressive rendering while agent responses arrive via SSE.

---

## Suspense boundaries

Wrap async Server Component content in `<Suspense>` to stream it progressively:

```tsx
// app/(chat)/page.tsx
import { Suspense } from 'react'
import { ChatHistory } from './components/ChatHistory'
import { ChatIsland } from './components/ChatIsland'
import { InlineLoading } from '@carbon/react'

export default function ChatPage() {
  return (
    <div>
      {/* Shell renders immediately */}
      <Suspense fallback={<InlineLoading description="Loading history..." />}>
        <ChatHistory />       {/* Streams in when ready */}
      </Suspense>
      <ChatIsland />          {/* Client island, renders immediately */}
    </div>
  )
}
```

---

## loading.tsx — automatic Suspense fallback

Create `loading.tsx` next to `page.tsx` for automatic route-level Suspense:

```tsx
// app/(chat)/loading.tsx
'use client'
import { InlineLoading } from '@carbon/react'

export default function Loading() {
  return (
    <InlineLoading
      description="Loading..."
      status="active"
    />
  )
}
```

Next.js automatically wraps `page.tsx` in a `<Suspense>` boundary and shows `loading.tsx` until the page data resolves.

---

## SSE proxy route handler

The Next.js route handler proxies requests to the LangGraph backend and forwards the SSE stream:

```ts
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { messages } = await req.json()

  const agentResponse = await fetch(process.env.AGENT_BACKEND_URL + '/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })

  if (!agentResponse.ok) {
    return new Response('Agent error', { status: 502 })
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

This pattern:
- Keeps `AGENT_BACKEND_URL` server-side (never exposed to browser)
- Handles CORS (browser talks to Next.js, not directly to LangGraph)
- Forwards SSE as-is (no buffering)

---

## Vercel AI SDK useChat

The Vercel AI SDK `useChat` hook handles SSE consumption, message state, and streaming in client islands:

```tsx
'use client'
import { useChat } from 'ai/react'

export function ChatIsland() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
  } = useChat({
    api: '/api/chat',
    streamProtocol: 'text',
    onError: (err) => console.error('Chat error:', err),
  })

  return (
    <div>
      <MessageList messages={messages} isStreaming={isLoading} />
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} disabled={isLoading} />
        <button type="submit" disabled={isLoading}>Send</button>
        {isLoading && <button type="button" onClick={stop}>Stop</button>}
      </form>
    </div>
  )
}
```

---

## Streaming message rendering

The last message in the `messages` array streams in character by character while `isLoading` is true. Render it separately to show the streaming indicator:

```tsx
function MessageList({ messages, isStreaming }: { messages: Message[], isStreaming: boolean }) {
  return (
    <div>
      {messages.map((msg, i) => {
        const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant'
        return (
          <div key={msg.id}>
            <span>{msg.content}</span>
            {isLastAssistant && isStreaming && <StreamingCursor />}
          </div>
        )
      })}
    </div>
  )
}

function StreamingCursor() {
  return <span className="streaming-cursor">▌</span>
}
```

---

## SSE vs WebSockets

| | SSE | WebSockets |
|---|-----|-----------|
| Direction | Server → client (unidirectional) | Bidirectional |
| Protocol | HTTP/1.1 and HTTP/2 | Separate WS protocol |
| OpenShift config | No special route config needed | Requires WS-enabled route |
| LLM streaming | Natural fit | Unnecessary complexity |
| Reconnection | Automatic (browser EventSource) | Manual |

**Use SSE for LangGraph streaming.** WebSockets add complexity without benefit for LLM response streaming.

# Streaming Rendering Reference

> Authority: [sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat) and [sdk.vercel.ai/docs/ai-sdk-ui/chatbot-with-tool-calling](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot-with-tool-calling)

The Vercel AI SDK `useChat` hook manages message state and SSE consumption. Understanding its message lifecycle is essential for correct streaming rendering.

---

## useChat hook reference

```ts
const {
  messages,         // Message[] — complete conversation history
  input,            // string — current input field value
  handleInputChange, // (e) => void — bind to input onChange
  handleSubmit,     // (e) => void — bind to form onSubmit
  isLoading,        // boolean — true while streaming
  error,            // Error | undefined — connection/parse errors
  stop,             // () => void — abort current stream
  reload,           // () => void — resend last user message
  append,           // (msg) => void — add message programmatically
  setMessages,      // (msgs) => void — replace all messages
} = useChat({
  api: '/api/chat',
  streamProtocol: 'text',        // 'text' for raw SSE, 'data' for structured events
  initialMessages: history,      // Message[] — pre-populate from server
  onFinish: (msg) => {},         // called when stream completes
  onError: (err) => {},          // called on connection error
})
```

---

## Message type

```ts
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string                // streaming text — grows character by character
  toolInvocations?: ToolInvocation[]
  createdAt?: Date
}
```

---

## Tool invocation lifecycle

When the LangGraph agent calls an MCP tool, the AI SDK emits tool invocation events with a state machine:

```
'call'    → agent has invoked the tool, waiting for result
'partial-call' → tool arguments being streamed
'result'  → tool has returned a result
```

```tsx
{msg.toolInvocations?.map((tool) => {
  if (tool.state === 'call' || tool.state === 'partial-call') {
    return (
      <InlineNotification
        key={tool.toolCallId}
        kind="info"
        lowContrast
        title={`Using: ${tool.toolName}`}
        subtitle="Working..."
      />
    )
  }
  if (tool.state === 'result') {
    return (
      <InlineNotification
        key={tool.toolCallId}
        kind="success"
        lowContrast
        title={`Done: ${tool.toolName}`}
      />
    )
  }
})}
```

---

## Manual appendChunk pattern (Zustand store)

For cases where `useChat` does not fit (custom protocol, non-standard SSE), manage streaming state in Zustand:

```ts
// stores/chatStore.ts
import { create } from 'zustand'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatStore {
  messages: Message[]
  isStreaming: boolean
  addMessage: (msg: Message) => void
  appendChunk: (chunk: string) => void
  setStreaming: (val: boolean) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isStreaming: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendChunk: (chunk) =>
    set((s) => ({
      messages: s.messages.map((m, i) =>
        i === s.messages.length - 1
          ? { ...m, content: m.content + chunk }
          : m
      ),
    })),
  setStreaming: (val) => set({ isStreaming: val }),
}))
```

Manual SSE consumption:
```ts
async function streamFromAgent(messages: Message[]) {
  const { addMessage, appendChunk, setStreaming } = useChatStore.getState()

  addMessage({ id: Date.now().toString(), role: 'assistant', content: '' })
  setStreaming(true)

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    appendChunk(decoder.decode(value))
  }

  setStreaming(false)
}
```

---

## Streaming cursor

Show a blinking cursor while the last assistant message is still streaming:

```tsx
function MessageBubble({ msg, isLast, isStreaming }: {
  msg: Message
  isLast: boolean
  isStreaming: boolean
}) {
  return (
    <div>
      <span>{msg.content}</span>
      {isLast && msg.role === 'assistant' && isStreaming && (
        <span className="streaming-cursor" aria-hidden="true">▌</span>
      )}
    </div>
  )
}
```

```scss
.streaming-cursor {
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}
```

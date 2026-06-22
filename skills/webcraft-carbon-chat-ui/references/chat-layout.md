# Chat Layout Reference

> Authority: [carbondesignsystem.com/components/tile/usage](https://carbondesignsystem.com/components/tile/usage) and [carbondesignsystem.com/components/notification/usage](https://carbondesignsystem.com/components/notification/usage)

Carbon components for structuring a chat interface layout.

---

## Layout structure

```
┌─────────────────────────────────┐
│  NavIsland (Carbon Header)      │
├─────────────────────────────────┤
│  Session list     │  Chat area  │
│  (SidePanel or    │             │
│   TreeView)       │  Messages   │
│                   │  ─────────  │
│                   │  Input row  │
└─────────────────────────────────┘
```

---

## Full chat layout with Carbon

```tsx
'use client'
import {
  Layer,
  Tile,
  TextInput,
  Button,
  InlineLoading,
  InlineNotification,
  IconButton,
} from '@carbon/react'
import { Send, StopFilled, Renew } from '@carbon/icons-react'
import { AILabel } from '@carbon/ibm-products'
import { useChat } from 'ai/react'
import type { Message } from 'ai'

export function ChatLayout() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, stop, reload } =
    useChat({ api: '/api/chat' })

  return (
    <Layer className="chat-layout">
      {/* Message feed */}
      <div
        className="chat-messages"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="chat-typing-indicator">
            <InlineLoading description="Agent is thinking..." status="active" />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error.message}
          actions={
            <Button kind="ghost" size="sm" onClick={reload}>
              Retry
            </Button>
          }
          onClose={() => {}}
        />
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="chat-input-area">
        <TextInput
          id="chat-input"
          labelText="Message"
          hideLabel
          placeholder="Ask something..."
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
        />
        {isLoading ? (
          <IconButton label="Stop" kind="secondary" onClick={stop}>
            <StopFilled />
          </IconButton>
        ) : (
          <IconButton label="Send" type="submit" disabled={!input.trim()}>
            <Send />
          </IconButton>
        )}
      </form>
    </Layer>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isAssistant = message.role === 'assistant'

  return (
    <Tile className={`chat-bubble chat-bubble--${message.role}`}>
      {isAssistant && <AILabel size="xs" />}

      {/* Tool invocations */}
      {message.toolInvocations?.map((tool) => (
        <InlineNotification
          key={tool.toolCallId}
          kind={tool.state === 'result' ? 'success' : 'info'}
          lowContrast
          title={tool.toolName}
          subtitle={tool.state === 'result' ? 'Complete' : 'Running...'}
        />
      ))}

      {message.content && <p className="chat-bubble__content">{message.content}</p>}
    </Tile>
  )
}
```

---

## SCSS for chat layout

```scss
@use '@carbon/react/scss/spacing' as spacing;
@use '@carbon/react/scss/themes' as themes;
@use '@carbon/react/scss/breakpoint' as bp;

.chat-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: spacing.$spacing-05;
  display: flex;
  flex-direction: column;
  gap: spacing.$spacing-04;
}

.chat-bubble {
  max-width: 80%;
  
  &--user {
    align-self: flex-end;
    background: themes.$layer-02;
  }

  &--assistant {
    align-self: flex-start;
  }

  &__content {
    margin-block: 0;
    margin-top: spacing.$spacing-02;
  }
}

.chat-input-area {
  display: flex;
  gap: spacing.$spacing-03;
  padding: spacing.$spacing-05;
  border-top: 1px solid themes.$border-subtle-01;
  align-items: flex-end;

  .cds--text-input-wrapper {
    flex: 1;
  }
}

.chat-typing-indicator {
  padding: spacing.$spacing-03;
}
```

---

## Empty state

Show an empty state when there are no messages:

```tsx
import { Tile } from '@carbon/react'
import { Chat } from '@carbon/icons-react'

function EmptyState() {
  return (
    <Tile className="chat-empty-state">
      <Chat size={32} />
      <h2>Start a conversation</h2>
      <p>Ask the AI assistant anything about your data.</p>
    </Tile>
  )
}

// In the message list:
{messages.length === 0 && !isLoading && <EmptyState />}
```

---

## Conversation history with Layer nesting

Use Carbon `Layer` to create visual depth in the chat layout:

```tsx
<Layer>
  {/* Sidebar — Layer 1 */}
  <Layer>
    <SessionList />  {/* Layer 2 — sits above sidebar */}
  </Layer>

  {/* Main chat area — Layer 1 */}
  <ChatLayout />
</Layer>
```

`Layer` automatically adjusts background and border token values based on nesting depth, so the visual hierarchy is consistent with the Carbon design language without manual token overrides.

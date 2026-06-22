# AI SDK Mocking Reference

> Authority: [vitest.dev/api/vi#vi-mock](https://vitest.dev/api/vi.html#vi-mock) and [sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat](https://sdk.vercel.ai/docs/reference/ai-sdk-ui/use-chat)

The Vercel AI SDK `useChat` hook cannot run in jsdom — it requires a real browser event loop and fetch API. Mock it at the module level in every chat UI test file.

---

## Basic useChat mock

```ts
// In the test file or a shared test helper

vi.mock('ai/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    input: '',
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    error: undefined,
    stop: vi.fn(),
    reload: vi.fn(),
    append: vi.fn(),
    setMessages: vi.fn(),
  })),
}))
```

---

## Mocking with pre-populated messages

```ts
import { useChat } from 'ai/react'

vi.mock('ai/react')

const mockUseChat = vi.mocked(useChat)

beforeEach(() => {
  mockUseChat.mockReturnValue({
    messages: [
      { id: '1', role: 'user', content: 'Hello agent', createdAt: new Date() },
      { id: '2', role: 'assistant', content: 'How can I help?', createdAt: new Date() },
    ],
    input: '',
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    error: undefined,
    stop: vi.fn(),
    reload: vi.fn(),
    append: vi.fn(),
    setMessages: vi.fn(),
  })
})
```

---

## Mocking streaming state (isLoading: true)

```ts
it('shows InlineLoading while streaming', () => {
  mockUseChat.mockReturnValue({
    messages: [
      { id: '1', role: 'user', content: 'Question', createdAt: new Date() },
      { id: '2', role: 'assistant', content: 'Part of answer...', createdAt: new Date() },
    ],
    input: '',
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: true,   // <-- streaming
    error: undefined,
    stop: vi.fn(),
    reload: vi.fn(),
    append: vi.fn(),
    setMessages: vi.fn(),
  })

  render(<ChatIsland />)

  expect(screen.getByText('Agent is thinking...')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
})
```

---

## Mocking error state

```ts
it('shows error notification on connection failure', () => {
  mockUseChat.mockReturnValue({
    messages: [],
    input: '',
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    error: new Error('Connection refused'),
    stop: vi.fn(),
    reload: vi.fn(),
    append: vi.fn(),
    setMessages: vi.fn(),
  })

  render(<ChatIsland />)

  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(screen.getByText('Connection refused')).toBeInTheDocument()
})
```

---

## Mocking tool invocations

```ts
it('renders tool invocation notification', () => {
  mockUseChat.mockReturnValue({
    messages: [
      {
        id: '1',
        role: 'assistant',
        content: '',
        toolInvocations: [
          {
            toolCallId: 'call-1',
            toolName: 'search',
            state: 'call',
            args: { query: 'weather London' },
          },
        ],
        createdAt: new Date(),
      },
    ],
    input: '',
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: true,
    error: undefined,
    stop: vi.fn(),
    reload: vi.fn(),
    append: vi.fn(),
    setMessages: vi.fn(),
  })

  render(<ChatIsland />)

  expect(screen.getByText('Using: search')).toBeInTheDocument()
})
```

---

## Testing form submission

```ts
it('calls handleSubmit when Send is clicked', async () => {
  const user = userEvent.setup()
  const handleSubmit = vi.fn((e) => e.preventDefault())

  mockUseChat.mockReturnValue({
    messages: [],
    input: 'Test message',
    handleInputChange: vi.fn(),
    handleSubmit,
    isLoading: false,
    error: undefined,
    stop: vi.fn(),
    reload: vi.fn(),
    append: vi.fn(),
    setMessages: vi.fn(),
  })

  render(<ChatIsland />)

  await user.click(screen.getByRole('button', { name: 'Send' }))
  expect(handleSubmit).toHaveBeenCalled()
})
```

---

## Shared mock helper (extract if used in many tests)

```ts
// test/mocks/aiSdk.ts
import { vi } from 'vitest'
import type { UseChatHelpers } from 'ai/react'

export function createMockUseChat(overrides: Partial<UseChatHelpers> = {}): UseChatHelpers {
  return {
    messages: [],
    input: '',
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    isLoading: false,
    error: undefined,
    stop: vi.fn(),
    reload: vi.fn(),
    append: vi.fn(),
    setMessages: vi.fn(),
    ...overrides,
  }
}
```

Usage:
```ts
vi.mock('ai/react', () => ({ useChat: vi.fn() }))
const mockUseChat = vi.mocked(useChat)
mockUseChat.mockReturnValue(createMockUseChat({ isLoading: true }))
```

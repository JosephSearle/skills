# Carbon Testing Patterns Reference

> Authority: [testing-library.com/docs/queries/about](https://testing-library.com/docs/queries/about) and [carbondesignsystem.com/developing/testing](https://carbondesignsystem.com/developing/testing/)

RTL query strategies and patterns for common Carbon components.

---

## Query priority (Carbon-specific)

Use accessible queries that match how screen readers find elements:

| Priority | Query | When to use |
|----------|-------|-------------|
| 1 | `getByRole` | Buttons, inputs, checkboxes, selects |
| 2 | `getByLabelText` | Form inputs with a label |
| 3 | `getByText` | Static text content |
| 4 | `getByPlaceholderText` | Inputs where label isn't accessible |
| Last | `getByTestId` | Only when no other query works |

WRONG — querying by Carbon class name:
```tsx
const button = container.querySelector('.cds--btn')
// Breaks if Carbon renames internal classes between versions
```

CORRECT:
```tsx
const button = screen.getByRole('button', { name: 'Send' })
```

---

## Testing TextInput

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from './ChatInput'

it('calls onSubmit with the input value', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()

  render(<ChatInput onSubmit={onSubmit} />)

  const input = screen.getByLabelText('Message')
  await user.type(input, 'Hello agent')
  await user.click(screen.getByRole('button', { name: 'Send' }))

  expect(onSubmit).toHaveBeenCalledWith('Hello agent')
})
```

---

## Testing disabled state

```tsx
it('disables input while loading', () => {
  render(<ChatInput disabled />)

  expect(screen.getByLabelText('Message')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
})
```

---

## Testing Carbon Modal

Carbon Modal renders in a portal. Use `waitFor` to handle async open/close animations:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

it('opens modal when button clicked', async () => {
  const user = userEvent.setup()
  render(<SettingsButton />)

  await user.click(screen.getByRole('button', { name: 'Settings' }))

  await waitFor(() => {
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
  })
})

it('closes modal on Cancel', async () => {
  const user = userEvent.setup()
  render(<SettingsButton />)

  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

---

## Testing Carbon Select / Dropdown

```tsx
it('selects a model from dropdown', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<ModelSelector onChange={onChange} />)

  // Open the dropdown
  await user.click(screen.getByRole('combobox', { name: 'Model' }))

  // Select an item from the list
  await user.click(screen.getByRole('option', { name: 'Claude Sonnet' }))

  expect(onChange).toHaveBeenCalledWith('claude-sonnet-4-6')
})
```

---

## Testing Carbon Checkbox

```tsx
it('toggles streaming option', async () => {
  const user = userEvent.setup()
  render(<StreamingToggle />)

  const checkbox = screen.getByRole('checkbox', { name: 'Enable streaming' })
  expect(checkbox).not.toBeChecked()

  await user.click(checkbox)
  expect(checkbox).toBeChecked()
})
```

---

## Testing Carbon InlineNotification

```tsx
it('shows error notification on failed submission', async () => {
  const user = userEvent.setup()
  server.use(rest.post('/api/chat', (_req, res, ctx) => res(ctx.status(500))))

  render(<ChatForm />)
  await user.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => {
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/connection error/i)).toBeInTheDocument()
  })
})
```

---

## Full component test example

```tsx
// app/components/AgentQueryForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentQueryForm } from './AgentQueryForm'

describe('AgentQueryForm', () => {
  it('renders required fields', () => {
    render(<AgentQueryForm onSubmit={vi.fn()} />)

    expect(screen.getByLabelText('Query')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
  })

  it('shows validation error when query is empty', async () => {
    const user = userEvent.setup()
    render(<AgentQueryForm onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(screen.getByText('Query is required')).toBeInTheDocument()
    })
  })

  it('calls onSubmit with form data', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AgentQueryForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Query'), 'What is the status?')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ query: 'What is the status?' })
    })
  })
})
```

---
name: webcraft-forms-validation
description: >
  Wire IBM Carbon form components to React Hook Form v7 and Zod schema validation.
  Covers the Controller wrapper pattern for every Carbon form component, error display
  using Carbon's invalid/invalidText props, multi-step forms with ProgressIndicator,
  and loading states. Requires webcraft-carbon-setup.
  Triggers on: "form with Carbon", "React Hook Form", "Zod validation", "Carbon form components",
  "TextInput validation", "Carbon Select RHF", "Carbon Dropdown form", "Carbon DatePicker form",
  "multi-step form Carbon", "form error Carbon". Not for chat input — use webcraft-carbon-chat-ui.
---

# webcraft-forms-validation

Carbon form components (TextInput, Select, Checkbox, DatePicker, Dropdown, ComboBox) are **controlled components** — they don't manage their own value state. React Hook Form's default uncontrolled approach does not work with them. The correct integration is RHF's `Controller` wrapper, which bridges RHF's registration system to Carbon's `value` + `onChange` props. Every Carbon form component in this stack uses `Controller`.

---

## Core Philosophy

**Always use `Controller`, never `register`.** RHF's `register()` API works by attaching a `ref` to the input's DOM node. Carbon components don't expose their DOM node via `ref` in a way RHF can use for uncontrolled inputs — the Carbon component manages the DOM internally. `Controller` is the correct API: it renders a render prop that passes `value`, `onChange`, and `onBlur` explicitly, which Carbon components accept.

**Zod infers TypeScript types from schemas.** Define the schema with Zod, then derive the TypeScript type with `z.infer<typeof schema>`. Never write the form data type separately — they'll diverge. The `zodResolver` from `@hookform/resolvers/zod` connects Zod validation to RHF automatically.

---

## Step 1 — Detect existing setup

```
Check package.json:
  └─ Is react-hook-form installed?
       └─ NO → install (Step 3 — Install)

  └─ Is zod installed?
       └─ NO → install (Step 3 — Install)

  └─ Is @hookform/resolvers installed?
       └─ NO → install (Step 3 — Install)

Check existing form code:
  └─ Does it use register() with Carbon components?
       └─ YES → replace with Controller (Step 3 — Controller pattern)
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Wiring Carbon form components to RHF
  │    → load references/rhf-carbon-integration.md
  └─ Defining Zod schemas, error display, or multi-step forms
       → load references/zod-schemas.md
```

---

## Step 3 — Execute

### Install

```bash
npm install react-hook-form zod @hookform/resolvers
```

### Basic form pattern

```tsx
'use client'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, TextInput, TextArea, Button, InlineLoading } from '@carbon/react'
import { z } from 'zod'

const schema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query is too long'),
  context: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function AgentQueryForm({ onSubmit }: { onSubmit: (data: FormData) => Promise<void> }) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { query: '', context: '' },
  })

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="query"
        control={control}
        render={({ field }) => (
          <TextInput
            {...field}
            id="query"
            labelText="Query"
            placeholder="What do you want to know?"
            invalid={!!errors.query}
            invalidText={errors.query?.message}
          />
        )}
      />

      <Controller
        name="context"
        control={control}
        render={({ field }) => (
          <TextArea
            {...field}
            id="context"
            labelText="Additional context"
            helperText="Optional: provide extra context for the agent"
            invalid={!!errors.context}
            invalidText={errors.context?.message}
          />
        )}
      />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <InlineLoading description="Submitting..." /> : 'Submit'}
      </Button>
    </Form>
  )
}
```

---

## Step 4 — Validate

- [ ] `react-hook-form`, `zod`, `@hookform/resolvers` in `package.json`
- [ ] All Carbon form components use `Controller` (not `register`)
- [ ] `zodResolver(schema)` passed to `useForm({ resolver })`
- [ ] Form type derived from schema: `type FormData = z.infer<typeof schema>`
- [ ] Every Carbon input has `invalid={!!errors.fieldName}` wired up
- [ ] Every Carbon input has `invalidText={errors.fieldName?.message}` wired up
- [ ] Submit button shows `InlineLoading` while `isSubmitting` is true
- [ ] `defaultValues` provided to `useForm` (prevents uncontrolled → controlled switch)
- [ ] Form has `'use client'` directive

---

## Reference Files

- [references/rhf-carbon-integration.md](references/rhf-carbon-integration.md) — `Controller` wrapper for TextInput, Select, Checkbox, DatePicker, Dropdown, ComboBox, Toggle. **Load for all Carbon form component integration tasks.**
- [references/zod-schemas.md](references/zod-schemas.md) — Schema patterns, `z.infer`, error messages, multi-step form with `ProgressIndicator`, conditional validation. **Load for schema design and multi-step forms.**

---

## Source Documentation

All content is grounded in [react-hook-form.com](https://react-hook-form.com/), [zod.dev](https://zod.dev/), [github.com/react-hook-form/resolvers](https://github.com/react-hook-form/resolvers), and [carbondesignsystem.com/components/form/usage](https://carbondesignsystem.com/components/form/usage/).

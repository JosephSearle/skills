# Zod Schema Patterns Reference

> Authority: [zod.dev](https://zod.dev/) and [github.com/react-hook-form/resolvers](https://github.com/react-hook-form/resolvers)

Zod validates form data at runtime and infers TypeScript types at compile time. Always derive the form TypeScript type from the schema — never write it separately.

---

## Basic schema + type inference

```ts
import { z } from 'zod'

const agentConfigSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  model: z.enum(['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'], {
    errorMap: () => ({ message: 'Please select a model' }),
  }),
  maxTokens: z.number().int().min(100).max(8000).default(4096),
  temperature: z.number().min(0).max(1).default(0.7),
  systemPrompt: z.string().optional(),
  enableStreaming: z.boolean().default(true),
})

type AgentConfigData = z.infer<typeof agentConfigSchema>
// { name: string; model: "claude-sonnet-4-6" | ...; maxTokens: number; ... }
```

---

## Common field validators

```ts
z.string().min(1, 'Required')
z.string().min(1).max(500)
z.string().email('Invalid email address')
z.string().url('Invalid URL')
z.string().regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens')
z.number().positive('Must be positive')
z.number().int('Must be a whole number')
z.number().min(0).max(100)
z.boolean()
z.enum(['option-a', 'option-b', 'option-c'])
z.array(z.string()).min(1, 'At least one item required')
z.date()
z.coerce.date()   // coerces string → Date (for DatePicker output)
```

---

## Optional vs nullable

```ts
z.string().optional()       // string | undefined — field can be omitted
z.string().nullable()       // string | null — field can be null
z.string().nullish()        // string | null | undefined — both
z.string().optional().default('')  // undefined → '' if omitted
```

---

## Conditional validation with refine

```ts
const schema = z.object({
  notifyByEmail: z.boolean(),
  email: z.string().optional(),
}).refine(
  (data) => !data.notifyByEmail || (data.email && z.string().email().safeParse(data.email).success),
  {
    message: 'Valid email is required when email notification is enabled',
    path: ['email'],
  }
)
```

---

## Wiring to React Hook Form

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<AgentConfigData>({
  resolver: zodResolver(agentConfigSchema),
  defaultValues: {
    name: '',
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    temperature: 0.7,
    enableStreaming: true,
  },
})
```

Always provide `defaultValues` that match the schema's shape — this prevents React warnings about switching between controlled and uncontrolled inputs.

---

## Multi-step form with Carbon ProgressIndicator

```tsx
'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ProgressIndicator, ProgressStep, Button, InlineLoading } from '@carbon/react'

const steps = ['Basic Info', 'Model Config', 'Review']

export function MultiStepForm() {
  const [step, setStep] = useState(0)
  const form = useForm<AgentConfigData>({
    resolver: zodResolver(agentConfigSchema),
    mode: 'onBlur',
  })

  const next = form.handleSubmit(() => {
    if (step < steps.length - 1) setStep((s) => s + 1)
  })

  return (
    <div>
      <ProgressIndicator currentIndex={step}>
        {steps.map((label) => (
          <ProgressStep key={label} label={label} />
        ))}
      </ProgressIndicator>

      {step === 0 && <Step1Fields form={form} />}
      {step === 1 && <Step2Fields form={form} />}
      {step === 2 && <ReviewStep form={form} />}

      <div className="form-actions">
        {step > 0 && (
          <Button kind="secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        {step < steps.length - 1 && <Button onClick={next}>Next</Button>}
        {step === steps.length - 1 && (
          <Button type="submit" onClick={form.handleSubmit(onFinalSubmit)}>
            {form.formState.isSubmitting ? <InlineLoading description="Saving..." /> : 'Save'}
          </Button>
        )}
      </div>
    </div>
  )
}
```

---

## Displaying errors with Carbon

Individual field errors (inline):
```tsx
invalid={!!errors.fieldName}
invalidText={errors.fieldName?.message}
```

Root-level error summary (after failed submit):
```tsx
{!form.formState.isValid && form.formState.isSubmitted && (
  <InlineNotification
    kind="error"
    title="Please correct the errors above"
  />
)}
```

Success notification after submit:
```tsx
{submitSuccess && (
  <InlineNotification
    kind="success"
    title="Saved successfully"
    onClose={() => setSubmitSuccess(false)}
  />
)}
```

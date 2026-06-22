# Carbon Theming Reference

> Authority: [carbondesignsystem.com/elements/themes/overview](https://carbondesignsystem.com/elements/themes/overview) and [carbondesignsystem.com/elements/color/tokens](https://carbondesignsystem.com/elements/color/tokens)

Carbon v11 ships four production-ready themes, all WCAG 2.1 AA compliant. Theme context is applied via the `<Theme>` component from `@carbon/react`.

---

## Built-in themes

| Value | Description | Use case |
|-------|-------------|----------|
| `'white'` | Light theme, white background | Default light mode |
| `'g10'` | Light theme, gray-10 background | Light mode with soft background |
| `'g90'` | Dark theme, gray-90 background | Dark mode, softer |
| `'g100'` | Dark theme, gray-100 background | Dark mode, maximum contrast |

---

## Theme provider setup

The `<Theme>` component must be in a `'use client'` file because it sets React context:

```tsx
// app/providers.tsx
'use client'
import { Theme } from '@carbon/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <Theme theme="g100">{children}</Theme>
}
```

```tsx
// app/layout.tsx
import { Providers } from './providers'
import './globals.scss'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

---

## Runtime theme switching (dark/light toggle)

```tsx
// app/providers.tsx
'use client'
import { useState } from 'react'
import { Theme, Toggle } from '@carbon/react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true)

  return (
    <Theme theme={isDark ? 'g100' : 'white'}>
      <Toggle
        id="theme-toggle"
        labelText="Dark mode"
        toggled={isDark}
        onToggle={setIsDark}
      />
      {children}
    </Theme>
  )
}
```

---

## Nesting themes

`<Theme>` components can be nested to apply different themes to sections of the UI:

```tsx
<Theme theme="g100">
  {/* Dark sidebar */}
  <Sidebar />

  <Theme theme="white">
    {/* Light content area */}
    <MainContent />
  </Theme>
</Theme>
```

---

## Design token usage

Use Carbon SCSS tokens instead of hardcoded values. Token categories:

| Category | SCSS module | Example token | Value |
|----------|------------|---------------|-------|
| Spacing | `@carbon/react/scss/spacing` | `$spacing-05` | 1rem (16px) |
| Color (theme) | `@carbon/react/scss/themes` | `$background` | Theme-aware background |
| Color (static) | `@carbon/react/scss/colors` | `$blue-60` | #0f62fe |
| Type | `@carbon/react/scss/type` | `$body-long-01` | Body text style |

```scss
@use '@carbon/react/scss/spacing' as spacing;
@use '@carbon/react/scss/themes' as themes;
@use '@carbon/react/scss/type' as type;

.my-card {
  padding: spacing.$spacing-05;
  background: themes.$layer-01;
  color: themes.$text-primary;
  @include type.type-style('body-long-01');
}
```

### Key spacing tokens

| Token | Value |
|-------|-------|
| `$spacing-01` | 0.125rem (2px) |
| `$spacing-02` | 0.25rem (4px) |
| `$spacing-03` | 0.5rem (8px) |
| `$spacing-04` | 0.75rem (12px) |
| `$spacing-05` | 1rem (16px) |
| `$spacing-06` | 1.5rem (24px) |
| `$spacing-07` | 2rem (32px) |
| `$spacing-08` | 2.5rem (40px) |
| `$spacing-09` | 3rem (48px) |

### Key theme-aware color tokens

| Token | Meaning |
|-------|---------|
| `$background` | Page background |
| `$layer-01` | First layer above background (cards, panels) |
| `$layer-02` | Second layer (modals, dropdowns) |
| `$text-primary` | Primary text |
| `$text-secondary` | Secondary/helper text |
| `$interactive` | Interactive element color (links, focus) |
| `$border-subtle-01` | Subtle borders |

---

## System preference detection

Respect the user's OS dark mode preference as the initial theme:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Theme } from '@carbon/react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'white' | 'g100'>('g100')

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(prefersDark ? 'g100' : 'white')
  }, [])

  return <Theme theme={theme}>{children}</Theme>
}
```

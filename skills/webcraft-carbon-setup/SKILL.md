---
name: webcraft-carbon-setup
description: >
  Install and configure IBM Carbon Design System (@carbon/react v11) in a Next.js
  App Router project. Use when setting up Carbon from scratch, adding Carbon to an
  existing Next.js app, configuring SCSS compilation, or applying Carbon theming.
  Targets senior developers building on OpenShift with a fixed Carbon design language.
  Triggers on: "set up Carbon", "add Carbon to Next.js", "configure Carbon theme",
  "install @carbon/react", "Carbon SCSS Next.js", "dark mode Carbon", "Carbon tokens",
  "Carbon App Router setup". Not for general Next.js scaffolding — use
  webcraft-nextjs-architecture for that.
---

# webcraft-carbon-setup

IBM Carbon Design System is the fixed, non-negotiable design language for this stack. The integration with Next.js App Router works reliably but has two footguns that catch every newcomer: **all Carbon components require a `'use client'` boundary** (Carbon uses React context and browser APIs internally), and **SCSS must be compiled via `sass` with a specific `next.config.js` configuration**. Missing either causes silent failures or build errors.

---

## Core Philosophy

**Carbon components are client-only.** `@carbon/react` components use React context, hooks, and browser APIs internally. They cannot run in React Server Components. Every component you import from `@carbon/react` must be inside a `'use client'` boundary — either in the file itself or in a parent wrapper. The practical pattern is a "server shell, client island": the page is a server component that fetches data and passes props; the Carbon UI lives in a client component that receives serialisable props.

**Never import individual component SCSS.** Carbon's SCSS architecture resolves token dependencies across the full design system. Importing individual component stylesheets (e.g., `@use '@carbon/react/scss/components/button'`) breaks this dependency graph and produces mismatched tokens or missing styles. Always use the single barrel import `@use '@carbon/react'` in `globals.scss`.

---

## Step 1 — Detect existing setup

```
Check package.json:
  └─ Is @carbon/react installed?
       └─ NO → install it (Step 3 — Install)
       └─ YES → check version (must be ^11.x)

Check next.config.js / next.config.mjs / next.config.ts:
  └─ Does it have sassOptions.includePaths with node_modules?
       └─ NO → add sassOptions (Step 3 — Configure SCSS)

Check app/globals.scss (or globals.css):
  └─ Does it contain @use '@carbon/react'?
       └─ NO → add barrel import (Step 3 — Configure SCSS)

Check app/providers.tsx (or layout.tsx):
  └─ Is there a <Theme> wrapper from @carbon/react?
       └─ NO → add Theme provider (Step 3 — Theme)
```

---

## Step 2 — Load reference files

```
What is the primary task?
  ├─ Installing Carbon or fixing SCSS build errors
  │    → load references/installation.md
  ├─ Configuring themes, dark mode, or token usage
  │    → load references/theming.md
  └─ Diagnosing client boundary errors, SCSS order issues, or Tailwind conflicts
       → load references/appRouter-gotchas.md
```

---

## Step 3 — Execute

### Install

```bash
npm install @carbon/react sass
```

Both packages are required. `@carbon/react` is the component library; `sass` is the SCSS compiler Next.js uses.

### Configure SCSS in next.config.js

WRONG — missing sassOptions:
```js
// next.config.js
const nextConfig = {};
module.exports = nextConfig;
// Result: build error — @carbon/react cannot resolve its own SCSS imports
```

CORRECT:
```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  sassOptions: {
    includePaths: ['./node_modules'],
    prependData: `@use '@carbon/react/scss/config' with ($prefix: 'cds');`,
  },
};
module.exports = nextConfig;
```

`includePaths: ['./node_modules']` lets Carbon's SCSS resolve its own internal imports. `prependData` sets the Carbon CSS class prefix to `cds` (the v11 default).

### Add the global SCSS barrel import

Create or update `app/globals.scss`:

```scss
/* app/globals.scss */
@use '@carbon/react';
```

This single line imports all Carbon component styles and design tokens. Import this file in `app/layout.tsx`:

```tsx
// app/layout.tsx
import './globals.scss';
```

### Add the Theme provider

```tsx
// app/providers.tsx
'use client'
import { Theme } from '@carbon/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <Theme theme="g100">{children}</Theme>
}
```

Wire it into the root layout:

```tsx
// app/layout.tsx
import './globals.scss'
import { Providers } from './providers'

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

Available theme values: `'white'`, `'g10'`, `'g90'`, `'g100'` (dark).

### Use design tokens instead of hardcoded values

WRONG:
```scss
.my-component {
  padding: 16px;
  color: #ffffff;
  background: #161616;
}
```

CORRECT:
```scss
@use '@carbon/react/scss/spacing' as spacing;
@use '@carbon/react/scss/colors' as colors;
@use '@carbon/react/scss/themes' as themes;

.my-component {
  padding: spacing.$spacing-05;  // = 1rem = 16px
  color: themes.$text-primary;
  background: themes.$background;
}
```

---

## Step 4 — Validate

- [ ] `@carbon/react` and `sass` appear in `package.json` dependencies
- [ ] `next.config.js` has `sassOptions.includePaths: ['./node_modules']`
- [ ] `next.config.js` has `sassOptions.prependData` with `$prefix: 'cds'`
- [ ] `globals.scss` contains `@use '@carbon/react'` (barrel import, not individual components)
- [ ] `globals.scss` is imported in `app/layout.tsx`
- [ ] `<Theme>` provider is in a `'use client'` file
- [ ] No Carbon component is imported directly in a Server Component file
- [ ] Design tokens used instead of hardcoded hex/px values where Carbon tokens exist
- [ ] `npm run build` completes without SCSS errors

---

## Reference Files

- [references/installation.md](references/installation.md) — Package installation, `next.config.js` sassOptions, `globals.scss` barrel import, `sass` requirement. **Load for all install and SCSS tasks.**
- [references/theming.md](references/theming.md) — Theme values, token reference tables, dark/light mode switching, runtime theme toggling. **Load when configuring themes or design tokens.**
- [references/appRouter-gotchas.md](references/appRouter-gotchas.md) — Client boundary errors, SCSS import order issues, Tailwind coexistence (`preflight: false`), common diagnostic steps. **Load when diagnosing Carbon errors in App Router.**

---

## Source Documentation

All content is grounded in [carbondesignsystem.com/developing/frameworks/react](https://carbondesignsystem.com/developing/frameworks/react), [carbondesignsystem.com/elements/themes/overview](https://carbondesignsystem.com/elements/themes/overview), the [Carbon v11 migration guide](https://carbondesignsystem.com/migrating/guide/overview/), and the [official Carbon Next.js example](https://github.com/carbon-design-system/carbon/tree/main/examples/next).

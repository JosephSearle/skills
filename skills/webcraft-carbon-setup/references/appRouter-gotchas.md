# Carbon App Router Gotchas

> Authority: [nextjs.org/docs/app/building-your-application/rendering/client-components](https://nextjs.org/docs/app/building-your-application/rendering/client-components) and [carbondesignsystem.com/developing/frameworks/react](https://carbondesignsystem.com/developing/frameworks/react)

Common failure modes when integrating Carbon with Next.js App Router.

---

## Gotcha 1: Missing 'use client' on Carbon components

**Symptom:** `Error: useState can only be used in a Client Component` or `You're importing a component that needs context`.

**Cause:** Carbon components use hooks and context internally. Server Components cannot render them.

WRONG — importing Carbon in a Server Component:
```tsx
// app/page.tsx (Server Component by default)
import { Button, TextInput } from '@carbon/react'

export default function Page() {
  return <Button>Click me</Button>
  // Error: cannot use hooks in Server Component
}
```

CORRECT — isolate Carbon in a client island:
```tsx
// app/components/SearchBar.tsx
'use client'
import { TextInput, Button } from '@carbon/react'

export function SearchBar() {
  return (
    <div>
      <TextInput id="search" labelText="Search" />
      <Button>Search</Button>
    </div>
  )
}
```

```tsx
// app/page.tsx (Server Component)
import { SearchBar } from './components/SearchBar'

export default async function Page() {
  const data = await fetchData()  // server-side data fetching
  return <SearchBar initialData={data} />
}
```

**Rule:** The `'use client'` directive propagates down the tree. Any component that imports from `@carbon/react` must either have `'use client'` itself or be a descendant of a component that does.

---

## Gotcha 2: SCSS import order causing token conflicts

**Symptom:** Carbon styles partially apply, colors look wrong, or `@use` conflicts with other SCSS.

**Cause:** SCSS `@use` rules must appear before any other content in a file. Mixing Carbon's barrel import with other `@use` statements can produce unexpected specificity or variable conflicts.

WRONG — other imports before Carbon:
```scss
@import 'some-other-lib/styles';
@use '@carbon/react';  // SCSS error: @use must come before other rules
```

CORRECT — Carbon barrel first:
```scss
/* globals.scss */
@use '@carbon/react';
/* any custom styles below */
```

If you need to import other SCSS libraries, ensure `@use` statements all come first and `@import` is avoided entirely (deprecated in SASS).

---

## Gotcha 3: Tailwind CSS reset conflicts

**Symptom:** Carbon buttons/inputs look unstyled or have wrong box-sizing.

**Cause:** Tailwind's `preflight` resets `box-sizing`, margins, and other base styles that Carbon depends on.

WRONG — Tailwind preflight active alongside Carbon:
```js
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{ts,tsx}'],
  // preflight enabled by default — conflicts with Carbon reset
}
```

CORRECT — disable Tailwind preflight:
```js
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
}
```

Note: Carbon ships its own CSS reset via `@carbon/reset` (included automatically in `@use '@carbon/react'`). Tailwind's preflight and Carbon's reset will conflict if both are active. Prefer Carbon's spacing and layout tokens over Tailwind utilities — they're already part of the design system.

---

## Gotcha 4: Theme context not available in components

**Symptom:** Carbon components render with wrong colors or fallback to default theme even when `<Theme theme="g100">` is set.

**Cause:** `<Theme>` sets React context. Components outside the `<Theme>` tree don't receive the context.

WRONG — Carbon component outside Theme:
```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Header />           {/* outside <Theme> — wrong colors */}
        <Providers>          {/* <Theme> is here */}
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

CORRECT — wrap everything in Theme:
```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>          {/* <Theme> wraps all Carbon UI */}
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

---

## Gotcha 5: sass package not installed

**Symptom:** `Error: 'sass' package not found` or `Cannot find module 'sass'` during `next dev` or `next build`.

**Fix:**
```bash
npm install sass
```

Next.js does not bundle a SCSS compiler — `sass` must be a project dependency. It is listed as a peer dependency of `@carbon/react` but not automatically installed.

---

## Diagnostic checklist

When Carbon styles are not applying correctly:

- [ ] Is `sass` in `package.json` dependencies?
- [ ] Does `next.config.js` have `sassOptions.includePaths: ['./node_modules']`?
- [ ] Does `globals.scss` start with `@use '@carbon/react'`?
- [ ] Is `globals.scss` imported in `app/layout.tsx`?
- [ ] Are all Carbon component files marked `'use client'`?
- [ ] Is `<Theme>` wrapping all Carbon UI in the layout?
- [ ] If using Tailwind: is `corePlugins.preflight: false` set?

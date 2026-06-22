# Carbon Installation Reference

> Authority: [carbondesignsystem.com/developing/frameworks/react](https://carbondesignsystem.com/developing/frameworks/react) and the [official Carbon Next.js example](https://github.com/carbon-design-system/carbon/tree/main/examples/next)

`@carbon/react` v11 is the current stable major version. It ships all Carbon components and design tokens as a single package.

---

## Required packages

| Package | Role | Required? |
|---------|------|-----------|
| `@carbon/react` | Component library + design tokens | **Yes** |
| `sass` | SCSS compiler (Next.js uses this to process Carbon styles) | **Yes** |
| `@carbon/ibm-products` | Extended AI/enterprise components (AILabel, Slug, etc.) | Only for AI features |
| `@carbon/ibm-products-styles` | Styles for `@carbon/ibm-products` | Paired with above |

```bash
npm install @carbon/react sass
```

---

## next.config.js sassOptions

Carbon requires two SCSS settings in `next.config.js`:

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

| Setting | Purpose |
|---------|---------|
| `includePaths: ['./node_modules']` | Allows Carbon's SCSS to resolve its own internal `@use` paths |
| `prependData` with `$prefix: 'cds'` | Sets the Carbon v11 CSS class prefix (must match v11's default `cds`) |

WRONG — omitting `includePaths`:
```js
const nextConfig = {
  sassOptions: {
    prependData: `@use '@carbon/react/scss/config' with ($prefix: 'cds');`,
  },
};
// Result: Error: Can't find stylesheet to import — @carbon/react/scss/...
```

CORRECT:
```js
const nextConfig = {
  sassOptions: {
    includePaths: ['./node_modules'],
    prependData: `@use '@carbon/react/scss/config' with ($prefix: 'cds');`,
  },
};
```

---

## globals.scss barrel import

```scss
/* app/globals.scss */
@use '@carbon/react';
```

This single import loads all Carbon component styles and resolves all token dependencies. Import order matters: this must be the first or only import in `globals.scss` to avoid CSS specificity conflicts.

WRONG — importing individual components:
```scss
@use '@carbon/react/scss/components/button';
@use '@carbon/react/scss/components/text-input';
// Result: Token dependency errors, missing styles
```

CORRECT:
```scss
@use '@carbon/react';
```

---

## app/layout.tsx wiring

```tsx
// app/layout.tsx (Server Component)
import './globals.scss'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

The `globals.scss` import must be in `layout.tsx` (not in a client component) so Next.js includes it in the initial CSS bundle.

---

## Adding @carbon/ibm-products (AI components)

When using `AILabel`, `Slug`, or chat-specific AI components:

```bash
npm install @carbon/ibm-products @carbon/ibm-products-styles
```

Add to `globals.scss`:
```scss
@use '@carbon/react';
@use '@carbon/ibm-products/css/index.min.css';
```

`@carbon/ibm-products` components also require a `'use client'` boundary.

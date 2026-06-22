# Storybook Setup Reference

> Authority: [storybook.js.org/docs](https://storybook.js.org/docs) and [storybook.js.org/docs/writing-tests/vitest-plugin](https://storybook.js.org/docs/writing-tests/vitest-plugin)

Storybook 8 provides isolated development and documentation for custom Carbon-based components. The Vitest integration lets stories double as component tests.

---

## Initialisation

```bash
npx storybook@latest init
```

Storybook detects the Next.js framework and configures `@storybook/nextjs` automatically. Accept defaults.

This creates:
```
.storybook/
  main.ts       ← framework config, addons, stories glob
  preview.ts    ← global decorators, parameters
stories/        ← example stories (can be deleted)
```

---

## .storybook/main.ts

```ts
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs'

const config: StorybookConfig = {
  stories: ['../app/**/*.stories.@(ts|tsx)', '../components/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
}

export default config
```

`@storybook/addon-a11y` is essential for Carbon — it surfaces ARIA issues in the Storybook panel alongside Carbon's own a11y requirements.

---

## .storybook/preview.ts — Carbon theme decorator

The Carbon `<Theme>` wrapper must be applied globally so every story renders with the correct Carbon theme:

```ts
// .storybook/preview.ts
import type { Preview } from '@storybook/react'
import { Theme } from '@carbon/react'
import React from 'react'
import '../app/globals.scss'

const withCarbonTheme = (Story: React.FC, context: { globals: { theme: string } }) => {
  const theme = (context.globals?.theme as 'white' | 'g10' | 'g90' | 'g100') ?? 'g100'
  return React.createElement(Theme, { theme }, React.createElement(Story))
}

const preview: Preview = {
  decorators: [withCarbonTheme],
  globalTypes: {
    theme: {
      name: 'Carbon Theme',
      description: 'Carbon Design System theme',
      defaultValue: 'g100',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'white', title: 'White' },
          { value: 'g10', title: 'Gray 10' },
          { value: 'g90', title: 'Gray 90' },
          { value: 'g100', title: 'Gray 100 (Dark)' },
        ],
        showName: true,
      },
    },
  },
}

export default preview
```

This adds a theme switcher toolbar to Storybook so developers can test components in all four Carbon themes.

---

## Writing a Carbon component story

```tsx
// app/components/ChatInput.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { ChatInput } from './ChatInput'

const meta: Meta<typeof ChatInput> = {
  component: ChatInput,
  title: 'Chat/ChatInput',
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    onSubmit: { action: 'submitted' },
    disabled: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof ChatInput>

export const Default: Story = {
  args: {
    placeholder: 'Ask something...',
    disabled: false,
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Ask something...',
    disabled: true,
  },
}

export const Loading: Story = {
  args: {
    placeholder: 'Ask something...',
    isLoading: true,
  },
}
```

---

## Vitest integration (story-as-test)

Storybook 8 integrates with Vitest so each story is automatically run as a component test:

```bash
npm install --save-dev @storybook/test @storybook/experimental-addon-test
```

Add to `vitest.config.ts`:
```ts
import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    storybookTest(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
})
```

Stories are now runnable via `npx vitest`. Each story's `play` function (if defined) becomes an interaction test.

---

## package.json scripts

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

---

## Common Carbon/Storybook issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Styles not applying | `globals.scss` not imported in `preview.ts` | Add `import '../app/globals.scss'` |
| Wrong theme | `withCarbonTheme` decorator missing | Add decorator to `preview.ts` |
| `ResizeObserver` errors | Carbon uses ResizeObserver, jsdom doesn't have it | Add polyfill in `test/setup.ts` |
| Next.js Image not working | Static dir not configured | Set `staticDirs: ['../public']` in `main.ts` |

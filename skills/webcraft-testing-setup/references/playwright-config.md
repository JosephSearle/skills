# Playwright Configuration Reference

> Authority: [playwright.dev/docs/test-configuration](https://playwright.dev/docs/test-configuration) and [playwright.dev/docs/ci](https://playwright.dev/docs/ci)

Playwright E2E tests run against the containerised app on OpenShift staging. The base URL is injected via environment variable so the same tests run locally and in CI.

---

## Installation

```bash
npm install --save-dev @playwright/test
npx playwright install  # downloads browser binaries
```

---

## playwright.config.ts

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start local dev server when not testing against staging
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
      },
})
```

---

## Environment setup

For local runs (against `localhost:3000`):
```bash
npx playwright test
```

For staging runs (against OpenShift):
```bash
BASE_URL=https://myapp.staging.example.com npx playwright test
```

Store the staging URL in CI secrets, not hardcoded in config.

---

## E2E test structure

```ts
// test/e2e/chat.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Chat interface', () => {
  test('sends a message and receives a response', async ({ page }) => {
    await page.goto('/')

    // Wait for Carbon to load (check for the UI shell header)
    await expect(page.getByRole('banner')).toBeVisible()

    // Type a message
    const input = page.getByLabel('Message')
    await input.fill('Hello agent')

    // Submit
    await page.getByRole('button', { name: 'Send' }).click()

    // Wait for response (streaming — wait for text to appear)
    await expect(page.getByRole('log')).toContainText('Hello', { timeout: 15_000 })
  })

  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
  })
})
```

---

## Authentication setup (if the app has auth)

```ts
// test/e2e/auth.setup.ts
import { test as setup } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill(process.env.TEST_USERNAME!)
  await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await page.waitForURL('/')
  await page.context().storageState({ path: 'test/e2e/.auth/user.json' })
})
```

```ts
// playwright.config.ts — add auth dependency
projects: [
  {
    name: 'setup',
    testMatch: /auth\.setup\.ts/,
  },
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'test/e2e/.auth/user.json',
    },
    dependencies: ['setup'],
  },
],
```

---

## .gitignore additions

```
test/e2e/.auth/
test-results/
playwright-report/
```

---

## CI integration (GitHub Actions example)

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npx playwright test
  env:
    BASE_URL: ${{ secrets.STAGING_URL }}
    CI: true
```

For OpenShift/Tekton pipelines, the same pattern applies: inject `BASE_URL` from a pipeline parameter or ConfigMap referencing the staging route URL.

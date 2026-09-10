import { expect, test } from '@playwright/test';

test('homepage lists at least one skill', async ({ page }) => {
  await page.goto('/');
  const skillLinks = page.locator('a[href^="/skills/"]');
  await expect(skillLinks.first()).toBeVisible();
});

test('skill detail page renders content and a download link', async ({ page }) => {
  await page.goto('/');
  const firstSkillLink = page.locator('a[href^="/skills/"]').first();
  const href = await firstSkillLink.getAttribute('href');
  expect(href).toBeTruthy();

  await firstSkillLink.click();
  await expect(page).toHaveURL(new RegExp(`${href}/?$`));

  const downloadLink = page.locator('a[href$=".skill"]');
  await expect(downloadLink.first()).toBeVisible();
});

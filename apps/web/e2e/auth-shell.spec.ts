import { expect, test } from '@playwright/test'

test('unauthenticated users are redirected to the login page', async ({ page }) => {
  await page.goto('/apps')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
})

test('login form remains usable at mobile width', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel(/username/i)).toBeVisible()
  await expect(page.getByLabel(/password/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
})

test('auth pixel backdrop is visible in dark mode and suppressed in OLED mode', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto('/login')

  const canvas = page.getByTestId('auth-pixel-canvas')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(canvas).toBeVisible()

  await page.getByRole('button', { name: 'Choose theme' }).click()
  await page.getByRole('menuitem', { name: 'OLED' }).click()

  await expect(page.locator('html')).toHaveClass(/oled/)
  await expect(canvas).toBeHidden()
})

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

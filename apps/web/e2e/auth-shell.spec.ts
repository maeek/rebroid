import { expect, test } from '@playwright/test'

test('unauthenticated users are redirected to the login page', async ({ page }) => {
  await page.goto('/apps')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('login form remains usable at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 })
  await page.goto('/login')
  await expect(page.getByLabel(/username/i)).toBeVisible()
  await expect(page.getByLabel(/password/i)).toBeVisible()
  const submit = page.getByRole('button', { name: 'Sign in' })
  await expect(submit).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await submit.click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Enter your username and password.')
})

test('signed-out branding and form follow the console design across themes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto('/login')

  await expect(page.locator('html')).toHaveClass(/dark/)
  const header = page.getByRole('banner')
  const logo = header.getByRole('link', { name: 'Rebroid', exact: true }).locator('img')
  await expect(logo).toBeVisible()
  await expect(logo).toHaveAttribute('src', '/rebroid-icon.svg')
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await expect(page.locator('head link[rel="icon"]')).toHaveAttribute('href', '/rebroid-icon.svg')

  const panel = page.getByRole('main').locator('[data-level="panel"]')
  await expect(panel).toHaveClass(/\bshadow-none\b/)
  for (const theme of ['Dark', 'Light', 'OLED']) {
    await header.getByRole('button', { name: 'Choose theme' }).click()
    await page.getByRole('menuitemradio', { name: theme, exact: true }).click()
    await expect(page.locator('html')).toHaveClass(new RegExp(theme.toLowerCase()))
    await expect(logo).toHaveAttribute('src', '/rebroid-icon.svg')
    const editorBackground = await panel.evaluate(element => {
      const probe = document.createElement('span')
      probe.style.backgroundColor = 'hsl(var(--surface-editor))'
      element.append(probe)
      const background = getComputedStyle(probe).backgroundColor
      probe.remove()
      return background
    })
    await expect(panel).toHaveCSS('background-color', editorBackground)
  }
})

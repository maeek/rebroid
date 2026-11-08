import { expect, test } from '@playwright/test'

const widths = [390, 768, 1440, 2048]

test('trigger creation uses consistent, searchable and keyboard accessible fields', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=triggers')
    const table = page.getByRole('table')
    const before = await table.boundingBox()
    await page.getByRole('checkbox', { name: 'Select current page' }).check()
    expect((await table.boundingBox())?.y).toBe(before?.y)
    await page.getByRole('checkbox', { name: 'Select current page' }).uncheck()
    await page.getByRole('button', { name: 'New trigger' }).click()
    const dialog = page.getByRole('dialog', { name: 'New trigger' })
    const target = dialog.getByRole('combobox', { name: /Target app/ })
    await target.fill('Reports')
    await page.getByRole('option', { name: /Reports worker/ }).click()
    await expect(target).toHaveValue('Reports worker')
    const workflow = dialog.getByRole('combobox', { name: /Workflow/ })
    await workflow.fill('inventory')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(workflow).toHaveValue('Daily inventory check')
    await dialog.getByRole('combobox', { name: 'Frequency' }).click()
    await page.getByRole('option', { name: 'Every month', exact: true }).click()
    await expect(dialog.getByRole('spinbutton', { name: 'Day of month' })).toBeVisible()
    await expect(dialog.getByLabel('Time', { exact: true })).toBeVisible()
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
        document.documentElement.style.colorScheme = value === 'light' ? 'light' : 'dark'
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
      await page.screenshot({
        path: `/tmp/rebroid-console-trigger-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'New trigger' })).toBeFocused()
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    const filters = page.getByRole('dialog', { name: 'Filters' })
    await expect(filters.getByRole('combobox', { name: 'Target app' })).toBeVisible()
    await expect(filters.getByRole('combobox', { name: 'State' })).toBeVisible()
    await filters.getByRole('button', { name: 'Done' }).click()
  }
  expect(errors).toEqual([])
})

test('network policies keep the same grid and filter geometry while loading', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=policies-loading')
    const header = await page.getByRole('columnheader').allTextContents()
    const loadingGrid = await page.getByRole('table').boundingBox()
    await expect(page.getByRole('button', { name: 'Reconcile all' })).toBeDisabled()
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Restriction' })).toBeEnabled()
    await page.getByRole('button', { name: 'Done' }).click()
    await page.goto('/skeleton-contract-test?editor=policies')
    expect(await page.getByRole('columnheader').allTextContents()).toEqual(header)
    const readyGrid = await page.getByRole('table').boundingBox()
    expect(readyGrid?.x).toBe(loadingGrid?.x)
    expect(readyGrid?.width).toBe(loadingGrid?.width)
    expect(readyGrid?.y).toBe(loadingGrid?.y)
    await expect(page.getByRole('button', { name: 'Reconcile all' })).toBeEnabled()
    await expect(page.getByRole('link', { name: 'Inventory worker' })).toHaveAttribute(
      'href',
      '/app/preview-app?view=configuration'
    )
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
        document.documentElement.style.colorScheme = value === 'light' ? 'light' : 'dark'
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
      await page.screenshot({
        path: `/tmp/rebroid-console-policies-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
  }
})

test('resource titles wrap and the expanded sidebar remains scrollable to its last link', async ({ page }) => {
  await page.route('**/api/bff/shell/recent-apps', route =>
    route.fulfill({ json: { ok: true, data: [], requestId: 'preview' } })
  )
  for (const width of widths) {
    await page.setViewportSize({ width, height: 480 })
    await page.goto('/skeleton-contract-test?editor=console-shell')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('inventory-worker-'.repeat(8))
    await expect(page.getByRole('button', { name: 'Remove', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    if (width >= 1024) {
      for (const group of ['Platform settings', 'Infrastructure', 'Access and policies']) {
        await page.getByRole('button', { name: `Expand ${group} menu` }).click()
      }
      const general = page.getByRole('link', { name: 'General', exact: true })
      await general.scrollIntoViewIfNeeded()
      const link = await general.boundingBox()
      expect(link!.y + link!.height).toBeLessThanOrEqual(480)
      const sidebar = await page.locator('aside').boundingBox()
      expect(sidebar!.y + sidebar!.height).toBe(480)
    }
  }
})

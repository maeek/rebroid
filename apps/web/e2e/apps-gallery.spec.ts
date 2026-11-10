import { expect, test } from '@playwright/test'
import { galleryPreviewApplications } from '../src/features/applications/list/apps-gallery-preview-data'

const recentApps = [
  { id: 'recent-2', name: 'Warehouse scanner', openedAt: 200, status: 'stopped' },
  { id: 'recent-1', name: 'Inventory worker', openedAt: 100, status: 'error' }
]

test.beforeEach(async ({ page }) => {
  await page.route('**/api/applications', route => route.fulfill({ json: galleryPreviewApplications }))
})

test('gallery search, status, menus and visible selection work together without shifting tiles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=apps-gallery')
  const tiles = page.locator('[data-app-tile]')
  await expect(tiles).toHaveCount(8)
  const search = page.getByRole('searchbox')
  await search.fill('warehouse')
  await expect(tiles).toHaveCount(1)
  await expect(tiles).toContainText('Warehouse scanner')
  await page.getByRole('button', { name: 'Clear search', exact: true }).click()
  await expect(tiles).toHaveCount(8)
  await page.getByRole('button', { name: 'Actions for Inventory worker', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Configuration' })).toHaveAttribute(
    'href',
    '/app/gallery-app-0?view=configuration'
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Actions for Inventory worker', exact: true })).toBeFocused()
  await page.getByRole('combobox', { name: 'App status' }).click()
  await page.getByRole('option', { name: 'Needs attention', exact: true }).click()
  await page.getByRole('option', { name: 'Needs attention', exact: true }).waitFor({ state: 'detached' })
  await expect(tiles).toHaveCount(1)
  await expect(page.getByRole('combobox', { name: 'App status' })).toContainText('Needs attention')
  await page.mouse.move(0, 0)
  await expect(tiles.first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const appLink = page.getByRole('link', { name: 'Open Inventory worker', exact: true })
  await expect(appLink).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  if (await page.evaluate(() => matchMedia('(hover: hover)').matches)) {
    await appLink.hover()
    await expect(appLink).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  }
  await page.mouse.move(0, 0)
  await page.screenshot({ path: `/tmp/rebroid-gallery-single-${test.info().project.name}.png`, fullPage: true })
  const original = await tiles.first().boundingBox()
  await page.getByRole('button', { name: 'Select apps', exact: true }).click()
  await page.getByRole('button', { name: 'Select Inventory worker', exact: true }).click()
  expect(await tiles.first().boundingBox()).toEqual(original)
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Delete 1 selected app?')
  await expect(dialog).toContainText('Inventory worker')
  await expect(dialog).not.toContainText('Warehouse scanner')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await search.fill('does not exist')
  await expect(page.getByRole('heading', { name: 'No matching apps' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear search and filters' }).click()
  await expect(tiles).toHaveCount(8)
})

test('gallery and its loader fit small and large screens in every theme', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=apps-gallery-loading')
    const loadingHeading = await page.getByRole('heading', { name: /^My apps/ }).boundingBox()
    await expect(page.getByRole('searchbox')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Loading app actions' }).first().locator('..')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)'
    )
    await page.goto('/skeleton-contract-test?editor=apps-gallery')
    await expect(page.locator('[data-app-tile]')).toHaveCount(8)
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      const tile = page.locator('[data-app-tile]').first()
      expect((await tile.boundingBox())!.width).toBeGreaterThan(130)
      await page.screenshot({
        path: `/tmp/rebroid-gallery-${width}-${theme}-${test.info().project.name}.png`,
        fullPage: true,
        animations: 'disabled'
      })
    }
    expect((await page.getByRole('heading', { name: /^My apps/ }).boundingBox())!.y - loadingHeading!.y).toBe(0)
  }
  expect(errors).toEqual([])
})

test('overview recent shortcuts preserve visit order and handle empty or unavailable history', async ({ page }) => {
  let apps = recentApps
  let unavailable = false
  await page.route('**/api/bff/applications/recent', route =>
    route.fulfill({
      status: unavailable ? 503 : 200,
      json: unavailable
        ? { ok: false, error: { code: 'upstream_unavailable', message: 'Unavailable' }, requestId: 'preview' }
        : { ok: true, data: apps, requestId: 'preview' }
    })
  )
  await page.route('**/api/bff/platform/operations', route =>
    route.fulfill({
      json: {
        ok: true,
        data: { failedCount: 0, pendingCount: 0, activeRunCount: 0, failed: [], pending: [], runs: [] },
        requestId: 'preview'
      }
    })
  )
  await page.route('**/api/bff/platform/resources', route =>
    route.fulfill({
      status: 503,
      json: { ok: false, error: { code: 'upstream_unavailable', message: 'Unavailable' }, requestId: 'preview' }
    })
  )
  await page.goto('/skeleton-contract-test?editor=overview')
  const recent = page.getByRole('region', { name: 'Recently opened', exact: true })
  const shortcuts = recent.locator('a[href^="/app/"]')
  await expect(shortcuts).toHaveCount(2)
  await expect(shortcuts.first()).toContainText('Warehouse scanner')
  await expect(shortcuts.first()).toHaveAttribute('href', '/app/recent-2')
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.screenshot({
      path: `/tmp/rebroid-overview-recent-${width}-${test.info().project.name}.png`,
      fullPage: true,
      animations: 'disabled'
    })
  }
  apps = []
  await page.reload()
  await expect(recent).toContainText('Apps you open will appear here')
  unavailable = true
  await page.reload()
  await expect(recent).toContainText('Recently opened apps could not be loaded', { timeout: 15_000 })
  await expect(recent.getByRole('link', { name: 'All apps' })).toHaveAttribute('href', '/apps')
})

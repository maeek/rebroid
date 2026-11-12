import { expect, test } from '@playwright/test'
import { galleryPreviewApplications } from '../src/features/applications/list/apps-gallery-preview-data'

const recentApps = [
  { id: 'recent-2', name: 'Warehouse scanner', openedAt: 200, status: 'stopped' },
  {
    id: 'recent-1',
    name: 'Inventory worker',
    openedAt: 100,
    status: 'error',
    ownerDisplayName: 'Operations',
    canClone: true
  }
]

test.beforeEach(async ({ page }) => {
  await page.route('**/api/applications', route => route.fulfill({ json: galleryPreviewApplications }))
})

test('phone gallery controls share gutters in ready and loading states', async ({ page }) => {
  for (const width of [320, 384, 430]) {
    await page.setViewportSize({ width, height: 800 })
    for (const editor of ['apps-gallery', 'apps-gallery-loading']) {
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      await expect(page.getByRole('heading', { name: 'Apps', exact: true })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'breadcrumb' })).toBeHidden()
      await expect(page.getByText('Create app', { exact: true })).toBeVisible()
      const search = (await page.getByRole('searchbox').boundingBox())!
      const sortButton = page.getByRole('button', { name: 'Sort apps', exact: true })
      await expect(sortButton.locator('svg.tabler-icon-arrows-sort')).toBeVisible()
      const sort = (await sortButton.boundingBox())!
      const filters = page.getByRole('button', { name: 'Filters', exact: true })
      await expect(filters).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      const filter = (await filters.boundingBox())!
      await expect(page.getByRole('button', { name: 'Select apps', exact: true })).toBeHidden()
      expect(search.y).toBe(sort.y)
      expect(filter.y).toBe(search.y)
      expect(filter.x - (search.x + search.width)).toBe(8)
      expect(sort.x - (filter.x + filter.width)).toBe(8)
      expect(sort.x + sort.width).toBe(width - search.x)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    }
  }
})

test('gallery search, status, menus and visible selection work together without shifting tiles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=apps-gallery')
  await expect(page.getByRole('navigation', { name: 'breadcrumb' }).getByText('All apps')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sort apps' }).locator('svg.tabler-icon-settings')).toBeVisible()
  const tiles = page.locator('[data-app-tile]')
  await expect(tiles).toHaveCount(8)
  await expect(page.getByRole('heading', { name: /^My apps|^Other users/ })).toHaveCount(0)
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
  const filterButton = page.getByRole('button', { name: /^Filters/ })
  await filterButton.click()
  const filterSheet = page.getByRole('dialog', { name: 'Filter apps' })
  await expect(filterSheet.getByRole('radio', { name: 'Name A–Z' })).toHaveCount(0)
  await filterSheet.getByRole('radio', { name: 'Needs attention', exact: true }).check()
  await filterSheet.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(filterSheet).toBeHidden()
  await expect(filterButton).toBeFocused()
  await expect(tiles).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Remove Status filter' })).toBeVisible()
  await page.mouse.move(0, 0)
  await expect(tiles.first()).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const appLink = page.getByRole('link', { name: 'Open Inventory worker', exact: true })
  await expect(appLink).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  if (await page.evaluate(() => matchMedia('(hover: hover)').matches)) {
    await appLink.hover()
    await expect(appLink).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  }
  await page.mouse.move(0, 0)
  await page.screenshot({ path: `/tmp/rebroid-gallery-single-${test.info().project.name}.png`, fullPage: true })
  const original = await tiles.first().boundingBox()
  const selectApps = page.getByRole('button', { name: 'Select apps', exact: true })
  const selectTile = page.getByRole('button', { name: 'Select Inventory worker', exact: true })
  if (await selectApps.isVisible()) {
    await selectApps.click()
    await expect(page.getByText('0 selected', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeFocused()
    await selectTile.click()
  } else {
    await page.getByRole('button', { name: 'Actions for Inventory worker', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Select app', exact: true }).click()
    await expect(selectTile).toBeFocused()
  }
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

test('a shared status URL opens the matching apps and can be cleared', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=apps-gallery&status=error')
  const tiles = page.locator('[data-app-tile]')
  const removeStatus = page.getByRole('button', { name: 'Remove Status filter' })
  await expect(tiles).toHaveCount(1)
  await expect(tiles).toContainText('Inventory worker')
  await expect(removeStatus).toBeVisible()
  await page.reload()
  await expect(tiles).toHaveCount(1)
  await removeStatus.click()
  await expect(tiles).toHaveCount(8)
  await expect(page).toHaveURL(
    url => url.searchParams.get('editor') === 'apps-gallery' && !url.searchParams.has('status')
  )
})

test('the in-progress URL includes stopping apps alongside provisioning and removal', async ({ page }) => {
  const apps = galleryPreviewApplications.map((app, index) => {
    if (index === 1)
      return { ...app, status: { ...app.status, currentStatus: 'provisioning', lifecycleStage: 'queued' } }
    if (index === 2) return { ...app, status: { ...app.status, currentStatus: 'running', lifecycleStage: 'stopping' } }
    if (index === 3) return { ...app, status: { ...app.status, currentStatus: 'removing', lifecycleStage: 'removing' } }
    return app
  })
  await page.route('**/api/applications', route => route.fulfill({ json: apps }))
  await page.goto('/skeleton-contract-test?editor=apps-gallery&status=working')
  const tiles = page.locator('[data-app-tile]')
  await expect(tiles).toHaveCount(3)
  await expect(page.getByText('In progress', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Status filter' })).toBeVisible()
  await expect(tiles.filter({ hasText: 'Checkout terminal' })).toContainText('Stopping')
})

test('admin ownership filters scope the same gallery and combine with status', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=apps-gallery')
  const tiles = page.locator('[data-app-tile]')
  const filters = page.getByRole('button', { name: /^Filters/ })
  await filters.click()
  const sheet = page.getByRole('dialog', { name: 'Filter apps' })
  const ownership = sheet.getByRole('radiogroup', { name: 'Ownership' })
  await ownership.getByRole('radio', { name: 'All owners' }).press('ArrowDown')
  await expect(ownership.getByRole('radio', { name: 'Owned by me' })).toBeChecked()
  await expect(ownership.getByRole('radio', { name: 'Owned by me' })).toBeFocused()
  await sheet.getByRole('radio', { name: 'Owned by others' }).check()
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(tiles).toHaveCount(1)
  await expect(tiles.first()).toContainText('Operations team')
  await expect(tiles.first()).toContainText(/stopped/i)
  await expect(page.getByRole('button', { name: 'Remove Ownership filter' })).toBeVisible()

  await filters.click()
  await sheet.getByRole('radio', { name: 'Needs attention' }).check()
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'No matching apps' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear search and filters' }).click()
  await expect(tiles).toHaveCount(8)

  await filters.click()
  await sheet.getByRole('radio', { name: 'Owned by me' }).check()
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(tiles).toHaveCount(7)
  await page.getByRole('button', { name: 'Remove Ownership filter' }).click()
  await expect(tiles).toHaveCount(8)
})

test('sorting and selection stay usable on a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/skeleton-contract-test?editor=apps-gallery')
  const tiles = page.locator('[data-app-tile]')
  const sort = page.getByRole('button', { name: 'Sort apps', exact: true })
  await sort.click()
  const menu = page.getByRole('menu', { name: 'Sort apps' })
  const selectedOrder = menu.getByRole('menuitemradio', { name: 'Name A–Z', checked: true })
  await expect(selectedOrder).toBeVisible()
  await expect(selectedOrder).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(menu).toHaveCSS('border-top-width', '1px')
  const descending = menu.getByRole('menuitemradio', { name: 'Name Z–A', exact: true })
  await page.keyboard.press('Home')
  await expect(selectedOrder).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(descending).toBeFocused()
  await expect(selectedOrder).toHaveAttribute('aria-checked', 'true')
  const selectedFill = await selectedOrder.evaluate(node => getComputedStyle(node).backgroundColor)
  await expect(descending).not.toHaveCSS('background-color', selectedFill)
  await descending.click()
  await expect(menu).toBeHidden()
  await expect(sort).toBeFocused()
  await expect(tiles.first()).toContainText('Warehouse scanner')
  const firstPosition = () => tiles.first().evaluate(tile => tile.getBoundingClientRect().top + scrollY)
  const beforeSelection = await firstPosition()
  const search = (await page.getByRole('searchbox').boundingBox())!

  await expect(page.getByRole('button', { name: 'Select apps', exact: true })).toBeHidden()
  await page.getByRole('button', { name: /^Actions for Warehouse scanner/ }).click()
  await page.getByRole('menuitem', { name: 'Select app', exact: true }).click()
  const count = page.getByText('1 selected', { exact: true })
  await expect(count).toBeVisible()
  expect((await count.boundingBox())!.x).toBe(search.x)
  const done = page.getByRole('button', { name: 'Done', exact: true })
  const remove = page.getByRole('button', { name: 'Delete', exact: true })
  const doneBox = (await done.boundingBox())!
  const removeBox = (await remove.boundingBox())!
  expect(removeBox.x + removeBox.width).toBeLessThanOrEqual(doneBox.x)
  expect(doneBox.x + doneBox.width).toBeLessThanOrEqual(304)
  expect(await firstPosition()).toBe(beforeSelection)
  await done.click()
  await expect(page.getByRole('searchbox')).toBeVisible()
})

test('a touch hold opens tile actions and a swipe leaves selection inactive', async ({
  page,
  browserName,
  hasTouch
}) => {
  test.skip(!hasTouch || browserName !== 'chromium', 'Uses Chromium touch input')
  await page.goto('/skeleton-contract-test?editor=apps-gallery')
  const tile = page.getByRole('link', { name: 'Open Inventory worker', exact: true })
  await tile.scrollIntoViewIfNeeded()
  const box = (await tile.boundingBox())!
  const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }
  const input = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: (typeof point)[]) =>
    input.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  const menu = page.getByRole('menu', { name: 'Actions for Inventory worker' })

  await touch('touchStart', [point])
  await touch('touchMove', [{ ...point, y: point.y - 45 }])
  await page.waitForTimeout(600)
  await expect(menu).toBeHidden()
  await touch('touchEnd', [])

  await tile.scrollIntoViewIfNeeded()
  const movedBox = (await tile.boundingBox())!
  await touch('touchStart', [{ x: point.x, y: Math.round(movedBox.y + movedBox.height / 2) }])
  await expect(menu).toBeVisible()
  await touch('touchEnd', [])
  await expect(menu).toBeVisible()
  await expect(page).toHaveURL(/editor=apps-gallery$/)
  await menu.getByRole('menuitem', { name: 'Select app', exact: true }).tap()

  await expect(page.getByRole('button', { name: 'Select Inventory worker' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Select Warehouse scanner' }).tap()
  await expect(page.getByText('2 selected', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Done', exact: true }).tap()
  await expect(tile).toBeVisible()
})

test('gallery and its loader fit small and large screens in every theme', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=apps-gallery-loading')
    const loadingTile = page.getByRole('list', { name: 'Apps', exact: true }).getByRole('listitem').first()
    const loadingBox = await loadingTile.boundingBox()
    await expect(page.getByRole('searchbox')).toBeDisabled()
    await expect(loadingTile).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await page.goto('/skeleton-contract-test?editor=apps-gallery')
    await expect(page.locator('[data-app-tile]')).toHaveCount(8)
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.classList.remove('light', 'dark', 'oled')
        document.documentElement.classList.add(value)
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      const tile = page.locator('[data-app-tile]').first()
      expect((await tile.boundingBox())!.width).toBeGreaterThan(130)
      await page.screenshot({
        path: `/tmp/rebroid-gallery-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
    expect(await page.locator('[data-app-tile]').first().boundingBox()).toEqual(loadingBox)
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
        data: { failedCount: 0, pendingCount: 0, activeRunCount: 0 },
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
  await page.setViewportSize({ width: 2048, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=apps-gallery')
  const galleryTile = (await page.locator('[data-app-tile]').first().boundingBox())!
  await page.goto('/skeleton-contract-test?editor=overview')
  const recent = page.getByRole('region', { name: 'Recently opened', exact: true })
  const shortcuts = recent.locator('a[href^="/app/"]')
  await expect(shortcuts).toHaveCount(2)
  await expect(shortcuts.first()).toContainText('Warehouse scanner')
  await expect(shortcuts.first()).toHaveAttribute('href', '/app/recent-2')
  const overviewTile = (await recent.locator('[data-app-tile]').first().boundingBox())!
  expect(overviewTile.width).toBe(galleryTile.width)
  expect(overviewTile.height).toBe(galleryTile.height)
  await expect(shortcuts.nth(1)).toContainText('Operations')
  await expect(shortcuts.nth(1)).toContainText('Clone to run')
  await recent.getByRole('button', { name: 'Actions for Inventory worker · Operations' }).click()
  const menu = page.getByRole('menu', { name: 'Actions for Inventory worker · Operations' })
  await expect(menu.getByRole('menuitem', { name: 'Open as me' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Configuration' })).toHaveAttribute(
    'href',
    '/app/recent-1?view=configuration'
  )
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
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

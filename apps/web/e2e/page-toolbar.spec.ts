import { expect, test } from '@playwright/test'

test('loading the next grid page keeps the active search visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const [editor, param, label] of [
    ['workflows-loading', 'q', 'Search workflows'],
    ['triggers-loading', 'q', 'Search triggers'],
    ['activity-loading', 'search', 'Search actor, action, resource, or details']
  ]) {
    await page.goto(`/skeleton-contract-test?editor=${editor}&${param}=inventory&page=2`)
    const search = page.getByRole('searchbox', { name: label })
    await expect(search).toHaveValue('inventory', { timeout: 1500 })
    expect((await search.boundingBox())!.width).toBeGreaterThan(180)
  }
})

test('loading toolbar keeps its search expanded under the pointer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  test.skip(!(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)))
  await page.goto('/skeleton-contract-test?editor=services-loading')
  const search = page.getByRole('searchbox', { name: 'Search services' })
  await expect(search).toBeDisabled()
  await search.hover()
  await expect.poll(async () => (await search.boundingBox())!.width, { timeout: 1500 }).toBeGreaterThan(180)
})

test('wide page search expands from the breadcrumb row and keeps an active query visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=services')

  const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
  const search = page.getByRole('searchbox', { name: 'Search services' })
  const refresh = page.getByRole('button', { name: 'Refresh', exact: true })
  const table = page.getByRole('table')
  const gridTop = (await table.boundingBox())!.y
  const collapsedWidth = (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) ? '44px' : '36px'

  await expect(search).toHaveCSS('width', collapsedWidth)
  expect((await search.boundingBox())!.y).toBeLessThan((await breadcrumb.boundingBox())!.y + 10)
  expect((await search.boundingBox())!.x).toBeLessThan((await refresh.boundingBox())!.x)
  if (await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)) {
    await search.hover()
    await expect.poll(async () => (await search.boundingBox())!.width).toBeGreaterThan(180)
    await page.mouse.move(1, 1)
    await expect(search).toHaveCSS('width', collapsedWidth)
  }

  await search.focus()
  await expect.poll(async () => (await search.boundingBox())!.width).toBeGreaterThan(180)
  expect((await table.boundingBox())!.y).toBe(gridTop)
  await search.fill('unlisted service')
  await expect(page.getByRole('heading', { name: 'No matching results' })).toBeVisible()
  await search.blur()
  await expect.poll(async () => (await search.boundingBox())!.width).toBeGreaterThan(180)
  await page.locator('[data-slot="data-grid-toolbar"]').getByRole('button', { name: 'Clear search' }).click()
  await page.getByRole('heading', { name: 'Services', exact: true }).click()
  await expect(search).toHaveCSS('width', collapsedWidth)
  await expect(page.getByRole('link', { name: 'Orchestrator', exact: true })).toBeVisible()
})

test('filters and selection share the wide breadcrumb row while narrow search stays by the grid', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=triggers')

  const search = page.getByRole('searchbox', { name: 'Search triggers' })
  const filters = page.getByRole('button', { name: 'Filters', exact: true })
  const heading = page.getByRole('heading', { name: 'Triggers', exact: true })
  const table = page.getByRole('table')
  const gridTop = (await table.boundingBox())!.y

  expect((await filters.boundingBox())!.x).toBeLessThan((await search.boundingBox())!.x)
  expect((await filters.boundingBox())!.y).toBeLessThan((await heading.boundingBox())!.y)
  await filters.click()
  await page.getByRole('dialog', { name: 'Filters' }).getByRole('button', { name: 'Done' }).click()
  await expect(filters).toBeFocused()

  await page.getByRole('checkbox', { name: 'Select current page' }).check()
  await expect(search).toBeHidden()
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
  expect((await table.boundingBox())!.y).toBe(gridTop)
  await page.getByRole('checkbox', { name: 'Select current page' }).uncheck()

  await page.setViewportSize({ width: 390, height: 900 })
  expect((await search.boundingBox())!.y).toBeGreaterThan((await heading.boundingBox())!.y)
  expect((await search.boundingBox())!.width).toBeGreaterThan(180)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('page toolbars share the breadcrumb row and the viewer keeps its local search', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const collapsedWidth = (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) ? '44px' : '36px'
  for (const [editor, label] of [
    ['apps-gallery', 'Search apps'],
    ['workflows', 'Search workflows'],
    ['run-history', 'Search runs, targets, or errors'],
    ['run-history-loading', 'Search runs, targets, or errors'],
    ['features', 'Search features'],
    ['policies', 'Search policies'],
    ['activity', 'Search actor, action, resource, or details'],
    ['ai-list', 'Search AI providers'],
    ['scheduler', 'Search scheduled tasks'],
    ['users-list', 'Search users']
  ]) {
    await page.goto(`/skeleton-contract-test?editor=${editor}`)
    const search = page.getByRole('searchbox', { name: label })
    await expect(search).toHaveCSS('width', collapsedWidth)
    const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
    expect((await search.boundingBox())!.y, editor).toBeLessThan((await breadcrumb.boundingBox())!.y + 10)
  }

  await page.goto('/skeleton-contract-test?editor=app-resource&view=activity')
  const localSearch = page.getByRole('searchbox', { name: 'Search actor, action, resource, or details' })
  expect((await localSearch.boundingBox())!.width).toBeGreaterThan(180)
  expect((await localSearch.boundingBox())!.y).toBeGreaterThan(
    (await page.getByRole('heading', { level: 1 }).boundingBox())!.y
  )
})

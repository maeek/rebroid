import { expect, test } from '@playwright/test'

test('breadcrumb position matches the viewer across page headers', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const offsets = []
    for (const editor of ['app-resource', 'services', 'services-loading', 'service-docker', 'workflow']) {
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
      offsets.push(
        await breadcrumb.evaluate(nav => {
          const pageTop = nav.closest('header, .app-device-layout')!.getBoundingClientRect().top
          const { top, height } = nav.getBoundingClientRect()
          return top + height / 2 - pageTop
        })
      )
      if (width === 1440 && editor === 'services') {
        const search = (await page.getByRole('searchbox', { name: 'Search services' }).boundingBox())!
        const trail = (await breadcrumb.boundingBox())!
        expect(search.y + search.height / 2).toBeCloseTo(trail.y + trail.height / 2)
      }
    }
    expect(new Set(offsets).size, `breadcrumb offsets at ${width}px: ${offsets.join(', ')}`).toBe(1)
  }
})

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
  await page.mouse.move(1, 1)
  await page.locator('[data-slot="search-field"]').hover()
  await expect.poll(async () => (await search.boundingBox())!.width, { timeout: 1500 }).toBeGreaterThan(180)
})

test('a stationary pointer does not expand search on reload or navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  test.skip(!(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)))
  await page.addInitScript(() => {
    document.addEventListener('transitionrun', event => {
      const target = event.target
      if (
        (event.propertyName === 'width' || event.propertyName === 'inline-size') &&
        target instanceof HTMLElement &&
        target.dataset.slot === 'search-field'
      ) {
        document.documentElement.dataset.searchWidthTransitionStarted = ''
      }
    })
  })
  await page.goto('/skeleton-contract-test?editor=services')
  const search = page.getByRole('searchbox', { name: 'Search services' })
  const { x, y, width, height } = (await search.boundingBox())!
  const pointer = { x: x + width / 2, y: y + height / 2 }
  await page.mouse.move(1, 1)
  await page.mouse.move(pointer.x, pointer.y)
  await expect.poll(async () => (await search.boundingBox())!.width).toBeGreaterThan(180)

  const assertStationarySearch = async () => {
    await expect(page.locator('[data-slot="search-field"]:hover')).toBeVisible()
    // A pointer event at the existing coordinates must not open a newly mounted search.
    await page.mouse.move(pointer.x, pointer.y)
    await search.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await expect(page.locator('html')).not.toHaveAttribute('data-search-width-transition-started')
    await expect(search).toHaveCSS('width', '36px')
  }

  await page.reload()
  await assertStationarySearch()
  await page.evaluate(() => {
    const { next } = window as Window & { next?: { router: { push: (href: string) => void } } }
    if (!next?.router) throw new Error('The client router has not mounted')
    next.router.push('/skeleton-contract-test?editor=services-loading')
  })
  await expect(search).toBeDisabled()
  await assertStationarySearch()
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
    await page.mouse.move(1, 1)
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

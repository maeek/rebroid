import { expect, test } from '@playwright/test'

for (const width of [320, 390, 768, 1440]) {
  test(`breadcrumb position is consistent across page headers at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const editors = [
      'general',
      'general-loading',
      'runtime',
      'runtime-loading',
      'runtime-unavailable',
      'security',
      'services',
      'services-loading',
      'service-docker',
      'container-loading',
      'image-loading',
      'network-loading',
      'display-sessions',
      'service-ocr',
      'policies',
      'features',
      'activity',
      'user',
      'group-loading',
      'scheduler',
      'workflows',
      'triggers',
      'active-workflow-runs',
      'failed-run',
      'ai-connection',
      'console-defaults',
      'app'
    ]
    if (width >= 1024) editors.push('apps-gallery', 'app-resource', 'app-resource-loading')

    const { inset, controlHeight } = await page.evaluate(viewportWidth => {
      const styles = getComputedStyle(document.documentElement)
      const rootFontSize = Number.parseFloat(styles.fontSize)
      const touch = matchMedia('(pointer: coarse)').matches
      const compact = viewportWidth < 1024
      let topInset = compact ? 0.25 : 0
      if (viewportWidth < 640) topInset = 0.75
      return {
        inset: topInset * rootFontSize,
        controlHeight: touch || compact ? 44 : 2.25 * rootFontSize
      }
    }, width)
    const breadcrumbCenter = inset + controlHeight / 2
    for (const editor of editors) {
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
      const firstCrumb = breadcrumb.getByRole('listitem').first()
      await expect(firstCrumb).toBeVisible()
      const position = await firstCrumb.evaluate(crumb => {
        const header = crumb.closest('header, .app-device-layout')!.getBoundingClientRect()
        const { x, y, height } = crumb.getBoundingClientRect()
        return { x: x - header.x, center: y + height / 2 - header.y }
      })
      expect(position.x, editor).toBeCloseTo(width < 640 ? 16 : 24)
      expect(position.center, editor).toBeCloseTo(breadcrumbCenter)
      if (width === 1440 && editor === 'services') {
        const search = (await page.getByRole('searchbox', { name: 'Search services' }).boundingBox())!
        const trail = (await firstCrumb.boundingBox())!
        expect(search.y + search.height / 2).toBeCloseTo(trail.y + trail.height / 2)
      }
    }
  })
}

test('General page titles stay aligned with and without actions, including while loading', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/skeleton-contract-test?editor=general')
    const title =
      width < 640
        ? page.getByRole('navigation', { name: 'breadcrumb' }).locator('[aria-current="page"]')
        : page.getByRole('heading', { level: 1, name: 'General' })
    const baseline = (await title.boundingBox())!
    for (const editor of ['general-loading', 'runtime', 'runtime-loading', 'runtime-unavailable']) {
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      const current = (await title.boundingBox())!
      expect(current.x, `${editor} at ${width}px`).toBe(baseline.x)
      expect(current.y, `${editor} at ${width}px`).toBe(baseline.y)
    }
  }
})

test('phone settings show the title once with Save in the breadcrumb row', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [editor, title, saveLabel] of [
      ['runtime', 'General', 'Save'],
      ['runtime-loading', 'General', 'Save'],
      ['general', 'General'],
      ['security', 'Security'],
      ['features', 'Feature management'],
      ['activity', 'Audit log'],
      ['console-defaults', 'Console defaults', 'Save defaults'],
      ['ai-connection', 'Local model server', 'Save'],
      ['ai-models-loading&view=connection', 'AI provider', 'Save'],
      ['group', 'Operators', 'Save Group'],
      ['group-loading', 'Group', 'Save Group']
    ]) {
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      const crumb = page.getByRole('navigation', { name: 'breadcrumb' })
      const heading = page.getByRole('heading', { level: 1, name: title, exact: true })
      await expect(crumb.locator('[aria-current="page"]')).toHaveText(title)
      await expect(heading.locator('..')).toHaveCSS('position', 'absolute')
      if (saveLabel) {
        const save = page.getByRole('button', { name: saveLabel, exact: true })
        const [breadcrumbBounds, saveBounds] = await Promise.all([crumb.boundingBox(), save.boundingBox()])
        expect(saveBounds!.y + saveBounds!.height / 2, editor).toBeCloseTo(
          breadcrumbBounds!.y + breadcrumbBounds!.height / 2
        )
        expect(saveBounds!.x + saveBounds!.width, editor).toBeCloseTo(width - 16)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth), editor).toBe(width)
    }
  }

  await page.goto('/skeleton-contract-test?editor=runtime')
  const registry = page.getByRole('textbox', { name: 'Image registry' })
  const discard = page.getByRole('button', { name: 'Discard changes' })
  const save = page.getByRole('button', { name: 'Save', exact: true })
  const savedRegistry = 'registry.internal.example:5000'
  await expect(discard).toBeDisabled()
  await registry.fill(savedRegistry)
  await expect(save).toBeEnabled()
  await save.click()
  await expect(save).toBeDisabled()
  await registry.fill('discard.internal.example:5000')
  await discard.click()
  await expect(registry).toHaveValue(savedRegistry)
  await expect(save).toBeDisabled()
})

test('mobile breadcrumbs fit on one line and keep all linked ancestors reachable', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'breadcrumb' })
  const home = nav.getByRole('link', { name: 'Home' })
  const current = nav.locator('[aria-current="page"]')
  const earlier = nav.getByRole('button', { name: 'Earlier pages' })

  for (const width of [320, 412, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/skeleton-contract-test?editor=console-shell')
    await expect(home).toHaveAttribute('href', '/apps')
    const icon = (await home.locator('.tabler-icon-home').boundingBox())!
    const separator = (await nav.locator('.tabler-icon-chevron-right').first().boundingBox())!
    expect(separator.x - icon.x - icon.width).toBeCloseTo(width < 640 ? 6 : 10)
    expect((await home.boundingBox())!.width).toBeGreaterThanOrEqual(44)
    await expect(nav.getByText('Docker', { exact: true })).toBeHidden()
    await earlier.click()
    await expect(page.getByRole('menuitem', { name: 'Containers' })).toHaveAttribute('href', '/runtime/containers')
    await page.keyboard.press('Escape')
    await expect(current).toHaveCSS('text-overflow', 'ellipsis')
    expect(await current.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true)
    await expect(nav.getByRole('list')).toHaveCSS('height', '44px')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)

    await page.goto('/skeleton-contract-test?editor=run-history')
    await expect(nav.getByText('Automations', { exact: true })).toBeHidden()
    await expect(nav.getByRole('link', { name: 'Daily inventory check' })).toHaveAttribute(
      'href',
      '/automations/preview-workflow'
    )
    await expect(current).toHaveText('Run history')
    expect(await current.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await expect(nav.getByRole('list')).toHaveCSS('height', '44px')
    if (width === 320) {
      await earlier.press('ArrowDown')
      const menu = page.getByRole('menu', { name: 'Earlier pages' })
      const workflows = menu.getByRole('menuitem', { name: 'Workflows' })
      await expect(workflows).toHaveAttribute('href', '/automations')
      await expect(workflows).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
      await expect(earlier).toBeFocused()
    } else {
      await expect(nav.getByRole('link', { name: 'Workflows' })).toHaveAttribute('href', '/automations')
      await expect(earlier).toHaveCount(0)
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(home).toHaveCount(0)
  await expect(earlier).toHaveCount(0)
  await expect(nav.getByText('Automations', { exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Workflows' })).toHaveAttribute('href', '/automations')

  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/skeleton-contract-test?editor=failed-run')
  await expect(nav.getByRole('link', { name: 'Run history' })).toHaveAttribute(
    'href',
    '/automations/preview-workflow/traces'
  )
  await earlier.click()
  const items = page.getByRole('menu', { name: 'Earlier pages' }).getByRole('menuitem')
  await expect(items).toHaveText(['Workflows', 'Daily inventory check'])
  await expect(items.nth(1)).toHaveAttribute('href', '/automations/preview-workflow')
})

test('the trail expands with the available toolbar space and preserves the current label', async ({ page }) => {
  const workflowName = 'open-zappka-from-app-gallery-and-reconcile-daily-inventory-records'
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto(`/skeleton-contract-test?editor=run-history&workflowName=${workflowName}`)

  const nav = page.getByRole('navigation', { name: 'breadcrumb' })
  const current = nav.locator('[aria-current="page"]')
  const workflow = nav.getByRole('link', { name: workflowName })
  const workflows = nav.getByRole('link', { name: 'Workflows' })
  const earlier = nav.getByRole('button', { name: 'Earlier pages' })
  const search = page.getByRole('searchbox', { name: 'Search runs, targets, or errors' })
  const fits = (node: HTMLElement) => node.scrollWidth <= node.clientWidth

  await expect(earlier).toBeVisible()
  await expect(workflow).toBeVisible()
  expect(await workflow.locator('span').evaluate(fits)).toBe(false)
  expect(await current.evaluate(fits)).toBe(true)

  await page.setViewportSize({ width: 920, height: 900 })
  await expect(workflows).toBeVisible()
  await expect(earlier).toHaveCount(0)
  expect(await workflow.locator('span').evaluate(fits)).toBe(true)

  await search.focus()
  await expect(earlier).toBeVisible()
  expect(await current.evaluate(fits)).toBe(true)
  const [currentBounds, toolbarBounds] = await Promise.all([
    current.boundingBox(),
    page.locator('[data-slot="data-grid-toolbar"]').boundingBox()
  ])
  expect(currentBounds!.x + currentBounds!.width).toBeLessThan(toolbarBounds!.x)
  await search.blur()
  await expect(workflows).toBeVisible()
})

test('breadcrumbs end at the resource on tabbed pages', async ({ page }) => {
  const variants = [
    ['ai-models', 'Local model server', 'AI', 'AI provider navigation', 'Models'],
    ['ai-connection', 'Local model server', 'AI', 'AI provider navigation', 'Connection'],
    ['ai-models-loading', 'AI provider', 'AI', 'AI provider navigation', 'Models'],
    ['ai-models-loading&view=connection', 'AI provider', 'AI', 'AI provider navigation', 'Connection'],
    ['builder-gapps-idle', 'Image builder', 'Images', 'Image builder', 'Google Play builder'],
    ['builder-custom-idle', 'Image builder', 'Images', 'Image builder', 'Custom builder']
  ]

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [editor, resource, parent, navigation, activeTab] of variants) {
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      await page.waitForFunction(() => (history.state as { __NA?: boolean } | null)?.__NA === true)
      await page.evaluate(async () => {
        await document.fonts.ready
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })
      const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
      const switcher = page.getByRole('navigation', { name: navigation, exact: true })
      await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(resource)
      await expect(switcher.locator('[aria-current="page"]')).toHaveText(activeTab)
      const parentLink = breadcrumb.getByRole('link', { name: parent, exact: true })
      const overflow = breadcrumb.getByRole('button', { name: 'Earlier pages' })
      await expect(parentLink.or(overflow)).toBeVisible()
      if (await overflow.isVisible()) {
        await overflow.click()
        await expect(page.getByRole('menuitem', { name: parent, exact: true })).toBeVisible()
      }
    }
  }
})

test('app Home and the device and workflow back arrows align with the mobile breadcrumb gutter', async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/skeleton-contract-test?editor=general')
    const firstCrumb = page.getByRole('navigation', { name: 'breadcrumb' }).getByRole('listitem').first()
    const { x, y, height } = (await firstCrumb.boundingBox())!
    const breadcrumbCenter = y + height / 2

    await page.goto('/skeleton-contract-test?editor=docked-viewer')
    const appHome = page.getByRole('link', { name: 'Home' })
    const back = page.getByRole('button', { name: 'Back to Overview' })
    for (const control of [appHome, back]) {
      if (control === back) await page.getByRole('button', { name: 'Device', exact: true }).click()
      const arrow = (await control.locator('svg').boundingBox())!
      expect(arrow.x).toBeCloseTo(x)
      expect(arrow.y + arrow.height / 2).toBeCloseTo(breadcrumbCenter)
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }

    for (const editor of ['workflow', 'workflow-loading', 'workflow-create', 'workflow-create-loading']) {
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      const control = page.getByRole('link', { name: 'Back to workflows' })
      const arrow = (await control.locator('svg').boundingBox())!
      expect(arrow.x, editor).toBeCloseTo(x)
      expect(arrow.y + arrow.height / 2, editor).toBeCloseTo(breadcrumbCenter)
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
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
  const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
  expect((await search.boundingBox())!.y).toBeGreaterThan((await breadcrumb.boundingBox())!.y)
  expect((await search.boundingBox())!.width).toBeGreaterThan(180)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('list headers share the breadcrumb row on phones and wrap actions together', async ({ page }) => {
  for (const [editor, title, actionLabel, settingsLabel] of [
    ['workflows', 'Workflows', 'New workflow', 'Run history retention'],
    ['triggers', 'Triggers', 'New trigger'],
    ['users-list', 'Users', 'New user', 'Password policy'],
    ['groups-list', 'Groups', 'New group'],
    ['scheduler', 'Maintenance tasks', 'New task'],
    ['services', 'Services', 'Refresh']
  ]) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const layouts = []
      for (const loading of [false, true]) {
        await page.goto(`/skeleton-contract-test?editor=${editor}${loading ? '-loading' : ''}`)
        const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
        await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(title)
        const heading = page.getByRole('heading', { name: title, exact: true, level: 1 })
        await expect(heading).toHaveCount(1)
        const titleBox = (await heading.boundingBox())!
        const nav = (await breadcrumb.boundingBox())!
        const primaryAction =
          loading || editor !== 'workflows'
            ? page.getByRole('button', { name: actionLabel, exact: true })
            : page.getByRole('link', { name: actionLabel, exact: true }).first()
        await expect(primaryAction).toBeVisible()
        if (loading) await expect(primaryAction).toBeDisabled()
        const action = (await primaryAction.boundingBox())!

        if (width < 640) {
          expect(titleBox.width).toBeLessThanOrEqual(1)
          if (width === 320 && editor === 'workflows') {
            expect(action.y).toBeGreaterThanOrEqual(nav.y + nav.height)
          } else {
            expect(action.y + action.height / 2).toBeCloseTo(nav.y + nav.height / 2)
            expect(action.x).toBeGreaterThanOrEqual(nav.x + nav.width)
          }
          if (settingsLabel) {
            const settings = page.getByRole('button', { name: settingsLabel, exact: true })
            const settingsBox = (await settings.boundingBox())!
            expect(settingsBox.y).toBe(action.y)
            expect(settingsBox.x + settingsBox.width).toBeLessThan(action.x)
            if (loading) await expect(settings).toBeDisabled()
          }
          layouts.push({ nav, action })
        } else {
          expect(titleBox.width).toBeGreaterThan(1)
          if (editor === 'services') {
            expect(action.y).toBeLessThan(titleBox.y)
          } else {
            expect(action.y).toBeGreaterThan(nav.y + nav.height)
          }
        }
      }
      if (width < 640) expect(layouts[1]).toEqual(layouts[0])
    }
  }
})

test('settings actions switch between a mobile cog and a desktop label', async ({ page }) => {
  for (const [editor, label, dialogName] of [
    ['workflows', 'Run history retention', 'Workflow run history retention'],
    ['users-list', 'Password policy', 'Password policy'],
    ['activity', 'Configure retention', 'Activity retention'],
    ['service-route-loading&service=docker', 'Edit limits']
  ]) {
    await page.setViewportSize({ width: 390, height: 900 })
    await page.goto(`/skeleton-contract-test?editor=${editor}`)
    const action = page.getByRole('button', { name: label, exact: true })
    const text = action.getByText(label, { exact: true })
    const cog = action.locator('.tabler-icon-settings')
    await expect(cog).toBeVisible()
    await expect(text).toBeHidden()
    await expect(action).toHaveCSS('width', '44px')
    await expect(action).toHaveCSS('height', '44px')
    if (dialogName) {
      await action.press('Enter')
      const dialog = page.getByRole('dialog', { name: dialogName })
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(action).toBeFocused()
    } else {
      await expect(action).toBeDisabled()
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(cog).toBeHidden()
    await expect(text).toBeVisible()
  }
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

test('Firewall search stays above the network policies table', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/skeleton-contract-test?editor=policies')

    const policies = page.getByRole('region', { name: 'Network policies' })
    const search = policies.getByRole('searchbox', { name: 'Search policies' })
    const table = policies.getByRole('table')
    await expect(search).toBeVisible()
    await expect(table).toBeVisible()

    const [searchBounds, tableBounds] = await Promise.all([search.boundingBox(), table.boundingBox()])
    expect(searchBounds!.width).toBeGreaterThan(180)
    expect(searchBounds!.y + searchBounds!.height).toBeLessThanOrEqual(tableBounds!.y)
  }
})

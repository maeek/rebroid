import { expect, test } from '@playwright/test'

const widths = [390, 768, 1440, 2048]

test('phone headers keep actions together and form controls inside the viewport', async ({ page }) => {
  for (const width of [320, 384, 430]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/skeleton-contract-test?editor=service-docker')
    const title = (await page.getByRole('heading', { name: 'Docker', exact: true }).boundingBox())!
    const breadcrumbs = (await page.getByRole('navigation', { name: 'breadcrumb' }).boundingBox())!
    const refresh = (await page.getByRole('button', { name: 'Refresh', exact: true }).boundingBox())!
    expect(refresh.x).toBeGreaterThan(breadcrumbs.x)
    expect(refresh.y).toBeLessThan(breadcrumbs.y + breadcrumbs.height)
    expect(refresh.y + refresh.height).toBeGreaterThan(breadcrumbs.y)
    expect(refresh.y + refresh.height).toBeLessThan(title.y)

    await page.goto('/skeleton-contract-test?editor=runtime')
    const discard = (await page.getByRole('button', { name: 'Discard changes' }).boundingBox())!
    const save = (await page.getByRole('button', { name: 'Save', exact: true }).boundingBox())!
    expect(save.y).toBe(discard.y)
    expect(save.x + save.width).toBeLessThanOrEqual(width - 16)
    const registry = page.getByRole('textbox', { name: 'Image registry' })
    const field = (await registry.boundingBox())!
    expect(field.x + field.width).toBeLessThanOrEqual(width - 16)
    if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
      expect(refresh.width).toBeGreaterThanOrEqual(44)
      expect(refresh.height).toBeGreaterThanOrEqual(44)
      expect(save.height).toBeGreaterThanOrEqual(44)
      expect(field.height).toBeGreaterThanOrEqual(44)
      await expect(registry).toHaveCSS('font-size', '16px')
      await expect(page.locator('label[for="runtime-image-registry"]')).toHaveCSS('font-size', '16px')
      await expect(page.getByText('Optional prefix for image names without a registry host.')).toHaveCSS(
        'font-size',
        '14px'
      )
    }
  }
})

test('app headings leave workflow actions to the Workflows view', async ({ page }) => {
  for (const editor of ['app-resource', 'app-resource-loading']) {
    await page.goto(`/skeleton-contract-test?editor=${editor}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'App sections' }).getByText('Workflows', { exact: true })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run workflow', exact: true })).toHaveCount(0)
  }
})

test('configuration keeps Save next to the secondary actions menu on phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/skeleton-contract-test?editor=app-resource&view=configuration')
  const save = page.getByRole('button', { name: 'Save', exact: true })
  const actions = page.getByRole('button', { name: 'More configuration actions' })
  expect((await save.boundingBox())!.y).toBe((await actions.boundingBox())!.y)
  await actions.click()
  await expect(page.getByRole('menuitem', { name: 'Profiles' })).toHaveAttribute('href', /view=profiles/)
  await page.getByRole('menuitem', { name: 'Delete app' }).click()
  await expect(page.getByRole('dialog', { name: 'Delete Inventory worker?' })).toBeVisible()
})

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
  const grid = page.getByRole('table')
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=policies-loading')
    const header = await page.getByRole('columnheader').allTextContents()
    await expect
      .poll(() => grid.evaluate(table => parseFloat(table.style.width) >= table.parentElement!.clientWidth))
      .toBe(true)
    const loadingGrid = await grid.boundingBox()
    await expect(page.getByRole('button', { name: 'Reconcile all' })).toBeDisabled()
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await expect(page.getByRole('combobox', { name: 'Restriction' })).toBeEnabled()
    await page.getByRole('button', { name: 'Done' }).click()
    await page.goto('/skeleton-contract-test?editor=policies')
    expect(await page.getByRole('columnheader').allTextContents()).toEqual(header)
    await expect.poll(async () => (await grid.boundingBox())?.width).toBe(loadingGrid?.width)
    const readyGrid = await grid.boundingBox()
    expect(readyGrid?.x).toBe(loadingGrid?.x)
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
  for (const width of [390, 768, 1024, 1440, 2048]) {
    await page.setViewportSize({ width, height: 480 })
    await page.goto('/skeleton-contract-test?editor=console-shell')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('inventory-worker-'.repeat(8))
    await expect(page.getByRole('button', { name: 'Remove', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    if (width >= 1024) {
      for (const group of ['Platform settings', 'Infrastructure', 'Access and policies']) {
        const collapse = page.getByRole('button', { name: `Collapse ${group} menu` })
        await expect(collapse).toHaveAttribute('aria-expanded', 'true')
        await collapse.click()
        const expand = page.getByRole('button', { name: `Expand ${group} menu` })
        await expect(expand).toHaveAttribute('aria-expanded', 'false')
        await expand.click()
      }
      const toggle = page.getByRole('button', { name: 'Collapse sidebar', exact: true })
      const header = await toggle.boundingBox()
      const general = page.getByRole('link', { name: 'General', exact: true })
      await general.scrollIntoViewIfNeeded()
      const link = await general.boundingBox()
      expect(link!.y + link!.height).toBeLessThanOrEqual(480)
      const sidebar = await page.getByRole('complementary', { name: 'Primary navigation' }).boundingBox()
      expect(sidebar!.x).toBe(8)
      expect(sidebar!.y).toBe(8)
      expect(sidebar!.y + sidebar!.height).toBe(472)
      expect(await toggle.boundingBox()).toEqual(header)
      await expect(page.getByRole('link', { name: 'Create user', exact: true })).toHaveAttribute(
        'href',
        '/security/users?create=1'
      )
      await expect(page.getByRole('link', { name: 'Create group', exact: true })).toHaveAttribute(
        'href',
        '/security/groups?create=1'
      )
      await expect(page.getByRole('link', { name: 'Build image', exact: true })).toHaveCount(0)
    }
  }
})

test('sidebar footer popups clear the rail and open below the mobile header controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=console-shell')
  const sidebar = page.getByRole('complementary', { name: 'Primary navigation' })
  await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(sidebar).toHaveCSS('width', '64px')
  const rail = (await sidebar.boundingBox())!
  const popups = [
    { trigger: 'Notifications', content: page.getByRole('dialog', { name: 'Notifications' }) },
    { trigger: 'Account', content: page.getByRole('menu') }
  ]

  for (const { trigger, content } of popups) {
    const button = sidebar.getByRole('button', { name: trigger })
    await button.click()
    await expect(content).toHaveAttribute('data-side', 'right')
    await expect(content).toHaveAttribute('data-align', 'end')
    const anchor = (await button.boundingBox())!
    await expect
      .poll(async () => {
        const box = (await content.boundingBox())!
        return box.x >= rail.x + rail.width + 7 && Math.abs(box.y + box.height - anchor.y - anchor.height) <= 1
      })
      .toBe(true)
    await page.keyboard.press('Escape')
    await expect(content).toBeHidden()
    await expect(button).toBeFocused()
  }

  await page.setViewportSize({ width: 360, height: 740 })
  const header = page.getByRole('banner')
  for (const { trigger, content } of popups) {
    await header.getByRole('button', { name: trigger }).click()
    await expect(content).toHaveAttribute('data-side', 'bottom')
    const box = (await content.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(361)
    await page.keyboard.press('Escape')
    await expect(content).toBeHidden()
  }
})

test('the health chip sits next to notifications and becomes a dot in the rail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=console-shell')
  const sidebar = page.getByRole('complementary', { name: 'Primary navigation' })
  const footer = sidebar.getByRole('group', { name: 'Navigation controls' })
  const status = footer.getByRole('button', { name: /^Service status:/ })
  const bell = footer.getByRole('button', { name: 'Notifications' })
  const details = page.getByRole('dialog', { name: 'Service status' })
  await expect(status).toHaveText('Checking')
  const statusBox = (await status.boundingBox())!
  const bellBox = (await bell.boundingBox())!
  expect(statusBox.y + statusBox.height / 2).toBe(bellBox.y + bellBox.height / 2)
  expect(bellBox.x - (statusBox.x + statusBox.width)).toBe(4)

  const finePointer = await page.evaluate(() => matchMedia('(pointer: fine)').matches)
  if (finePointer) {
    await status.hover()
    await expect(status.getByText('Checking')).toHaveCSS('text-decoration-line', 'none')
    await expect(details).toHaveAttribute('data-side', 'top')
    await details.getByRole('link', { name: /^Orchestrator/ }).hover()
    await expect(details).toBeVisible()
    await page.mouse.move(650, 10)
    await expect(details).toBeHidden()
  }

  await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(sidebar).toHaveCSS('width', '64px')
  await expect(status).toHaveText('')
  await expect(status).toHaveAccessibleName('Service status: Checking')
  const railStatus = (await status.boundingBox())!
  const railBell = (await bell.boundingBox())!
  expect(railStatus.x + railStatus.width / 2).toBe(railBell.x + railBell.width / 2)
  expect(railStatus.y + railStatus.height).toBeLessThan(railBell.y)
  await status.press('Enter')
  await expect(details).toHaveAttribute('data-side', 'right')
  await expect(details.getByRole('link', { name: /^Docker/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(details).toBeHidden()
  await expect(status).toBeFocused()

  await page.setViewportSize({ width: 320, height: 640 })
  const mobileControls = page.getByRole('banner').getByRole('group', { name: 'Navigation controls' })
  const mobileStatus = mobileControls.getByRole('button', { name: /^Service status:/ })
  await expect(mobileStatus).toHaveText('Checking')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
  const mobileStatusBox = (await mobileStatus.boundingBox())!
  const mobileBellBox = (await mobileControls.getByRole('button', { name: 'Notifications' }).boundingBox())!
  expect(mobileStatusBox.y + mobileStatusBox.height / 2).toBe(mobileBellBox.y + mobileBellBox.height / 2)
  expect(mobileBellBox.x - (mobileStatusBox.x + mobileStatusBox.width)).toBe(4)
  if (finePointer) {
    await mobileStatus.click()
  } else {
    await expect(mobileStatus).toHaveCSS('min-width', '44px')
    await mobileStatus.tap()
  }
  await expect(details).toHaveAttribute('data-side', 'bottom')
  await expect(details.getByRole('link', { name: /^Orchestrator/ })).toBeInViewport()
})

test('desktop sidebar collapses to a navigable icon rail and persists', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=console-shell')
  const heading = page.getByRole('heading', { level: 1 })
  const sidebar = page.getByRole('complementary', { name: 'Primary navigation' })
  const start = (await heading.boundingBox())!
  const main = page.getByRole('main')
  const toggle = sidebar.getByRole('button', { name: 'Collapse sidebar' })
  const brand = sidebar.getByRole('link', { name: 'Rebroid', exact: true })
  await expect(brand).toHaveText('Rebroid')
  await expect(page.getByRole('banner')).toHaveCount(0)
  await expect(sidebar).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(sidebar).toHaveCSS('border-top-left-radius', '14px')
  const expanded = (await sidebar.boundingBox())!
  expect((await main.locator('header').boundingBox())!.y).toBe(8)
  await expect(sidebar).toHaveCSS('border-top-width', '0px')
  await expect(sidebar).toHaveCSS('box-shadow', 'none')
  const controls = sidebar.getByRole('group', { name: 'Navigation controls', exact: true })
  await expect(controls.getByRole('button', { name: 'Account' })).toBeVisible()
  const footer = (await controls.boundingBox())!
  expect(footer.y + footer.height).toBe(expanded.y + expanded.height)

  expect((await toggle.boundingBox())!.x).toBeGreaterThan((await brand.boundingBox())!.x)
  if (await page.evaluate(() => matchMedia('(pointer: fine)').matches)) {
    await expect(toggle).not.toHaveAttribute('title', /.+/)
    await toggle.hover()
    const hint = page.getByText('Collapse sidebar', { exact: true })
    await expect(hint).toBeVisible()
    const toggleBox = (await toggle.boundingBox())!
    await expect
      .poll(async () => {
        const box = (await hint.boundingBox())!
        return Math.abs(box.x + box.width - toggleBox.x - toggleBox.width)
      })
      .toBeLessThanOrEqual(1)
    expect((await hint.boundingBox())!.y).toBeGreaterThan(toggleBox.y + toggleBox.height)
  }
  await page.mouse.move(450, 20)
  await page.screenshot({ path: test.info().outputPath('sidebar-expanded.png'), animations: 'disabled' })
  await page.locator('[data-sidebar-motion]').evaluate(node => {
    ;(node as HTMLElement).style.setProperty('--shell-sidebar-duration', '650ms')
  })
  await toggle.click()
  await expect
    .poll(async () =>
      sidebar.evaluate(node => {
        const width = node.getBoundingClientRect().width
        const contentInset = Number.parseFloat(getComputedStyle(document.querySelector('main')!).paddingLeft)
        return width > 64 && width < 288 && Math.abs(contentInset - width - 8) < 2
      })
    )
    .toBe(true)
  await expect(sidebar).toBeVisible()
  await expect(sidebar).toHaveCSS('width', '64px')
  const rail = (await sidebar.boundingBox())!
  expect(rail.x).toBe(expanded.x)
  expect(rail.y).toBe(expanded.y)
  expect(rail.height).toBe(expanded.height)
  await expect(main).toHaveCSS('padding-left', '72px')
  expect(start.x - (await heading.boundingBox())!.x).toBe(224)
  await expect(brand).toBeVisible()
  await expect(brand.getByText('Rebroid')).toHaveCSS('opacity', '0')
  await expect(sidebar.getByRole('button', { name: 'Expand sidebar' })).toBeFocused()
  await page.mouse.move(450, 20)
  await page.screenshot({ path: test.info().outputPath('sidebar-rail.png'), animations: 'disabled' })
  const apps = sidebar.getByRole('link', { name: 'All apps', exact: true })
  await expect(apps).toHaveAttribute('href', '/apps')
  await expect(sidebar.getByRole('link', { name: 'Create app', exact: true })).toHaveAttribute('href', '/apps/create')
  if (await page.evaluate(() => matchMedia('(pointer: fine)').matches)) {
    const hint = page.locator('[data-slot="navigation-hint"]').filter({ hasText: 'All apps' })
    await apps.hover()
    await expect(hint).toBeVisible()
    await page.mouse.move(400, 5)
    await expect(hint).toBeHidden()
    await apps.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(apps).toBeFocused()
    await expect(hint).toBeVisible()
  }
  const access = sidebar.getByRole('button', { name: 'Access and policies', exact: true })
  await access.press('Enter')
  const group = page.getByRole('menu')
  await expect(group).not.toHaveCSS(
    'background-color',
    await sidebar.evaluate(node => getComputedStyle(node).backgroundColor)
  )
  await expect(group).toHaveCSS('width', '224px')
  await expect(group).toHaveCSS('border-top-width', '1px')
  await expect.poll(async () => (await group.boundingBox())!.x - (rail.x + rail.width)).toBeGreaterThanOrEqual(7)
  await expect(group.getByRole('menuitem', { name: 'Users', exact: true })).toHaveAttribute('href', '/security/users')
  await expect(group.getByRole('menuitem', { name: 'Create user', exact: true })).toHaveAttribute(
    'href',
    '/security/users?create=1'
  )
  await page.keyboard.press('Escape')
  await expect(group).toBeHidden()
  await expect(access).toBeFocused()
  if (await page.evaluate(() => matchMedia('(pointer: fine)').matches)) {
    await access.hover()
    await expect(group).toHaveAttribute('aria-label', 'Access and policies')
    await expect(group).toHaveCSS('animation-name', 'none')
    const flyout = (await group.elementHandle())!
    await sidebar.getByRole('button', { name: 'Infrastructure', exact: true }).hover()
    await expect(group).toHaveAttribute('aria-label', 'Infrastructure')
    expect(await flyout.getAttribute('aria-label')).toBe('Infrastructure')
    const containers = group.getByRole('menuitem', { name: 'Containers', exact: true })
    const item = (await containers.boundingBox())!
    await page.mouse.move(item.x + item.width / 2, item.y + item.height / 2, { steps: 12 })
    await expect(containers).toBeVisible()
    await page.mouse.move(450, 20)
    await expect(group).toBeHidden()
  } else {
    await access.tap()
    await expect(group).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(group).toBeHidden()
  }
  const collapsedResponse = await page.request.get(page.url())
  expect(await collapsedResponse.text()).toContain('data-sidebar-collapsed="true"')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  await expect(sidebar).toHaveCSS('width', '64px')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await expect(sidebar).toHaveCSS('width', '288px')
  await expect(sidebar).toHaveCSS('transition-property', 'none')
  await expect(main).toHaveCSS('transition-property', 'none')
  const expandedResponse = await page.request.get(page.url())
  expect(await expandedResponse.text()).toContain('data-sidebar-collapsed="false"')
  await page.setViewportSize({ width: 390, height: 900 })
  await expect(sidebar).toBeHidden()
  const mobileHeader = page.getByRole('banner')
  await expect(mobileHeader.getByRole('link', { name: 'Rebroid' })).toBeVisible()
  await expect(mobileHeader.getByRole('button', { name: 'Account' })).toBeVisible()
  await mobileHeader.getByRole('button', { name: 'Open navigation' }).click()
  const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true })
  await expect(drawer.getByRole('link', { name: 'All apps' })).toBeVisible()
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(drawer).toBeHidden()
  await expect(sidebar.getByRole('button', { name: 'Account' })).toBeVisible()
})

test('an older collapsed sidebar preference is visible before hydration', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('rebroid:sidebar-collapsed', 'true'))
  const scriptChunks = '**/_next/static/**/*.js'
  await page.route(scriptChunks, route => route.abort())
  await page.goto('/skeleton-contract-test?editor=console-shell')
  const sidebar = page.getByRole('complementary', { name: 'Primary navigation' })
  await expect(page.locator('[data-sidebar-pending]')).toBeVisible()
  await expect(sidebar).toHaveCSS('width', '64px')
  await expect(sidebar.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  await expect(page.getByRole('main')).toHaveCSS('padding-left', '72px')

  await page.unroute(scriptChunks)
  await page.reload()
  await expect(page.locator('[data-sidebar-pending]')).toHaveCount(0)
  await expect(page.locator('[data-sidebar-collapsed]')).toHaveAttribute('data-sidebar-collapsed', 'true')
  const response = await page.request.get(page.url())
  expect(await response.text()).toContain('data-sidebar-collapsed="true"')
})

test('console anchors only clear the top bar when it is visible', async ({ page }) => {
  for (const { editor, anchors, mobileOffset, desktopOffset } of [
    {
      editor: 'general',
      anchors: ['appearance', 'profile', 'security', 'console-defaults'],
      mobileOffset: 80,
      desktopOffset: 24
    },
    { editor: 'services-all', anchors: ['firewall'], mobileOffset: 96, desktopOffset: 40 },
    { editor: 'features', anchors: ['feature.ocr'], mobileOffset: 96, desktopOffset: 40 }
  ]) {
    await page.setViewportSize({ width: 390, height: 800 })
    await page.goto(`/skeleton-contract-test?editor=${editor}`)
    for (const id of anchors) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCSS('scroll-margin-top', `${mobileOffset}px`)
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    for (const id of anchors) {
      await expect(page.locator(`[id="${id}"]`)).toHaveCSS('scroll-margin-top', `${desktopOffset}px`)
    }
  }
})

test('the user creation shortcut opens and clears the existing dialog', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=users-list&create=1')
  const dialog = page.getByRole('dialog', { name: 'Create User' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\?editor=users-list$/)
  await page.getByRole('button', { name: 'New user' }).click()
  await expect(dialog).toBeVisible()
})

test('Files opens Downloads and keeps folder navigation available on narrow and wide layouts', async ({
  page
}, testInfo) => {
  const downloads = '/data/media/0/Download'
  await page.route('**/api/bff/applications/*/runtime/files?*', route => {
    const path = new URL(route.request().url()).searchParams.get('path')
    const data =
      path === downloads
        ? [
            {
              name: 'Reports',
              path: `${downloads}/Reports`,
              type: 'directory',
              sizeBytes: null,
              itemCount: null,
              modifiedAt: null
            },
            {
              name: 'summary.csv',
              path: `${downloads}/summary.csv`,
              type: 'file',
              sizeBytes: 2148,
              itemCount: null,
              modifiedAt: '2026-11-01T10:22:00Z'
            }
          ]
        : []
    return route.fulfill({ json: { ok: true, data, requestId: 'preview' } })
  })
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/skeleton-contract-test?editor=app-resource&view=files')
    const path = page.getByRole('navigation', { name: 'Current folder' })
    await expect(path.locator('[aria-current]')).toHaveText('Downloads')
    await expect(page.getByRole('button', { name: 'summary.csv' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: testInfo.outputPath(`files-${width}.png`) })
    await page.getByRole('button', { name: 'Reports', exact: true }).click()
    await expect(path.locator('[aria-current]')).toHaveText('Reports')
    await expect(page.getByRole('heading', { name: 'This folder is empty' })).toBeVisible()
    await path.getByRole('button', { name: 'Downloads', exact: true }).click()
    await expect(page.getByRole('button', { name: 'summary.csv' })).toBeVisible()
  }
})

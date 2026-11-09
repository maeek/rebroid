import { expect, test } from '@playwright/test'

test('users separate account status from explicit access actions', async ({ page }) => {
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=users-list')
    const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: /Ada Lovelace/ }) })
    await expect(row.getByText('Active', { exact: true })).toBeVisible()
    await expect(row.getByRole('button', { name: 'Active', exact: true })).toHaveCount(0)
    const actions = row.getByRole('button', { name: 'Open row actions' })
    await actions.click()
    const disable = page.getByRole('menuitem', { name: 'Disable user…', exact: true })
    await expect(disable).toBeVisible()
    await disable.click()
    const dialog = page.getByRole('dialog', { name: 'Disable Ada Lovelace?' })
    await expect(dialog).toContainText('signs users out and prevents new sign-ins')
    await expect(dialog.getByRole('button', { name: 'Disable user', exact: true })).toBeVisible()
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({
        path: `/tmp/rebroid-user-access-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(actions).toBeFocused()
    await expect(row.getByText('Active', { exact: true })).toBeVisible()
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      await page.screenshot({
        path: `/tmp/rebroid-users-grid-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
    const disabledRow = page.getByRole('row').filter({ has: page.getByRole('link', { name: /Grace Hopper/ }) })
    await disabledRow.getByRole('button', { name: 'Open row actions' }).click()
    await expect(page.getByRole('menuitem', { name: 'Enable user', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
  }
})

for (const width of [390, 1440]) {
  test(`app failure investigation stays readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=app-resource')
    await expect(page.getByRole('heading', { name: 'Inventory worker', exact: true })).toBeVisible()
    await expect(page.getByText('Android did not finish starting.').first()).toBeVisible()
    await expect(page.getByText('Configuration saved; runtime update pending')).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'App sections' }).getByRole('link', { name: 'Diagnostics', exact: true })
    ).toHaveAttribute('href', '/app/preview-app?view=diagnostics')
    await expect(page.getByRole('link', { name: 'Open viewer' })).toHaveCount(0)
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
      await page.screenshot({
        path: `/tmp/rebroid-operator-app-${test.info().project.name}-${width}-${theme}.png`,
        animations: 'disabled'
      })
      await expect(page.getByRole('heading', { name: 'Inventory worker', exact: true })).toBeVisible()
      await expect(page).toHaveURL(/editor=app-resource/)
    }
    await page.goto('/skeleton-contract-test?editor=app-resource&view=diagnostics')
    await expect(page.getByRole('heading', { name: 'Application logs' })).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'App sections' }).getByRole('link', { name: 'Diagnostics', exact: true })
    ).toHaveAttribute('aria-current', 'page')
  })
}

test('failed execution exposes step evidence, resource links, and keyboard dismissal', async ({ page }) => {
  await page.route('**/api/bff/automations/runs/**/events*', route =>
    route.fulfill({ json: { ok: true, requestId: 'preview', data: { events: [], streamUrl: '' } } })
  )
  await page.goto('/skeleton-contract-test?editor=failed-run')
  const trigger = page.getByRole('button', { name: 'Inspect failed run' })
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Android boot timed out.')).toBeVisible()
  await expect(page.getByText('No recorded events')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Inspect target app' })).toHaveAttribute('href', '/app/preview-app')
  await page.screenshot({ path: `/tmp/rebroid-failed-run-${test.info().project.name}.png`, animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

for (const view of ['overview', 'activity', 'diagnostics']) {
  test(`device fills the available height beside ${view}`, async ({ page }) => {
    await page.setViewportSize({ width: 2048, height: 1184 })
    await page.goto(`/skeleton-contract-test?editor=app-resource&view=${view}`)
    const pane = page.getByRole('complementary', { name: 'Android device' })
    await expect(pane).toBeVisible()
    const frame = pane.locator('[data-viewer-frame]')
    const box = await frame.boundingBox()
    expect(box!.height).toBeGreaterThan(1020)
    expect(box!.y + box!.height).toBeLessThanOrEqual(1184)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `/tmp/rebroid-device-${view}-${test.info().project.name}.png` })
  })
}

test('log source fits its selected label', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=app-resource&view=diagnostics')
  const select = page.getByRole('combobox', { name: 'Log source' })
  await expect(select).toContainText('Orchestrator events')
  const label = select.locator('[data-slot="select-value"]')
  expect(await label.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
})

test('app activity reuses the audit grid with scoped export and event inspection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=app-resource&view=activity')
  await expect(page.getByRole('heading', { name: 'App activity', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /Event/ })).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: 'Start application' })
  await expect(row).toContainText('Operator')
  const href = await page.getByRole('link', { name: 'Export CSV' }).getAttribute('href')
  const exported = new URL(href!, 'http://localhost')
  expect(exported.searchParams.get('resourceId')).toBe('preview-app')
  expect(exported.searchParams.get('resourceType')).toBe('application')
  await expect(page.getByRole('button', { name: 'Activity actions' })).toHaveCount(0)
  await row.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Details', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Android boot timed out')
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  await expect(page.getByRole('complementary', { name: 'Android device' })).toBeVisible()
})

test('diagnostics groups readable details before the logs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=app-resource&view=diagnostics')
  const details = page.getByRole('region', { name: 'Details', exact: true })
  await expect(details.getByRole('heading', { name: 'Container', exact: true })).toBeVisible()
  await expect(details.getByRole('heading', { name: 'Failure', exact: true })).toHaveCount(0)
  const copyAppId = details.getByRole('button', { name: 'Copy App ID' })
  await page.mouse.move(0, 0)
  if (!test.info().project.name.startsWith('mobile')) {
    await expect(copyAppId).toHaveCSS('opacity', '0')
    await details.locator('dt').filter({ hasText: 'App ID' }).hover()
    await expect(copyAppId).toHaveCSS('opacity', '1')
  }
  await copyAppId.focus()
  await expect(copyAppId).toHaveCSS('opacity', '1')
  const label = await details.locator('dt').filter({ hasText: 'App ID' }).locator('span').first().boundingBox()
  const copyBox = await copyAppId.boundingBox()
  expect(copyBox!.x - (label!.x + label!.width)).toBeLessThanOrEqual(8)
  const logs = page.getByRole('heading', { name: 'Application logs' })
  expect((await logs.boundingBox())!.y).toBeGreaterThan((await details.boundingBox())!.y)
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({
    path: `/tmp/rebroid-diagnostics-${test.info().project.name}.png`,
    fullPage: true,
    animations: 'disabled'
  })
})

test('log viewport keeps its height when changing source and showing unavailable output', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=app-resource&view=diagnostics')
  const logs = page.getByRole('region', { name: 'Application logs' })
  const output = logs.locator('pre')
  const before = await output.boundingBox()
  expect(before!.height).toBeGreaterThanOrEqual(320)
  await logs.getByRole('combobox', { name: 'Log source' }).click()
  await page.getByRole('option', { name: 'ADB logcat' }).click()
  await logs.getByRole('button', { name: 'Refresh', exact: true }).click()
  expect((await output.boundingBox())!.height).toBe(before!.height)
  await logs.getByRole('combobox', { name: 'Log source' }).click()
  await page.getByRole('option', { name: 'Orchestrator events' }).click()
  expect((await output.boundingBox())!.height).toBe(before!.height)
})

test('resource navigation stays flat and streaming controls open beside the viewer', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=app-resource')
  const navigation = page.getByRole('navigation', { name: 'App sections' })
  await expect(navigation.getByRole('link', { name: 'Configuration' })).toHaveAttribute(
    'href',
    '/app/preview-app?view=configuration'
  )
  await expect(navigation.getByRole('link', { name: 'AI agent' })).toHaveAttribute(
    'href',
    '/app/preview-app?view=ai-agent'
  )
  await expect(navigation.getByRole('link', { name: 'Diagnostics' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Runtime tools' })).toHaveCount(0)
  const settings = page
    .getByRole('complementary', { name: 'Android device' })
    .getByRole('button', { name: 'Streaming settings' })
  await settings.click()
  await expect(page.getByRole('dialog')).toContainText('Viewer quality, transport, and audio')
  await page.screenshot({ path: `/tmp/rebroid-shared-sheet-${test.info().project.name}.png`, animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(settings).toBeFocused()
})

test('operations stays bounded and readable with many failing apps', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=operations')
  await expect(page.getByRole('navigation', { name: /breadcrumb/i })).toHaveCount(0)
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1000 })
    const failures = page.getByRole('region', { name: 'Apps needing attention', exact: true })
    await expect(failures.getByRole('listitem')).toHaveCount(5)
    await expect(failures.getByText('Showing 5 of 128')).toBeVisible()
    await expect(page.getByRole('link', { name: 'All apps', exact: true })).toHaveAttribute('href', '/apps')
    await expect(page.getByRole('link', { name: 'All workflows', exact: true })).toHaveAttribute('href', '/automations')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    if (width >= 1024) {
      const cards = [
        failures,
        page.getByRole('region', { name: 'App operations', exact: true }),
        page.getByRole('region', { name: 'Active workflow runs', exact: true })
      ]
      const bounds = await Promise.all(cards.map(card => card.boundingBox()))
      for (const box of bounds) {
        expect(box?.y).toBe(bounds[0]?.y)
        expect(box?.height).toBe(bounds[0]?.height)
      }
    }
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      await page.screenshot({
        path: `/tmp/rebroid-operations-${width}-${theme}-${test.info().project.name}.png`,
        fullPage: true
      })
    }
  }
})

test('scheduler matches shared panels and keeps task interactions stable', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=scheduler')
    await expect(page.getByRole('heading', { name: 'Scheduler', exact: true })).toBeVisible()
    const table = page.getByRole('table')
    const rowHeights = await table
      .locator('tbody tr')
      .evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height))
    expect(Math.max(...rowHeights) - Math.min(...rowHeights)).toBeLessThanOrEqual(1)
    const before = await table.boundingBox()
    await page.getByRole('checkbox', { name: 'Select current page' }).check()
    await expect(page.getByText('5 selected', { exact: true })).toBeVisible()
    expect((await table.boundingBox())!.y).toBe(before!.y)
    await page.getByRole('checkbox', { name: 'Select current page' }).uncheck()
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({ path: `/tmp/rebroid-scheduler-${width}-${theme}-${test.info().project.name}.png` })
    }
    await page.getByRole('button', { name: 'Clean APK uploads', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Edit scheduled task' })).toBeVisible()
    await expect(dialog.getByLabel('Name', { exact: false })).toBeDisabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=scheduler-loading')
  const loadingY = (await page.getByRole('table').boundingBox())!.y
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toBeDisabled()
  await page.goto('/skeleton-contract-test?editor=scheduler')
  expect((await page.getByRole('table').boundingBox())!.y).toBe(loadingY)
  const pausedRow = page.getByRole('row').filter({ hasText: 'Full Docker cleanup' })
  await expect(pausedRow.getByText('Paused', { exact: true })).toHaveCount(0)
  await expect(pausedRow.getByText('Full cleanup', { exact: true })).toHaveCount(0)
  await expect(pausedRow.getByLabel('No scheduled run')).toHaveText('—')
  await expect(pausedRow.getByText('Day 1 of each month')).toBeVisible()
  const failure = page.getByRole('button', { name: 'View failed run for Weekend image cleanup' })
  await failure.click()
  const runDetails = page.getByRole('dialog')
  await expect(runDetails.getByRole('heading', { name: 'Last run failed' })).toBeVisible()
  await expect(runDetails).toContainText('Check the service connection before retrying.')
  await page.keyboard.press('Escape')
  await expect(failure).toBeFocused()
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  const filters = page.getByRole('dialog')
  await filters.getByRole('combobox', { name: 'State', exact: true }).click()
  await page.getByRole('option', { name: 'Paused', exact: true }).click()
  await filters.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Clean APK uploads', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Weekend image cleanup', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Remove State filter' }).click()
  await expect(page.getByRole('button', { name: 'Clean APK uploads', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('services keep navigation actions readable and unclipped', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const editor of ['services', 'services-all']) {
    for (const width of [390, 768, 1440, 2048]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      await expect(page.getByRole('heading', { name: 'Services', exact: true })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /^Connection/ })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Timeout', exact: true })).toHaveCount(0)
      await expect(page.getByRole('columnheader', { name: 'Settings', exact: true })).toHaveCount(0)
      const link = page.getByRole('link', { name: 'View sessions', exact: true })
      await link.scrollIntoViewIfNeeded()
      await expect(link).toHaveAttribute('href', '/platform/services/display-sessions')
      expect(
        await link.evaluate(node => {
          const cell = node.closest('td')!.getBoundingClientRect()
          const rect = node.getBoundingClientRect()
          return rect.left >= cell.left && rect.right <= cell.right && node.scrollWidth <= node.clientWidth
        })
      ).toBe(true)
      await link.focus()
      await expect(link).toBeFocused()
      if (editor === 'services') {
        await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
      } else {
        await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
      }
      for (const theme of ['light', 'dark', 'oled']) {
        await page.evaluate(value => {
          document.documentElement.className = value
        }, theme)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
        await page.screenshot({
          path: `/tmp/rebroid-${editor}-${width}-${theme}-${test.info().project.name}.png`,
          animations: 'disabled'
        })
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const editor of ['services', 'services-all']) {
    await page.goto(`/skeleton-contract-test?editor=${editor}-loading`)
    const loadingY = (await page.getByRole('table').boundingBox())!.y
    await expect(page.getByRole('searchbox', { name: 'Search services' })).toBeDisabled()
    await page.goto(`/skeleton-contract-test?editor=${editor}`)
    expect((await page.getByRole('table').boundingBox())!.y).toBe(loadingY)
  }
  await page.setViewportSize({ width: 390, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=services-edit')
  const dialog = page.getByRole('dialog', { name: 'OCR perception' })
  await expect(dialog.getByLabel('Endpoint', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Timeout', { exact: true })).toBeVisible()
  const settingsTab = dialog.getByRole('tab', { name: 'Settings', exact: true })
  await settingsTab.focus()
  await page.keyboard.press('Enter')
  await expect(settingsTab).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByLabel('Max image size', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Min confidence', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  await page.screenshot({
    path: `/tmp/rebroid-services-dialog-${test.info().project.name}.png`,
    animations: 'disabled'
  })
  expect(errors).toEqual([])
})

test('grid hover and selection keep the same rounded row shape', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const editor of ['services', 'scheduler']) {
    await page.goto(`/skeleton-contract-test?editor=${editor}`)
    const row = page.locator('tbody tr').first()
    const before = await row.boundingBox()
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      await row.hover()
      const shape = await row.evaluate(node => getComputedStyle(node).clipPath)
      const headerShape = await page.locator('thead').evaluate(node => getComputedStyle(node).clipPath)
      expect(shape).toBe(headerShape)
      expect(shape).not.toBe('none')
      expect(await row.boundingBox()).toEqual(before)
      await page.screenshot({
        path: `/tmp/rebroid-grid-hover-${editor}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
    if (editor === 'scheduler') {
      const hoverShape = await row.evaluate(node => getComputedStyle(node).clipPath)
      await row.getByRole('checkbox', { name: 'Select row', exact: true }).click()
      await page.mouse.move(0, 0)
      await expect(row).toHaveAttribute('data-state', 'selected')
      expect(await row.evaluate(node => getComputedStyle(node).clipPath)).toBe(hoverShape)
      expect(await row.boundingBox()).toEqual(before)
    } else {
      await page.mouse.move(0, 0)
      await row.focus()
      await expect(row).toBeFocused()
      expect(await row.evaluate(node => getComputedStyle(node).clipPath)).not.toBe('none')
    }
  }
})

test('task dialog keeps its field groups flat and aligned', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=scheduler')
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    const newTask = page.getByRole('button', { name: 'New task', exact: true })
    await newTask.click()
    const dialog = page.getByRole('dialog', { name: 'New scheduled task' })
    const details = dialog.getByRole('region', { name: 'Task details' })
    const name = dialog.getByLabel('Name', { exact: false })
    await expect(name).toBeFocused()
    await expect(details).toHaveAttribute('data-surface', 'plain')
    expect(await details.evaluate(node => getComputedStyle(node).paddingLeft)).toBe('0px')
    await expect(dialog.getByRole('combobox', { name: 'Frequency', exact: true })).toBeVisible()
    await expect(dialog.getByLabel('Time', { exact: true })).toBeVisible()
    const [nameBounds, frequencyBounds, timeBounds] = await dialog.locator('form').evaluate(form => {
      const time = form.querySelector('input[type="time"]')!
      const frequency = time.closest('fieldset')!.querySelector('[role="combobox"]')!
      return [form.querySelector('#scheduled-task-name')!, frequency, time].map(control => {
        const bounds = control.getBoundingClientRect()
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      })
    })
    expect(Math.abs(nameBounds.x - frequencyBounds.x)).toBeLessThanOrEqual(1)
    if (width >= 640) {
      expect(Math.abs(frequencyBounds.y - timeBounds.y)).toBeLessThanOrEqual(1)
      expect(Math.abs(frequencyBounds.width - timeBounds.width)).toBeLessThanOrEqual(1)
    } else {
      expect(Math.abs(frequencyBounds.x - timeBounds.x)).toBeLessThanOrEqual(1)
      expect(timeBounds.y).toBeGreaterThan(frequencyBounds.y + frequencyBounds.height)
    }
    await name.fill('Nightly cleanup')
    await expect(dialog.getByRole('button', { name: 'Create task', exact: true })).toBeEnabled()
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await details.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
      expect(await dialog.evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0)
      await page.screenshot({
        path: `/tmp/rebroid-task-dialog-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(newTask).toBeFocused()
  }
})

test('services connects feature management and keeps disabled services discoverable', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=services')
    let navigation = page.getByRole('navigation', { name: 'Services sections' })
    await expect(navigation.getByRole('link', { name: 'Connections' })).toHaveAttribute('aria-current', 'page')
    await expect(navigation.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '/platform/features')
    const ocr = page.getByRole('row', { name: 'Manage feature for OCR perception' })
    await expect(ocr.getByRole('link', { name: 'Manage feature' })).toHaveAttribute(
      'href',
      '/platform/features#feature.ocr'
    )
    await expect(ocr.getByRole('cell', { name: 'Disabled', exact: true })).toBeVisible()
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({
        path: `/tmp/rebroid-services-catalog-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
    await page.goto('/skeleton-contract-test?editor=features')
    navigation = page.getByRole('navigation', { name: 'Services sections' })
    await expect(navigation.getByRole('link', { name: 'Features' })).toHaveAttribute('aria-current', 'page')
    await expect(navigation.getByRole('link', { name: 'Connections' })).toHaveAttribute('href', '/platform/services')
    await expect(page.getByRole('navigation', { name: 'breadcrumb' })).toContainText('PlatformServicesFeatures')
    await expect(page.getByRole('heading', { name: 'Services', exact: true })).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Enable OCR perception' })).toHaveAttribute('aria-disabled', 'true')
    expect(
      await page.getByRole('switch', { name: 'Enable OCR perception' }).evaluate(node => getComputedStyle(node).opacity)
    ).toBe('0.5')
    await expect(page.getByRole('columnheader', { name: /^Enabled/ })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /^Availability/ })).toBeAttached()
    const builder = page.getByRole('row').filter({ hasText: 'Image builder' })
    await expect(builder.getByRole('link', { name: 'Open image builder' })).toHaveAttribute(
      'href',
      '/runtime/images/build'
    )
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({
        path: `/tmp/rebroid-service-features-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
    await page.getByRole('searchbox', { name: 'Search features' }).fill('firewall')
    await page.getByRole('searchbox', { name: 'Search features' }).press('Enter')
    await expect(page.locator('tbody tr')).toHaveCount(1)
    await expect(page.locator('tbody')).toContainText('Firewall enforcement')
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=features-loading')
  const loadingY = (await page.getByRole('table').boundingBox())!.y
  await expect(page.getByRole('searchbox', { name: 'Search features' })).toBeDisabled()
  await page.goto('/skeleton-contract-test?editor=features')
  expect((await page.getByRole('table').boundingBox())!.y).toBe(loadingY)
  expect(errors).toEqual([])
})

test('embedded Files keeps folder navigation, filtering, and details in one workspace', async ({ page }) => {
  const directory = {
    name: 'Pictures',
    path: '/data/Pictures',
    type: 'directory',
    sizeBytes: null,
    modifiedAt: null,
    itemCount: 1
  }
  const file = {
    name: 'screen.txt',
    path: '/data/Pictures/screen.txt',
    type: 'file',
    sizeBytes: 1024,
    modifiedAt: null,
    itemCount: null
  }
  await page.route('**/api/bff/applications/preview-app/runtime/files?*', route => {
    const path = new URL(route.request().url()).searchParams.get('path')
    return route.fulfill({ json: { ok: true, requestId: 'preview', data: path === '/data' ? [directory] : [file] } })
  })
  await page.goto('/skeleton-contract-test?editor=app-resource&view=files')
  await expect(page.getByRole('button', { name: 'Upload files' })).toBeVisible()
  await expect
    .poll(() =>
      page.getByRole('table').evaluate(table => {
        const scroll = table.parentElement!
        return scroll.scrollWidth - scroll.clientWidth
      })
    )
    .toBe(0)
  await page.getByRole('button', { name: 'Pictures', exact: true }).press('Enter')
  const currentFolder = page.getByRole('navigation', { name: 'Current folder' })
  const folder = currentFolder.getByText('Pictures')
  await expect(folder).toHaveAttribute('aria-current', 'location')
  await expect(folder).toBeFocused()

  const search = page.getByRole('searchbox', { name: 'Search this folder' })
  await search.fill('missing')
  await expect(page.getByText('No matching results')).toBeVisible()
  await search.fill('')
  const fileButton = page.getByRole('button', { name: 'screen.txt', exact: true })
  await fileButton.click()
  await expect(page.getByRole('dialog', { name: 'File details' })).toContainText(file.path)
  await page.keyboard.press('Escape')
  await expect(fileButton).toBeFocused()
  await currentFolder.getByRole('button', { name: 'data', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pictures', exact: true })).toBeVisible()
})

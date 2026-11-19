import { expect, type Locator, test } from '@playwright/test'

const expectAligned = async (heading: Locator, accessory: Locator) => {
  await expect
    .poll(async () => {
      const [headingBox, accessoryBox] = await Promise.all([heading.boundingBox(), accessory.boundingBox()])
      if (!headingBox || !accessoryBox) return Infinity
      const headingCenter = headingBox.y + headingBox.height / 2
      const accessoryCenter = accessoryBox.y + accessoryBox.height / 2
      return Math.abs(headingCenter - accessoryCenter)
    })
    .toBeLessThanOrEqual(1)
}

test('audit and app activity align event rows and controls without horizontal scrolling', async ({ page }) => {
  for (const [width, fixture, event, outcome] of [
    [390, 'activity', 'Update trigger', 'Success'],
    [390, 'app-resource&view=activity', 'Start application', 'Failure'],
    [320, 'app-resource&view=activity', 'Start application', 'Failure']
  ] as const) {
    await page.setViewportSize({ width, height: 960 })
    await page.goto(`/skeleton-contract-test?editor=${fixture}`)
    const table = page.getByRole('table')
    const trigger = page.getByRole('button', { name: `Inspect ${event}`, exact: true })
    const row = table.getByRole('row').filter({ has: trigger })
    await expect(trigger).toBeVisible()
    const badge = row.getByText(outcome, { exact: true }).filter({ visible: true })
    await expectAligned(trigger, badge)
    await expect(row.locator('time:visible')).toHaveCount(1)
    await expect(table.getByRole('button', { name: 'Time', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Toggle columns' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Export CSV' })).toBeVisible()
    if (fixture.startsWith('app-resource')) {
      const [search, refresh, exportButton] = await Promise.all([
        page.getByPlaceholder('Search activity').boundingBox(),
        page.getByRole('button', { name: 'Refresh', exact: true }).boundingBox(),
        page.getByRole('link', { name: 'Export CSV' }).boundingBox()
      ])
      expect(refresh).toMatchObject({ y: search!.y, width: 44, height: search!.height })
      expect(exportButton).toMatchObject({ y: search!.y, width: refresh!.width, height: refresh!.height })
    }
    expect(await table.locator('..').evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0)
    await trigger.click()
    await expect(page.getByRole('dialog', { name: event, exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  }
})

test('mobile inventory and workflow lists keep the primary record in view', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  for (const [fixture, heading] of [
    ['users-list', 'User'],
    ['groups-list', 'Group'],
    ['triggers', 'Trigger'],
    ['run-history', 'Run'],
    ['active-workflow-runs', 'Workflow run'],
    ['display-sessions', 'Application and user'],
    ['ai-list', 'Provider'],
    ['ai-models', 'Model'],
    ['policies', 'Application']
  ]) {
    await page.goto(`/skeleton-contract-test?editor=${fixture}`)
    const table = page
      .getByRole('table')
      .filter({ has: page.getByRole('columnheader', { name: new RegExp(`^${heading}\\b`) }) })
    await expect(table).toBeVisible()
    expect(await table.locator('..').evaluate(node => node.scrollWidth - node.clientWidth), fixture).toBe(0)
  }
})

test('compact record headings align with status chips and row actions', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const [fixture, name, status, hasMenu] of [
      ['workflows', 'Daily inventory check', 'Failed', true],
      ['active-workflow-runs', 'Inventory scan', 'Queued', false],
      ['ai-list', 'Local model server', 'Enabled', true],
      ['policies', 'Inventory worker', 'On next start', false]
    ] as const) {
      await page.goto(`/skeleton-contract-test?editor=${fixture}`)
      const heading = page.getByRole('link', { name })
      const row = page.getByRole('table').getByRole('row').filter({ has: heading })
      await expectAligned(heading, row.getByText(status, { exact: true }))
      if (fixture === 'ai-list') {
        const [nameBox, idBox, modelsBox] = await Promise.all([
          heading.boundingBox(),
          row.getByText('local-models', { exact: true }).boundingBox(),
          row.getByText('2 configured', { exact: true }).boundingBox()
        ])
        expect(nameBox!.x).toBeCloseTo(modelsBox!.x)
        expect(idBox!.x).toBeCloseTo(modelsBox!.x)
      }
      if (hasMenu) {
        const menu = row.getByRole('button', { name: 'Open row actions' })
        await expectAligned(heading, menu)
        expect(await menu.boundingBox()).toMatchObject({ width: 44, height: 44 })
      }
    }

    await page.goto('/skeleton-contract-test?editor=triggers')
    const trigger = page.getByRole('button', { name: 'Morning inventory', exact: true })
    const triggerRow = page.getByRole('row').filter({ has: trigger })
    await expectAligned(trigger, triggerRow.getByRole('switch'))
    await expectAligned(trigger, triggerRow.getByRole('button', { name: 'Open row actions' }))

    await page.goto('/skeleton-contract-test?editor=users-list')
    const user = page.getByRole('link', { name: /Ada Lovelace/ })
    const userRow = page.getByRole('row').filter({ has: user })
    await expectAligned(user, userRow.getByText('Active', { exact: true }))
    await expectAligned(user, userRow.getByRole('button', { name: 'Open row actions' }))

    await page.goto('/skeleton-contract-test?editor=ai-models')
    const title = page.getByRole('button', { name: 'Device controller', exact: true })
    const model = page.getByRole('row').filter({ has: title })
    await expectAligned(title, model.getByRole('switch'))
    await expectAligned(title, model.getByRole('button', { name: 'Open row actions' }))
    const checkHealth = model.getByRole('button', { name: 'Check AI provider health' })
    await expectAligned(model.getByText('Unknown', { exact: true }), checkHealth)
    expect(await checkHealth.boundingBox()).toMatchObject({ width: 44, height: 44 })
  }
})

test('settings grids reflow inside a narrow pane on a desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const [editor, wideColumn] of [
    ['features', 'Availability'],
    ['scheduler', 'Next run'],
    ['services-all', 'Connection']
  ]) {
    await page.goto(`/skeleton-contract-test?editor=${editor}`)
    const table = page.getByRole('table')
    const header = table.getByRole('columnheader', { name: new RegExp(`^${wideColumn}`) })
    await expect(header).toBeVisible()
    const frame = table.locator('../..')
    await frame.evaluate(node => {
      node.style.inlineSize = '320px'
    })
    await expect(header).toHaveCount(0)
    expect(await table.locator('..').evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0)

    if (editor === 'features') {
      const display = table.getByRole('row').filter({ hasText: 'Virtual displays' })
      await expectAligned(
        display.getByText('Virtual displays', { exact: true }),
        display.getByRole('switch', { name: 'Enable Virtual displays' })
      )
      await expect(display.getByText('Sync failed', { exact: true })).toBeVisible()
      await expect(display.getByRole('link', { name: 'View sessions' })).toHaveAttribute('href', '/platform/casting')
      await expect(table.getByRole('switch', { name: 'Enable OCR perception' })).toBeDisabled()
    } else if (editor === 'scheduler') {
      const task = table.getByRole('row').filter({ hasText: 'Weekend image cleanup' })
      const name = task.getByRole('button', { name: 'Weekend image cleanup', exact: true })
      await expectAligned(name, task.getByRole('switch', { name: 'Enable Weekend image cleanup' }))
      await expect(task.getByText('Every Sunday')).toBeVisible()
      const menu = task.getByRole('button', { name: 'Open row actions' })
      await expectAligned(name, menu)
      await expect.poll(() => menu.boundingBox()).toMatchObject({ width: 44, height: 44 })
      await task.getByRole('button', { name: 'View failed run for Weekend image cleanup' }).click()
      await expect(page.getByRole('dialog').getByRole('heading', { name: 'Last run failed' })).toBeVisible()
      await page.keyboard.press('Escape')
    } else {
      const firewall = table.getByRole('row', { name: 'View details for Firewall agent' })
      const service = firewall.getByRole('link', { name: 'Firewall agent', exact: true })
      const status = firewall.getByText('Offline', { exact: true })
      await expectAligned(service, status)
      await expect(service).toHaveAttribute('href', '/security/firewall')
      await expect(service.locator('svg')).toHaveCount(0)
      const note = firewall.getByText('Firewall agent could not be reached.', { exact: true }).filter({ visible: true })
      await expect(note).toBeVisible()
      const [noteBox, serviceBox, statusBox] = await Promise.all([
        note.boundingBox(),
        service.boundingBox(),
        status.boundingBox()
      ])
      expect(noteBox!.x).toBe(serviceBox!.x)
      expect(noteBox!.y).toBeGreaterThan(statusBox!.y + statusBox!.height)
      await expect(firewall.getByRole('link', { name: 'View details' })).toHaveCount(0)
    }

    await frame.evaluate(node => {
      node.style.removeProperty('inline-size')
    })
    await expect(header).toBeVisible()
  }
})

test('Workflows shows compact rows on phones and full columns on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 })
  await page.goto('/skeleton-contract-test?editor=workflows')

  const table = page.getByRole('table')
  const row = table.getByRole('row').filter({ has: page.getByRole('link', { name: 'Daily inventory check' }) })
  await expect(row.getByText('0 steps').filter({ visible: true })).toBeInViewport()
  await expect(row.getByText('Failed', { exact: true }).filter({ visible: true })).toBeInViewport()
  await expect(row.getByRole('checkbox')).toBeInViewport()
  await expect(row.getByRole('button', { name: 'Open row actions' })).toBeInViewport()
  await expect(row.getByRole('link', { name: 'View failure' })).toBeInViewport()
  await expect(table.getByRole('columnheader', { name: 'Apps' })).toHaveCount(0)
  const selectPage = table.getByRole('checkbox', { name: 'Select current page' })
  await expectAligned(table.getByRole('button', { name: 'Last run', exact: true }), selectPage)
  expect((await selectPage.boundingBox())!.x).toBe((await row.getByRole('checkbox').boundingBox())!.x)
  expect(await table.locator('..').evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0)
  await expect(page.getByText('1 workflow', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next page' })).toHaveCount(0)

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(table.getByRole('columnheader', { name: 'Apps' })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'Run status' })).toBeVisible()
  const resize = table.getByRole('separator', { name: 'Resize Workflow column' })
  await resize.focus()
  await resize.press('ArrowRight')
  await expect(resize).toHaveAttribute('aria-valuenow', '312')
  await resize.press('Shift+ArrowLeft')
  await expect(resize).toHaveAttribute('aria-valuenow', '280')
  await resize.press('Enter')
  await expect(resize).toHaveAttribute('aria-valuenow', '304')
  await expect(resize).toBeFocused()
})

test('wide audit tables show scrollable edges and keep column controls above the table', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 850 })
  await page.goto('/skeleton-contract-test?editor=activity')

  const table = page.getByRole('table')
  const scroll = table.locator('..')
  const frame = scroll.locator('..')
  const columns = page.locator('[data-slot=data-grid-toolbar]').getByRole('button', { name: 'Toggle columns' })
  await expect(columns).toBeInViewport()
  await expect(frame).toHaveAttribute('data-scroll-end', 'true')
  await expect(frame).not.toHaveAttribute('data-scroll-start')
  await scroll.evaluate(node => {
    node.scrollLeft = node.scrollWidth
  })
  await expect(frame).toHaveAttribute('data-scroll-start', 'true')
  await expect(frame).not.toHaveAttribute('data-scroll-end')

  await columns.click()
  const target = page.getByRole('menuitemcheckbox', { name: 'Target' })
  await expect(target).toBeChecked()
  await target.click()
  await expect(target).not.toBeChecked()
  await expect(table.getByRole('columnheader', { name: /^Target/ })).toHaveCount(0)
})

import { expect, test } from '@playwright/test'

const widths = [390, 768, 1440, 2048]

test('audit rows stay concise across widths and themes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=activity')
    await expect(page.getByRole('heading', { name: 'Audit log', exact: true })).toBeVisible()
    const row = page.getByRole('row', { name: 'Inspect Update trigger by Alex Morgan' })
    await expect(row.getByRole('button', { name: 'Inspect Update trigger', exact: true })).toBeVisible()
    await expect(row.getByText('Alex Morgan', { exact: true })).toHaveCount(1)
    await expect(row).not.toContainText('trigger-8646')
    await expect(page.getByText('none', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('columnheader').first()).toContainText('Time')
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
        document.documentElement.style.colorScheme = value === 'light' ? 'light' : 'dark'
      }, theme)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        `${width} ${theme}`
      ).toBeLessThanOrEqual(0)
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `/tmp/rebroid-audit-${width}-${theme}.png`,
          fullPage: true,
          animations: 'disabled'
        })
    }
  }
  expect(errors).toEqual([])
})

test('event inspection supports keyboard access, complete data, and focus restoration', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=activity')
  const row = page.getByRole('row', { name: 'Inspect Update trigger by Alex Morgan' })
  await row.focus()
  await page.keyboard.press('Enter')
  const detail = page.getByRole('dialog', { name: 'Update trigger', exact: true })
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('automation.trigger.update')
  await expect(detail).toContainText('trigger-8646f9d2-2b10-4be0-a960-33792a0618fb')
  await expect(detail).toContainText('192.0.2.10')
  await expect(detail.getByRole('region', { name: 'Event data JSON' })).toContainText('03:00')
  await expect(detail.getByRole('button', { name: 'Copy Action', exact: true })).toHaveCount(1)
  await page.screenshot({
    path: `/tmp/rebroid-audit-inspector-${test.info().project.name}.png`,
    animations: 'disabled'
  })
  await page.keyboard.press('Escape')
  await expect(detail).not.toBeVisible()
  await expect(row).toBeFocused()
  const signIn = page.getByRole('button', { name: 'Inspect Sign in', exact: true })
  await signIn.click()
  await expect(page.getByRole('dialog', { name: 'Sign in', exact: true })).toContainText(
    'No additional event data recorded.'
  )
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Target', exact: true })).toHaveCount(0)
})

test('audit filters are searchable and labeled; app scope keeps global actions out', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=activity')
  const filtersButton = page.getByRole('button', { name: 'Filters', exact: true })
  await filtersButton.click()
  const filters = page.getByRole('dialog', { name: 'Filter activity', exact: true })
  const actor = filters.getByRole('combobox', { name: 'Actor', exact: true })
  await actor.fill('Morgan')
  await expect(page.getByRole('option', { name: 'Alex Morgan', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Admin', exact: true })).toHaveCount(0)
  await actor.press('Escape')
  const action = filters.getByRole('combobox', { name: 'Action', exact: true })
  await action.fill('trigger')
  await expect(page.getByRole('option', { name: /Update trigger/ })).toBeVisible()
  await expect(page.getByRole('option', { name: /Start application/ })).toHaveCount(0)
  await action.press('Escape')
  await filters.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(filtersButton).toBeFocused()
  await expect(page.getByLabel('Activity summary').getByText('30 days', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Configure retention', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Activity retention', exact: true })).toBeVisible()
  const retention = page.getByRole('spinbutton', { name: 'Retention days', exact: true })
  await expect(retention).toHaveAccessibleDescription('Keep events for 1–3,650 days. The default is 30 days.')
  await retention.fill('0')
  await page.getByRole('button', { name: 'Save retention', exact: true }).click()
  await expect(retention).toBeVisible()
  expect(await retention.evaluate(node => (node as HTMLInputElement).validity.rangeUnderflow)).toBe(true)
  await page.keyboard.press('Escape')
  await page.goto('/skeleton-contract-test?editor=app-resource&view=activity')
  await expect(page.getByRole('button', { name: /Configure retention|Activity actions/ })).toHaveCount(0)
  const href = await page.getByRole('link', { name: 'Export CSV' }).getAttribute('href')
  const url = new URL(href!, 'https://example.test')
  expect(url.searchParams.get('resourceId')).toBe('preview-app')
  expect(url.searchParams.get('resourceType')).toBe('application')
})

test('audit loading retains toolbar and table header geometry', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 })
    const measurements = []
    for (const editor of ['activity-loading', 'activity']) {
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      await expect(page.getByRole('columnheader').first()).toBeVisible()
      // The flexible spacer gets its final width after the grid measures its scroll container.
      await expect
        .poll(() =>
          page.getByRole('table').evaluate(table => parseFloat(table.style.width) >= table.parentElement!.clientWidth)
        )
        .toBe(true)
      measurements.push(
        await page.locator('thead th').evaluateAll(nodes =>
          nodes.map(node => {
            const { x, y, width: cellWidth, height } = node.getBoundingClientRect()
            return { x, y, width: cellWidth, height }
          })
        )
      )
    }
    expect(measurements[0].length).toBe(measurements[1].length)
    for (let index = 0; index < measurements[0].length; index++)
      for (const axis of ['x', 'y', 'width', 'height'] as const)
        expect(
          Math.abs(measurements[0][index][axis] - measurements[1][index][axis]),
          `${width} ${index} ${axis}`
        ).toBeLessThanOrEqual(1)
  }
})

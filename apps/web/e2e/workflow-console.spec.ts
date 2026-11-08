import { expect, test } from '@playwright/test'

const widths = [390, 768, 1440, 2048]

test('workflow workspace remains readable across widths and themes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=workflow')
    await expect(page.getByRole('heading', { name: 'Workflow details' })).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Workflow navigation' }).getByRole('link', { name: 'Editor' })
    ).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('dialog')).toHaveCount(0)
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
          path: `/tmp/rebroid-workflow-${width}-${theme}.png`,
          fullPage: true,
          animations: 'disabled'
        })
    }
    await page.getByRole('button', { name: 'Edit step 2: Wait', exact: true }).click()
    if (width < 1280) {
      const inspector = page.getByRole('dialog', { name: 'Edit step', exact: true })
      await expect(inspector).toBeVisible()
      await inspector.getByRole('button', { name: 'Close inspector' }).click()
      await expect(inspector).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Edit step 2: Wait', exact: true })).toBeFocused()
      if (width < 640) {
        await page.getByRole('button', { name: 'Step menu', exact: true }).nth(1).click()
        await page.getByRole('menuitem', { name: 'Move step up', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Edit step 1: Wait', exact: true })).toBeVisible()
      }
    } else {
      const inspector = page.getByRole('complementary', { name: 'Step configuration' })
      await expect(inspector.getByRole('heading', { name: 'Wait', exact: true })).toBeVisible()
      await expect(inspector.getByRole('combobox', { name: 'Action', exact: true })).toHaveAccessibleDescription(
        'Choose the action this step performs.'
      )
    }
  }
  expect(errors).toEqual([])
})

test('step actions preserve selection, ordering and keyboard catalog choice', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=workflow')
  await page.getByRole('button', { name: 'Move step down', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Edit step 1: Wait', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit step 2: Viewer command', exact: true }).click()
  const action = page.getByRole('combobox', { name: 'Action', exact: true })
  await action.fill('debug.log')
  await expect(page.getByRole('option', { name: /Log message/ })).toBeVisible()
  await action.press('ArrowDown')
  await action.press('Enter')
  await expect(action).toHaveValue('Log message')
  await expect(page.getByRole('button', { name: 'Edit step 2: Log message', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await page.getByRole('button', { name: 'Step menu', exact: true }).nth(1).click()
  await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click()
  await expect(page.locator('[data-automation-step-item="true"] > .group')).toHaveCount(4)
  await page.getByRole('button', { name: 'Step menu', exact: true }).nth(2).click()
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await expect(page.locator('[data-automation-step-item="true"] > .group')).toHaveCount(3)
  await page.getByRole('button', { name: 'YAML', exact: true }).click()
  await expect(page.getByRole('button', { name: 'YAML', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('trigger setup groups searchable targets and schedule without nested cards', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=triggers')
    await page.getByRole('button', { name: 'New trigger', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'New trigger', exact: true })
    const app = dialog.getByRole('combobox', { name: /^Target app/ })
    await app.fill('Reports')
    await page.getByRole('option', { name: /Reports worker/ }).click()
    await expect(app).toHaveValue('Reports worker')
    await expect(dialog.getByRole('combobox', { name: 'Profile', exact: true })).toBeVisible()
    await dialog.getByRole('combobox', { name: 'Frequency', exact: true }).click()
    await page.getByRole('option', { name: 'Every week', exact: true }).click()
    await expect(dialog.getByRole('combobox', { name: 'Day of week', exact: true })).toBeVisible()
    await expect(dialog.getByRole('switch', { name: 'Start app if needed', exact: true })).toBeChecked()
    await dialog.getByRole('button', { name: 'Create trigger', exact: true }).scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `/tmp/rebroid-trigger-dialog-${width}.png`, animations: 'disabled' })
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  }
})

test('new workflow loader shares the current ready layout', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 })
    const boxes = []
    for (const editor of ['workflow-create-loading', 'workflow-create']) {
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      await expect(page.getByRole('heading', { name: 'Workflow details' })).toBeVisible()
      await expect
        .poll(() =>
          page.locator('#automation-name').evaluate(node => node.isConnected && node.getBoundingClientRect().width > 0)
        )
        .toBe(true)
      boxes.push(
        await page.locator('#automation-name').evaluate(node => {
          const { x, y, width: fieldWidth, height } = node.getBoundingClientRect()
          return { x, y, width: fieldWidth, height }
        })
      )
      await expect(page.getByRole('navigation', { name: 'Workflow navigation' })).toHaveCount(0)
    }
    for (const key of ['x', 'y', 'width', 'height'] as const)
      expect(Math.abs(boxes[0][key] - boxes[1][key]), `${width} ${key}`).toBeLessThanOrEqual(1)
  }
})

test('condition and repeat blocks retain labeled controls and branch editing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=workflow')
  const inspector = page.getByRole('complementary', { name: 'Step configuration' })
  await page.getByRole('button', { name: 'Add step', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Condition', exact: true }).click()
  await expect(inspector.getByRole('combobox', { name: 'Value', exact: true })).toBeVisible()
  await expect(inspector.getByRole('combobox', { name: 'Condition', exact: true })).toBeVisible()
  await inspector.getByRole('button', { name: 'And condition', exact: true }).click()
  await expect(inspector.getByRole('combobox', { name: 'Condition', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Add step', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Repeat', exact: true }).click()
  await expect(inspector.getByRole('spinbutton', { name: 'Count', exact: true })).toBeVisible()
  await inspector.getByRole('combobox', { name: 'Mode', exact: true }).click()
  await page.getByRole('option', { name: 'While condition', exact: true }).click()
  await expect(inspector.getByRole('spinbutton', { name: 'Count', exact: true })).toHaveCount(0)
  await expect(inspector.getByRole('spinbutton', { name: 'Max iterations', exact: true })).toBeVisible()
  await expect(inspector.getByRole('combobox', { name: 'Value', exact: true })).toBeVisible()
})

test('loading workflow does not capture global paste shortcuts', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=workflow-create-loading')
  await expect(page.getByRole('heading', { name: 'Workflow steps' })).toBeVisible()
  const intercepted = await page.evaluate(() => {
    const clipboardData = new DataTransfer()
    clipboardData.setData(
      'text/plain',
      JSON.stringify({
        type: 'rebroid.workflow.step',
        version: 1,
        step: { kind: 'action', id: 'pasted', clientKey: 'pasted', uses: 'debug.log', withJson: '{}' }
      })
    )
    const event = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(intercepted).toBe(false)
})

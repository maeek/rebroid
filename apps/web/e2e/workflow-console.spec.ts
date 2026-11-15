import { expect, test } from '@playwright/test'

const widths = [390, 768, 1440, 2048]

test('workflow workspace remains readable across widths and themes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=workflow')
    await expect(page.getByRole('heading', { name: 'Daily inventory check' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to workflows' })).toHaveAttribute('href', '/automations')
    const moreActions = page.getByRole('button', { name: 'More workflow actions' })
    await expect(moreActions).toBeVisible()
    await expect(page.getByRole('button', { name: 'Workflow details' })).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Workflow navigation' })).toHaveCount(0)
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
    await moreActions.click()
    await expect(page.getByRole('menuitem', { name: 'Run history' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'Workflow details' }).click()
    const details = page.getByRole('dialog', { name: 'Workflow details' })
    await expect(details.getByRole('textbox', { name: 'Name' })).toHaveValue('Daily inventory check')
    await expect(details).toHaveAttribute('data-slot', 'dialog-content')
    await details.getByRole('button', { name: 'Done' }).click()
    await expect(moreActions).toBeFocused()
    await page.getByRole('button', { name: 'Edit step 2: Wait for a duration', exact: true }).click()
    if (width < 1280) {
      const inspector = page.getByRole('dialog', { name: 'Edit step', exact: true })
      await expect(inspector).toBeVisible()
      await inspector.getByRole('button', { name: 'Close inspector' }).click()
      await expect(inspector).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Edit step 2: Wait for a duration', exact: true })).toBeFocused()
      if (width < 640) {
        await page.getByRole('button', { name: 'Step menu', exact: true }).nth(1).click()
        await page.getByRole('menuitem', { name: 'Move step up', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Edit step 1: Wait for a duration', exact: true })).toBeVisible()
      }
    } else {
      const inspector = page.getByRole('complementary', { name: 'Step configuration' })
      await expect(inspector.getByRole('heading', { name: 'Wait for a duration', exact: true })).toBeVisible()
      await expect(inspector.getByRole('button', { name: 'More step actions', exact: true })).toBeVisible()
    }
  }
  expect(errors).toEqual([])
})

test('workflow toolbar stays visible and covers steps during scroll', async ({ page, isMobile }) => {
  await page.goto('/skeleton-contract-test?editor=workflow-long')
  const toolbar = page.locator('[data-workflow-toolbar]')
  const safeAreaInset = isMobile ? 20 : 0
  if (isMobile) {
    await toolbar.evaluate((element, inset) => {
      const shell = element.parentElement!.parentElement!
      shell.dataset.slot = 'protected-shell'
      shell.style.setProperty('--console-top-inset', `${inset}px`)
      shell.style.paddingTop = 'var(--console-top-inset)'
    }, safeAreaInset)
  }

  const sequence = page.getByRole('region', { name: 'Step sequence' })
  await expect(sequence.locator('[data-reorder-id]')).toHaveCount(27)
  await page.evaluate(() => window.scrollTo(0, 400))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)

  await expect
    .poll(() =>
      toolbar.evaluate(element => {
        const box = element.getBoundingClientRect()
        const { top, backgroundColor } = getComputedStyle(element)
        const coveredRow = Array.from(document.querySelectorAll('[data-reorder-id]')).find(row => {
          const rect = row.getBoundingClientRect()
          return rect.top < box.bottom && rect.bottom > box.top
        })
        if (!coveredRow) return false
        const row = coveredRow.getBoundingClientRect()
        const point = { x: row.x + 8, y: (Math.max(row.top, box.top) + Math.min(row.bottom, box.bottom)) / 2 }
        return (
          Math.abs(box.top - parseFloat(top)) < 1 &&
          backgroundColor !== 'rgba(0, 0, 0, 0)' &&
          element.contains(document.elementFromPoint(point.x, point.y))
        )
      })
    )
    .toBe(true)
  const top = (await toolbar.boundingBox())!.y
  expect(top).toBe(safeAreaInset)

  const visibleActions = ['Save', 'Undo', 'Redo', 'More workflow actions']
  if (!isMobile) visibleActions.push('Visual editor', 'YAML')
  for (const name of visibleActions) {
    await expect(toolbar.getByRole('button', { name, exact: true })).toBeInViewport()
  }
  if (!isMobile) {
    const inspector = page.getByRole('complementary', { name: 'Step configuration' })
    const header = (await toolbar.boundingBox())!
    expect((await inspector.boundingBox())!.y).toBeGreaterThanOrEqual(header.y + header.height)
    await expect.poll(() => inspector.evaluate(element => innerHeight - element.getBoundingClientRect().bottom)).toBe(8)

    const handles = sequence.getByRole('button', { name: 'Drag step' })
    const from = (await handles.nth(10).boundingBox())!
    const to = (await handles.nth(8).boundingBox())!
    const x = from.x + from.width / 2
    await page.mouse.move(x, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(x, to.y + to.height / 2, { steps: 12 })
    const marker = sequence.locator('[data-step-drop-indicator]')
    await expect(marker).toBeVisible()
    await page.mouse.move(x, header.y + header.height / 2, { steps: 12 })
    await expect(marker).toHaveCount(0)
    await page.mouse.up()
    await expect(toolbar.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  }
})

test('workflow inspector fills the desktop viewport beside an unboxed sequence', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=workflow')
  const sequence = page.getByRole('region', { name: 'Step sequence' })
  await expect(sequence).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(sequence).toHaveCSS('padding', '0px')
  await expect(sequence).toHaveCSS('border-radius', '0px')
  const inspector = page.getByRole('complementary', { name: 'Step configuration' })
  for (const height of [720, 1000]) {
    await page.setViewportSize({ width: 1440, height })
    await expect.poll(() => inspector.evaluate(element => innerHeight - element.getBoundingClientRect().bottom)).toBe(8)
    const sequenceBox = (await sequence.boundingBox())!
    const inspectorBox = (await inspector.boundingBox())!
    expect(sequenceBox.y).toBe(inspectorBox.y)
    expect(sequenceBox.height).toBeLessThan(inspectorBox.height)
  }
})

test('Delete and Backspace remove the selected workflow step outside text fields', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=workflow')
  const sequence = page.getByRole('region', { name: 'Step sequence' })
  const wait = sequence.getByRole('button', { name: 'Edit step 2: Wait for a duration', exact: true })
  await wait.click()
  await page.getByRole('spinbutton', { name: 'Duration (s)' }).press('Backspace')
  await expect(wait).toBeVisible()

  await wait.press('Delete')
  await expect(wait).toHaveCount(0)
  const log = sequence.getByRole('button', { name: 'Edit step 2: Write to run log', exact: true })
  await expect(log).toBeFocused()
  await expect(log).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Backspace')
  await expect(log).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(log).toBeVisible()
})

test('workflow title can be renamed in place, canceled, and undone', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=workflow')
  const heading = page.getByRole('heading', { level: 1 })
  const title = heading.getByRole('button')
  const name = page.getByRole('textbox', { name: 'Workflow name' })
  await title.press('Enter')
  await expect(name).toBeFocused()
  await name.fill('Discard this title')
  await name.press('Escape')
  await expect(title).toHaveText('Daily inventory check')
  await expect(title).toBeFocused()

  await title.press('Enter')
  await name.fill('Morning inventory check')
  await name.press('Enter')
  await expect(title).toHaveText('Morning inventory check')
  await title.press('Control+z')
  await expect(title).toHaveText('Daily inventory check')

  await title.click()
  await name.fill('Evening inventory check')
  await name.press('Tab')
  await expect(title).toHaveText('Evening inventory check')
})

test('workflow YAML fills the desktop workspace and validates edits in Monaco', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const workerErrors: string[] = []
  const recordError = (message: string) => {
    if (/Missing requestHandler|Could not create web worker/i.test(message)) workerErrors.push(message)
  }
  page.on('pageerror', error => recordError(error.message))
  page.on('console', message => recordError(message.text()))
  await page.goto('/skeleton-contract-test?editor=workflow')
  await page.getByRole('button', { name: 'YAML', exact: true }).click()
  const section = page.getByRole('region', { name: 'Workflow YAML' })
  const editor = section.getByLabel('Automation YAML editor', { exact: true })
  await expect(editor.locator('.monaco-editor')).toBeVisible()
  await expect(editor).toHaveCSS('border-top-width', '0px')
  await expect(editor).toHaveCSS('border-radius', '0px')
  await expect.poll(() => editor.evaluate(element => innerHeight - element.getBoundingClientRect().bottom)).toBe(8)

  await editor.locator('.view-lines').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText('apiVersion: invalid\nkind: AndroidAutomation\n')
  await expect(editor.locator('.view-lines')).toContainText('invalid')
  await expect(editor.locator('.squiggly-error').first()).toBeVisible()
  expect(workerErrors).toEqual([])
})

test('mobile workflow keeps core actions visible and fits YAML above the dock', async ({ page }) => {
  for (const { width, height } of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 }
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto('/skeleton-contract-test?editor=workflow-shell')
    const toolbar = page.locator('[data-workflow-toolbar]')
    const more = toolbar.getByRole('button', { name: 'More workflow actions' })
    const actionRow = (await more.boundingBox())!
    for (const name of ['Undo', 'Redo']) {
      const button = toolbar.getByRole('button', { name, exact: true })
      await expect(button).toBeInViewport({ ratio: 1 })
      const box = (await button.boundingBox())!
      expect(box.y).toBe(actionRow.y)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    const save = toolbar.getByRole('button', { name: 'Save', exact: true })
    await expect(save).toBeInViewport({ ratio: 1 })
    const saveBox = (await save.boundingBox())!
    if (width < 640) {
      const heading = (await toolbar.getByRole('heading', { level: 1 }).boundingBox())!
      expect(saveBox.y + saveBox.height / 2).toBeCloseTo(heading.y + heading.height / 2)
      expect(saveBox.x + saveBox.width).toBe(width - 16)
      expect(saveBox.y).toBeLessThan(actionRow.y)
    } else {
      expect(saveBox.y).toBe(actionRow.y)
    }
    await expect(toolbar.getByRole('group', { name: 'Editor mode' })).toBeHidden()
    await expect(toolbar.getByRole('button', { name: 'Draft workflow from prompt' })).toBeHidden()

    await more.press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Draft with AI' })).toBeVisible()
    const visual = page.getByRole('menuitemradio', { name: 'Visual editor' })
    const yaml = page.getByRole('menuitemradio', { name: 'YAML' })
    await expect(visual).toBeChecked()
    await expect(visual).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(yaml).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(more).toBeFocused()

    const editor = page.getByLabel('Automation YAML editor', { exact: true })
    await expect(editor.locator('.monaco-editor')).toBeVisible()
    const dock = page.getByRole('navigation', { name: 'Mobile navigation' })
    const dockBox = (await dock.boundingBox())!
    const toolbarBox = (await toolbar.boundingBox())!
    const gutter = width < 640 ? 16 : 24
    const box = (await editor.boundingBox())!
    expect(box.x).toBe(toolbarBox.x + gutter)
    expect(box.width).toBe(toolbarBox.width - gutter * 2)
    expect(box.y).toBe(toolbarBox.y + toolbarBox.height + 8)
    expect(dockBox.y - (box.y + box.height)).toBe(16)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)

    await more.click()
    await expect(yaml).toBeChecked()
    await visual.click()
    await expect(page.getByRole('region', { name: 'Step sequence' })).toBeVisible()
    await more.click()
    await expect(visual).toBeChecked()
    await visual.click()
    await expect(page.getByRole('region', { name: 'Step sequence' })).toBeVisible()
  }
})

test('workflow details opens from the keyboard and closes back to the menu button', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=workflow-create')
  const actions = page.getByRole('button', { name: 'More workflow actions' })
  await actions.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Run history' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Workflow details' }).press('Enter')
  const details = page.getByRole('dialog', { name: 'Workflow details' })
  await expect(details.getByRole('textbox', { name: 'Name' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(details).not.toBeVisible()
  await expect(actions).toBeFocused()
})

test('run history uses breadcrumbs and keeps filter chips compact and aligned', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/skeleton-contract-test?editor=run-history')
    const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
    await expect(breadcrumb.getByRole('link', { name: 'Daily inventory check' })).toHaveAttribute(
      'href',
      '/automations/preview-workflow'
    )
    await expect(page.getByRole('link', { name: 'Back to editor' })).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Workflow navigation' })).toHaveCount(0)

    const filters = page.getByRole('button', { name: /^Filters/ })
    await filters.click()
    const dialog = page.getByRole('dialog', { name: 'Filters' })
    await dialog.getByRole('combobox', { name: 'Status', exact: true }).click()
    await page.getByRole('option', { name: 'queued' }).click()
    await dialog.getByRole('button', { name: 'Done' }).click()
    const summary = page.getByRole('group', { name: 'Active filters' })
    const chip = summary.getByRole('button', { name: 'Remove Status filter' })
    await expect(chip).toHaveAccessibleDescription('queued')
    const target = (await chip.boundingBox())!
    const badge = summary.getByText('queued', { exact: true }).locator('..')
    const surface = (await badge.boundingBox())!
    const table = (await page.getByRole('table').boundingBox())!
    expect(surface.x).toBe(table.x)
    expect(surface.height).toBeLessThanOrEqual(24)
    if (width === 390) {
      const search = (await page.getByRole('searchbox').boundingBox())!
      expect(surface.x).toBe(search.x)
    }
    if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
      expect(target.height).toBeGreaterThanOrEqual(44)
    }
    await chip.press('Enter')
    await expect(summary).toHaveCount(0)
    await expect(filters).toBeFocused()
  }
})

test('step actions preserve selection, ordering and keyboard catalog choice', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=workflow')
  await page.getByRole('button', { name: 'Move step down', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Edit step 1: Wait for a duration', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit step 2: Device control', exact: true }).click()
  const inspector = page.getByRole('complementary', { name: 'Step configuration' })
  const stepMenu = inspector.getByRole('button', { name: 'More step actions', exact: true })
  await expect(stepMenu).toBeVisible()
  await expect(inspector.getByRole('combobox', { name: 'Change action' })).toHaveCount(0)
  await stepMenu.click()
  await page.getByRole('menuitem', { name: 'Replace block' }).click()
  const catalog = page.getByRole('dialog', { name: 'Replace block' })
  const action = catalog.getByRole('combobox', { name: 'Search actions' })
  await expect(action).toBeFocused()
  await action.fill('debug.log')
  await expect(page.getByRole('option', { name: /Write to run log/ })).toBeVisible()
  await action.press('ArrowDown')
  await action.press('Enter')
  await expect(catalog).toHaveCount(0)
  await expect(stepMenu).toBeFocused()
  await expect(page.getByRole('button', { name: 'Edit step 2: Write to run log', exact: true })).toHaveAttribute(
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

test('adds a swipe from the grouped catalog and replaces it from the inspector menu', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=workflow')
  await page.getByRole('button', { name: 'Add step', exact: true }).click()
  const add = page.getByRole('dialog', { name: 'Add step' })
  await expect(add.getByRole('group', { name: 'Touch & gestures' })).toBeVisible()
  const search = add.getByRole('combobox', { name: 'Search steps' })
  await expect(search).toBeFocused()
  await search.fill('scroll')
  await expect(add.getByRole('group', { name: 'Network' })).toHaveCount(0)
  await add.getByRole('option', { name: /^Swipe\b/ }).click()
  const duration = page.getByRole('spinbutton', { name: 'Duration (ms)' })
  await duration.fill('500')
  await page.getByRole('button', { name: 'Right', exact: true }).click()
  await expect(duration).toHaveValue('500')
  await expect(page.getByRole('button', { name: 'Right', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Custom', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Start X (%)' })).toHaveValue('20')
  await expect(page.getByRole('spinbutton', { name: 'End X (%)' })).toHaveValue('80')
  const menu = page.getByRole('button', { name: 'More step actions' })
  await menu.click()
  await page.getByRole('menuitem', { name: 'Replace block' }).click()
  const replace = page.getByRole('dialog', { name: 'Replace block' })
  await expect(replace.getByRole('combobox', { name: 'Search actions' })).toBeFocused()
  await replace.getByRole('combobox', { name: 'Search actions' }).press('Escape')
  await expect(replace).toHaveCount(0)
  await expect(menu).toBeFocused()
  await expect(duration).toHaveValue('500')
})

test('uses the full inspector width and keeps step-specific options inline', async ({ page, isMobile }) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=workflow')
  await page.getByRole('button', { name: 'Add step', exact: true }).click()
  const add = page.getByRole('dialog', { name: 'Add step' })
  await add.getByRole('combobox', { name: 'Search steps' }).fill('android.launchPackage')
  await add.getByRole('option', { name: /^Launch app/ }).click()
  const inspector = isMobile
    ? page.getByRole('dialog', { name: 'Edit step' })
    : page.getByRole('complementary', { name: 'Step configuration' })
  const packageId = inspector.getByRole('textbox', { name: 'Android package ID' })
  const timeout = inspector.getByRole('spinbutton', { name: 'Timeout (s)' })
  const options = inspector.getByText('Launch timeout', { exact: true })
  await expect(packageId).toBeVisible()
  const panel = (await inspector.boundingBox())!
  const field = (await packageId.boundingBox())!
  expect(field.x - panel.x).toBeCloseTo(panel.x + panel.width - field.x - field.width, 0)
  await expect(timeout).not.toBeVisible()
  await options.click()
  await expect(timeout).toBeVisible()
  await timeout.fill('12.5')
  await options.click()
  await expect(timeout).not.toBeVisible()
  await expect(inspector.getByText('· Custom timeout', { exact: true })).toBeVisible()
  await options.click()
  await expect(timeout).toHaveValue('12.5')
})

test('workflow history restores step moves and metadata edits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=workflow')
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  const redo = page.getByRole('button', { name: 'Redo', exact: true })
  await expect(undo).toBeDisabled()
  await page.getByRole('button', { name: 'Move step down', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Edit step 1: Wait for a duration', exact: true })).toBeVisible()
  await undo.click()
  await expect(page.getByRole('button', { name: 'Edit step 1: Device control', exact: true })).toBeVisible()
  await redo.click()
  await expect(page.getByRole('button', { name: 'Edit step 1: Wait for a duration', exact: true })).toBeVisible()

  const moreActions = page.getByRole('button', { name: 'More workflow actions' })
  await moreActions.click()
  await page.getByRole('menuitem', { name: 'Workflow details' }).click()
  const details = page.getByRole('dialog', { name: 'Workflow details' })
  await details.getByRole('textbox', { name: 'Name' }).fill('Revised workflow')
  await details.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Revised workflow' })).toBeVisible()
  await moreActions.press('Control+z')
  await expect(page.getByRole('heading', { name: 'Daily inventory check' })).toBeVisible()
  await moreActions.press('Control+y')
  await expect(page.getByRole('heading', { name: 'Revised workflow' })).toBeVisible()
})

test('workflow drag shows the current insertion gap and commits one undoable move', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Uses the desktop mouse.')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=workflow')
  const sequence = page.getByRole('region', { name: 'Step sequence' })
  const first = sequence.getByRole('button', { name: 'Drag step' }).first()
  const from = (await first.boundingBox())!
  const last = (await sequence.locator('[data-reorder-id]').last().boundingBox())!
  const marker = sequence.locator('[data-step-drop-indicator]')

  const start = async () => {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 8)
  }
  await start()
  await page.mouse.move(last.x + last.width / 2, last.y + 8, { steps: 10 })
  await expect(marker).toBeVisible()
  const firstGap = (await marker.boundingBox())!.y
  await page.mouse.move(last.x + last.width / 2, last.y + last.height - 6)
  await expect.poll(async () => (await marker.boundingBox())!.y).toBeGreaterThan(firstGap)
  await page.mouse.move(last.x + last.width + 24, last.y + 14)
  await expect(marker).toHaveCount(0)
  await page.mouse.up()
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  await expect(undo).toBeDisabled()

  await start()
  await page.mouse.move(last.x + last.width / 2, last.y + last.height - 6, { steps: 10 })
  await expect(marker).toBeVisible()
  await page.mouse.up()
  await expect(sequence.getByRole('button', { name: 'Edit step 3: Device control', exact: true })).toBeVisible()
  await undo.click()
  await expect(sequence.getByRole('button', { name: 'Edit step 1: Device control', exact: true })).toBeVisible()
  await expect(undo).toBeDisabled()
})

test('a drag marks the affected workflow step until its reference is repaired', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Uses the desktop mouse.')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=workflow-references')
  const sequence = page.getByRole('region', { name: 'Step sequence' })
  await expect(sequence).toHaveAttribute('data-surface', 'plain')
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await expect(save).toBeEnabled()
  const wait = sequence.locator('[data-reorder-id="wait"]')
  const from = (await wait.getByRole('button', { name: 'Drag step' }).boundingBox())!
  const to = (await sequence.locator('[data-reorder-id="log"]').boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 6, { steps: 12 })
  await expect(sequence.locator('[data-step-drop-indicator]')).toBeVisible()
  await page.mouse.up()

  const editLog = sequence.getByRole('button', { name: 'Edit step 2: Write to run log' })
  await expect(editLog).toHaveAccessibleDescription('Broken reference')
  await expect(save).toBeDisabled()
  const affectedStep = page.getByRole('button', { name: 'Write to run log (log)', exact: true })
  await expect(async () => {
    await affectedStep.click()
    await expect(editLog).toHaveAttribute('aria-pressed', 'true', { timeout: 250 })
  }).toPass({ timeout: 3000 })
  const inspector = page.getByRole('complementary', { name: 'Step configuration' })
  await expect(inspector.getByText('wait.summary', { exact: true })).toBeVisible()
  await inspector.getByRole('button', { name: 'Remove output reference for Message' }).click()
  await expect(editLog).not.toHaveAccessibleDescription('Broken reference')
  await expect(save).toBeEnabled()
  await expect(inspector.getByText('wait.summary', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(editLog).toHaveAccessibleDescription('Broken reference')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByText('1 step has broken references')).toHaveCount(0)
  await expect(save).toBeEnabled()
})

test('moves a step into an empty branch and rejects dropping its block into that branch', async ({
  page,
  isMobile
}) => {
  test.skip(isMobile, 'Uses the desktop mouse.')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=workflow')
  const sequence = page.getByRole('region', { name: 'Step sequence' })
  await sequence.getByRole('button', { name: 'Add step', exact: true }).click()
  await page.getByRole('option', { name: /^Condition/ }).click()
  await expect(page.getByRole('dialog', { name: 'Add step' })).toHaveCount(0)
  const lane = sequence.getByRole('group', { name: 'Otherwise', exact: true })
  const elseBranch = lane.getByRole('button', { name: 'Add step', exact: true })
  await expect(elseBranch).toBeVisible()
  const marker = sequence.locator('[data-step-drop-indicator]')

  const dragToElse = async (handle: ReturnType<typeof sequence.getByRole>) => {
    await handle.scrollIntoViewIfNeeded()
    const from = (await handle.boundingBox())!
    const to = (await elseBranch.boundingBox())!
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 8)
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
  }

  const blockRow = sequence.locator('[data-reorder-id]').filter({
    has: page.getByRole('button', { name: 'Edit step 4: Condition', exact: true })
  })
  await dragToElse(blockRow.getByRole('button', { name: 'Drag step' }))
  await expect(marker).toHaveCount(0)
  await page.mouse.up()
  await expect(blockRow).toBeVisible()

  await dragToElse(sequence.getByRole('button', { name: 'Drag step' }).first())
  await expect(marker).toBeVisible()
  await expect(lane.getByRole('button', { name: 'Drop step here' })).toBeVisible()
  await page.mouse.up()
  await expect(lane.getByRole('button', { name: 'Edit step 1: Device control' })).toBeVisible()
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  await undo.click()
  await expect(elseBranch).toBeVisible()
  await expect(sequence.getByRole('button', { name: 'Edit step 1: Device control', exact: true })).toBeVisible()
})

test('reorders workflow steps with a touch drag', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Uses Chromium touch events.')
  await page.goto('/skeleton-contract-test?editor=workflow')
  const sequence = page.getByRole('region', { name: 'Step sequence' })
  const from = (await sequence.getByRole('button', { name: 'Drag step' }).first().boundingBox())!
  const to = (await sequence.locator('[data-reorder-id]').last().boundingBox())!
  const x = Math.round(from.x + from.width / 2)
  const start = Math.round(from.y + from.height / 2)
  const end = Math.round(to.y + to.height - 6)
  const session = await page.context().newCDPSession(page)
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] })
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: Math.round(start + ((end - start) * step) / 12) }]
    })
  }
  await expect(sequence.locator('[data-step-drop-indicator]')).toBeVisible()
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(sequence.getByRole('button', { name: 'Edit step 3: Device control', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('reorders workflow steps with the keyboard and cancels with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=workflow')
  const sequence = page.getByRole('region', { name: 'Step sequence' })
  const handle = sequence.getByRole('button', { name: 'Drag step' }).first()
  const marker = sequence.locator('[data-step-drop-indicator]')
  const undo = page.getByRole('button', { name: 'Undo', exact: true })

  await handle.focus()
  await page.keyboard.press('Space')
  await expect(sequence.getByRole('button', { name: 'Drag step' }).first()).toHaveAttribute('aria-pressed', 'true')
  for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowDown')
  await expect(marker).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(marker).toHaveCount(0)
  await expect(undo).toBeDisabled()
  await expect(handle).toBeFocused()

  await page.keyboard.press('Space')
  await expect(sequence.getByRole('button', { name: 'Drag step' }).first()).toHaveAttribute('aria-pressed', 'true')
  for (let step = 0; step < 4; step++) await page.keyboard.press('ArrowDown')
  await expect(marker).toBeVisible()
  await page.keyboard.press('Space')
  await expect(sequence.getByRole('button', { name: 'Edit step 2: Device control', exact: true })).toBeVisible()
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
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && /hydrat|descendant|cannot contain|validateDOMNesting/i.test(message.text()))
      errors.push(message.text())
  })
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 })
    const boxes = []
    for (const editor of ['workflow-create-loading', 'workflow-create']) {
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      const toolbar = page.getByRole('button', { name: 'Save', exact: true })
      await expect(toolbar).toBeVisible()
      if (editor === 'workflow-create-loading') await expect(toolbar).toBeDisabled()
      await expect(page.getByRole('button', { name: 'More workflow actions' })).toBeVisible()
      const sequence = page.getByRole('region', { name: 'Step sequence' })
      await expect(sequence).toBeVisible()
      boxes.push({ toolbar: (await toolbar.boundingBox())!, sequence: (await sequence.boundingBox())! })
      await expect(page.getByRole('navigation', { name: 'Workflow navigation' })).toHaveCount(0)
    }
    for (const key of ['x', 'y', 'width'] as const) {
      for (const region of ['toolbar', 'sequence'] as const) {
        expect(
          Math.abs(boxes[0][region][key] - boxes[1][region][key]),
          `${width} ${region} ${key}`
        ).toBeLessThanOrEqual(1)
      }
    }
  }
  expect(errors).toEqual([])
})

test('condition and repeat blocks retain labeled controls and branch editing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=workflow')
  const inspector = page.getByRole('complementary', { name: 'Step configuration' })
  await page.getByRole('button', { name: 'Add step', exact: true }).last().click()
  await page.getByRole('option', { name: /^Condition/ }).click()
  await expect(inspector.getByRole('combobox', { name: 'Value', exact: true })).toBeVisible()
  await expect(inspector.getByRole('combobox', { name: 'Condition', exact: true })).toBeVisible()
  await inspector.getByRole('button', { name: 'Add AND rule', exact: true }).click()
  await expect(inspector.getByRole('combobox', { name: 'Condition', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Add step', exact: true }).last().click()
  await page.getByRole('option', { name: /^Repeat/ }).click()
  await expect(inspector.getByRole('spinbutton', { name: 'Number of times', exact: true })).toBeVisible()
  await inspector.getByRole('combobox', { name: 'Mode', exact: true }).click()
  await page.getByRole('option', { name: 'While condition is true', exact: true }).click()
  await expect(inspector.getByRole('spinbutton', { name: 'Number of times', exact: true })).toHaveCount(0)
  await expect(inspector.getByRole('spinbutton', { name: 'Maximum iterations', exact: true })).toBeVisible()
  await expect(inspector.getByRole('combobox', { name: 'Value', exact: true })).toBeVisible()
})

test('loading workflow does not capture global paste shortcuts', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=workflow-create-loading')
  await expect(page.getByRole('heading', { name: 'Step sequence' })).toBeVisible()
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

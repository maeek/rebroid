import { expect, test, type Locator } from '@playwright/test'

const expectActionsSideBySide = async (first: Locator, second: Locator) => {
  await expect(first).toBeInViewport({ ratio: 1 })
  await expect(second).toBeInViewport({ ratio: 1 })
  await expect
    .poll(async () => {
      const [left, right] = await Promise.all([first.boundingBox(), second.boundingBox()])
      if (!left || !right) return false
      return left.x + left.width <= right.x && Math.abs(left.y + left.height / 2 - right.y - right.height / 2) <= 1
    })
    .toBe(true)
}

test('model picker has no blank empty-state row and dialogs separate controls from their surface', async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=ai-models')
    const models = page.getByRole('region', { name: 'Models', exact: true })
    for (const theme of ['light', 'dark', 'oled']) {
      await models.getByRole('button', { name: 'Add model', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Add model', exact: true })
      const input = dialog.getByRole('combobox', { name: 'Available model', exact: true })
      const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
      await expectActionsSideBySide(cancel, dialog.getByRole('button', { name: 'Add model', exact: true }))
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      await expect
        .poll(() =>
          input.evaluate(node => {
            const color = (element: Element) => Number(getComputedStyle(element).backgroundColor.match(/\d+/g)![0])
            return color(node) - color(node.closest('[role="dialog"]')!)
          })
        )
        .toBeGreaterThanOrEqual(12)
      await input.fill('Another')
      const list = page.getByRole('listbox')
      const popup = list.locator('..')
      await expect
        .poll(() =>
          popup.evaluate(node => {
            const first = node.querySelector('[role="option"]')
            return first ? first.getBoundingClientRect().top - node.getBoundingClientRect().top : Infinity
          })
        )
        .toBeLessThanOrEqual(6)
      const liveRegion = popup.getByRole('status')
      expect((await liveRegion.boundingBox())!.height).toBe(0)
      await expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      await page.screenshot({
        path: `/tmp/rebroid-dialog-model-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
      await input.fill('does-not-exist')
      await expect(liveRegion).toHaveText('No options found.')
      expect((await liveRegion.boundingBox())!.height).toBeGreaterThan(0)
      await input.fill('Another')
      await page.getByRole('option', { name: /Another model/ }).click()
      await cancel.click()
    }
  }
})

test('membership options have no blank status row and retain an announced empty state', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=user')
  await page.getByRole('tab', { name: 'Groups', exact: true }).click()
  await page.getByRole('button', { name: 'Edit membership', exact: true }).click()
  const input = page.getByRole('dialog').getByRole('combobox')
  await input.fill('Operations')
  const popup = page.getByRole('listbox').locator('..')
  expect((await popup.getByRole('status').boundingBox())!.height).toBe(0)
  await input.fill('no-such-group')
  await expect(popup.getByRole('status')).not.toBeEmpty()
})

test('trigger inputs align and closing retains the complete form until unmount', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/skeleton-contract-test?editor=triggers')
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.getByRole('button', { name: 'New trigger', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'New trigger', exact: true })
    const name = dialog.getByRole('textbox', { name: /^Name/ })
    const tags = dialog.locator('[data-slot="multi-select-combobox"]').filter({
      has: page.getByRole('combobox', { name: 'Tags' })
    })
    await expect
      .poll(async () => {
        const [nameBounds, tagsBounds] = await Promise.all([name.boundingBox(), tags.boundingBox()])
        if (!nameBounds || !tagsBounds) return Infinity
        return Math.max(Math.abs(nameBounds.x - tagsBounds.x), Math.abs(nameBounds.width - tagsBounds.width))
      })
      .toBeLessThanOrEqual(1)
    await dialog.evaluate(node => {
      const popup = node as HTMLElement & { incompleteFrames?: number; completed?: boolean }
      popup.incompleteFrames = 0
      const observe = () => {
        if (!popup.isConnected) {
          popup.completed = true
          return
        }
        if (!popup.querySelector('form')) popup.incompleteFrames! += 1
        requestAnimationFrame(observe)
      }
      requestAnimationFrame(observe)
      ;(window as unknown as { closingPopup: typeof popup }).closingPopup = popup
    })
    if (attempt === 0) await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    if (attempt === 1) await page.keyboard.press('Escape')
    if (attempt === 2) await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(
      await page.evaluate(
        () => (window as unknown as { closingPopup: { incompleteFrames: number } }).closingPopup.incompleteFrames
      )
    ).toBe(0)
    await expect(page.getByRole('button', { name: 'New trigger', exact: true })).toBeFocused()
  }
})

test('confirmation keeps the safe action focused and the footer reachable in a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 245 })
  await page.goto('/skeleton-contract-test?editor=users-list')
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: /Ada Lovelace/ }) })
  const trigger = row.getByRole('button', { name: 'Open row actions' })
  await trigger.click()
  await page.getByRole('menuitem', { name: 'Disable user…', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Disable Ada Lovelace?' })
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
  const confirm = dialog.getByRole('button', { name: 'Disable user', exact: true })
  await expect(cancel).toBeFocused()
  await expect(dialog).toHaveAccessibleDescription(/signs users out and prevents new sign-ins/)
  await expectActionsSideBySide(cancel, confirm)
  const disclosure = dialog.locator('summary')
  await expect(dialog.getByText('ada', { exact: true })).toBeHidden()
  await page.keyboard.press('Shift+Tab')
  await expect(disclosure).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(disclosure.locator('..')).toHaveAttribute('open', '')
  await expectActionsSideBySide(cancel, confirm)
  await page.mouse.click(2, 2)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('full Docker cleanup shows the host scope and data loss in one description', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/skeleton-contract-test?editor=runtime')
  await page.getByRole('button', { name: 'Run full Docker cleanup' }).click()
  const dialog = page.getByRole('dialog', { name: 'Run full Docker cleanup?' })
  await expect(dialog).toHaveAccessibleDescription(
    /across the Docker host.*Data in removed containers and volumes is lost/
  )
  await expect(dialog.locator('[data-slot="dialog-description"]')).toHaveCount(1)
  await expect(dialog.locator('details')).toHaveCount(0)
  const cancel = dialog.getByRole('button', { name: 'Cancel' })
  await expectActionsSideBySide(cancel, dialog.getByRole('button', { name: 'Clean up', exact: true }))
  await cancel.click()
  await expect(dialog).toHaveCount(0)
})

test('app stop and delete confirmations fit a narrow screen with a long app name', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/skeleton-contract-test?editor=apps-gallery-snapshot')
  const appName = 'Warehouse scanner with a very long application name'
  const trigger = page.getByRole('button', { name: `Actions for ${appName}`, exact: false })

  for (const [verb, impact] of [
    ['Stop', /Android stops and active viewers disconnect/],
    ['Delete', /Permanently delete the app and saved profile data/]
  ] as const) {
    await trigger.press('Enter')
    await page.getByRole('menuitem', { name: `${verb} app…`, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: `${verb} ${appName}?` })
    await expect(dialog).toHaveAccessibleDescription(impact)
    const cancel = dialog.getByRole('button', { name: 'Cancel' })
    await expectActionsSideBySide(cancel, dialog.getByRole('button', { name: `${verb} app` }))
    await cancel.click()
    await expect(dialog).toHaveCount(0)
  }
})

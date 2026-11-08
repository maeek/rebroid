import { expect, test } from '@playwright/test'

test('model picker has no blank empty-state row and dialogs separate controls from their surface', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=ai-models')
    await page.getByRole('button', { name: 'Add model', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add model', exact: true })
    const input = dialog.getByRole('combobox', { name: 'Available model', exact: true })
    for (const theme of ['light', 'dark', 'oled']) {
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
      const first = await page.getByRole('option').first().boundingBox()
      const bounds = await popup.boundingBox()
      expect(first!.y - bounds!.y).toBeLessThanOrEqual(6)
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
    }
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
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
    await expect
      .poll(() =>
        dialog.evaluate(node => {
          const name = node.querySelector('input')!.getBoundingClientRect()
          const tags = node
            .querySelector('input[placeholder="Add tag and press Enter"]')!
            .parentElement!.getBoundingClientRect()
          return Math.max(Math.abs(name.height - tags.height), Math.abs(name.y - tags.y))
        })
      )
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

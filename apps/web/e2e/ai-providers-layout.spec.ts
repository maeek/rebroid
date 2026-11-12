import { expect, test } from '@playwright/test'

for (const width of [390, 768, 1440, 2048]) {
  test(`AI provider pages and dialogs stay readable at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height: 1100 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    for (const view of ['list', 'models', 'connection']) {
      await page.goto(`/skeleton-contract-test?editor=ai-${view}`)
      if (width >= 1024 && view !== 'list') {
        await page.locator('[data-editor]').evaluate(editor => {
          const node = editor as HTMLElement
          node.style.width = 'calc(100% - 288px)'
          node.style.marginLeft = '288px'
        })
      }
      for (const theme of ['light', 'dark', 'oled']) {
        await page.evaluate(value => {
          document.documentElement.className = value
        }, theme)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
        await page.screenshot({
          path: `/tmp/rebroid-ai-${view}-${width}-${theme}-${test.info().project.name}.png`,
          fullPage: true,
          animations: 'disabled'
        })
      }
      if (view === 'list') {
        await page.getByRole('button', { name: 'Add provider', exact: true }).click()
        const dialog = page.getByRole('dialog')
        await expect(dialog.getByLabel('Base URL')).toHaveValue('https://api.openai.com/v1')
        await expect(dialog.getByRole('switch', { name: 'Add GPT-5.6 Luna' })).toBeChecked()
        await expect(dialog.getByRole('combobox', { name: 'Transport protocol' })).toHaveCount(0)
        const connect = dialog.getByRole('button', { name: 'Connect OpenAI' })
        await expect(connect).toBeDisabled()
        await dialog.getByLabel('API key', { exact: true }).fill('test-api-key')
        await expect(connect).toBeEnabled()
        await page.screenshot({
          path: `/tmp/rebroid-ai-create-${width}-${test.info().project.name}.png`,
          animations: 'disabled'
        })
        await page.keyboard.press('Escape')
        await expect(page.getByRole('button', { name: 'Add provider', exact: true })).toBeFocused()
      }
      if (view === 'models') {
        await expect(page.getByRole('region', { name: 'Models', exact: true })).toHaveAttribute('data-surface', 'plain')
        await expect(
          page.getByRole('navigation', { name: 'AI provider navigation' }).getByRole('link', { name: 'Connection' })
        ).toHaveAttribute('href', '/platform/ai/local-models?view=connection')
        await page.getByRole('button', { name: 'Add model', exact: true }).click()
        const dialog = page.getByRole('dialog')
        const available = dialog.getByRole('combobox', { name: 'Available model' })
        const widths = await dialog.evaluate(node => {
          const source = node.querySelector('#provider-model-source')!.getBoundingClientRect()
          const picker = node.querySelector('#provider-model-available')!.getBoundingClientRect()
          return { leftDifference: picker.x - source.x, widthDifference: picker.width - source.width }
        })
        expect(widths.leftDifference).toBe(0)
        expect(widths.widthDifference).toBe(0)
        await available.fill('Another')
        await page.getByRole('option', { name: /Another model/ }).click()
        await expect(available).toHaveValue('Another model')
        await page.screenshot({
          path: `/tmp/rebroid-ai-add-model-${width}-${test.info().project.name}.png`,
          animations: 'disabled'
        })
        await dialog.getByRole('button', { name: 'Add model', exact: true }).click()
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Another model', exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Device controller', exact: true }).click()
        await expect(page.getByRole('dialog').getByRole('checkbox', { name: /^Device control/ })).toBeDisabled()
        await page.getByRole('dialog').getByRole('button', { name: 'Advanced generation settings' }).click()
        const settings = page.getByRole('dialog', { name: 'Model settings' })
        const temperature = settings.getByRole('spinbutton', { name: 'Temperature' })
        const done = settings.getByRole('button', { name: 'Done' })
        if (width >= 1440) {
          const bounds = await settings.boundingBox()
          expect(bounds!.width).toBeGreaterThanOrEqual(800)
        }
        await expect(done).toBeInViewport({ ratio: 1 })
        await temperature.fill('0.7')
        await expect(temperature).toHaveValue('0.7')
        await expect(done).toBeInViewport({ ratio: 1 })
        await done.click()
        await expect(page.getByRole('button', { name: 'Device controller', exact: true })).toBeFocused()
      }
      if (view === 'connection') {
        const field = page
          .locator('[data-editor-field]')
          .filter({ has: page.getByRole('textbox', { name: 'Base URL', exact: true }) })
        const label = await field.locator('label').boundingBox()
        const input = await field.getByRole('textbox').boundingBox()
        expect(input!.y - (label!.y + label!.height)).toBeGreaterThanOrEqual(8)
        await page.getByRole('button', { name: 'Advanced connection settings' }).click()
        await expect(page.getByRole('combobox', { name: 'Transport protocol' })).toBeVisible()
      }
    }
    expect(errors).toEqual([])
  })
}

test('provider loading views reuse the ready grid columns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  for (const view of ['list', 'models']) {
    await page.goto(`/skeleton-contract-test?editor=ai-${view}-loading`)
    if (view === 'models') {
      await expect(page.getByRole('region', { name: 'Models', exact: true })).toHaveAttribute('data-surface', 'plain')
    }
    const headers = await page.getByRole('columnheader').allTextContents()
    const table = await page.getByRole('table').boundingBox()
    await page.goto(`/skeleton-contract-test?editor=ai-${view}`)
    expect(await page.getByRole('columnheader').allTextContents()).toEqual(headers)
    const ready = await page.getByRole('table').boundingBox()
    expect(ready!.x).toBe(table!.x)
    expect(ready!.width).toBe(table!.width)
  }
})

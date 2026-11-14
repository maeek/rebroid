import { expect, test, type Locator } from '@playwright/test'

const documentBounds = (locator: Locator) =>
  locator.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return { x: bounds.x + scrollX, y: bounds.y + scrollY, width: bounds.width, height: bounds.height }
  })

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`AI settings markers preserve spacing (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/skeleton-contract-test?editor=ai-connection')
    await page.evaluate(() => document.fonts.ready)
    const url = page.getByLabel('Base URL', { exact: true })
    const key = page.getByLabel('API key', { exact: true })
    const field = page.locator('[data-slot=form-field]').filter({ has: url })
    const label = field.locator('label')
    const inputBounds = await documentBounds(url)
    const fieldBounds = await documentBounds(field)
    const labelBounds = await documentBounds(label)
    const previousBounds = await documentBounds(key)
    const savedValue = await url.inputValue()
    await url.fill('http://edited.example:11434')
    await expect(field).toHaveAttribute('data-modified', 'true')
    const dot = field.locator('[data-slot=modified-indicator]')
    await expect(dot).toHaveCSS('position', 'absolute')
    await expect(dot.locator('span')).toHaveCSS('opacity', '1')
    await expect(dot.locator('span')).toHaveCSS('transition-duration', reducedMotion === 'reduce' ? '0s' : '0.12s')
    expect((await dot.boundingBox())!.x).toBeLessThan(labelBounds.x)
    expect(await documentBounds(url)).toEqual(inputBounds)
    expect(await documentBounds(field)).toEqual(fieldBounds)
    expect(await documentBounds(label)).toEqual(labelBounds)
    expect(await documentBounds(key)).toEqual(previousBounds)

    await url.fill(savedValue)
    await expect(field).not.toHaveAttribute('data-modified')
    await url.fill('http://saved.example:11434')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(field).not.toHaveAttribute('data-modified')
    await url.fill('http://discard.example:11434')
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(url).toHaveValue('http://saved.example:11434')
    await expect(field).not.toHaveAttribute('data-modified')
    expect(await documentBounds(field)).toEqual(fieldBounds)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.getByRole('button', { name: 'Advanced connection settings' }).click()
    const displayName = page.getByLabel('Display name', { exact: true })
    await displayName.fill('Edited provider')
    const advancedDot = page
      .locator('[data-slot=form-field]')
      .filter({ has: displayName })
      .locator('[data-slot=modified-indicator]')
    await expect(advancedDot.locator('span')).toHaveCSS('opacity', '1')
    await expect
      .poll(() =>
        advancedDot.evaluate(element => {
          const bounds = element.getBoundingClientRect()
          return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2))
        })
      )
      .toBe(true)
    await page.screenshot({
      path: `/tmp/rebroid-settings-dots-${test.info().project.name}-${reducedMotion}.png`,
      fullPage: true
    })
  })
}

test('model setting markers remain visible inside scrolling dialogs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/skeleton-contract-test?editor=ai-models')
  await page.getByRole('button', { name: 'Device controller', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Model settings' })
  const name = dialog.getByLabel('Display name', { exact: true })
  await expect(name).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const before = await name.boundingBox()
  await name.fill('Edited controller')
  const dot = dialog
    .locator('[data-slot=form-field]')
    .filter({ has: page.getByLabel('Display name', { exact: true }) })
    .locator('[data-slot=modified-indicator]')
  await expect(dot.locator('span')).toHaveCSS('opacity', '1')
  expect(await name.boundingBox()).toEqual(before)
  await expect
    .poll(() =>
      dot.evaluate(element => {
        const bounds = element.getBoundingClientRect()
        return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2))
      })
    )
    .toBe(true)
  await name.fill('Device controller')
  await expect(name).not.toHaveAccessibleDescription(/Unsaved change/)
})

import { expect, test } from '@playwright/test'

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`edited markers preserve geometry and errors expand naturally (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/skeleton-contract-test?editor=field-feedback')
    const name = page.getByRole('textbox', { name: 'Name', exact: true })
    const field = page.locator('[data-slot="form-field"]').filter({ has: name })
    const next = page.getByRole('textbox', { name: 'Description' })
    const original = await field.boundingBox()
    const inputBounds = await name.boundingBox()
    const nextBounds = await next.boundingBox()
    await name.fill('Edited app')
    await expect(field).toHaveAttribute('data-modified', 'true')
    await expect(name).toHaveAccessibleDescription('Display name for this app. Unsaved change')
    expect(await field.boundingBox()).toEqual(original)
    await expect(field.locator('[data-slot=field-validation]')).toHaveCount(0)
    await page.screenshot({
      path: `/tmp/rebroid-edited-${test.info().project.name}-${reducedMotion}.png`,
      fullPage: true
    })
    await page.getByRole('button', { name: 'Validate name' }).click()
    const error = field.getByRole('alert')
    await expect(error).toHaveCSS('opacity', '1')
    const dot = field.locator('[data-slot=modified-indicator]')
    await expect(dot).toHaveCSS('position', 'absolute')
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    expect((await field.boundingBox())!.height).toBeGreaterThan(original!.height)
    expect(await name.boundingBox()).toEqual(inputBounds)
    expect((await next.boundingBox())!.y).toBeGreaterThan(nextBounds!.y)
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(field).not.toHaveAttribute('data-modified')
    await expect(name).toHaveValue('Example app')
    await name.fill('Saved app')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(field).not.toHaveAttribute('data-modified')
    expect(await field.boundingBox()).toEqual(original)
  })

  test(`file selection and drag feedback stay in place (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/skeleton-contract-test?editor=field-feedback')
    const zone = page.locator('[data-slot="file-drop-zone"]')
    const picker = page.locator('[data-slot="file-upload-field"]')
    const button = picker.getByRole('button')
    const original = await picker.boundingBox()
    const buttonBounds = await button.boundingBox()
    const filename = 'a-very-long-application-package-name-for-testing-layout-stability-and-keyboard-access.apk'
    await page.getByLabel('APK', { exact: true }).setInputFiles({
      name: filename,
      mimeType: 'application/vnd.android.package-archive',
      buffer: Buffer.from('apk')
    })
    await expect(button).toHaveAccessibleName('Uploading…')
    await expect(button).toHaveText('Choose file')
    expect(await button.boundingBox()).toEqual(buttonBounds)
    expect(await picker.boundingBox()).toEqual(original)
    await page.getByRole('button', { name: 'Finish upload' }).click()
    await expect(button).toHaveAccessibleName('Choose file')
    const filenameLabel = page.locator('[data-slot="file-name"]')
    await filenameLabel.focus()
    await expect(page.getByText(filename, { exact: true }).last()).toBeVisible()
    const transfer = await page.evaluateHandle(() => {
      const data = new DataTransfer()
      data.items.add(new File(['apk'], 'dropped.apk', { type: 'application/vnd.android.package-archive' }))
      return data
    })
    await zone.dispatchEvent('dragenter', { dataTransfer: transfer })
    const overlay = page.locator('[data-slot="file-drop-feedback"]')
    await expect(overlay).toHaveCSS('opacity', '1')
    await expect(overlay).toHaveCSS('transition-duration', reducedMotion === 'reduce' ? '0s' : '0.12s')
    await button.dispatchEvent('dragenter', { dataTransfer: transfer })
    await button.dispatchEvent('dragleave', { dataTransfer: transfer })
    await expect(overlay).toHaveCSS('opacity', '1')
    expect(await picker.boundingBox()).toEqual(original)
    await zone.dispatchEvent('drop', { dataTransfer: transfer })
    await expect(overlay).toHaveCSS('opacity', '0')
    await expect(filenameLabel).toHaveText('Uploading… dropped.apk')
    expect(await button.boundingBox()).toEqual(buttonBounds)
    await page.getByRole('button', { name: 'Finish upload' }).click()
    await page.getByRole('checkbox', { name: 'Disable uploads' }).check()
    await zone.dispatchEvent('dragenter', { dataTransfer: transfer })
    await expect(overlay).toHaveCSS('opacity', '0')
    await zone.dispatchEvent('drop', { dataTransfer: transfer })
    await expect(filenameLabel).toHaveText('dropped.apk')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.screenshot({
      path: `/tmp/rebroid-fields-${test.info().project.name}-${reducedMotion}.png`,
      fullPage: true
    })
  })
}

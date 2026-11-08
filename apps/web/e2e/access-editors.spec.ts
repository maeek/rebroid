import { expect, test } from '@playwright/test'

for (const editor of ['user', 'group']) {
  test(`${editor} access editor keeps drafts, quotas, and bounded tables usable`, async ({ page }) => {
    for (const width of [390, 768, 1440, 2048]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(`/skeleton-contract-test?editor=${editor}`)
      // Match the space available beside the desktop navigation.
      await page.locator('[data-editor]').evaluate(
        (node, gutter) => {
          const element = node as HTMLElement
          element.style.width = `calc(100% - ${gutter}px)`
          element.style.marginLeft = `${gutter}px`
        },
        width >= 1024 ? 288 : 0
      )
      const identity = editor === 'user' ? 'Username' : 'Name'
      await page.getByRole('textbox', { name: identity, exact: false }).first().fill('Draft name')
      if (editor === 'user') {
        await page.getByRole('tab', { name: 'Groups', exact: true }).click()
        await expect(page.getByRole('table').getByRole('row')).toHaveCount(6)
        await expect(page.getByText('1-5 of 12', { exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Next page' }).click()
        await expect(page.getByText('6-10 of 12', { exact: true })).toBeVisible()
        await page.screenshot({
          path: `/tmp/rebroid-membership-${width}-${test.info().project.name}.png`,
          fullPage: true,
          animations: 'disabled'
        })
        await page.getByRole('button', { name: 'Edit membership', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Edit group membership' })
        await expect(dialog).toBeVisible()
        const chips = dialog.locator('[data-slot="multi-select-combobox"]')
        expect((await chips.boundingBox())!.height).toBeLessThanOrEqual(162)
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Edit membership', exact: true })).toBeFocused()
      }
      await page.getByRole('tab', { name: 'Permissions', exact: true }).click()
      await expect(page.getByRole('table').getByRole('row')).toHaveCount(11)
      await expect(page.getByRole('spinbutton', { name: 'Max Open Apps', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Quotas', exact: true })).toHaveCount(0)
      if (width >= 1440) {
        const search = await page.getByRole('searchbox', { name: 'Search permissions', exact: true }).boundingBox()
        const category = await page.getByRole('combobox', { name: 'Permission category', exact: true }).boundingBox()
        expect(Math.abs(search!.y + search!.height - category!.y - category!.height)).toBeLessThan(1)
      }
      const action = editor === 'user' ? 'Override' : 'Set'
      const choice = page.getByRole('combobox', { name: `${action} Create applications`, exact: true })
      await choice.click()
      await page.getByRole('option', { name: 'Deny', exact: true }).click()
      await expect(choice).toHaveText('Deny')
      await expect(choice).toBeFocused()
      await page.getByRole('tab', { name: 'Quotas', exact: true }).click()
      await expect(page.getByRole('table')).toHaveCount(0)
      const quota = page.getByRole('spinbutton', { name: 'Max Open Apps', exact: true })
      await quota.fill('7')
      for (const theme of ['light', 'dark', 'oled']) {
        await page.evaluate(value => {
          document.documentElement.className = value
        }, theme)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
        await page.screenshot({
          path: `/tmp/rebroid-access-${editor}-${width}-${theme}-${test.info().project.name}.png`,
          fullPage: true,
          animations: 'disabled'
        })
      }
      await page.getByRole('tab', { name: editor === 'user' ? 'Account' : 'Details', exact: true }).click()
      await expect(page.getByRole('textbox', { name: identity, exact: false }).first()).toHaveValue('Draft name')
      await page.getByRole('tab', { name: 'Permissions', exact: true }).click()
      await expect(choice).toHaveText('Deny')
      await page.getByRole('tab', { name: 'Quotas', exact: true }).click()
      await expect(quota).toHaveValue('7')
    }
  })
}

test('profile photo supports native upload, inline errors, and removal', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=user')
  const picker = page.getByRole('button', { name: 'Choose photo', exact: true })
  const chooser = page.waitForEvent('filechooser')
  await picker.focus()
  await page.keyboard.press('Enter')
  await (
    await chooser
  ).setFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
      'base64'
    )
  })
  await expect(page.getByRole('button', { name: 'Change photo', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('photo.png')
  const image = page.getByAltText(/profile photo$/)
  await expect(image).toBeVisible()
  await page
    .getByLabel('Profile photo', { exact: true })
    .setInputFiles({ name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load icon image' })).toBeVisible()
  await expect(image).toBeVisible()
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Choose photo', exact: true })).toBeVisible()
  await expect(page.getByText('Could not load icon image.', { exact: true })).toHaveCount(0)
})

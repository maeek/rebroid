import { expect, test, type Page } from '@playwright/test'

const openBuilder = async (page: Page, mode: string, width: number, state = 'idle') => {
  await page.goto(`/skeleton-contract-test?editor=builder-${mode}-${state}`)
  if (width >= 1024) {
    await page.locator('[data-builder-page]').evaluate(node => {
      node.style.width = 'calc(100% - 288px)'
      node.style.marginLeft = '288px'
    })
  }
}
for (const width of [390, 768, 1440, 2048]) {
  test(`image builders are readable and consistent at ${width}px`, async ({ page }) => {
    test.setTimeout(35_000)
    await page.setViewportSize({ width, height: 1100 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    for (const mode of ['gapps', 'custom']) {
      await openBuilder(page, mode, width)
      await expect(page.getByRole('navigation', { name: 'Image builder' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Build image', exact: true })).toHaveCount(1)
      const field = page.getByRole('textbox', { name: 'Target image', exact: true }).locator('../..')
      const label = await field.locator('label').boundingBox()
      const input = await field.getByRole('textbox').boundingBox()
      expect(input!.y - (label!.y + label!.height)).toBeGreaterThan(8)
      if (mode === 'custom') await expect(page.getByRole('textbox', { name: 'Dockerfile', exact: true })).toBeVisible()
      for (const theme of ['light', 'dark', 'oled']) {
        await page.evaluate(value => {
          window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: value }))
        }, theme)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
        await page.screenshot({
          path: `/tmp/rebroid-builder-${mode}-${width}-${theme}-${test.info().project.name}.png`,
          fullPage: true,
          animations: 'disabled'
        })
      }
      if (mode === 'custom') {
        await expect(page.getByRole('region', { name: 'Build checks' }).getByRole('alert')).toHaveCount(0)
        await page.getByRole('combobox', { name: 'Starter template' }).click()
        await page.getByRole('option', { name: 'Android 13 · microG overlay' }).click()
        await expect(page.getByRole('textbox', { name: 'Target image', exact: true })).toHaveValue(
          'local/redroid-microg:14'
        )
        await page.getByRole('button', { name: 'Apply template', exact: true }).click()
        await expect(page.getByRole('textbox', { name: 'Target image', exact: true })).toHaveValue(
          'local/redroid-microg:13'
        )
        await page.getByRole('combobox', { name: 'Uploaded files' }).fill('GmsCore')
        await page.getByRole('option', { name: /apks\/GmsCore.apk/ }).click()
        await page.getByRole('combobox', { name: 'Uploaded files' }).click()
        await page.getByRole('combobox', { name: 'Uploaded files' }).fill('permissions')
        await page.getByRole('option', { name: /permissions\/privapp-permissions-microg.xml/ }).click()
        await page.keyboard.press('Escape')
        await expect(page.getByRole('button', { name: 'Build image', exact: true })).toBeEnabled()
        await expect(page.getByRole('region', { name: 'Build checks' }).getByRole('alert')).toHaveCount(0)
        await page.getByRole('button', { name: 'Upload a single file' }).click()
        await expect(page.getByRole('textbox', { name: 'Path in build context' })).toBeVisible()
        await page.getByLabel('Build context file', { exact: true }).setInputFiles({
          name: 'long-context-file-name.apk',
          mimeType: 'application/octet-stream',
          buffer: Buffer.from('preview')
        })
        await expect(page.getByText('long-context-file-name.apk', { exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Upload file', exact: true })).toBeEnabled()
      }
    }
    expect(errors).toEqual([])
  })
}

test('build states keep logs stable and expose result navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  for (const mode of ['gapps', 'custom']) {
    for (const state of ['running', 'failed', 'succeeded']) {
      await openBuilder(page, mode, 1440, state)
      const output = page.locator('pre[aria-label="Build logs"]')
      expect((await output.boundingBox())!.height).toBeGreaterThanOrEqual(288)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      if (state === 'running') {
        await expect(page.getByRole('button', { name: 'Cancel build' })).toBeEnabled()
        await expect(page.getByRole('button', { name: 'Build in progress' })).toBeDisabled()
      }
      if (state === 'succeeded') {
        await expect(page.getByRole('link', { name: 'Create app' })).toHaveAttribute('href', /image=/)
        await expect(
          page.getByRole('region', { name: 'Build status' }).getByRole('link', { name: /local\/redroid-/ })
        ).toHaveAttribute('href', '/runtime/images/sha256%3Apreview-image')
      }
      await page.screenshot({
        path: `/tmp/rebroid-builder-${mode}-${state}-${test.info().project.name}.png`,
        fullPage: true,
        animations: 'disabled'
      })
    }
  }
  await openBuilder(page, 'gapps', 1440, 'blocked')
  await expect(page.getByRole('button', { name: 'Build image', exact: true })).toBeDisabled()
  await expect(page.getByText('At least 3 GB of available Docker memory is required.')).toBeVisible()
})

test('loading builders reuse the same panels and column geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  for (const mode of ['gapps', 'custom']) {
    await openBuilder(page, mode, 1440, 'loading')
    const heading = mode === 'gapps' ? 'Image configuration' : 'Image recipe'
    const loading = await page.getByRole('region', { name: heading, exact: true }).boundingBox()
    const nav = await page.getByRole('navigation', { name: 'Image builder' }).boundingBox()
    await openBuilder(page, mode, 1440)
    const ready = await page.getByRole('region', { name: heading, exact: true }).boundingBox()
    expect(ready!.x).toBe(loading!.x)
    expect(ready!.y).toBe(loading!.y)
    expect(ready!.width).toBe(loading!.width)
    expect((await page.getByRole('navigation', { name: 'Image builder' }).boundingBox())!.height).toBe(nav!.height)
  }
})

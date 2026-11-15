import { expect, test } from '@playwright/test'

test('Configuration adapts the identity, runtime preview and limits to the available width', async ({
  page,
  baseURL
}) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1100 })
    if (width === 1440) {
      await page.context().addCookies([{ name: 'rebroid-viewer-placement', value: 'right', url: baseURL! }])
    }
    await page.goto('/skeleton-contract-test?editor=app-resource&view=configuration')

    const apk = page.getByRole('button', { name: 'Replace APK', exact: true })
    const icon = page.getByRole('button', { name: 'Upload icon', exact: true })
    await expect(icon).toHaveAccessibleDescription('Icon changes save immediately.')
    await expect(apk).toHaveAccessibleDescription('APK changes save immediately.')

    const runtime = page.getByRole('region', { name: 'Runtime settings', exact: true })
    const image = runtime.getByText('redroid/redroid:14.0.0-latest', { exact: true })
    const display = runtime.locator('[data-slot="display-preview"]')
    const args = runtime.getByRole('textbox', { name: 'Command-line arguments' })
    await expect(display).toContainText('1080 × 2340 px')
    await expect(display).toHaveCSS('border-top-width', '0px')
    const title = (await display.getByText('Configured display').boundingBox())!
    const device = (await display.locator('[data-slot="device-preview-screen"]').boundingBox())!
    const dimensions = (await display.getByText('1080 × 2340 px').boundingBox())!
    expect(title.x).toBe((await display.boundingBox())!.x)
    expect(device.y).toBeGreaterThan(title.y + title.height)
    expect(dimensions.y).toBeGreaterThan(device.y + device.height)
    expect(device.x + device.width / 2).toBeCloseTo(dimensions.x + dimensions.width / 2, 0)

    const resources = page.getByRole('region', { name: 'Lifecycle and resources', exact: true })
    const timeout = resources.getByRole('spinbutton', { name: 'Inactivity timeout' })
    const ram = resources.getByRole('spinbutton', { name: 'RAM limit' })
    const cpu = resources.getByRole('spinbutton', { name: 'CPU limit' })

    for (const [first, second] of [
      [apk, icon],
      [image, display],
      [timeout, ram]
    ]) {
      const firstBox = (await first.boundingBox())!
      const secondBox = (await second.boundingBox())!
      if (width === 1440) expect(secondBox.x).toBeGreaterThan(firstBox.x)
      else expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height)
    }
    const ramBox = (await ram.boundingBox())!
    const cpuBox = (await cpu.boundingBox())!
    if (width === 1440) expect(cpuBox.x).toBeGreaterThan(ramBox.x)
    else expect(cpuBox.y).toBeGreaterThan(ramBox.y + ramBox.height)

    await runtime.getByText('Container arguments', { exact: true }).click()
    await args.fill('androidboot.redroid_width=1920 androidboot.redroid_height=1080')
    await expect(display).toContainText('1920 × 1080 px')
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    }

    const previewGeometry = (await display.boundingBox())!
    await page.goto('/skeleton-contract-test?editor=app-resource-loading&view=configuration')
    const loadingDisplay = page.locator('[data-slot="display-preview"]')
    const loadingGeometry = (await loadingDisplay.boundingBox())!
    expect(loadingGeometry.width).toBe(previewGeometry.width)
    expect(loadingGeometry.height).toBe(previewGeometry.height)
    await expect(loadingDisplay).not.toContainText('1080 × 2340 px')
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  }
})

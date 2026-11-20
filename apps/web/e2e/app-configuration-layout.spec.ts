import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const mockResourceLimits = (page: Page) =>
  page.route('**/api/bff/platform/resource-limits', route =>
    route.fulfill({
      json: {
        ok: true,
        requestId: 'app-configuration-layout',
        data: { maxMemoryMb: 8192, maxCpuCpus: 4, hostMemoryBytes: 32 * 1024 ** 3, hostCpuCores: 8 }
      }
    })
  )

test('Configuration adapts the identity, runtime summary and limits to the available width', async ({
  page,
  baseURL
}) => {
  await mockResourceLimits(page)
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1100 })
    if (width === 1440) {
      await page.context().addCookies([{ name: 'rebroid-viewer-placement', value: 'right', url: baseURL! }])
    }
    await page.goto('/skeleton-contract-test?editor=app-resource&view=configuration')

    const apk = page.getByRole('button', { name: 'Replace APK', exact: true })
    const icon = page.getByRole('button', { name: 'Upload icon', exact: true })
    await expect(icon).toHaveAccessibleDescription('Click Save to apply icon changes.')
    await expect(apk).toHaveAccessibleDescription('APK changes save immediately.')

    const runtime = page.getByRole('region', { name: 'Runtime settings', exact: true })
    const image = runtime.locator('dl').first()
    const display = runtime.locator('dl').last()
    const disclosure = runtime.locator('details')
    const args = runtime.getByRole('textbox', { name: 'Command-line arguments' })
    await expect(image).toContainText('redroid/redroid:14.0.0-latest')
    await expect(image.getByRole('button', { name: 'Copy Runtime image' })).toBeAttached()
    await expect(display).toContainText('Configured display')
    await expect(display).toContainText('1080 × 2340 px')
    await expect(runtime.locator('[data-slot="display-preview"]')).toHaveCount(0)
    await expect(disclosure).toHaveCSS('border-top-width', '0px')
    await expect(args).toBeHidden()
    const imageGeometry = (await image.boundingBox())!
    const displayGeometry = (await display.boundingBox())!
    if (width === 1440) {
      expect(imageGeometry.y).toBe(displayGeometry.y)
      expect(imageGeometry.width).toBeGreaterThan(displayGeometry.width)
    }

    const resources = page.getByRole('region', { name: 'Lifecycle and resources', exact: true })
    const timeout = resources.getByRole('spinbutton', { name: 'Inactivity timeout' })
    const ram = resources.getByRole('spinbutton', { name: 'RAM limit' })
    const cpu = resources.getByRole('spinbutton', { name: 'CPU limit' })

    for (const [first, second] of [
      [apk, icon],
      [image, display]
    ]) {
      const firstBox = (await first.boundingBox())!
      const secondBox = (await second.boundingBox())!
      if (width === 1440) expect(secondBox.x).toBeGreaterThan(firstBox.x)
      else expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height)
    }
    for (const [first, second] of [
      [timeout, ram],
      [ram, cpu]
    ]) {
      const firstBox = (await first.boundingBox())!
      const secondBox = (await second.boundingBox())!
      expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height)
    }
    for (const [input, slider, total] of [
      [ram, 'Adjust RAM limit', 'Host total 32 GiB'],
      [cpu, 'Adjust CPU limit', 'Host total 8 logical CPUs']
    ] as const) {
      await expect(resources.getByRole('slider', { name: slider })).toBeVisible()
      const inputBox = (await input.boundingBox())!
      const totalBox = (await resources.getByText(total, { exact: true }).boundingBox())!
      expect(totalBox.x).toBeGreaterThan(inputBox.x + inputBox.width)
      expect(totalBox.y).toBeLessThan(inputBox.y + inputBox.height)
    }

    await runtime.getByText('Container arguments', { exact: true }).click()
    await args.fill('androidboot.redroid_width=1920 androidboot.redroid_height=1080 androidboot.redroid_dpi=240')
    await expect(display).toContainText('1920 × 1080 px · 240 dpi')
    const argsGeometry = (await args.boundingBox())!
    expect(argsGeometry.x).toBe(imageGeometry.x)
    expect(argsGeometry.x + argsGeometry.width).toBeCloseTo(displayGeometry.x + displayGeometry.width, 0)
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    }

    await page.goto('/skeleton-contract-test?editor=app-resource-loading&view=configuration')
    const loadingDisplay = runtime.locator('dl').last()
    const loadingGeometry = (await loadingDisplay.boundingBox())!
    expect(loadingGeometry.width).toBe(displayGeometry.width)
    expect(loadingGeometry.height).toBe(displayGeometry.height)
    await expect(loadingDisplay).not.toContainText('1080 × 2340 px')
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  }
})

test('Create app keeps sliders and exact limits in sync and can reset to the default', async ({ page }) => {
  await mockResourceLimits(page)
  await page.goto('/skeleton-contract-test?editor=app')
  await page.getByRole('button', { name: /Lifecycle and resources/ }).click()

  const ram = page.getByRole('spinbutton', { name: 'RAM limit', exact: true })
  const ramSlider = page.getByRole('slider', { name: 'Adjust RAM limit' })
  const cpu = page.getByRole('spinbutton', { name: 'CPU limit', exact: true })
  const cpuSlider = page.getByRole('slider', { name: 'Adjust CPU limit' })

  await expect(ramSlider).toHaveAttribute('aria-valuetext', 'Default')
  await ramSlider.press('End')
  await expect(ram).toHaveValue('8192')
  await ram.fill('4096')
  await expect(ramSlider).toHaveAttribute('aria-valuenow', '4096')

  await expect(cpuSlider).toHaveAttribute('aria-valuetext', 'Default')
  await cpu.fill('1.5')
  await cpuSlider.press('ArrowRight')
  await expect(cpu).toHaveValue('1.6')
  await page.getByRole('button', { name: 'Reset CPU limit to default' }).click()
  await expect(cpu).toHaveValue('')
  await expect(cpuSlider).toHaveAttribute('aria-valuetext', 'Default')
})

test('Selecting an app icon prepares a preview until Save', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=app-resource&view=configuration')
  const writes: string[] = []
  page.on('request', request => {
    if (request.method() === 'POST') writes.push(request.url())
  })
  const save = page.getByRole('button', { name: 'Save', exact: true })
  const icon = page.getByLabel('App icon', { exact: true })

  await expect(save).toBeDisabled()
  await icon.setInputFiles({
    name: 'icon.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=',
      'base64'
    )
  })
  await expect(page.getByText('New icon', { exact: true })).toBeVisible()
  await expect(save).toBeEnabled()
  expect(writes).toEqual([])

  await page.getByRole('button', { name: 'Undo icon change' }).click()
  await expect(page.getByText('Default icon', { exact: true })).toBeVisible()
  await expect(save).toBeDisabled()
})

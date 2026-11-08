import { expect, test } from '@playwright/test'

test('effective arguments use the shared code viewer without overflowing the runtime section', async ({ page }) => {
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=app')
    await page.getByText('Runtime arguments', { exact: true }).click()
    const viewer = page.getByRole('region', { name: 'Effective arguments Shell' })
    await expect(viewer).toBeVisible()
    const lines = (await viewer.textContent())!.split('\n')
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines.slice(0, -1)) expect(line).toMatch(/ \\$/)
    expect(lines.at(-1)).not.toMatch(/\\$/)
    const section = page.getByRole('region', { name: 'Effective arguments', exact: true })
    const wrap = section.getByRole('button', { name: 'Wrap' })
    await wrap.click()
    await expect(wrap).toHaveAttribute('aria-pressed', 'false')
    await wrap.click()
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      const bounds = await viewer.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
      if (width === 390 || width === 1440) {
        await section.screenshot({ path: `/tmp/rebroid-effective-arguments-${width}-${theme}.png` })
      }
    }
  }
})

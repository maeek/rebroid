import { expect, test } from '@playwright/test'

test('section and grid feedback stays compact, readable, and actionable at every viewport', async ({ page }) => {
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=feedback')
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }'
    })
    const limits = page.getByRole('region', { name: 'Operation limits' })
    expect((await limits.boundingBox())!.height).toBeLessThan(300)
    const filtered = page.getByRole('status').filter({ hasText: 'No matching results' })
    await expect(filtered.getByRole('button', { name: 'Clear search' })).toBeInViewport()
    const bounds = await filtered.boundingBox()
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({
        path: `/tmp/rebroid-feedback-${width}-${theme}-${test.info().project.name}.png`,
        fullPage: true
      })
    }
    await filtered.getByRole('button', { name: 'Clear search' }).click()
    await expect(page.getByRole('heading', { name: 'No models added' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /Model/ })).toBeVisible()
    await limits.getByRole('button', { name: 'Try again' }).click()
    await expect(limits).toContainText('Settings loaded')
    await expect(limits.getByRole('alert')).toHaveCount(0)
  }
})

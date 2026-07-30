import { expect, test, type Page } from '@playwright/test'

type Box = { height: number; width: number; x: number; y: number }

const boxes = async (page: Page) => {
  const selectors = [
    '[data-testid="contract-toolbar"]',
    '[data-testid="contract-grid"]',
    '[data-testid="contract-grid"] table',
    '[data-testid="contract-grid"] thead',
    '[data-testid="contract-grid"] tbody tr:first-child',
    '[data-testid="contract-pagination"]',
    '[data-testid="contract-family-detail"]',
    '[data-testid="contract-family-form"]',
    '[data-testid="contract-family-split"]',
    '[data-testid="contract-family-immersive"]'
  ]
  const result: Box[] = []
  for (const selector of selectors) {
    const box = await page.locator(selector).boundingBox()
    if (!box) throw new Error(`Missing layout anchor: ${selector}`)
    result.push(box)
  }
  return result
}

test('loading and ready states keep stable geometry', async ({ page }) => {
  await page.goto('/skeleton-contract-test')
  const loadingBoxes = await boxes(page)
  const loadingScrollWidth = await page
    .getByTestId('contract-grid')
    .locator('div.overflow-x-auto')
    .evaluate(node => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth
    }))

  await page.getByRole('button', { name: 'Toggle state' }).click()
  await expect(page.getByText('Resource 1', { exact: true })).toBeVisible()

  const readyBoxes = await boxes(page)
  const readyScrollWidth = await page
    .getByTestId('contract-grid')
    .locator('div.overflow-x-auto')
    .evaluate(node => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth
    }))

  expect(readyScrollWidth).toEqual(loadingScrollWidth)
  for (const [index, loadingBox] of loadingBoxes.entries()) {
    const readyBox = readyBoxes[index]
    expect(readyBox).toBeTruthy()
    expect(Math.abs((readyBox?.x ?? 0) - loadingBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs((readyBox?.y ?? 0) - loadingBox.y)).toBeLessThanOrEqual(1)
    expect(Math.abs((readyBox?.width ?? 0) - loadingBox.width)).toBeLessThanOrEqual(1)
    expect(
      Math.abs((readyBox?.height ?? 0) - loadingBox.height),
      `height mismatch for anchor ${index}: loading=${loadingBox.height}, ready=${readyBox?.height ?? 0}`
    ).toBeLessThanOrEqual(1)
  }

  const documentOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(documentOverflow).toBeLessThanOrEqual(0)
})

test('success banners and toasts retain semantic backgrounds in dark and OLED themes', async ({ page }) => {
  await page.goto('/skeleton-contract-test')

  for (const theme of ['dark', 'oled']) {
    await page.evaluate(value => {
      document.documentElement.className = value
    }, theme)

    const bannerColors = await page.evaluate(() => ({
      success: getComputedStyle(document.querySelector('[data-testid="contract-success-banner"]')!).backgroundColor,
      neutral: getComputedStyle(document.querySelector('[data-testid="contract-neutral-banner"]')!).backgroundColor
    }))
    expect(bannerColors.success).not.toBe(bannerColors.neutral)
    expect(bannerColors.success).not.toBe('transparent')

    await page.getByRole('button', { name: 'Show success toast' }).click()
    const toastBackground = await page
      .locator('[data-tone="success"]')
      .filter({ hasText: 'Mutation complete' })
      .last()
      .evaluate(node => getComputedStyle(node).backgroundColor)
    expect(toastBackground).not.toBe(bannerColors.neutral)
    expect(toastBackground).not.toBe('transparent')
  }
})

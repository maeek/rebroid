import { expect, test, type Page } from '@playwright/test'

type Box = { height: number; width: number; x: number; y: number }

const boxes = async (page: Page) => {
  const selectors = [
    '[data-slot="data-grid-toolbar"]',
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

test('flat grids stay readable across themes and viewport sizes', async ({ page }) => {
  await page.goto('/skeleton-contract-test')
  await page.getByRole('button', { name: 'Toggle state' }).click()
  const grid = page.getByTestId('contract-grid')

  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      await expect(grid.getByText('Resource 1', { exact: true })).toBeVisible()
      const surfaces = await page.evaluate(() => {
        const editor = document.querySelector('[data-testid="contract-standard-editor"] [data-surface="editor"]')!
        const panel = document.querySelector('[data-testid="contract-family-detail"] section')!
        return [getComputedStyle(editor).backgroundColor, getComputedStyle(panel).backgroundColor]
      })
      expect(surfaces[0]).toBe(surfaces[1])
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0)
      await grid.screenshot({ path: `/tmp/rebroid-flat-grid-${width}-${theme}.png` })
      if (width === 1440) {
        await page
          .getByTestId('contract-family-detail')
          .screenshot({ path: `/tmp/rebroid-unified-panels-${theme}.png` })
      }
    }
  }
})

test('row selection swaps toolbar actions without moving the grid', async ({ page }) => {
  await page.goto('/skeleton-contract-test')
  await page.getByRole('button', { name: 'Toggle state' }).click()
  const grid = page.getByTestId('contract-grid')
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1000 })
    const checkbox = grid.locator('tbody').getByRole('checkbox').first()
    await checkbox.scrollIntoViewIfNeeded()
    const before = await grid.boundingBox()
    await checkbox.click()
    await expect(page.getByRole('button', { name: 'Stop selected' })).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Search resources' })).toBeHidden()
    expect(await grid.boundingBox()).toEqual(before)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0)
    await checkbox.click()
    await expect(page.getByRole('searchbox', { name: 'Search resources' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop selected' })).toBeHidden()
    expect(await grid.boundingBox()).toEqual(before)
  }
  await grid.locator('tbody').getByRole('checkbox').first().click()
  await page.locator('[data-slot="data-grid-toolbar"]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `/tmp/rebroid-refined-selection-${test.info().project.name}.png` })
})

test('filter backdrop fades out without flashing and restores focus', async ({ page }) => {
  await page.goto('/skeleton-contract-test')
  await page.getByRole('button', { name: 'Toggle state' }).click()
  const trigger = page.getByRole('button', { name: 'Filters', exact: true })
  for (const theme of ['light', 'dark', 'oled']) {
    await page.evaluate(value => {
      document.documentElement.className = value
    }, theme)
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const { panel, input, expectedPanel } = await dialog.evaluate(node => {
      const probe = document.createElement('span')
      probe.style.color = 'hsl(var(--surface-dialog))'
      node.append(probe)
      const dialogSurface = getComputedStyle(probe).color
      probe.remove()
      return {
        panel: getComputedStyle(node).backgroundColor,
        input: getComputedStyle(node.querySelector('input')!).backgroundColor,
        expectedPanel: dialogSurface
      }
    })
    expect(panel).toBe(expectedPanel)
    expect(input).not.toBe(panel)
    const backdrop = page.locator('[data-slot="sheet-overlay"]')
    await expect(backdrop).toHaveCSS('opacity', '1')
    await page.evaluate(() => {
      const samples: number[] = []
      ;(window as unknown as { backdropSamples: number[] }).backdropSamples = samples
      const sample = () => {
        const node = document.querySelector('[data-slot="sheet-overlay"]')
        samples.push(node ? Number(getComputedStyle(node).opacity) : 0)
        if (node) requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(backdrop).toHaveCount(0)
    await expect(trigger).toBeFocused()
    const samples = await page.evaluate(() => (window as unknown as { backdropSamples: number[] }).backdropSamples)
    for (let index = 1; index < samples.length; index++) {
      expect(samples[index]).toBeLessThanOrEqual(samples[index - 1] + 0.01)
    }
  }
})

test('memory chart stays centered and contained beside CPU history', async ({ page }) => {
  await page.goto('/skeleton-contract-test')
  await page.getByRole('button', { name: 'Toggle state' }).click()
  const memory = page.getByRole('region', { name: 'Host memory', exact: true })
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1000 })
    const chart = memory.locator('[data-chart]')
    await chart.scrollIntoViewIfNeeded()
    await expect(chart.locator('svg.recharts-surface')).toBeVisible()
    const content = await chart.locator('..').boundingBox()
    const frame = await chart.boundingBox()
    expect(Math.abs(frame!.x + frame!.width / 2 - (content!.x + content!.width / 2))).toBeLessThanOrEqual(1)
    expect(Math.abs(frame!.y + frame!.height / 2 - (content!.y + content!.height / 2))).toBeLessThanOrEqual(1)
    expect(frame!.width).toBeLessThanOrEqual(content!.width)
    await expect
      .poll(() =>
        chart.evaluate(node => {
          const sector = node.querySelector('.recharts-radial-bar-sector')
          if (!sector) return false
          const chartFrame = node.getBoundingClientRect()
          const ring = sector.getBoundingClientRect()
          return (
            ring.width > 0 &&
            ring.height > 0 &&
            ring.x >= chartFrame.x &&
            ring.y >= chartFrame.y &&
            ring.right <= chartFrame.right &&
            ring.bottom <= chartFrame.bottom
          )
        })
      )
      .toBe(true)
    await memory.screenshot({ path: `/tmp/rebroid-memory-alignment-${width}-${test.info().project.name}.png` })
  }
})

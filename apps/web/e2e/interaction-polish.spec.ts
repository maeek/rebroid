import { expect, test } from '@playwright/test'

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`copy and row actions preserve geometry with ${reducedMotion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (value: string) =>
            new Promise<void>(resolve => {
              document.documentElement.dataset.copiedValue = value
              window.addEventListener('complete-copy', () => resolve(), { once: true })
            })
        }
      })
    })
    await page.goto('/skeleton-contract-test?editor=interaction-polish')
    const copy = page.getByRole('button', { name: 'Copy image', exact: true })
    const reference = await page.getByRole('button', { name: 'Reference copy' }).boundingBox()
    const initial = await copy.boundingBox()
    const neighbor = await page.getByRole('button', { name: 'Copy ID' }).boundingBox()
    expect(initial!.width).toBe(reference!.width)
    await copy.click()
    const pending = page.getByRole('button', { name: 'Copying…', exact: true })
    await expect(pending).toBeDisabled()
    expect(await pending.boundingBox()).toEqual(initial)
    await page.evaluate(() => window.dispatchEvent(new Event('complete-copy')))
    const copied = page.getByRole('button', { name: 'Copied', exact: true })
    await expect(copied).toHaveText('Copy')
    expect(await copied.boundingBox()).toEqual(initial)
    expect(await page.getByRole('button', { name: 'Copy ID' }).boundingBox()).toEqual(neighbor)
    expect(await page.locator('html').getAttribute('data-copied-value')).toBe('redroid:latest')

    const row = page.getByRole('row', { includeHidden: true }).filter({
      has: page.getByRole('button', { name: 'Screenshot.png', exact: true, includeHidden: true })
    })
    const actions = row.locator('[data-row-actions]')
    const name = row.getByRole('button', { name: 'Screenshot.png', exact: true })
    const rowBounds = await row.boundingBox()
    const nameBounds = await name.boundingBox()
    const usesHover = await page.evaluate(
      () => matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(any-pointer: coarse)').matches
    )
    await page.getByRole('heading', { name: 'Interaction polish preview' }).hover()
    await expect(actions).toHaveCSS('opacity', usesHover ? '0' : '1')
    await row.hover()
    await expect(actions).toHaveCSS('opacity', '1')
    expect(await row.boundingBox()).toEqual(rowBounds)
    expect(await name.boundingBox()).toEqual(nameBounds)
    const quickActionBounds = await row.getByRole('button', { name: 'Download Screenshot.png' }).boundingBox()
    const menuBounds = await row.getByRole('button', { name: 'Open row actions' }).boundingBox()
    expect(quickActionBounds!.y + quickActionBounds!.height / 2).toBe(menuBounds!.y + menuBounds!.height / 2)
    expect(quickActionBounds!.x + quickActionBounds!.width).toBeLessThan(menuBounds!.x)
    await row.getByRole('button', { name: 'Download Screenshot.png' }).click()
    await expect(page.getByTestId('last-action')).toHaveText('Download Screenshot.png')
    await page.getByRole('heading', { name: 'Interaction polish preview' }).hover()
    await name.focus()
    await page.keyboard.press('Tab')
    await expect(row.getByRole('button', { name: 'Download Screenshot.png' })).toBeFocused()
    await expect(actions).toHaveCSS('opacity', '1')
    await row.getByRole('button', { name: 'Open row actions' }).click()
    await page.getByRole('menuitem', { name: 'Rename' }).hover()
    await expect(actions).toHaveCSS('opacity', '1')
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    await expect(page.getByTestId('last-action')).toHaveText('Rename Screenshot.png')
    await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeHidden()
    expect(await row.boundingBox()).toEqual(rowBounds)
    await expect(actions).toHaveCSS('transition-duration', reducedMotion === 'reduce' ? '0s' : '0.14s')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.screenshot({
      path: `/tmp/rebroid-polish-${test.info().project.name}-${reducedMotion}.png`,
      fullPage: true
    })
  })

  test(`tooltips share their delay and respect ${reducedMotion} motion`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'Touch controls expose accessible labels without relying on hover.')
    await page.emulateMedia({ reducedMotion })
    await page.goto('/skeleton-contract-test?editor=interaction-polish')
    await page.getByRole('button', { name: 'Copy image', exact: true }).hover()
    // Check the intentional initial delay before opening the first tooltip.
    await page.waitForTimeout(120)
    await expect(page.getByText('Copy image', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Copy image', { exact: true })).toBeVisible()
    await expect(page.getByText('Copy image', { exact: true })).toHaveCSS(
      'transition-duration',
      reducedMotion === 'reduce' ? '0s' : '0.12s'
    )
    await page.getByRole('button', { name: 'Copy ID', exact: true }).hover()
    await expect(page.getByText('Copy ID', { exact: true })).toBeVisible({ timeout: 250 })
  })
}

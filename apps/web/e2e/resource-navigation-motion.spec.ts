import { expect, test, type Locator, type Page } from '@playwright/test'

const expectAligned = async (container: Locator, selected: Locator) => {
  const indicator = container.locator('[data-slot="resource-navigation-indicator"]')
  await expect
    .poll(async () => {
      const marker = await indicator.boundingBox()
      const item = await selected.boundingBox()
      return Math.abs(marker!.x + marker!.width / 2 - (item!.x + item!.width / 2))
    })
    .toBeLessThanOrEqual(1)
  expect((await indicator.boundingBox())!.width).toBe(24)
}

const recordIndicatorMotion = async (page: Page) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options)
      if (this instanceof HTMLElement && this.dataset.slot === 'resource-navigation-indicator') {
        this.dataset.motionFinished = 'false'
        this.dataset.motionSelection = this.parentElement?.querySelector<HTMLElement>(
          '[aria-current=page], [aria-selected=true]'
        )?.dataset.resourceItem
        this.dataset.motionDuration = String(typeof options === 'number' ? options : options?.duration)
        animation.addEventListener('finish', () => {
          if (this instanceof HTMLElement) this.dataset.motionFinished = 'true'
        })
      }
      return animation
    }
  })
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`resource selection respects ${reducedMotion} motion without resizing tabs`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await recordIndicatorMotion(page)
    await page.goto('/skeleton-contract-test?editor=resource-navigation')
    const navigation = page.getByRole('navigation', { name: 'Preview sections' })
    const marker = navigation.locator('[data-slot="resource-navigation-indicator"]')
    await expectAligned(navigation, navigation.getByRole('link', { name: 'Overview', exact: true }))
    await expect(marker).not.toHaveAttribute('data-motion-duration')
    const initialWidths = await navigation
      .getByRole('link')
      .evaluateAll(items => items.map(item => item.getBoundingClientRect().width))

    await navigation.getByRole('link', { name: 'Configuration' }).click()
    await expect(page.getByText('Current section: configuration')).toBeVisible()
    if (reducedMotion === 'reduce') await expect(marker).not.toHaveAttribute('data-motion-duration')
    else {
      await expect(marker).toHaveAttribute('data-motion-duration', '180')
      await expect(marker).toHaveAttribute('data-motion-finished', 'true')
    }
    await expectAligned(navigation, navigation.getByRole('link', { name: 'Configuration' }))
    expect(
      await navigation.getByRole('link').evaluateAll(items => items.map(item => item.getBoundingClientRect().width))
    ).toEqual(initialWidths)

    await page.goBack()
    await expect(navigation.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    )
    await expectAligned(navigation, navigation.getByRole('link', { name: 'Overview', exact: true }))
    if (reducedMotion === 'no-preference') await expect(marker).toHaveAttribute('data-motion-finished', 'true')

    const tabs = page.getByRole('tablist', { name: 'Preview tabs' })
    const overview = tabs.getByRole('tab', { name: 'Overview', exact: true })
    await overview.focus()
    await page.keyboard.press('ArrowRight')
    const files = tabs.getByRole('tab', { name: 'Files', exact: true })
    await expect(files).toBeFocused()
    await expect(files).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel', { name: 'Files' })).toBeVisible()
    await expectAligned(tabs, files)
    const tabMarker = tabs.locator('[data-slot="resource-navigation-indicator"]')
    if (reducedMotion === 'reduce') await expect(tabMarker).not.toHaveAttribute('data-motion-duration')
    else await expect(tabMarker).toHaveAttribute('data-motion-duration', '180')

    await page.setViewportSize({ width: 390, height: 844 })
    await expectAligned(tabs, files)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.screenshot({
      path: `/tmp/rebroid-tab-motion-${test.info().project.name}-${reducedMotion}.png`,
      fullPage: true
    })
  })
}

test('app templates animate navigation to and from Overview and Configuration', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await recordIndicatorMotion(page)
  await page.goto('/skeleton-contract-test?editor=app-resource')
  const navigation = page.getByRole('navigation', { name: 'App sections' })
  const indicator = navigation.locator('[data-slot="resource-navigation-indicator"]')
  await expect(navigation.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page')
  for (const view of [
    'configuration',
    'overview',
    'activity',
    'diagnostics',
    'overview',
    'configuration',
    'diagnostics',
    'configuration'
  ]) {
    // Drive the real page templates through their query-selected view, without an authenticated backend.
    await page.evaluate(selected => {
      window.history.pushState(null, '', `/skeleton-contract-test?editor=app-resource&view=${selected}`)
    }, view)
    await expect(indicator).toHaveAttribute('data-motion-selection', view)
    await expect(indicator).toHaveAttribute('data-motion-finished', 'true')
    await expectAligned(navigation, navigation.locator('[aria-current="page"]'))
  }
})

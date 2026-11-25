import { expect, test } from '@playwright/test'
import { viewerPlacementCookie } from '../src/shared/model/settings/viewer-placement'
import type { Page } from '@playwright/test'

const openVirtualDisplay = (page: Page, orientation: 'portrait' | 'landscape') =>
  page.evaluate(value => {
    const url = new URL(location.href)
    url.searchParams.set('virtual-display', value)
    history.replaceState(null, '', url)
  }, orientation)

test('the live main display follows its dock as a virtual display appears and disappears', async ({
  page,
  baseURL
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.context().addCookies([{ name: viewerPlacementCookie, value: 'top', url: baseURL }])
  await page.route('**/preview-display-frame*', route =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><body data-preview-display></body>' })
  )
  await page.goto('/skeleton-contract-test?editor=docked-viewer')

  const workspace = page.locator('[data-display-workspace]')
  const dock = page.getByRole('region', { name: 'Main display' }).locator('.viewer-chrome')
  const virtualDisplay = page.getByRole('region', { name: 'Virtual display' })
  const frame = page.locator('iframe[src="/preview-display-frame"]')
  const frameBody = frame.contentFrame().locator('[data-preview-display]')
  await expect(frame).toBeVisible()
  await frameBody.evaluate(node => node.setAttribute('data-retained', 'true'))

  const initialX = (await dock.boundingBox())!.x
  const expectAligned = async () => {
    await expect
      .poll(async () => Math.abs((await frame.boundingBox())!.x - (await dock.boundingBox())!.x))
      .toBeLessThan(1)
    await expect(frameBody).toHaveAttribute('data-retained', 'true')
  }
  await expectAligned()

  for (const orientation of ['portrait', 'landscape'] as const) {
    await openVirtualDisplay(page, orientation)
    await expect(virtualDisplay).toBeVisible()
    expect((await dock.boundingBox())!.x).toBeLessThan(initialX - 100)
    expect(await workspace.evaluate(element => element.scrollLeft)).toBe(0)
    await expectAligned()

    await page.evaluate(() => history.replaceState(null, '', '/skeleton-contract-test?editor=docked-viewer'))
    await expect(virtualDisplay).toHaveCount(0)
    await expectAligned()
  }
})

test('display headers and the compact switcher activate the display while keeping both streams mounted', async ({
  page,
  baseURL
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.context().addCookies([{ name: viewerPlacementCookie, value: 'top', url: baseURL }])
  await page.route('**/preview-display-frame*', route =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><body><button>Preview display</button><script>
        window.addEventListener('pointerdown', () => {
          window.parent.postMessage({ type: 'rebroid-viewer-activate-display' }, location.origin)
        })
      </script></body>`
    })
  )
  await page.goto('/skeleton-contract-test?editor=docked-viewer')
  const addDisplay = page.getByRole('button', { name: 'Add virtual display' })
  await expect(addDisplay).toBeVisible()
  await expect(page.getByRole('button', { name: 'Main display', exact: true })).toHaveCount(0)
  expect(await addDisplay.getAttribute('aria-busy')).toBeNull()

  const mainFrame = page.frameLocator('iframe[src="/preview-display-frame"]')
  await mainFrame.locator('body').evaluate(body => body.setAttribute('data-retained', 'true'))
  await openVirtualDisplay(page, 'portrait')
  const switcher = page.getByRole('group', { name: 'Active display' })
  const mainPanel = page.getByRole('region', { name: 'Main display', exact: true })
  const virtualPanel = page.getByRole('region', { name: 'Virtual display', exact: true })
  const virtualFrame = page.frameLocator('iframe[src="/preview-display-frame?virtual"]')
  const mainHeader = mainPanel.getByRole('button', { name: 'Main display', exact: true })
  const virtualHeader = virtualPanel.getByRole('button', { name: 'Virtual display', exact: true })
  const workspace = page.locator('[data-display-workspace]')
  await virtualFrame.locator('body').evaluate(body => body.setAttribute('data-retained', 'true'))
  await expect(switcher).toHaveCount(0)
  await expect(addDisplay).toHaveCount(0)
  await expect(mainHeader).toHaveAttribute('aria-pressed', 'true')
  await virtualHeader.focus()
  await expect(mainHeader).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Enter')
  await expect(virtualHeader).toHaveAttribute('aria-pressed', 'true')
  await expect(virtualPanel.getByRole('group', { name: 'Device controls' })).toBeVisible()
  await mainFrame.getByRole('button', { name: 'Preview display' }).click()
  await expect(mainHeader).toHaveAttribute('aria-pressed', 'true')
  expect(await workspace.evaluate(element => element.scrollLeft)).toBe(0)

  // A slight overflow can trap both panels short of the workspace center.
  const track = workspace.locator('[data-display-track]')
  const wideTrack = (await track.boundingBox())!
  await workspace.evaluate((element, width) => (element.style.width = `${width}px`), wideTrack.width - 20)
  const mainSwitch = switcher.getByRole('button', { name: 'Main display' })
  const virtualSwitch = switcher.getByRole('button', { name: 'Virtual display' })
  await expect(mainSwitch).toHaveAttribute('aria-pressed', 'true')
  await virtualSwitch.click()
  await expect(virtualPanel).toBeInViewport({ ratio: 1 })
  await expect(virtualPanel.getByRole('group', { name: 'Device controls' })).toBeVisible()
  await mainSwitch.click()
  await expect(mainPanel).toBeInViewport({ ratio: 1 })
  await workspace.evaluate(element => element.style.removeProperty('width'))

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Device', exact: true }).click()
  await expect(switcher).toHaveCount(0)
  await expect(mainHeader).toHaveCount(0)
  await page.getByRole('button', { name: 'Main display' }).click()
  await page.getByRole('menuitemradio', { name: 'Virtual display' }).click()
  await expect(virtualPanel).toBeInViewport({ ratio: 1 })
  await expect(mainPanel).toBeHidden()
  await page.getByRole('button', { name: 'Virtual display' }).click()
  await page.getByRole('menuitemradio', { name: 'Main display' }).click()
  await expect(mainPanel).toBeInViewport({ ratio: 1 })
  await expect(virtualPanel).toBeHidden()

  await page.setViewportSize({ width: 1920, height: 1080 })
  await expect(switcher).toHaveCount(0)
  await expect(mainHeader).toHaveAttribute('aria-pressed', 'true')
  for (const frame of [mainFrame, virtualFrame]) {
    await expect(frame.locator('body')).toHaveAttribute('data-retained', 'true')
  }
})

test('the mobile device view fits a narrow, short viewport and retains both frames', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 500 })
  await page.route('**/preview-display-frame*', route =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><body data-preview-display></body>' })
  )
  const appName = 'Inventory worker with a long name that needs to be truncated on mobile'
  await page.goto(`/skeleton-contract-test?editor=docked-viewer&app-name=${encodeURIComponent(appName)}`)

  const device = page.getByRole('button', { name: 'Device', exact: true })
  const exit = page.getByRole('button', { name: 'Back to Overview' })
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' })
  const controls = page.getByRole('group', { name: 'Device controls' })
  const main = page.locator('iframe[src="/preview-display-frame"]')
  const virtual = page.locator('iframe[src="/preview-display-frame?virtual"]')
  const appHeader = page.getByRole('group', { name: 'App workspace view' })
  const home = appHeader.getByRole('link', { name: 'Home' })
  const title = page.getByRole('heading', { level: 1, name: appName, exact: true })
  await expect(home).toHaveAttribute('href', '/apps')
  await expect(home.locator('.tabler-icon-home')).toBeVisible()
  await expect(appHeader.getByText(appName, { exact: true })).toBeHidden()
  await expect(title).toBeVisible()
  await expect(title).toHaveAttribute('title', appName)
  await expect(title).toHaveCSS('text-overflow', 'ellipsis')
  expect(await title.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true)
  await expect(appHeader.getByRole('button')).toHaveCount(1)
  const [homeBounds, deviceBounds] = await Promise.all([home.boundingBox(), device.boundingBox()])
  expect(homeBounds!.y).toBeCloseTo(deviceBounds!.y)
  expect(homeBounds!.height).toBeGreaterThanOrEqual(44)
  expect(deviceBounds!.height).toBeGreaterThanOrEqual(44)
  expect(homeBounds!.y).toBeLessThan(16)
  await expect(page.getByRole('banner')).toHaveCount(0)
  await expect(mobileNavigation).toBeVisible()
  const bottomApps = mobileNavigation.getByRole('link', { name: 'Apps' })
  expect((await bottomApps.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320)
  await device.click()
  await expect(mobileNavigation).toBeHidden()
  await expect(exit).toBeFocused()
  await expect(controls).toBeInViewport({ ratio: 1 })
  await expect(main).toBeInViewport({ ratio: 1 })
  const mainBounds = await main.boundingBox()
  await main
    .contentFrame()
    .locator('body')
    .evaluate(body => body.setAttribute('data-retained', 'true'))

  await page.getByRole('button', { name: 'Main display' }).click()
  await expect(page.getByRole('menuitem', { name: 'Add virtual display' })).toBeVisible()
  await page.keyboard.press('Escape')

  await openVirtualDisplay(page, 'landscape')
  await expect(virtual).toHaveCount(1)
  await expect(virtual).toBeHidden()
  expect(await main.boundingBox()).toEqual(mainBounds)
  await virtual
    .contentFrame()
    .locator('body')
    .evaluate(body => body.setAttribute('data-retained', 'true'))

  await page.getByRole('button', { name: 'Main display' }).click()
  await expect(page.getByRole('menuitem', { name: 'Close virtual display' })).toBeVisible()
  await page.getByRole('menuitemradio', { name: 'Virtual display' }).click()
  await expect(virtual).toBeInViewport({ ratio: 1 })
  await expect(main).toBeHidden()
  await expect(controls).toBeInViewport({ ratio: 1 })
  await expect(controls.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible()
  const fitsViewport = await page.evaluate(() => {
    const { clientWidth, scrollWidth, scrollHeight } = document.documentElement
    return scrollWidth === clientWidth && scrollHeight <= window.innerHeight
  })
  expect(fitsViewport).toBe(true)
  await controls.getByRole('button', { name: 'More device controls' }).click()
  const drawer = page.getByRole('dialog', { name: 'Device controls' })
  await expect(drawer.getByRole('button', { name: 'Volume up' })).toBeVisible()
  await drawer.getByRole('button', { name: 'Close device controls' }).click()
  await expect(drawer).toBeHidden()

  await page.getByRole('button', { name: 'Virtual display' }).click()
  await page.getByRole('menuitemradio', { name: 'Main display' }).click()
  await expect(main).toBeInViewport({ ratio: 1 })
  await expect(virtual).toBeHidden()
  for (const frame of [main, virtual]) {
    await expect(frame.contentFrame().locator('body')).toHaveAttribute('data-retained', 'true')
  }

  await exit.click()
  await expect(device).toBeFocused()
  await expect(mobileNavigation).toBeVisible()
  await page.evaluate(() => history.replaceState(null, '', '/apps/inventory-worker'))
  await expect(bottomApps).toHaveAttribute('aria-current', 'location')
  const accent = await page.evaluate(() => {
    const sample = document.createElement('span')
    sample.style.color = 'hsl(var(--primary))'
    document.body.append(sample)
    const color = getComputedStyle(sample).color
    sample.remove()
    return color
  })
  await expect(bottomApps).toHaveCSS('color', accent)
  await expect(bottomApps).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(bottomApps.locator('[data-slot="mobile-navigation-icon"]')).not.toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)'
  )
})

for (const display of ['Main display', 'Virtual display'] as const) {
  test(`mobile fullscreen keeps a movable toolbar with the ${display.toLowerCase()}`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Exercises touch gestures in fullscreen')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.route('**/preview-display-frame*', route =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><body data-preview-display><script>
          let backRequest
          window.addEventListener('message', ({ source, origin, data }) => {
            if (source !== parent || origin !== location.origin || data.type !== 'rebroid-viewer-control-event') return
            document.body.dataset.command = data.command
            if (data.command === 'back') {
              backRequest = data.requestId
              return
            }
            parent.postMessage({ type: 'rebroid-viewer-control-result', requestId: data.requestId, ok: true }, origin)
          })
          document.addEventListener('confirm-back', () => {
            const result = { type: 'rebroid-viewer-control-result', requestId: backRequest, ok: true }
            parent.postMessage(result, location.origin)
          })
        </script></body>`
      })
    )
    await page.goto('/skeleton-contract-test?editor=docked-viewer&virtual-display=portrait')
    await page.getByRole('button', { name: 'Device', exact: true }).tap()
    if (display === 'Virtual display') {
      await page.getByRole('button', { name: 'Main display', exact: true }).tap()
      await page.getByRole('menuitemradio', { name: display }).tap()
    }

    const src = display === 'Main display' ? '/preview-display-frame' : '/preview-display-frame?virtual'
    const frame = page.frameLocator(`iframe[src="${src}"]`).locator('body')
    await frame.evaluate(element => element.setAttribute('data-retained', 'true'))
    await page.getByRole('group', { name: 'Device controls' }).getByRole('button', { name: 'Back', exact: true }).tap()
    await expect(frame).toHaveAttribute('data-command', 'back')
    await page.getByRole('button', { name: 'Enter fullscreen' }).tap()
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)

    const toolbar = page.getByRole('group', { name: 'Fullscreen viewer controls' })
    const handle = toolbar.getByRole('button', { name: 'Move viewer toolbar' })
    const exit = toolbar.getByRole('button', { name: 'Exit fullscreen' })
    const back = toolbar.getByRole('button', { name: 'Back', exact: true })
    const home = toolbar.getByRole('button', { name: 'Home', exact: true })
    await expect(back).toBeVisible()
    await expect(handle).toHaveCSS('height', '44px')
    await expect(back).toHaveAttribute('aria-busy', 'true')
    await expect(toolbar.getByRole('button', { name: 'Keyboard capture' })).toBeEnabled()
    await home.tap()
    await expect(home).toHaveAttribute('aria-busy', 'true')
    await expect(frame).toHaveAttribute('data-command', 'back')
    await frame.evaluate(element => element.dispatchEvent(new Event('confirm-back', { bubbles: true })))
    await expect(frame).toHaveAttribute('data-command', 'home')
    await toolbar.getByRole('button', { name: 'Hide toolbar' }).tap()
    await expect(back).toBeHidden()
    await expect(exit).toBeVisible()

    const start = (await handle.boundingBox())!
    const x = start.x + start.width / 2
    const y = start.y + start.height / 2
    const touch = await page.context().newCDPSession(page)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 385, y: 839 }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(async () => (await handle.boundingBox())!.x).toBeGreaterThan(start.x + 100)

    await toolbar.getByRole('button', { name: 'Show toolbar' }).tap()
    await expect(back).toBeVisible()
    await expect(toolbar).toBeInViewport({ ratio: 1 })
    await touch.send('Emulation.setDeviceMetricsOverride', {
      width: 500,
      height: 320,
      deviceScaleFactor: 1,
      mobile: true,
      screenOrientation: { type: 'landscapePrimary', angle: 90 }
    })
    await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(320)
    await expect(toolbar).toBeInViewport({ ratio: 1 })
    await expect(exit).toBeInViewport({ ratio: 1 })
    const beforeKey = (await handle.boundingBox())!.x
    await handle.press('ArrowLeft')
    await expect.poll(async () => (await handle.boundingBox())!.x).toBeLessThan(beforeKey)
    await exit.tap()
    await expect(toolbar).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible()
    await expect(frame).toHaveAttribute('data-retained', 'true')
  })
}

import { expect, test } from '@playwright/test'
import { viewerPlacementCookie } from '../src/shared/model/settings/viewer-placement'

test.beforeEach(async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: viewerPlacementCookie, value: 'right', url: baseURL }])
})

test('the viewer defaults to the top for a new preference', async ({ page }) => {
  await page.context().clearCookies({ name: viewerPlacementCookie })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=app-resource')
  const pane = page.getByRole('complementary', { name: 'Android device' })
  await expect(pane).toHaveAttribute('data-viewer-placement', 'top')
  const viewer = (await pane.boundingBox())!
  const heading = (await page.getByRole('heading', { level: 1 }).boundingBox())!
  expect(viewer.y + viewer.height).toBeLessThanOrEqual(heading.y)
})

test('narrow screens keep the viewer on top and hide its layout menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  const pane = page.getByRole('complementary', { name: 'Android device' })
  const layout = page.getByRole('button', { name: 'Viewer layout' })

  for (const editor of ['app-resource-loading', 'app-resource']) {
    await page.goto(`/skeleton-contract-test?editor=${editor}`)
    await expect(layout).toBeHidden()
    const viewer = (await pane.boundingBox())!
    const heading = (await page.getByRole('heading', { level: 1 }).boundingBox())!
    expect(viewer.y + viewer.height).toBeLessThanOrEqual(heading.y)
  }

  await page.keyboard.press('Alt+Shift+L')
  await page.setViewportSize({ width: 1440, height: 900 })
  await layout.click()
  await expect(page.getByRole('menuitemradio', { name: 'Viewer on the right' })).toHaveAttribute('aria-checked', 'true')
  await page.setViewportSize({ width: 390, height: 800 })
  await expect(page.getByRole('menu')).toBeHidden()
})

test('the inline viewer fits the small viewport when mobile browser chrome is present', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.isMobile, 'Uses Chromium mobile browser chrome emulation')
  await page.setViewportSize({ width: 384, height: 600 })
  await page.goto('/skeleton-contract-test?editor=app-resource')
  const frame = page.getByRole('complementary', { name: 'Android device' }).locator('[data-viewer-frame]')
  const initial = (await frame.boundingBox())!
  const chrome = frame.locator('.viewer-chrome')
  await expect(chrome).toHaveCSS('height', '32px')
  await expect(chrome.getByRole('button', { name: 'Streaming settings' })).toHaveCSS('width', '44px')
  expect(initial.height).toBeGreaterThan(300)
  const viewportHeight = await page.evaluate(() => innerHeight)
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setSmallViewportHeightDifferenceOverride', { difference: 64 })

  await expect.poll(async () => (await frame.boundingBox())!.height).toBeLessThan(initial.height)
  expect(await page.evaluate(() => innerHeight)).toBe(viewportHeight)
})

test('shared app chrome stays fixed when switching between diagnostics and AI agent', async ({ page }) => {
  for (const width of [1024, 1440, 2048]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/skeleton-contract-test?editor=agent&view=diagnostics')
    await page.waitForFunction(() => (history.state as { __NA?: boolean } | null)?.__NA === true)
    const navigation = page.getByRole('navigation', { name: 'App sections' })
    const heading = page.getByRole('heading', { name: 'Inventory worker', exact: true })
    const frame = page.getByRole('complementary', { name: 'Android device' }).locator('[data-viewer-frame]')
    const settings = page.getByRole('button', { name: 'Streaming settings', exact: true })
    await expect(navigation.getByRole('link', { name: 'Diagnostics', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    )
    const original = await Promise.all([
      heading.boundingBox(),
      navigation.boundingBox(),
      frame.boundingBox(),
      settings.boundingBox()
    ])
    for (const view of ['ai-agent', 'diagnostics', 'ai-agent']) {
      await page.evaluate(next => {
        history.pushState(null, '', `/skeleton-contract-test?editor=agent&view=${next}`)
      }, view)
      await expect(
        navigation.getByRole('link', { name: view === 'ai-agent' ? 'AI agent' : 'Diagnostics', exact: true })
      ).toHaveAttribute('aria-current', 'page')
      const current = await Promise.all([
        heading.boundingBox(),
        navigation.boundingBox(),
        frame.boundingBox(),
        settings.boundingBox()
      ])
      for (let index = 0; index < original.length; index++) {
        for (const dimension of ['x', 'y', 'width', 'height'] as const)
          expect(
            Math.abs(current[index]![dimension] - original[index]![dimension]),
            `${width} ${view} element ${index} ${dimension}`
          ).toBeLessThanOrEqual(1)
      }
      if (view === 'ai-agent') {
        await expect(page.getByRole('textbox', { name: 'Message the device agent' })).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1)
      }
    }
  }
})

test('agent chat fits the viewport and keeps its composer reachable', async ({ page }, testInfo) => {
  for (const width of [390, 768, 1024, 1440, 2048]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/skeleton-contract-test?editor=agent')
    const composer = page.getByRole('textbox', { name: 'Message the device agent' })
    await expect(composer).toBeVisible()
    if (width === 390)
      await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('agent-mobile.png'), fullPage: true })
    await page.getByRole('button', { name: 'Inspect screen', exact: true }).click()
    await expect(composer).toBeFocused()
    await expect(composer).not.toHaveValue('')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    if (width >= 1024) {
      expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1)
      const dock = (await page.getByTestId('ai-agent-composer-dock').boundingBox())!
      expect(900 - dock.y - dock.height).toBeCloseTo(16, 0)
      if (width >= 1440) {
        const frame = page.getByRole('complementary', { name: 'Android device' }).locator('[data-viewer-frame]')
        const box = (await frame.boundingBox())!
        expect(900 - box.y - box.height).toBeCloseTo(16, 0)
      }
      const rect = await composer.boundingBox()
      expect(rect!.y + rect!.height).toBeLessThan(900)
      await page.mouse.move(rect!.x + 20, rect!.y + 20)
      await page.mouse.wheel(0, 900)
      expect(await page.evaluate(() => scrollY)).toBe(0)
    }
    if (width === 1440) await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('agent-empty.png') })
  }
})

test('long conversations scroll independently and can return to latest', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=agent&conversation=history')
  const transcript = page.getByRole('region', { name: 'AI agent transcript' })
  await expect(transcript.locator('article')).toHaveCount(15)
  const dock = page.getByTestId('ai-agent-composer-dock')
  const initialDock = await dock.boundingBox()
  await transcript.evaluate(node => {
    node.scrollTop = 0
    node.dispatchEvent(new Event('scroll'))
  })
  await expect(page.getByRole('button', { name: 'Latest messages' })).toBeVisible()
  await transcript.focus()
  await page.keyboard.press('PageDown')
  expect(await page.evaluate(() => scrollY)).toBe(0)
  await page.getByRole('button', { name: 'Latest messages' }).click()
  await expect(page.getByRole('button', { name: 'Latest messages' })).toHaveCount(0)
  expect(await dock.boundingBox()).toEqual(initialDock)
  const composer = page.getByRole('textbox', { name: 'Message the device agent' })
  await composer.fill('Open Downloads')
  await composer.press('Enter')
  await expect(transcript.locator('article')).toHaveCount(16)
  await expect(composer).toHaveValue('')
  await page.getByRole('button', { name: 'Suggestions', exact: true }).click()
  await page.getByRole('button', { name: 'Inspect screen', exact: true }).click()
  await expect(composer).toBeFocused()
  await expect(page.getByText('Suggested requests', { exact: true })).toBeHidden()
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('agent-history.png') })
})

test('stacked viewer floats without reconnecting and the chat passes wheel scrolling to the page', async ({
  page,
  baseURL
}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.context().addCookies([{ name: viewerPlacementCookie, value: 'top', url: baseURL }])
  await page.route('**/preview-display-frame', route =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><body data-preview-display></body>' })
  )
  await page.goto('/skeleton-contract-test?editor=agent&viewer=preview')
  const frame = page.locator('iframe[title="display viewer"]')
  const transcript = page.getByRole('region', { name: 'AI agent transcript' })
  const closePreview = page.getByRole('button', { name: 'Close mini player' })
  await expect(frame).toBeInViewport()
  await expect(frame.contentFrame().locator('[data-preview-display]')).toBeAttached()
  const clipboard = page.getByRole('button', { name: 'Device clipboard' })
  await clipboard.click()
  const clipboardDialog = page.getByRole('dialog', { name: 'Device clipboard' })
  await expect(clipboardDialog.getByRole('textbox', { name: 'Clipboard text' })).toBeEditable()
  await page.keyboard.press('Escape')
  await expect(clipboard).toBeFocused()
  await frame.evaluate(element => {
    const iframe = element as HTMLIFrameElement
    iframe.contentDocument!.body.dataset.retained = 'true'
  })

  await page.evaluate(() => window.scrollBy(0, 650))
  await expect(closePreview).toBeInViewport()
  await expect(frame.locator('..')).toHaveAttribute('inert', '')
  await expect(transcript).toBeInViewport()
  await transcript.hover()
  const scrolledDown = await page.evaluate(() => scrollY)
  await page.mouse.wheel(0, -350)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(scrolledDown)

  await page.evaluate(() => window.scrollBy(0, 650))
  await expect(closePreview).toBeInViewport()
  const beforeClose = await page.evaluate(() => scrollY)
  await closePreview.click()
  await expect(closePreview).toHaveCount(0)
  expect(await page.evaluate(() => scrollY)).toBe(beforeClose)
  await expect(frame.locator('..')).not.toHaveAttribute('inert')
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(frame).toBeInViewport()
  expect(await frame.evaluate(element => (element as HTMLIFrameElement).contentDocument!.body.dataset.retained)).toBe(
    'true'
  )
  await page.evaluate(() => window.scrollBy(0, 650))
  await expect(closePreview).toBeInViewport()
  expect(errors).toEqual([])
})

test('stopped devices retain drafts and model settings fit short screens', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 650 })
  await page.goto('/skeleton-contract-test?editor=agent&conversation=stopped')
  const composer = page.getByRole('textbox', { name: 'Message the device agent' })
  await composer.fill('Draft only')
  await composer.press('Enter')
  await expect(composer).toHaveValue('Draft only')
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()
  await page.getByRole('button', { name: /^Agent settings:/ }).click()
  await expect(page.getByRole('button', { name: 'Device agent', exact: true })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Run time limit' })).toBeHidden()
  await page.getByText('More options', { exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Run time limit' })).toBeVisible()
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('agent-settings.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: /^Agent settings:/ })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1)
})

test('model selection is direct and restores focus without exposing advanced controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=agent')
  const trigger = page.getByRole('button', { name: /^Agent settings:/ })
  await trigger.click()
  const picker = page.getByRole('dialog', { name: 'Choose AI model' })
  await expect(picker).toHaveCSS('border-top-width', '1px')
  const colors = await picker.evaluate(node => {
    const probe = document.createElement('span')
    probe.style.color = 'hsl(var(--surface-elevated))'
    node.append(probe)
    const expected = getComputedStyle(probe).color
    probe.remove()
    return { expected, actual: getComputedStyle(node).backgroundColor }
  })
  expect(colors.actual).toBe(colors.expected)
  await expect(picker.getByRole('combobox')).toHaveCount(0)
  await expect(picker.getByRole('spinbutton')).toHaveCount(0)
  const model = picker.getByRole('button', { name: 'Device agent', pressed: true })
  await expect(model).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await model.focus()
  await page.keyboard.press('Enter')
  await expect(picker).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('agent surfaces stay consistent through themes and loading', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const theme of ['light', 'dark', 'oled']) {
    await page.addInitScript(mode => localStorage.setItem('theme', mode), theme)
    await page.goto('/skeleton-contract-test?editor=agent&conversation=no-model')
    await expect(page.locator('html')).toHaveClass(new RegExp(theme))
    await expect(page.getByText('Configure an enabled AI provider and model before sending.')).toBeVisible()
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`agent-${theme}.png`) })
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1)
  }
  await page.goto('/skeleton-contract-test?editor=app-resource-loading&view=ai-agent')
  await expect(page.getByLabel('Loading AI chat history')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Message the device agent' })).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1)
})

test('app tabs keep the same device and tab position', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=app-resource')
  await page.waitForFunction(() => (history.state as { __NA?: boolean } | null)?.__NA === true)
  const navigation = page.getByRole('navigation', { name: 'App sections' })
  const pane = page.getByRole('complementary', { name: 'Android device' })
  const initialNavigation = (await navigation.boundingBox())!
  const initialPane = (await pane.boundingBox())!
  await pane.locator('[data-viewer-frame]').evaluate(element => element.setAttribute('data-retained', 'true'))

  for (const [view, label] of [
    ['configuration', 'Configuration'],
    ['diagnostics', 'Diagnostics'],
    ['overview', 'Overview']
  ]) {
    await page.evaluate(
      next => history.pushState(null, '', `/skeleton-contract-test?editor=app-resource&view=${next}`),
      view
    )
    await expect(navigation.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(pane.locator('[data-viewer-frame]')).toHaveAttribute('data-retained', 'true')
    const current = (await navigation.boundingBox())!
    expect(current.x).toBe(initialNavigation.x)
    expect(current.y).toBe(initialNavigation.y)
    expect(await pane.boundingBox()).toEqual(initialPane)
  }
})

test('viewer layout shortcut is discoverable and yields to editors and menus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.use.hasTouch === true, 'Checks desktop hover and keyboard behavior')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=app-resource&view=configuration')
  const layout = page.getByRole('button', { name: 'Viewer layout' })
  const pane = page.getByRole('complementary', { name: 'Android device' })
  const frame = pane.locator('[data-viewer-frame]')
  await frame.evaluate(element => element.setAttribute('data-retained', 'true'))

  await expect(layout).toHaveAttribute('aria-keyshortcuts', 'Alt+Shift+L')
  await expect(layout).not.toHaveAttribute('title', /.+/)
  await layout.hover()
  const hint = page.getByText('Switch viewer layout', { exact: true }).locator('..')
  await expect(hint).toBeVisible()
  await expect(hint.locator('kbd')).toHaveText([/Alt|Option/, 'Shift', 'L'])

  await page.keyboard.press('Alt+Shift+L')
  await expect(pane).toHaveAttribute('data-viewer-placement', 'top')

  const name = page.getByRole('textbox', { name: /^Name/ })
  await name.focus()
  await page.keyboard.press('Alt+Shift+L')
  await expect(pane).toHaveAttribute('data-viewer-placement', 'top')
  await expect(name).toBeFocused()

  await layout.click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Alt+Shift+L')
  await expect(pane).toHaveAttribute('data-viewer-placement', 'top')
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(layout).toBeFocused()

  await page.keyboard.press('Alt+Shift+L')
  await expect(pane).not.toHaveAttribute('data-viewer-placement', 'top')
  await expect(layout).toBeFocused()
  await expect(frame).toHaveAttribute('data-retained', 'true')
})

test('viewer layout keeps breadcrumbs above the device and preserves the mounted viewer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=app-resource')
  const breadcrumbs = page.getByRole('navigation', { name: 'breadcrumb' })
  const navigation = page.getByRole('navigation', { name: 'App sections' })
  const pane = page.getByRole('complementary', { name: 'Android device' })
  const frame = pane.locator('[data-viewer-frame]')
  const layout = page.getByRole('button', { name: 'Viewer layout' })
  const initialBreadcrumbs = (await breadcrumbs.boundingBox())!
  const initialNavigation = (await navigation.boundingBox())!
  const initialFrame = (await frame.boundingBox())!
  const appsCrumb = (await breadcrumbs.getByRole('link', { name: 'Apps' }).boundingBox())!
  const layoutButton = (await layout.boundingBox())!
  expect(Math.abs(layoutButton.y + layoutButton.height / 2 - (appsCrumb.y + appsCrumb.height / 2))).toBeLessThan(2)
  await frame.evaluate(element => element.setAttribute('data-retained', 'true'))

  await layout.click()
  await expect(page.getByRole('menuitemradio', { name: 'Viewer on the right' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('menuitemradio', { name: 'Viewer on top' }).click()
  await expect(pane).toHaveAttribute('data-viewer-placement', 'top')
  await expect(layout).toBeFocused()
  await expect(frame).toHaveAttribute('data-retained', 'true')
  await expect(navigation.getByRole('link', { name: 'Viewer', exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(/editor=app-resource$/)

  const stackedBreadcrumbs = (await breadcrumbs.boundingBox())!
  const stackedNavigation = (await navigation.boundingBox())!
  const bottomSpace = await page.evaluate(() => (matchMedia('(pointer: coarse)').matches ? 8 : 16))
  await expect
    .poll(async () => {
      const box = (await pane.boundingBox())!
      return box.y + box.height
    })
    .toBeLessThanOrEqual(900 - bottomSpace)
  const stackedPane = (await pane.boundingBox())!
  expect(stackedBreadcrumbs.y).toBe(initialBreadcrumbs.y)
  expect(stackedPane.y).toBeGreaterThanOrEqual(stackedBreadcrumbs.y + stackedBreadcrumbs.height)
  expect(stackedNavigation.y).toBeGreaterThan(stackedPane.y + stackedPane.height)
  expect(stackedNavigation.width).toBeGreaterThan(initialNavigation.width)
  await expect
    .poll(async () => {
      const box = (await frame.boundingBox())!
      return Math.abs(box.width / box.height - initialFrame.width / initialFrame.height)
    })
    .toBeLessThan(0.01)

  await page.evaluate(() => {
    window.scrollTo(0, 80)
    history.pushState(null, '', '/skeleton-contract-test?editor=app-resource&view=diagnostics')
  })
  await expect(navigation.getByRole('link', { name: 'Diagnostics' })).toHaveAttribute('aria-current', 'page')
  expect(await page.evaluate(() => scrollY)).toBe(80)
  await page.evaluate(() => {
    history.pushState(null, '', '/skeleton-contract-test?editor=app-resource')
    window.scrollTo(0, 0)
  })
  await expect(navigation.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')

  await layout.click()
  await page.getByRole('menuitemradio', { name: 'Viewer on the right' }).click()
  await expect(pane).not.toHaveAttribute('data-viewer-placement', 'top')
  await expect(frame).toHaveAttribute('data-retained', 'true')
  await expect(navigation.getByRole('link', { name: 'Viewer', exact: true })).toHaveCount(0)
  expect((await navigation.boundingBox())!.y).toBe(initialNavigation.y)

  await layout.click()
  await page.getByRole('menuitemradio', { name: 'Viewer on top' }).click()
  const initialHtml = await page.request.get('/skeleton-contract-test?editor=app-resource')
  expect(await initialHtml.text()).toContain('data-viewer-placement="top"')
  await page.goto('/skeleton-contract-test?editor=app-resource-loading')
  await expect(pane).toHaveAttribute('data-viewer-placement', 'top')
  await page.goto('/skeleton-contract-test?editor=app-resource')
  await expect(pane).toHaveAttribute('data-viewer-placement', 'top')
  expect(await page.evaluate(() => scrollY)).toBe(0)

  await page.goto('/skeleton-contract-test?editor=general')
  const preference = page.getByRole('combobox', { name: 'Viewer layout' })
  await expect(preference).toHaveText('Viewer on top')
  await preference.click()
  await page.getByRole('option', { name: 'Viewer on the right' }).click()
  await page.goto('/skeleton-contract-test?editor=app-resource')
  await expect(pane).not.toHaveAttribute('data-viewer-placement', 'top')
})

import { expect, test } from '@playwright/test'

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
  await expect(picker.getByRole('combobox')).toHaveCount(0)
  await expect(picker.getByRole('spinbutton')).toHaveCount(0)
  const model = picker.getByRole('button', { name: 'Device agent', pressed: true })
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
  await expect
    .poll(async () => {
      const box = (await pane.boundingBox())!
      return box.y + box.height
    })
    .toBeLessThanOrEqual(900 - 16)
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

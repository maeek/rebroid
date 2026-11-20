import { expect, test } from '@playwright/test'

for (const [kind, titles] of [
  ['user', ['Identity', 'Password', 'Account status', 'Appearance']],
  ['group', ['Group details', 'Notes']]
] as const) {
  test(`${kind} editor sections preserve loading geometry and drafts`, async ({ page }) => {
    for (const width of [390, 768, 1440, 2048]) {
      await page.setViewportSize({ width, height: 1100 })
      const geometry = async () =>
        page.locator('[role="tabpanel"]:not([hidden]) [data-surface="editor"]').evaluateAll(sections => {
          const origin = sections[0].getBoundingClientRect().y
          return sections.map(section => {
            const { x, y, width: sectionWidth, height } = section.getBoundingClientRect()
            return { x, y: y - origin, width: sectionWidth, height }
          })
        })
      await page.goto(`/skeleton-contract-test?editor=${kind}-loading`)
      await expect(page.getByRole('heading', { name: titles[0], exact: true })).toBeVisible()
      const loading = await geometry()
      await page.getByRole('tab', { name: 'Quotas', exact: true }).click()
      const quotaLoading = await geometry()
      await page.goto(`/skeleton-contract-test?editor=${kind}`)
      await expect(page.getByRole('heading', { name: titles[0], exact: true })).toBeVisible()
      expect(await geometry()).toEqual(loading)
      for (const title of titles) {
        const section = page.getByRole('region', { name: title, exact: true })
        await expect(section).toHaveAttribute('data-surface', 'editor')
        await expect(section.locator('[data-surface="editor"]')).toHaveCount(0)
      }
      const field = page.getByRole('textbox', { name: kind === 'user' ? /^Username/ : 'Description' })
      await field.fill('Unsaved section draft')
      await page.getByRole('tab', { name: 'Permissions' }).click()
      await expect(page.getByRole('heading', { name: 'Permissions', exact: true })).toHaveCount(0)
      await expect(page.getByRole('region', { name: 'Quotas', exact: true })).toHaveCount(0)
      await page.getByRole('tab', { name: 'Quotas', exact: true }).click()
      expect(await geometry()).toEqual(quotaLoading)
      const quotas = page.getByRole('region', { name: 'Quotas', exact: true })
      await expect(quotas.getByRole('heading', { name: 'Quotas', exact: true })).toHaveCount(0)
      await expect(quotas).toContainText(
        kind === 'user'
          ? 'Effective limits from the selected groups.'
          : 'Resource limits for applications and sessions.'
      )
      await expect(quotas).toHaveAttribute('data-surface', 'editor')
      await expect(quotas.locator('[data-surface="editor"]')).toHaveCount(0)
      await page.getByRole('tab', { name: kind === 'user' ? 'Account' : 'Details', exact: true }).click()
      await expect(field).toHaveValue('Unsaved section draft')
      for (const theme of ['light', 'dark', 'oled']) {
        await page.evaluate(value => {
          document.documentElement.className = value
        }, theme)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
        if (width === 390 || width === 1440) {
          await page.screenshot({
            path: `/tmp/rebroid-${kind}-sections-${width}-${theme}-${test.info().project.name}.png`,
            fullPage: true,
            animations: 'disabled'
          })
        }
      }
    }
  })
}

test('console defaults keep descriptions beneath labels and preserve loading geometry', async ({ page }) => {
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=console-defaults-loading')
    const loading = await page.locator('[data-surface="editor"]').evaluateAll(sections =>
      sections.map(section => {
        const rect = section.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      })
    )
    await page.goto('/skeleton-contract-test?editor=console-defaults')
    const ready = await page.locator('[data-surface="editor"]').evaluateAll(sections =>
      sections.map(section => {
        const rect = section.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      })
    )
    expect(ready).toEqual(loading)
    const refresh = page.getByRole('spinbutton', { name: 'List refresh interval' })
    await expect(refresh).toHaveAccessibleDescription(
      'Controls how often app lists refresh automatically across the frontend.'
    )
    const describedControls = [
      refresh,
      page.getByRole('combobox', { name: 'Preset' }),
      page.getByRole('spinbutton', { name: 'Bitrate' }),
      page.getByRole('switch', { name: 'Enable keyboard in fullscreen' }),
      page.getByRole('switch', { name: 'Enable sound' })
    ]
    for (const control of describedControls) {
      const field = page.locator('[data-editor-field]').filter({ has: control })
      const label = await field.locator('label').boundingBox()
      const description = await field.locator('p').boundingBox()
      const input = await control.boundingBox()
      expect(description!.y - (label!.y + label!.height)).toBe(4)
      expect(input!.y - (description!.y + description!.height)).toBe(12)
    }
    const streaming = page.getByRole('region', { name: 'Streaming defaults' })
    const note = await streaming.getByText('Interactive video always', { exact: false }).boundingBox()
    const presetLabel = await streaming.locator('label').first().boundingBox()
    expect(note!.y + note!.height).toBeLessThan(presetLabel!.y)
    const bitrate = page.getByRole('spinbutton', { name: 'Bitrate' })
    await bitrate.fill('12')
    await expect(bitrate).toBeFocused()
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({
        path: `/tmp/rebroid-general-fields-${width}-${theme}-${test.info().project.name}.png`,
        fullPage: true,
        animations: 'disabled'
      })
    }
  }
})

for (const width of [390, 768, 1440, 2048]) {
  test(`standard editor stays bounded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test')
    const editor = page.locator('[data-editor]')
    const before = await editor.boundingBox()
    expect(before?.width).toBeLessThanOrEqual(896)
    const name = page.getByLabel('Editor name')
    expect((await name.boundingBox())?.width).toBeLessThanOrEqual(before!.width)
    await page.getByRole('button', { name: 'Toggle state' }).click()
    const after = await editor.boundingBox()
    expect(after?.width).toBe(before?.width)
    expect(after?.x).toBe(before?.x)
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
      await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()
      await page.screenshot({ path: `/tmp/rebroid-editor-${width}-${theme}.png` })
    }
    const advanced = page.getByRole('button', { name: 'Advanced limits' })
    await advanced.click()
    const memory = page.getByRole('spinbutton', { name: 'Memory', exact: true })
    await expect(memory).toBeVisible()
    expect((await memory.boundingBox())?.width).toBeLessThanOrEqual(192)
    await advanced.click()
    await expect(advanced).toHaveAttribute('aria-expanded', 'false')
  })
}

test('real create form starts with name and uses a normal page header', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/skeleton-contract-test?editor=app')
  await expect(page.getByRole('heading', { name: 'Create app', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox').first()).toHaveAccessibleName(/Name/)
  for (const theme of ['light', 'dark', 'oled']) {
    await page.evaluate(value => {
      document.documentElement.className = value
    }, theme)
    await page.screenshot({ path: `/tmp/rebroid-create-${theme}.png` })
  }
  await page.evaluate(() => scrollTo(0, 400))
  expect((await page.getByRole('heading', { name: 'Create app', exact: true }).boundingBox())?.y).toBeLessThan(0)
  await page.screenshot({ path: '/tmp/rebroid-create-scrolled.png' })
})

test('create app aligns with the Apps action on mobile in ready and loading states', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const layouts = []
    for (const loading of [false, true]) {
      await page.goto(`/skeleton-contract-test?editor=apps-gallery${loading ? '-loading' : ''}`)
      const appsAction = page.getByRole(loading ? 'button' : 'link', { name: 'Create app', exact: true })
      const appsActionBox = (await appsAction.boundingBox())!
      const appsHeader = (await appsAction.locator('xpath=ancestor::header').boundingBox())!

      await page.goto(`/skeleton-contract-test?editor=app${loading ? '-loading' : ''}`)
      const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
      await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('Create app')
      const heading = page.getByRole('heading', { level: 1, name: 'Create app', exact: true })
      await expect(heading).toHaveCount(1)
      expect((await heading.boundingBox())!.width).toBeLessThanOrEqual(1)

      const submit = page.getByRole('button', { name: 'Create app', exact: true })
      const action = (await submit.boundingBox())!
      const nav = (await breadcrumb.boundingBox())!
      const header = (await submit.locator('xpath=ancestor::header').boundingBox())!
      expect(action.y + action.height / 2).toBe(nav.y + nav.height / 2)
      expect(action.x).toBeGreaterThanOrEqual(nav.x + nav.width)
      expect(width - action.x - action.width).toBe(16)
      expect(nav.y - header.y).toBe(12)
      expect(action.x - header.x).toBe(appsActionBox.x - appsHeader.x)
      expect(action.y - header.y).toBe(appsActionBox.y - appsHeader.y)
      expect(action.width).toBe(appsActionBox.width)
      expect(action.height).toBe(44)
      expect(action.height).toBe(appsActionBox.height)
      for (const [property, value] of [
        ['border-block-start-width', '2px'],
        ['border-block-end-width', '2px'],
        ['background-clip', 'padding-box']
      ])
        await expect(submit).toHaveCSS(property, value)
      expect(await submit.evaluate(button => (button as HTMLButtonElement).form instanceof HTMLFormElement)).toBe(true)
      if (loading) {
        await expect(submit).toBeDisabled()
      } else {
        await page.getByRole('textbox', { name: /Name/ }).fill('Tablet')
        await expect(submit).toBeEnabled()
      }
      layouts.push({ action, nav })
    }
    expect(layouts[1]).toEqual(layouts[0])
  }
})

test('phone editors reserve the top-right primary action while loading', async ({ page }) => {
  for (const [editor, label] of [
    ['user', 'Save User'],
    ['group', 'Save Group'],
    ['ai-connection', 'Save'],
    ['runtime', 'Save'],
    ['console-defaults', 'Save defaults'],
    ['builder-gapps', 'Build image'],
    ['builder-custom', 'Build image']
  ]) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const boxes = []
      for (const loading of [false, true]) {
        const query = editor === 'ai-connection' ? '&view=connection' : ''
        await page.goto(`/skeleton-contract-test?editor=${editor}${loading ? '-loading' : ''}${query}`)
        const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' })
        await expect(breadcrumb.locator('[aria-current="page"]')).toBeVisible()
        const heading = page.getByRole('heading', { level: 1 })
        await expect(heading).toHaveCount(1)
        const action = page.getByRole('button', { name: label, exact: true })
        await expect(action).toBeVisible()
        if (loading) await expect(action).toBeDisabled()
        const nav = (await breadcrumb.boundingBox())!
        const save = (await action.boundingBox())!
        const title = (await heading.boundingBox())!
        if (width < 640) {
          expect(title.width).toBeLessThanOrEqual(1)
          expect(save.y + save.height / 2).toBeCloseTo(nav.y + nav.height / 2)
          expect(save.x + save.width).toBeCloseTo(width - 16)
          expect(save.height).toBe(44)
          boxes.push({ top: save.y - nav.y, width: save.width })
        } else {
          expect(title.width).toBeGreaterThan(1)
          expect(save.y).toBeGreaterThan(nav.y)
        }
      }
      if (width < 640) {
        expect(boxes[0].top, editor).toBeCloseTo(boxes[1].top)
        expect(Math.abs(boxes[0].width - boxes[1].width), editor).toBeLessThanOrEqual(1)
      }
    }
  }
})

test('create editor stacks fields inside rounded sections', async ({ page, isMobile }) => {
  for (const width of [320, 390, 768, 1024, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=app')
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    const name = await page.getByRole('textbox', { name: /Name/ }).boundingBox()
    const uploadApk = page.getByRole('button', { name: 'Upload APK', exact: true })
    const uploadIcon = page.getByRole('button', { name: 'Upload icon', exact: true })
    const savedApkButton = page.getByRole('button', { name: 'Saved APKs', exact: true })
    const savedApk = (await savedApkButton.boundingBox())!
    const apk = (await uploadApk.boundingBox())!
    const icon = (await uploadIcon.boundingBox())!
    expect(savedApk.y).toBe(apk.y)
    expect(savedApk.x).toBeGreaterThan(apk.x + apk.width)
    if (isMobile) {
      expect(apk.height).toBeGreaterThanOrEqual(44)
      expect(savedApk.height).toBeGreaterThanOrEqual(44)
    }
    if (width >= 1024) {
      const uploads = page.locator('[data-slot="file-upload-field"]')
      const apkField = (await uploads.filter({ has: uploadApk }).boundingBox())!
      const iconField = (await uploads.filter({ has: uploadIcon }).boundingBox())!
      expect(apkField.y).toBe(iconField.y)
      expect(apkField.height).toBe(iconField.height)
      expect(apk.y).toBe(icon.y)
    } else {
      expect(icon.y).toBeGreaterThan(Math.max(apk.y + apk.height, savedApk.y + savedApk.height))
    }
    const runtimeImage = (await page.getByRole('combobox', { name: 'Runtime image', exact: true }).boundingBox())!
    const display = (await page.getByRole('combobox', { name: 'Display size', exact: true }).boundingBox())!
    const network = (await page.getByRole('combobox', { name: 'Outbound access', exact: true }).boundingBox())!
    const preview = (await page.locator('[data-slot="display-preview"]').boundingBox())!
    const device = (await page.locator('[data-slot="device-preview-screen"]').boundingBox())!
    for (const bounds of [runtimeImage, display, network]) {
      expect(bounds.x).toBe(name!.x)
      expect(bounds.width).toBe(runtimeImage.width)
    }
    if (width >= 768) {
      expect(preview.x).toBeGreaterThan(runtimeImage.x + runtimeImage.width)
      expect(preview.y).toBeLessThan(runtimeImage.y)
      expect(device.height).toBeGreaterThan(120)
    } else {
      expect(runtimeImage.width).toBe(name!.width)
      expect(preview.y).toBeGreaterThan(display.y + display.height)
      expect(device.height).toBeLessThan(100)
    }
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      expect((await savedApkButton.boundingBox())!.y).toBe((await uploadApk.boundingBox())!.y)
      await page.screenshot({
        path: `/tmp/rebroid-editor-widths-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
    await page.goto('/skeleton-contract-test?editor=app-loading')
    const loadingRuntime = await page.locator('input[role="combobox"]').first().boundingBox()
    expect(loadingRuntime!.x).toBe(name!.x)
    expect(loadingRuntime!.width).toBe(runtimeImage.width)
    expect(await page.locator('[data-slot="display-preview"]').boundingBox()).toEqual(preview)
  }
})

test('runtime settings separate defaults, hardware acceleration, and maintenance workflows', async ({ page }) => {
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=runtime')
    const imageDefaults = page.getByRole('region', { name: 'Image defaults', exact: true })
    const behavior = page.getByRole('region', { name: 'App behavior', exact: true })
    const hardware = page.getByRole('region', { name: 'Hardware Acceleration', exact: true })
    const maintenance = page.getByRole('region', { name: 'Maintenance', exact: true })
    const defaultImage = await page.getByRole('combobox', { name: 'Default image', exact: true }).boundingBox()
    const imageRegistry = await page.getByRole('textbox', { name: 'Image registry' }).boundingBox()
    expect(defaultImage!.x).toBe(imageRegistry!.x)
    expect(defaultImage!.width).toBe(imageRegistry!.width)
    await expect(imageDefaults).toBeVisible()
    await expect(behavior).toBeVisible()
    await expect(hardware.getByText('Software (default)')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Connection', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await expect(maintenance.getByRole('button', { name: /^Clean up / })).toHaveCount(6)
    const numeric = page.getByRole('spinbutton', { name: 'Default inactivity timeout' })
    const input = await numeric.boundingBox()
    const unit = await page.getByText('seconds', { exact: true }).boundingBox()
    expect(unit!.x - (input!.x + input!.width)).toBeLessThanOrEqual(12)
    await expect(numeric).toHaveValue('900')
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({
        path: `/tmp/rebroid-runtime-${width}-${theme}-${test.info().project.name}.png`,
        fullPage: true,
        animations: 'disabled'
      })
    }
    const registry = page.getByRole('textbox', { name: 'Image registry' })
    await hardware.getByRole('combobox', { name: 'Rendering mode' }).click()
    await page.getByRole('option', { name: 'Host GPU' }).click()
    const device = hardware.getByRole('textbox', { name: /GPU render device/ })
    await expect(device).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await device.fill('/dev/dri/renderD128')
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(device).toHaveCount(0)
    await registry.fill('registry.example:5000')
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(registry).toHaveValue('')
    const uploadLimit = page.getByRole('spinbutton', { name: 'Max APK size' })
    await uploadLimit.fill('0')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    expect(await uploadLimit.evaluate(node => (node as HTMLInputElement).validity.rangeUnderflow)).toBe(true)
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
    await uploadLimit.fill('256')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    const cleanup = maintenance.getByRole('button', { name: 'Clean up unused volumes' })
    await cleanup.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('cannot be recovered')
    await page.screenshot({
      path: `/tmp/rebroid-runtime-confirm-${width}-${test.info().project.name}.png`,
      animations: 'disabled'
    })
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(cleanup).toBeFocused()
  }
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/skeleton-contract-test?editor=runtime-loading')
  const loading = await page.getByRole('region', { name: 'Image defaults', exact: true }).boundingBox()
  const hardware = page.getByRole('region', { name: 'Hardware Acceleration', exact: true })
  const hardwareLoading = await hardware.boundingBox()
  await expect(hardware.locator('#runtime-rendering-mode')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await page.goto('/skeleton-contract-test?editor=runtime')
  expect(await page.getByRole('region', { name: 'Image defaults', exact: true }).boundingBox()).toEqual(loading)
  expect(await hardware.boundingBox()).toEqual(hardwareLoading)
})

test('icon preview and upload share a row below the field label', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1184 })
  await page.goto('/skeleton-contract-test?editor=app')
  const uploadButton = page.getByRole('button', { name: 'Upload icon', exact: true })
  const uploadField = page.locator('[data-slot="file-upload-field"]').filter({ has: uploadButton })
  const icon = await uploadField.locator('[data-slot="file-upload-preview"]').boundingBox()
  const upload = await uploadButton.boundingBox()
  expect(upload!.x).toBeGreaterThan(icon!.x + icon!.width)
  expect(upload!.y + upload!.height / 2).toBeGreaterThanOrEqual(icon!.y)
  expect(upload!.y + upload!.height / 2).toBeLessThanOrEqual(icon!.y + icon!.height)
  const field = page
    .locator('[data-editor-field]')
    .filter({ has: page.getByRole('textbox', { name: /Name/ }) })
    .first()
  const label = await field.locator(':scope > div').first().boundingBox()
  const input = await page.getByRole('textbox', { name: /Name/ }).boundingBox()
  expect(input!.y).toBeGreaterThanOrEqual(label!.y + label!.height + 8)
})

test('display and network selects keep readable labels after selection and closing', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=app')
  const display = page.getByRole('combobox', { name: 'Display size', exact: true })
  await expect(display).toContainText('Modern phone')
  const deviceScreen = page.locator('[data-slot="device-preview-screen"]')
  const portrait = (await deviceScreen.boundingBox())!
  expect(portrait.width / portrait.height).toBeCloseTo(1080 / 2340, 2)
  await display.click()
  await page.getByRole('option', { name: /Tall phone/ }).click()
  await expect(display).toContainText('Tall phone')
  await display.click()
  await page.getByRole('option', { name: 'Custom dimensions' }).click()
  await expect(display).toContainText('Custom dimensions')
  const customWidth = page.getByRole('spinbutton', { name: 'Width', exact: true })
  await customWidth.fill('3000')
  await expect(page.getByText('3000 × 2160 px')).toBeVisible()
  const landscape = (await deviceScreen.boundingBox())!
  expect(landscape.width / landscape.height).toBeCloseTo(3000 / 2160, 2)
  await customWidth.clear()
  await expect(page.getByText('Enter valid dimensions and DPI.')).toBeVisible()
  const mode = page.getByRole('combobox', { name: 'Outbound access', exact: true })
  const destinations = page.getByRole('textbox', { name: 'Additional IPv4 destinations' })
  await destinations.fill('203.0.113.10')
  await mode.click()
  await page.getByRole('option', { name: 'Unrestricted', exact: true }).click()
  await expect(mode).toContainText('Unrestricted')
  await expect(destinations).toHaveCount(0)
  await mode.click()
  await page.getByRole('option', { name: 'Approved destinations only' }).click()
  await expect(mode).toContainText('Approved destinations only')
  await expect(destinations).toHaveValue('203.0.113.10')
})

for (const editor of ['app', 'runtime', 'user', 'group']) {
  test(`${editor} uses rounded sections and labels above controls`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await page.goto(`/skeleton-contract-test?editor=${editor}`)
    const card = page.locator('[data-surface="editor"]').first()
    await expect(card).toBeVisible()
    expect(await card.evaluate(node => parseFloat(getComputedStyle(node).borderRadius))).toBeGreaterThan(0)
    const field = card
      .locator('[data-editor-field]')
      .filter({ has: page.getByRole('textbox') })
      .first()
    const label = await field.locator('label').first().boundingBox()
    const input = await field.getByRole('textbox').first().boundingBox()
    expect(input!.y).toBeGreaterThan(label!.y + label!.height)
    expect(input!.x).toBe(label!.x)
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      await page.screenshot({
        path: `/tmp/rebroid-section-${editor}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    }
    await page.setViewportSize({ width: 390, height: 1000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  })
}

test('runtime panels align within the available console width', async ({ page }) => {
  for (const width of [390, 768, 1024, 1440, 1536, 2048]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=runtime')
    await page.locator('[data-editor]').evaluate(
      (editor, gutter) => {
        const node = editor as HTMLElement
        node.style.width = `calc(100% - ${gutter}px)`
        node.style.marginLeft = `${gutter}px`
      },
      width >= 1024 ? 288 : 0
    )
    const geometry = await page.getByRole('form', { name: 'Runtime defaults' }).evaluate(form => {
      const panels = Array.from(form.querySelectorAll('section[data-surface="editor"]')).map(panel => {
        const { top, bottom } = panel.getBoundingClientRect()
        return { top, bottom }
      })
      const timeout = form.querySelector('#runtime-inactivity-timeout')!.getBoundingClientRect()
      const limit = form.querySelector('#runtime-max-apk-size')!.getBoundingClientRect()
      return { panels, timeout: { x: timeout.x, y: timeout.y }, limit: { x: limit.x, y: limit.y } }
    })
    expect(geometry.panels).toHaveLength(3)
    for (const panel of geometry.panels) {
      for (const sibling of geometry.panels.filter(other => Math.abs(other.top - panel.top) < 1)) {
        expect(Math.abs(panel.bottom - sibling.bottom)).toBeLessThan(1)
      }
    }
    if (Math.abs(geometry.timeout.x - geometry.limit.x) > 1) {
      expect(Math.abs(geometry.timeout.y - geometry.limit.y)).toBeLessThan(1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.screenshot({
      path: `/tmp/rebroid-runtime-aligned-${width}-${test.info().project.name}.png`,
      animations: 'disabled'
    })
  }
})

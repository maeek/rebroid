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

test('general preferences keep descriptions beneath labels and preserve loading geometry', async ({ page }) => {
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=general-loading')
    const loading = await page.locator('[data-surface="editor"]').evaluateAll(sections =>
      sections.map(section => {
        const rect = section.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      })
    )
    await page.goto('/skeleton-contract-test?editor=general')
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

test('create editor stacks fields inside rounded sections', async ({ page }) => {
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=app')
    const name = await page.getByRole('textbox', { name: /Name/ }).boundingBox()
    for (const label of ['Runtime image', 'Display size', 'Mode']) {
      const control = page.getByRole('combobox', { name: label, exact: true })
      const bounds = await control.boundingBox()
      expect(bounds!.x).toBe(name!.x)
      expect(bounds!.width).toBe(name!.width)
    }
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({
        path: `/tmp/rebroid-editor-widths-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
    await page.goto('/skeleton-contract-test?editor=app-loading')
    const loadingRuntime = await page.locator('input[role="combobox"]').first().boundingBox()
    expect(loadingRuntime!.x).toBe(name!.x)
    expect(loadingRuntime!.width).toBe(name!.width)
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
  const icon = await page.getByText('APP', { exact: true }).boundingBox()
  const upload = await page.getByRole('button', { name: 'Choose App icon' }).boundingBox()
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
  await display.click()
  await page.getByRole('option', { name: /Tall phone/ }).click()
  await expect(display).toContainText('Tall phone')
  await display.click()
  await page.getByRole('option', { name: 'Custom dimensions' }).click()
  await expect(display).toContainText('Custom dimensions')
  await expect(page.getByRole('spinbutton', { name: 'Width', exact: true })).toBeVisible()
  const mode = page.getByRole('combobox', { name: 'Mode', exact: true })
  await mode.click()
  await page.getByRole('option', { name: 'Unrestricted outbound access' }).click()
  await expect(mode).toContainText('Unrestricted outbound access')
  await mode.click()
  await page.getByRole('option', { name: 'Only API plus allowlist' }).click()
  await expect(mode).toContainText('Only API plus allowlist')
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

import { expect, test } from '@playwright/test'

test('the account menu links directly to Preferences and Security', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=console-shell')
  const controls = page.getByRole('group', { name: 'Navigation controls', exact: true })
  const account = controls.getByRole('button', { name: /^Account(?::|$)/ })
  await expect(controls.getByRole('button', { name: 'Notifications' })).toBeVisible()
  await account.click()
  await expect(page.getByRole('menuitem', { name: 'Preferences' })).toHaveAttribute('href', '/preferences/general')
  await expect(page.getByRole('menuitem', { name: 'Security', exact: true })).toHaveAttribute(
    'href',
    '/preferences/security'
  )
  await expect(page.getByRole('menuitem', { name: 'Account overview', exact: true })).toHaveCount(0)
})

test('the account Appearance submenu matches its parent and fits beside it on narrow screens', async ({ page }) => {
  const mobile = page.viewportSize()!.width < 1024
  await page.setViewportSize(mobile ? { width: 320, height: 640 } : { width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto('/skeleton-contract-test?editor=console-shell')
  if (!mobile) {
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(page.getByRole('complementary', { name: 'Primary navigation' })).toHaveCSS('width', '64px')
  }

  const account = page.getByRole('button', { name: /^Account(?::|$)/ })
  await account.click()
  const trigger = page.getByRole('menuitem', { name: 'Appearance', exact: true })
  await expect(trigger).toHaveCSS('column-gap', '8px')
  await expect(trigger.locator(mobile ? '.tabler-icon-chevron-left' : '.tabler-icon-chevron-right')).toBeVisible()
  const menu = page.getByRole('menu').filter({ has: trigger })
  if (mobile) {
    await trigger.tap()
  } else {
    await trigger.press('ArrowRight')
  }

  const dark = page.getByRole('menuitemradio', { name: 'Dark', exact: true })
  const submenu = page.getByRole('menu', { name: 'Appearance', exact: true })
  await expect(submenu).toBeVisible()
  await expect(dark).toBeChecked()
  await expect(dark).toHaveCSS('column-gap', '8px')
  await expect(submenu).toHaveCSS(
    'background-color',
    await menu.evaluate(node => getComputedStyle(node).backgroundColor)
  )
  await expect(submenu).toHaveCSS(
    'border-top-color',
    await menu.evaluate(node => getComputedStyle(node).borderTopColor)
  )
  const parent = (await menu.boundingBox())!
  await expect
    .poll(async () => {
      const child = (await submenu.boundingBox())!
      const besideParent = mobile ? child.x + child.width < parent.x : child.x > parent.x + parent.width
      const { width, height } = page.viewportSize()!
      const fitsViewport =
        child.x >= 0 && child.y >= 0 && child.x + child.width <= width && child.y + child.height <= height
      return besideParent && fitsViewport
    })
    .toBe(true)

  await page.getByRole('menuitemradio', { name: 'OLED' }).click()
  await expect(page.locator('html')).toHaveClass(/\boled\b/)
})

test('personal preferences apply immediately or have their own save action', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=general-member')
  const theme = page.getByRole('combobox', { name: 'Theme' })
  await theme.click()
  await page.getByRole('option', { name: 'OLED' }).click()
  await expect(page.locator('html')).toHaveClass(/\boled\b/)
  await page.reload()
  await expect(theme).toHaveText('OLED')

  await page.getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page).toHaveURL(/#profile$/)
  await expect(page.getByRole('button', { name: 'Save photo' })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Multi-factor authentication' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Change password' })).toHaveCount(0)
  await expect(page.getByRole('spinbutton', { name: 'List refresh interval' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Console defaults' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
})

test('preferences use a consistent form column gap and stack fields on narrow screens', async ({ page }, testInfo) => {
  const narrow = testInfo.project.name === 'mobile-chromium'
  await page.setViewportSize({ width: narrow ? 390 : 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=security')
  const password = page.getByRole('region', { name: 'Change password', exact: true })
  const mfa = page.getByRole('region', { name: 'Multi-factor authentication', exact: true })
  const pairs = [
    [mfa, password],
    [password.getByLabel('New password', { exact: true }), password.getByLabel('Confirm new password', { exact: true })]
  ]

  for (const [first, second] of pairs) {
    await expect(first).toBeVisible()
    await expect(second).toBeVisible()
    const firstBox = (await first.boundingBox())!
    const secondBox = (await second.boundingBox())!
    if (narrow) {
      expect(secondBox.x).toBeCloseTo(firstBox.x, 0)
      expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height)
    } else {
      expect(secondBox.x - firstBox.x - firstBox.width).toBeCloseTo(32, 0)
    }
  }
})

test('shared defaults have a scoped save and confirmed restore', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=console-defaults')
  await expect(page.getByRole('heading', { level: 1, name: 'Console defaults' })).toBeVisible()
  const defaults = page.locator('[data-editor]')
  const save = defaults.getByRole('button', { name: 'Save defaults' })
  await expect(save).toBeDisabled()
  await defaults.getByRole('spinbutton', { name: 'List refresh interval' }).fill('12')
  await expect(save).toBeEnabled()
  await defaults.getByRole('button', { name: 'Restore defaults' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Restore console defaults?' })
  await expect(confirmation).toContainText('for everyone')
  await confirmation.getByRole('button', { name: 'Cancel' }).click()
  await expect(defaults.getByRole('spinbutton', { name: 'List refresh interval' })).toHaveValue('12')
})

for (const editor of ['general', 'security']) {
  test(`${editor} preferences preserve their own loading geometry`, async ({ page }) => {
    await page.goto(`/skeleton-contract-test?editor=${editor}-loading`)
    const geometry = () =>
      page.locator('[data-surface="editor"]').evaluateAll(sections =>
        sections.map(section => {
          const { x, y, width, height } = section.getBoundingClientRect()
          return { x, y, width, height }
        })
      )
    const loading = await geometry()
    await page.goto(`/skeleton-contract-test?editor=${editor}`)
    expect(await geometry()).toEqual(loading)
    await expect(page.getByRole('spinbutton', { name: 'List refresh interval' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save defaults' })).toHaveCount(0)
    if (editor === 'security') {
      await expect(page.getByRole('button', { name: 'Set up MFA' })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Change password' })).toBeDisabled()
      await expect(page.getByRole('combobox', { name: 'Theme' })).toHaveCount(0)
    }
  })
}

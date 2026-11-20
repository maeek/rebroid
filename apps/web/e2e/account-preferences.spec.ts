import { expect, test } from '@playwright/test'

test('the desktop account menu links directly to Preferences and Security', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/skeleton-contract-test?editor=console-shell')
  const controls = page.getByRole('group', { name: 'Navigation controls', exact: true })
  const account = controls.getByRole('button', { name: /^Account(?::|$)/ })
  await expect(controls.getByRole('button')).toHaveCount(1)
  await expect(controls).toHaveCSS('border-top-width', '0px')
  await account.click()
  const menu = page.getByRole('menu')
  await expect(menu).toHaveCSS('border-top-width', '0px')
  await expect(menu).toHaveAttribute('data-side', 'top')
  const anchor = (await account.boundingBox())!
  const popup = (await menu.boundingBox())!
  expect(popup.x).toBeCloseTo(anchor.x, 0)
  expect(popup.width).toBeCloseTo(anchor.width, 0)
  expect(anchor.y - (popup.y + popup.height)).toBeCloseTo(8, 0)
  await expect(page.getByRole('menuitem', { name: 'Preferences' })).toHaveAttribute('href', '/preferences/general')
  await expect(page.getByRole('menuitem', { name: 'Security', exact: true })).toHaveAttribute(
    'href',
    '/preferences/security'
  )
  await expect(page.getByRole('menuitem', { name: 'Account overview', exact: true })).toHaveCount(0)
})

test('the desktop Theme picker reuses the account popup and keeps the current selection visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto('/skeleton-contract-test?editor=console-shell')
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(page.getByRole('complementary', { name: 'Primary navigation' })).toHaveCSS('width', '64px')

  const account = page.getByRole('button', { name: /^Account(?::|$)/ })
  await account.click()
  const trigger = page.getByRole('menuitem', { name: /^Theme/ })
  await expect(trigger).toHaveText('ThemeDark')
  const menu = page.getByRole('menu')
  const initialMenuId = await menu.getAttribute('id')
  await trigger.press('ArrowRight')

  const dark = page.getByRole('menuitemradio', { name: 'Dark', exact: true })
  await expect(menu).toHaveCount(1)
  const themes = menu.getByRole('group', { name: 'Theme' })
  await expect(themes).toBeVisible()
  expect(await menu.getAttribute('id')).toBe(initialMenuId)
  await expect(menu).toHaveAttribute('data-side', 'right')
  await expect(menu.getByRole('menuitemradio')).toHaveText(['System', 'Light', 'Dark', 'OLED'])
  await expect(dark).toBeChecked()
  await expect(dark).toBeFocused()

  const oled = page.getByRole('menuitemradio', { name: 'OLED', exact: true })
  await page.keyboard.press('ArrowDown')
  await expect(oled).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(oled).toBeChecked()
  await expect(page.locator('html')).toHaveClass(/\boled\b/)
  await expect(themes).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveText('ThemeOLED')
  await trigger.click()
  await menu.getByRole('menuitem', { name: 'Back to account menu' }).click()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(account).toBeFocused()
})

test('the mobile More drawer starts with an account entry that opens inline Theme choices', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto('/skeleton-contract-test?editor=console-shell')
  const more = page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('button', { name: 'More' })
  await more.click()

  const navigation = page.getByRole('dialog', { name: 'Navigation' })
  const entry = navigation.getByRole('button', { name: 'Account: Preview operator' })
  await expect(entry).toBeInViewport()
  expect((await entry.boundingBox())!.y).toBeLessThan(
    (await navigation.getByRole('link', { name: 'All apps', exact: true }).boundingBox())!.y
  )
  await entry.click()
  const drawer = page.getByRole('dialog', { name: 'Account', exact: true })
  const account = drawer.getByRole('region', { name: 'Account' })
  const back = drawer.getByRole('button', { name: 'Back to More' })
  await expect(back).toBeFocused()
  await expect(account.getByText('Preview operator', { exact: true })).toBeVisible()
  await expect(account.getByRole('link', { name: 'Preferences' })).toHaveAttribute('href', '/preferences/general')
  await expect(account.getByRole('link', { name: 'Security' })).toHaveAttribute('href', '/preferences/security')
  await expect(drawer.getByRole('menu')).toHaveCount(0)

  const logout = account.getByRole('button', { name: 'Log out' })
  await logout.scrollIntoViewIfNeeded()
  await expect(logout).toBeInViewport()
  const theme = account.getByRole('group', { name: 'Theme' })
  await expect(theme.getByRole('radio')).toHaveCount(4)
  const dark = theme.getByRole('radio', { name: 'Dark' })
  const oled = theme.getByRole('radio', { name: 'OLED' })
  await expect(dark).toBeChecked()
  await dark.press('ArrowRight')
  await expect(oled).toBeChecked()
  await expect(page.locator('html')).toHaveClass(/\boled\b/)
  await expect(oled).toBeFocused()
  const { x, width } = (await theme.boundingBox())!
  expect(x).toBeGreaterThanOrEqual(0)
  expect(x + width).toBeLessThanOrEqual(320)
  await back.click()
  await expect(entry).toBeFocused()
  await entry.click()
  await expect(oled).toBeChecked()

  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(more).toBeFocused()
  await more.click()
  await expect(entry).toBeInViewport()
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
    [password, mfa],
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
      expect(secondBox.y).toBeCloseTo(firstBox.y, 0)
      expect(secondBox.height).toBeCloseTo(firstBox.height, 0)
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

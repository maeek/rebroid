import { expect, test } from '@playwright/test'

test('the account overview and preferences have distinct destinations', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=console-shell')
  const controls = page.getByRole('group', { name: 'Navigation controls', exact: true })
  const account = controls.getByRole('button', { name: 'Account', exact: true })
  await expect(controls.getByRole('button', { name: 'Notifications' })).toBeVisible()
  await account.click()
  await expect(page.getByRole('menuitem', { name: 'Preferences' })).toHaveAttribute('href', '/preferences/general')
  await page.getByRole('menuitem', { name: 'Account overview' }).click()

  const dialog = page.getByRole('dialog', { name: 'Account overview' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('preview-operator')).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'Edit profile photo' })).toHaveAttribute(
    'href',
    '/preferences/general#profile'
  )
  await expect(dialog.getByRole('link', { name: 'Manage sign-in' })).toHaveAttribute(
    'href',
    '/preferences/general#security'
  )
  await expect(dialog.locator('input')).toHaveCount(0)
  const [profile, security] = await dialog
    .getByRole('region', { name: /^(Profile|Sign-in security)$/ })
    .evaluateAll(sections =>
      sections.map(section => {
        const { x, y } = section.getBoundingClientRect()
        return { x, y }
      })
    )
  const viewport = page.viewportSize()!
  if (viewport.width >= 640) {
    expect(profile.y).toBe(security.y)
    expect((await dialog.boundingBox())!.width).toBeGreaterThan(512)
  } else {
    expect(profile.x).toBe(security.x)
    expect(security.y).toBeGreaterThan(profile.y)
  }

  const backdrop = page.locator('[data-slot="dialog-overlay"]')
  await expect(backdrop).toHaveCSS('opacity', '1')
  const samples = page.evaluate(async () => {
    const values: number[] = []
    const start = performance.now()
    await new Promise<void>(resolve => {
      const sample = () => {
        const overlay = document.querySelector('[data-slot="dialog-overlay"]')
        values.push(overlay ? Number(getComputedStyle(overlay).opacity) : 0)
        if (performance.now() - start < 500) requestAnimationFrame(sample)
        else resolve()
      }
      requestAnimationFrame(sample)
    })
    return values
  })
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(backdrop).toHaveCount(0)
  await expect(account).toBeFocused()
  const opacity = await samples
  expect(opacity.some(value => value > 0 && value < 1)).toBe(true)
  for (let index = 1; index < opacity.length; index++) {
    expect(opacity[index]).toBeLessThanOrEqual(opacity[index - 1] + 0.01)
  }
})

test('the account Theme submenu matches its parent and fits beside it on narrow screens', async ({ page }) => {
  const mobile = page.viewportSize()!.width < 1024
  await page.setViewportSize(mobile ? { width: 320, height: 640 } : { width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto('/skeleton-contract-test?editor=console-shell')
  if (!mobile) {
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(page.getByRole('complementary', { name: 'Primary navigation' })).toHaveCSS('width', '64px')
  }

  const account = page.getByRole('button', { name: 'Account', exact: true })
  await account.click()
  const trigger = page.getByRole('menuitem', { name: 'Theme', exact: true })
  await expect(trigger.locator(mobile ? '.tabler-icon-chevron-left' : '.tabler-icon-chevron-right')).toBeVisible()
  const menu = page.getByRole('menu').filter({ has: trigger })
  if (mobile) {
    await trigger.tap()
  } else {
    await trigger.press('ArrowRight')
  }

  const dark = page.getByRole('menuitemradio', { name: 'Dark', exact: true })
  const submenu = page.getByRole('menu', { name: 'Theme', exact: true })
  await expect(submenu).toBeVisible()
  await expect(dark).toBeChecked()
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
  await page.getByRole('link', { name: 'Security', exact: true }).click()
  await expect(page).toHaveURL(/#security$/)
  await expect(page.getByRole('button', { name: 'Set up MFA' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Change password' })).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Console defaults' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
})

test('shared defaults have a scoped save and confirmed restore', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=general')
  const defaults = page.getByRole('region', { name: 'Console defaults' })
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

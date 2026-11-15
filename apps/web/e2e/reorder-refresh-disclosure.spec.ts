import { expect, test } from '@playwright/test'

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`refresh confirms success without changing geometry (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/skeleton-contract-test?editor=reorder-refresh-disclosure')
    const refresh = page.getByRole('button', { name: 'Refresh', exact: true })
    const bounds = await refresh.boundingBox()
    await page.getByRole('button', { name: 'Complete refresh' }).click()
    await expect(refresh.locator('svg')).toHaveAttribute('data-refresh-state', 'idle')
    await refresh.click()
    await expect(refresh).toBeDisabled()
    expect(await refresh.boundingBox()).toEqual(bounds)
    if (reducedMotion === 'reduce') await expect(refresh.locator('svg')).toHaveCSS('animation-name', 'none')
    await page.getByRole('button', { name: 'Complete refresh' }).click()
    await expect(refresh.locator('svg')).toHaveAttribute('data-refresh-state', 'confirmed')
    expect(await refresh.boundingBox()).toEqual(bounds)
    await refresh.click()
    await page.getByRole('button', { name: 'Fail refresh' }).click()
    await expect(refresh.locator('svg')).toHaveAttribute('data-refresh-state', 'idle')
    expect(await refresh.boundingBox()).toEqual(bounds)
  })

  test(`reorder follows the item across pages and retains focus (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/skeleton-contract-test?editor=reorder-refresh-disclosure')
    const table = page.getByRole('table')
    const firstMove = page.getByRole('button', { name: 'Move Group 1 later' })
    await firstMove.focus()
    const bounds = await table.boundingBox()
    await page.keyboard.press('Enter')
    await expect(firstMove).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: 'Group 1 moved' })).toHaveText(
      'Group 1 moved to position 2.'
    )
    expect(await table.boundingBox()).toEqual(bounds)
    const row = page.locator('[data-reorder-id="Group 1"]')
    await expect(row).not.toHaveCSS('box-shadow', 'none')
    if (reducedMotion === 'reduce') await expect(row).toHaveCSS('animation-name', 'none')
    const crossPage = page.getByRole('button', { name: 'Move Group 5 later' })
    await crossPage.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('6–7 of 7')).toBeVisible()
    await expect(crossPage).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: 'Group 5 moved' })).toHaveText(
      'Group 5 moved to position 6.'
    )
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Move Group 5 earlier' })).toBeFocused()
    await expect(crossPage).toBeDisabled()
  })

  test(`disclosures preserve drafts and isolate nested chevrons (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/skeleton-contract-test?editor=reorder-refresh-disclosure')
    const section = page.getByRole('region', { name: 'Advanced settings' })
    const trigger = page.getByRole('button', { name: 'Advanced settings' })
    const original = await section.boundingBox()
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('textbox', { name: 'Retained draft' }).fill('Keep this edit')
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect.poll(async () => (await section.boundingBox())?.height).toBe(original?.height)
    await trigger.click()
    await expect(page.getByRole('textbox', { name: 'Retained draft' })).toHaveValue('Keep this edit')
    const parent = page.locator('summary').filter({ hasText: /^Event details$/ })
    const nested = page.locator('summary').filter({ hasText: /^Nested details$/ })
    await parent.focus()
    await page.keyboard.press('Space')
    await expect(parent.locator('svg')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
    await expect(nested.locator('svg')).toHaveCSS('transform', 'matrix(0, -1, 1, 0, 0, 0)')
    if (reducedMotion === 'reduce') {
      await expect(parent.locator('svg')).toHaveCSS('transition-duration', '0s')
      await expect(trigger.locator('svg')).toHaveCSS('transition-duration', '0s')
    }
    await nested.click()
    await expect(page.getByText('Event payload')).toBeVisible()
    await expect(nested.locator('svg')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.screenshot({
      path: `/tmp/rebroid-reorder-${test.info().project.name}-${reducedMotion}.png`,
      fullPage: true
    })
  })
}

test('workflow move controls keep the outline in place and announce the move', async ({ page, isMobile }) => {
  await page.goto('/skeleton-contract-test?editor=workflow')
  const rows = page.locator('[data-automation-step-item=true][data-reorder-id]')
  const firstId = await rows.first().getAttribute('data-reorder-id')
  if (isMobile) {
    await rows.first().getByRole('button', { name: 'Step menu' }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: 'Move step down' }).focus()
    await page.keyboard.press('Enter')
  } else {
    await rows.first().getByRole('button', { name: 'Move step down' }).focus()
    await page.keyboard.press('Enter')
  }
  await expect(rows.nth(1)).toHaveAttribute('data-reorder-id', firstId!)
  await expect(page.getByRole('status').filter({ hasText: 'moved to position 2.' })).toBeVisible()
  await expect(rows.nth(1).getByRole('button', { name: isMobile ? 'Step menu' : 'Move step down' })).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Daily inventory check' })).toBeVisible()
})

test('dropping a workflow step highlights its destination without opening the inspector', async ({
  page,
  isMobile
}) => {
  test.skip(isMobile, 'Pointer drag is covered on desktop; touch uses the tested move menu.')
  await page.goto('/skeleton-contract-test?editor=workflow')
  const rows = page.locator('[data-automation-step-item=true][data-reorder-id]')
  const firstId = await rows.first().getAttribute('data-reorder-id')
  const handle = rows.first().getByRole('button', { name: 'Drag step' })
  await rows.last().scrollIntoViewIfNeeded()
  await handle.scrollIntoViewIfNeeded()
  const from = (await handle.boundingBox())!
  const to = (await rows.nth(2).boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 8)
  await expect(rows.first()).toHaveClass(/opacity-0/)
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 4, { steps: 12 })
  await page.mouse.up()
  await expect(rows.last()).toHaveAttribute('data-reorder-id', firstId!)
  await expect(page.getByRole('status').filter({ hasText: 'moved to position 3.' })).toBeVisible()
  await expect(rows.last()).not.toHaveCSS('box-shadow', 'none')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

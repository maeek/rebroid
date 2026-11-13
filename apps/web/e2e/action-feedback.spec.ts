import { expect, test } from '@playwright/test'

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`action feedback keeps compact controls and respects ${reducedMotion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/skeleton-contract-test?editor=action-feedback')
    for (const size of ['sm', 'md', 'lg', 'icon-sm', 'icon-md', 'text']) {
      const buttons = page.getByTestId(`button-sizing-${size}`).getByRole('button')
      const reference = await buttons.first().boundingBox()
      const animated = await buttons.last().boundingBox()
      expect(animated!.width).toBe(reference!.width)
      expect(animated!.height).toBe(reference!.height)
      if (size !== 'text') {
        const referenceIcon = await buttons.first().locator('svg').boundingBox()
        const animatedIcon = await buttons.last().locator('[data-active="true"] svg').boundingBox()
        expect(animatedIcon!.x - animated!.x).toBe(referenceIcon!.x - reference!.x)
      }
    }
    const save = page.getByRole('button', { name: 'Save', exact: true })
    const initial = await save.boundingBox()
    await save.click()
    const pending = page.getByRole('button', { name: 'Saving…', exact: true })
    await expect(pending).toBeDisabled()
    expect((await pending.boundingBox())!.width).toBeGreaterThan(initial!.width)
    expect((await pending.boundingBox())!.height).toBe(initial!.height)
    await page.getByRole('button', { name: 'Confirm save' }).click()
    const saved = page.getByRole('button', { name: 'Saved', exact: true })
    await expect(saved).toBeVisible()
    expect((await saved.boundingBox())!.height).toBe(initial!.height)
    expect(
      await saved.locator('[data-active="true"]').evaluate(element => getComputedStyle(element).transitionDuration)
    ).toBe(reducedMotion === 'reduce' ? '0s' : '0.16s')

    await page.getByRole('textbox', { name: 'Name' }).fill('Changed app')
    await expect(save).toBeVisible()
    expect((await save.boundingBox())!.width).toBe(initial!.width)
    await save.click()
    await page.getByRole('button', { name: 'Fail save' }).click()
    await expect(save).toBeVisible()
    await expect(page.getByRole('button', { name: 'Saved', exact: true })).toHaveCount(0)

    const queued = page.getByText('Queued', { exact: true })
    expect(await queued.evaluate(element => getComputedStyle(element).animationName)).toBe('none')
    await page.getByRole('button', { name: 'Advance run' }).click()
    await page.getByRole('button', { name: 'Advance run' }).click()
    const completed = page.getByText('Completed', { exact: true })
    await expect(completed).toBeVisible()
    const animation = await completed.evaluate(element => getComputedStyle(element).animationName)
    if (reducedMotion === 'reduce') expect(animation).toBe('none')
    else expect(animation).not.toBe('none')

    const progress = page.getByRole('progressbar')
    const track = await progress.boundingBox()
    await page.getByRole('button', { name: 'Update progress' }).click()
    await expect(progress).toHaveAttribute('aria-valuenow', '80')
    expect((await progress.boundingBox())!.height).toBe(track!.height)
    expect(await progress.locator('div').evaluate(element => getComputedStyle(element).transitionDuration)).toBe(
      reducedMotion === 'reduce' ? '0s' : '0.2s'
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.screenshot({
      path: `/tmp/rebroid-action-feedback-${test.info().project.name}-${reducedMotion}.png`,
      fullPage: true
    })
  })
}

test('app header keeps its Start split button compact', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=action-feedback')
  const reference = await page.getByTestId('button-sizing-md').getByRole('button').first().boundingBox()
  await page.goto('/skeleton-contract-test?editor=app-resource')
  const start = page.getByRole('button', { name: 'Start', exact: true })
  const primary = await start.boundingBox()
  // The joined primary button omits its right border.
  expect(primary!.width).toBe(reference!.width - 1)
  expect(primary!.height).toBe(reference!.height)
  await expect(page.getByRole('button', { name: 'Runtime actions', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  await page.screenshot({ path: `/tmp/rebroid-power-sizing-${test.info().project.name}.png`, fullPage: true })
})

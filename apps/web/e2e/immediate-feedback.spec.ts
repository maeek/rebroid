import { expect, test } from '@playwright/test'

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`immediate saves and composer feedback retain geometry (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.goto('/skeleton-contract-test?editor=immediate-feedback')
    const control = page.getByRole('switch', { name: 'Enable task' })
    const switchArea = page.locator('[data-slot=mutation-switch]')
    const originalSwitch = await switchArea.boundingBox()
    await control.click()
    await expect(control).toHaveAttribute('aria-busy', 'true')
    await expect(control).not.toBeChecked()
    expect(await switchArea.boundingBox()).toEqual(originalSwitch)
    await page.getByRole('button', { name: 'Confirm save' }).click()
    await expect(control).toBeChecked()
    await expect(switchArea.getByRole('status')).toHaveText('Saved')
    expect(await switchArea.boundingBox()).toEqual(originalSwitch)
    await control.click()
    await page.getByRole('button', { name: 'Fail save' }).click()
    await expect(control).toBeEnabled()
    await expect(control).toBeChecked()
    await expect(switchArea.getByRole('status')).toBeEmpty()
    const composer = page.locator('[data-slot=ai-prompt-composer]')
    const input = page.getByRole('textbox', { name: 'Message' })
    const send = page.getByRole('button', { name: 'Send message', exact: true })
    const stop = page.getByRole('button', { name: 'Stop', exact: true })
    const canceling = page.getByRole('button', { name: 'Canceling', exact: true })
    const composerBounds = await composer.boundingBox()
    const actionBounds = await send.boundingBox()
    await send.click()
    await expect(input).toBeFocused()
    await expect(stop).toBeVisible()
    expect(await composer.boundingBox()).toEqual(composerBounds)
    expect(await stop.boundingBox()).toEqual(actionBounds)
    await stop.click()
    await expect(canceling).toBeDisabled()
    expect(await canceling.boundingBox()).toEqual(actionBounds)
    await page.getByRole('button', { name: 'Show status' }).click()
    expect(await composer.boundingBox()).toEqual(composerBounds)
    const status = page.locator('[data-slot=composer-status]')
    await input.focus()
    await page.keyboard.press('Tab')
    await expect(status).toBeFocused()
    const fullStatus = page.getByText('Device stopped. Start this app to send a new message.', { exact: true })
    await expect(fullStatus).toHaveCount(2)
    await expect(fullStatus.last()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    await page.screenshot({
      path: `/tmp/rebroid-immediate-${test.info().project.name}-${reducedMotion}.png`,
      fullPage: true
    })
  })

  test(`toasts coalesce and use quiet motion (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion })
    await page.addInitScript(() => {
      document.addEventListener('transitionrun', event => {
        const toast = event.target
        if (
          toast instanceof HTMLElement &&
          toast.dataset.testid === 'toast-success' &&
          event.propertyName === 'transform'
        ) {
          toast.dataset.slideStarted = 'true'
        }
      })
    })
    await page.goto('/skeleton-contract-test?editor=immediate-feedback')
    const button = page.getByRole('button', { name: 'Show toast' })
    const original = await button.boundingBox()
    await button.click()
    await button.click()
    const notice = page.getByTestId('toast-success')
    await expect(notice).toHaveCount(1)
    await expect(notice).toHaveCSS('opacity', '1')
    await expect(notice).toHaveCSS('transition-duration', reducedMotion === 'reduce' ? '0s' : '0.14s, 0.14s')
    if (reducedMotion === 'reduce') {
      await expect(notice).toHaveCSS('transform', 'none')
      await expect(notice).not.toHaveAttribute('data-slide-started')
    } else {
      await expect(notice).toHaveAttribute('data-slide-started', 'true')
    }
    expect(await button.boundingBox()).toEqual(original)
    await expect(notice.getByRole('button', { name: 'Close' })).toHaveCSS('opacity', '0.7')
    await notice.getByRole('button', { name: 'Close' }).click()
    await expect(notice).toHaveCount(0)
  })
}

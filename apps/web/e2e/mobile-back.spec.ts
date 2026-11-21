import { expect, test } from '@playwright/test'

const previous = '/skeleton-contract-test?editor=console-shell&workflows=1'
const shell = '/skeleton-contract-test?editor=console-shell'

test.use({ viewport: { width: 390, height: 844 } })

test('Back returns from Account to More, then closes More before leaving the page', async ({ page }) => {
  await page.goto(previous)
  await page.goto(shell)
  const more = page.getByRole('button', { name: 'More', exact: true })
  await more.click()
  const navigation = page.getByRole('dialog', { name: 'Navigation', exact: true })
  const account = navigation.getByRole('button', { name: 'Account: Preview operator' })
  await account.click()
  await expect(page.getByRole('dialog', { name: 'Account', exact: true })).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL(shell)
  await expect(account).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(shell)
  await expect(navigation).toBeHidden()
  await expect(more).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(previous)
})

test('explicit close and Escape do not leave spare Back steps', async ({ page }) => {
  await page.goto(previous)
  await page.goto(shell)
  const more = page.getByRole('button', { name: 'More', exact: true })
  const navigation = page.getByRole('dialog', { name: 'Navigation', exact: true })
  await more.click()
  await navigation.getByRole('button', { name: 'Close navigation' }).click()
  await expect(navigation).toBeHidden()
  await more.click()
  await expect(navigation).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(navigation).toBeHidden()
  await page.goBack()
  await expect(page).toHaveURL(previous)
})

test('Back dismisses viewer settings and returns from Device without leaving the app', async ({ page }) => {
  const app = '/skeleton-contract-test?editor=app-resource'
  await page.goto(previous)
  await page.goto(app)
  const device = page.getByRole('button', { name: 'Device', exact: true })
  await device.click()
  const settings = page.getByRole('button', { name: 'Streaming settings' })
  await settings.click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toContainText('Viewer quality, transport, and audio')

  await page.goBack()
  await expect(page).toHaveURL(app)
  await expect(sheet).toBeHidden()
  await expect(settings).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(app)
  await expect(device).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(previous)
})

test('updates the current page behind an open viewer sheet', async ({ page }) => {
  const app = '/skeleton-contract-test?editor=app-resource'
  const updatedApp = `${app}&app-name=Updated+device`
  await page.goto(previous)
  await page.goto(app)
  const device = page.getByRole('button', { name: 'Device', exact: true })
  await device.click()
  await page.getByRole('button', { name: 'Streaming settings' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toBeVisible()
  await page.evaluate(href => window.history.replaceState(null, '', href), updatedApp)
  await expect(page).toHaveURL(updatedApp)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window.history.state as { rebroidBackLayer?: { href: string } } | null
        return state?.rebroidBackLayer?.href === window.location.href
      })
    )
    .toBe(true)
  await expect(sheet).toBeVisible()

  await page.goBack()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(updatedApp)
  await page.goBack()
  await expect(device).toBeVisible()
  await expect(page).toHaveURL(updatedApp)
  await page.goBack()
  await expect(page).toHaveURL(previous)
})

test('Back dismisses a standalone dialog and keeps the form values', async ({ page }) => {
  const app = '/skeleton-contract-test?editor=app'
  await page.route('**/api/bff/apks', route => route.fulfill({ json: { ok: true, data: [], requestId: 'test' } }))
  await page.goto(previous)
  await page.goto(app)
  const name = page.getByRole('textbox', { name: /Name/ })
  const picker = page.getByRole('button', { name: 'Saved APKs' })
  await name.fill('Keep this draft')
  await picker.click()
  const dialog = page.getByRole('dialog', { name: 'Choose a saved APK' })
  await expect(dialog).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(app)
  await expect(dialog).toBeHidden()
  await expect(picker).toBeFocused()
  await expect(name).toHaveValue('Keep this draft')
})

test('Back respects a dialog dismissal guard while a workflow is being queued', async ({ page }) => {
  const workflows = '/skeleton-contract-test?editor=app-resource&view=workflows'
  const started = Promise.withResolvers<void>()
  const finish = Promise.withResolvers<void>()
  await page.route('**/api/bff/automations/runnable-options', route =>
    route.fulfill({ json: { ok: true, data: [{ id: 'workflow-1', name: 'Inspect settings' }], requestId: 'test' } })
  )
  await page.route('**/skeleton-contract-test?editor=app-resource&view=workflows', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    started.resolve()
    await finish.promise
    await route.abort()
  })

  await page.goto(previous)
  await page.goto(workflows)
  await page.getByRole('button', { name: 'Run workflow', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Run workflow', exact: true })
  await dialog.getByRole('button', { name: 'Run workflow', exact: true }).click()
  await started.promise

  await page.goBack()
  await expect(page).toHaveURL(workflows)
  await expect(dialog.getByRole('button', { name: 'Queuing…' })).toBeDisabled()
  finish.resolve()
  await expect(dialog.getByRole('button', { name: 'Run workflow', exact: true })).toBeEnabled()
  await page.goBack()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(workflows)
})

test('Back protects configuration edits and discards only after confirmation', async ({ page }) => {
  const configuration = '/skeleton-contract-test?editor=app-resource&view=configuration'
  await page.goto(previous)
  await page.goto(configuration)
  const name = page.getByRole('textbox', { name: /^Name/ })
  await name.fill('Keep this name')

  const confirmation = page.getByRole('dialog', { name: 'Leave without saving?' })
  await page.goBack()
  await expect(page).toHaveURL(configuration)
  await expect(confirmation).toBeVisible()
  await page.goBack()
  await expect(confirmation).toBeHidden()
  await expect(name).toHaveValue('Keep this name')

  await page.goBack()
  await confirmation.getByRole('button', { name: 'Leave page' }).click()
  await expect(page).toHaveURL(previous)
})

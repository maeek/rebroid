import { expect, test, type WebSocketRoute } from '@playwright/test'

const id = '76e85cb0-135b-4ca0-9782-bcb7233b4672'
const run = {
  id,
  automationId: 'workflow-1',
  automationName: 'Check inventory',
  automationTriggerId: null,
  ownerUserId: 'owner-1',
  targetDeviceId: 'preview-app',
  targetProfileName: 'default',
  targetProfileMode: 'persistent',
  trigger: 'manual',
  status: 'failed',
  startedAt: null,
  completedAt: '2026-11-11T12:00:03Z',
  createdAt: '2026-11-11T12:00:00Z',
  updatedAt: '2026-11-11T12:00:03Z',
  error: 'The web service could not be reached to authorize this workflow.',
  failureCode: 'authorization_unreachable',
  failureRequestId: 'authorization-request-1',
  stepResults: []
}

test('app run history refresh stays beside search while the request is pending', async ({ page }) => {
  const history = '**/api/bff/devices/preview-app/workflow-runs?*'
  let holdRefresh: Promise<void> | undefined
  await page.route(history, async route => {
    await holdRefresh
    await route.fulfill({ json: { ok: true, data: { items: [], total: 0, pageSize: 25 }, requestId: 'test' } })
  })

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 960 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto('/skeleton-contract-test?editor=app-resource&view=workflows')
    await expect(page.getByText('No workflow runs yet')).toBeVisible()
    const search = page.getByRole('searchbox', { name: 'Search workflows or run IDs' })
    const refresh = page.getByRole('button', { name: 'Refresh', exact: true })
    await expect(refresh).toBeEnabled()
    const searchBox = (await search.boundingBox())!
    const refreshBox = (await refresh.boundingBox())!
    expect(refreshBox).toMatchObject({ width: 44, height: 44 })
    expect(refreshBox.x).toBeGreaterThanOrEqual(searchBox.x + searchBox.width)
    expect(refreshBox.y + refreshBox.height / 2).toBeCloseTo(searchBox.y + searchBox.height / 2)
    await expect(refresh).toHaveText('')

    const request = Promise.withResolvers<void>()
    holdRefresh = request.promise
    try {
      await refresh.click()
      await expect(refresh).toHaveAttribute('aria-busy', 'true')
      await expect(refresh).toBeDisabled()
      expect(await refresh.boundingBox()).toEqual(refreshBox)
      expect(await search.boundingBox()).toEqual(searchBox)
      await expect(refresh.locator('svg')).toHaveCSS('animation-name', 'spin')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await expect(refresh.locator('svg')).toHaveCSS('animation-name', 'none')
    } finally {
      request.resolve()
      holdRefresh = undefined
    }
    await expect(refresh).toBeEnabled()
    await expect(refresh.locator('svg')).toHaveAttribute('data-refresh-state', 'confirmed')
    expect(await refresh.boundingBox()).toEqual(refreshBox)
  }
})

test('app run history survives reload and opens summary and events beside the same device', async ({ page }, info) => {
  const narrow = info.project.name === 'mobile-chromium'
  await page.setViewportSize({ width: narrow ? 390 : 1440, height: 960 })
  const appUrl = '/skeleton-contract-test?editor=app-resource&view=workflows'
  const history = '**/api/bff/devices/preview-app/workflow-runs'
  await page.route(`${history}?*`, route =>
    route.fulfill({ json: { ok: true, data: { items: [run], total: 1, pageSize: 25 }, requestId: 'test' } })
  )
  await page.route(`${history}/${id}`, route => route.fulfill({ json: { ok: true, data: run, requestId: 'test' } }))
  await page.route(`**/api/bff/automations/runs/${id}/events?*`, route =>
    route.fulfill({
      json: {
        ok: true,
        requestId: 'test',
        data: {
          nextAfter: null,
          events: [
            {
              id: 'event-1',
              runId: id,
              sequence: 1,
              type: 'run.failed',
              message: run.error,
              data: { code: run.failureCode, requestId: run.failureRequestId },
              createdAt: run.completedAt
            }
          ]
        }
      }
    })
  )

  const previous = '/skeleton-contract-test?editor=console-shell'
  await page.goto(previous)
  await page.goto(appUrl)
  const device = page.getByLabel('Android device')
  const expectDevicePane = async () => {
    if (narrow) {
      await expect(device).toBeHidden()
      await expect(page.getByRole('button', { name: 'Device', exact: true })).toBeEnabled()
    } else {
      await expect(device).toBeVisible()
    }
  }
  await expectDevicePane()
  await device.evaluate(element => element.setAttribute('data-workflow-test-mounted', 'true'))
  const link = page.getByRole('link', { name: 'Check inventory', exact: true })
  const search = page.getByPlaceholder('Search workflows or run IDs')
  await search.fill('inventory')
  await search.press('Enter')
  await link.click()
  await expect(page).toHaveURL(new RegExp(`[?&]run=${id}`))
  await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true')
  const failure = page.getByRole('region', { name: 'Check inventory', exact: true }).getByRole('alert')
  await expect(failure).toContainText('Workflow authorization service is unreachable')
  await expect(failure).toContainText('then run the workflow again')
  await expect(page.getByRole('region', { name: 'Run summary' })).toContainText(run.failureRequestId)
  await expect(page.getByRole('link', { name: 'Open full trace' })).toHaveAttribute(
    'href',
    `/automations/workflow-1/traces?run=${id}`
  )
  await expect(device).toHaveAttribute('data-workflow-test-mounted', 'true')
  await expectDevicePane()
  await page.getByRole('button', { name: 'Run history', exact: true }).click()
  await expect(link).toBeFocused()
  await expect(search).toHaveValue('inventory')

  await page.goBack()
  await expect(page).toHaveURL(previous)
  await page.goForward()
  await expect(page).toHaveURL(appUrl)

  await link.click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Check inventory', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Events' }).click()
  const log = page.getByRole('log')
  await log.getByText('Workflow authorization service is unreachable', { exact: true }).click()
  await expect(log.getByText(run.failureRequestId)).toBeVisible()
  await expect(log.getByText(/check the connection/)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width
  )
  await expectDevicePane()
  await page.getByRole('button', { name: 'Run history', exact: true }).click()
  await expect(link).toBeVisible()
  await page.reload()
  await expect(link).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width
  )
})

test('workflow loading keeps the device and the requested run view', async ({ page }) => {
  const url = '/skeleton-contract-test?editor=app-resource-loading&view=workflows'
  const device = page.getByLabel('Android device')
  const expectDevicePane = async () => {
    if (page.viewportSize()!.width < 1024) {
      await expect(device).toBeAttached()
      await expect(page.getByRole('button', { name: 'Device', exact: true })).toBeDisabled()
    } else {
      await expect(device).toBeVisible()
    }
  }
  await page.goto(url)
  await expectDevicePane()
  await expect(page.getByRole('heading', { name: 'Run history', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader').filter({ hasText: 'Workflow' })).toBeVisible()

  await page.goto(`${url}&run=${id}`)
  await expectDevicePane()
  await expect(page.getByRole('heading', { name: 'Run details', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run history', exact: true })).toBeDisabled()
})

test('Summary follows a cold workflow run and retains its live events across tabs', async ({ page }) => {
  const socket = Promise.withResolvers<WebSocketRoute>()
  await page.routeWebSocket('**/test-workflow-events', connection => socket.resolve(connection))
  const ok = (data: unknown) => ({ json: { ok: true, requestId: 'test', data } })
  let status = 'queued'
  await page.route(`**/api/bff/devices/preview-app/workflow-runs/${id}`, route =>
    route.fulfill(
      ok({
        ...run,
        status,
        completedAt: status === 'success' ? run.completedAt : null,
        error: null,
        failureCode: undefined,
        failureRequestId: undefined
      })
    )
  )
  await page.route(`**/api/bff/automations/runs/${id}/events?*`, route =>
    route.fulfill(
      ok(
        route.request().method() === 'POST'
          ? { streamUrl: 'ws://127.0.0.1:3001/test-workflow-events' }
          : { events: [], nextAfter: null }
      )
    )
  )

  await page.goto(`/skeleton-contract-test?editor=app-resource&view=workflows&run=${id}`)
  await expect(page.getByText('Waiting in queue…')).toBeVisible()
  const connection = await socket.promise
  const publish = (
    sequence: number,
    type: string,
    message: string,
    data: Record<string, unknown> = {},
    stepId?: string
  ) =>
    connection.send(
      JSON.stringify({
        type: 'event',
        event: {
          id: `test-event-${sequence}`,
          runId: id,
          sequence,
          type,
          message,
          data,
          stepId,
          createdAt: run.createdAt
        }
      })
    )

  publish(1, 'run.preparing', 'Waiting for Android to be ready.', { phase: 'waiting-for-android' })
  await expect(page.getByText('Waiting for Android…')).toBeVisible()
  await page.getByRole('tab', { name: 'Events' }).click()
  await expect(page.getByRole('log').getByText('Waiting for Android to be ready.')).toBeVisible()
  await page.getByRole('tab', { name: 'Summary' }).click()
  publish(2, 'run.started', 'Workflow started.')
  publish(3, 'step.started', 'Starting android.launchPackage.', { uses: 'android.launchPackage' }, 'launch')
  await expect(page.getByText('Running step · Launch app')).toBeVisible()

  status = 'success'
  publish(4, 'run.completed', 'Workflow completed.')
  await expect(page.getByText('Completed', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stop run' })).toHaveCount(0)
})

import { expect, test } from '@playwright/test'
import { dockerOperationLimitsSchema } from '../src/shared/contracts/docker-operation-limits'
import { defaultOrchestratorUiSettings } from '../src/shared/model/settings/orchestrator-ui-settings'

test('Firewall agent has a service page with a scoped connection save', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=services-all')
  const search = page.getByPlaceholder('Search services')
  await search.fill('Firewall')
  const row = page.getByRole('row', { name: 'View details for Firewall agent' })
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(2)
  await expect(row.getByRole('link', { name: 'View details' })).toHaveAttribute(
    'href',
    '/platform/services?service=firewall'
  )
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)

  const firewall = { endpoint: '/run/draft-firewall.sock', timeoutMs: 6000 }
  const updates: unknown[] = []
  await page.route('**/api/bff/preferences/ui-settings', route => {
    updates.push(route.request().postDataJSON())
    return route.fulfill({
      json: {
        ok: true,
        requestId: 'preview',
        data: {
          ...defaultOrchestratorUiSettings,
          services: { ...defaultOrchestratorUiSettings.services, firewall }
        }
      }
    })
  })
  await page.goto('/skeleton-contract-test?editor=service-firewall')
  await expect(page.getByRole('heading', { level: 1, name: 'Firewall agent' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'Offline' })).toContainText(
    'Firewall agent could not be reached.'
  )
  const connection = page.getByRole('region', { name: 'Connection' })
  const endpoint = connection.getByRole('textbox', { name: 'Endpoint' })
  const timeout = connection.getByRole('spinbutton', { name: 'Timeout' })
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(endpoint).toHaveValue(defaultOrchestratorUiSettings.services.firewall.endpoint!)
  await expect(save).toBeDisabled()
  await endpoint.fill(firewall.endpoint)
  await timeout.fill(String(firewall.timeoutMs))
  await save.click()
  await expect.poll(() => updates).toEqual([{ operation: 'save-runtime', settings: { services: { firewall } } }])
  await expect(save).toBeDisabled()
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(endpoint).toHaveValue(firewall.endpoint)
    await expect(timeout).toHaveValue(String(firewall.timeoutMs))
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  }
})

test('Docker failures stay compact and offer scoped recovery', async ({ page }) => {
  let limitsUnavailable = true
  const limits = {
    maxConcurrentReads: 8,
    maxConcurrentLongOperations: 4,
    slowRequestWarningMs: 5000,
    longOperationTimeoutMs: 1_800_000
  }
  const unavailable = {
    ok: false,
    requestId: 'preview',
    error: { requestId: 'preview', code: 'upstream_unavailable', message: 'Service unavailable.' }
  }
  await page.route('**/api/bff/platform/docker-operation-limits', route =>
    route.fulfill({
      status: limitsUnavailable ? 503 : 200,
      json: limitsUnavailable ? unavailable : { ok: true, data: limits, requestId: 'preview' }
    })
  )
  await page.route('**/api/bff/platform/docker-metrics', route => route.fulfill({ status: 503, json: unavailable }))
  await page.goto('/skeleton-contract-test?editor=service-docker')
  const limitsError = page.getByRole('alert').filter({ hasText: 'Operation limits unavailable' })
  const metricsError = page.getByRole('alert').filter({ hasText: 'Docker metrics unavailable' })
  await expect(limitsError).toBeVisible()
  await expect(metricsError).toBeVisible()
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1100 })
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      expect((await limitsError.boundingBox())!.height).toBeLessThan(200)
      expect((await metricsError.boundingBox())!.height).toBeLessThan(200)
      await expect(page.getByRole('heading', { name: 'Infrastructure diagnostics', exact: true })).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    }
  }
  await page.screenshot({ path: `/tmp/rebroid-docker-errors-${test.info().project.name}.png`, animations: 'disabled' })
  limitsUnavailable = false
  await limitsError.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(limitsError).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit limits', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Concurrent reads', exact: true })).toHaveValue('8')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(limitsError).toHaveCount(0)
  await expect(metricsError).toBeVisible()
})

test('services show complete observed health and matching loading geometry', async ({ page }) => {
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1100 })
    await page.goto('/skeleton-contract-test?editor=services-all-loading')
    const loading = await page.getByRole('table').boundingBox()
    const columns = await page.getByRole('columnheader').allTextContents()
    await page.goto('/skeleton-contract-test?editor=services-all')
    const ready = await page.getByRole('table').boundingBox()
    expect(ready!.y).toBe(loading!.y)
    expect(ready!.width).toBe(loading!.width)
    expect(await page.getByRole('columnheader').allTextContents()).toEqual(columns)
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(6)
    await expect(page.getByRole('row', { name: 'View details for Firewall agent' })).toContainText('Offline')
    await expect(page.getByRole('link', { name: 'Docker', exact: true })).toHaveAttribute(
      'href',
      '/platform/services?service=docker'
    )
    await expect(page.getByRole('link', { name: 'Orchestrator', exact: true })).toHaveAttribute(
      'href',
      '/platform/services?service=orchestrator'
    )
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({
        path: `/tmp/rebroid-services-health-${width}-${theme}-${test.info().project.name}.png`,
        animations: 'disabled'
      })
    }
  }
})

test('Docker service edits real limits, retains failed drafts, and leaves connection settings separate', async ({
  page
}) => {
  let limits = {
    maxConcurrentReads: 8,
    maxConcurrentLongOperations: 4,
    slowRequestWarningMs: 5000,
    longOperationTimeoutMs: 1_800_000
  }
  let fail = true
  let saves = 0
  await page.route('**/api/bff/platform/docker-operation-limits', async route => {
    if (route.request().method() === 'PATCH') {
      saves += 1
      if (fail)
        return route.fulfill({
          status: 503,
          json: {
            ok: false,
            requestId: 'preview',
            error: { requestId: 'preview', code: 'upstream_unavailable', message: 'Docker unavailable.' }
          }
        })
      limits = dockerOperationLimitsSchema.parse(route.request().postDataJSON())
    }
    return route.fulfill({ json: { ok: true, data: limits, requestId: 'preview' } })
  })
  await page.route('**/api/bff/platform/docker-metrics', route =>
    route.fulfill({
      json: {
        ok: true,
        requestId: 'preview',
        data: {
          collectedAt: new Date().toISOString(),
          transport: 'local-socket',
          limits: { ...limits, remoteRequestTimeoutMs: 30_000 },
          totals: { success: 52, errors: 1, timeouts: 0, retries: 2, slow: 0 },
          inFlight: { read: 0, mutation: 0, long: 0 },
          queued: { read: 0, mutation: 0, long: 0 },
          operations: [],
          events: []
        }
      }
    })
  )
  await page.goto('/skeleton-contract-test?editor=service-docker')
  await expect(page.getByRole('heading', { level: 1, name: 'Docker', exact: true })).toBeVisible()
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
  const editLimits = page.getByRole('button', { name: 'Edit limits', exact: true })
  await editLimits.click()
  const dialog = page.getByRole('dialog', { name: 'Edit operation limits' })
  const reads = dialog.getByRole('spinbutton', { name: 'Concurrent reads', exact: true })
  await expect(reads).toHaveValue('8')
  await reads.fill('12')
  await page.getByRole('button', { name: 'Save limits', exact: true }).click()
  await expect(page.getByText('Docker unavailable.', { exact: true })).toBeVisible()
  await expect(reads).toHaveValue('12')
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    const inputs = await dialog.getByRole('spinbutton').all()
    const boxes = await Promise.all(inputs.map(input => input.boundingBox()))
    for (const box of boxes) {
      expect(box!.x).toBe(boxes[0]!.x)
      expect(box!.width).toBe(boxes[0]!.width)
    }
    for (let index = 1; index < boxes.length; index += 1)
      expect(boxes[index]!.y).toBeGreaterThan(boxes[index - 1]!.y + boxes[index - 1]!.height)
    await dialog.getByRole('button', { name: 'Save limits' }).scrollIntoViewIfNeeded()
    await expect(dialog.getByRole('button', { name: 'Save limits' })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  }
  fail = false
  await page.getByRole('button', { name: 'Save limits', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(editLimits).toBeFocused()
  await expect(page.getByRole('region', { name: 'Operation limits', exact: true })).toContainText('12 reads')
  expect(limits.maxConcurrentReads).toBe(12)
  expect(saves).toBe(2)
  for (const width of [390, 768, 1440, 2048]) {
    await page.setViewportSize({ width, height: 1100 })
    for (const theme of ['light', 'dark', 'oled']) {
      await page.evaluate(value => {
        document.documentElement.className = value
      }, theme)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      await page.screenshot({
        path: `/tmp/rebroid-docker-service-${width}-${theme}-${test.info().project.name}.png`,
        fullPage: true,
        animations: 'disabled'
      })
    }
  }
  await page.goto('/skeleton-contract-test?editor=service-orchestrator')
  await expect(page.getByRole('heading', { name: 'Orchestrator', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Docker diagnostics and limits' })).toHaveAttribute(
    'href',
    '/platform/services?service=docker'
  )
  await expect(page.getByRole('heading', { name: 'Operation limits' })).toHaveCount(0)
})

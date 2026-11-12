import { expect, test } from '@playwright/test'

test('remaining inventories show one failure without dependent controls or requests', async ({ page }) => {
  for (const [editor, title] of [
    ['services-unavailable', 'Services unavailable'],
    ['resources-unavailable', 'Resources unavailable']
  ]) {
    await page.goto(`/skeleton-contract-test?editor=${editor}`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.locator('.root').getByRole('alert')).toHaveCount(1)
    await expect(page.locator('[data-slot="state-illustration"]')).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled()
  }
  const dependentRequests: string[] = []
  page.on('request', request => {
    if (request.url().includes('/api/bff/platform/display-sidecar/logs')) dependentRequests.push(request.url())
  })
  await page.goto('/skeleton-contract-test?editor=display-offline')
  await expect(page.getByText('Display service is offline.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Sessions', exact: true })).toHaveCount(0)
  await expect(page.getByRole('table')).toHaveCount(0)
  expect(dependentRequests).toEqual([])
})

test('known orchestrator outages produce one warning and no dependent Docker requests', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => {
    if (/\/api\/bff\/platform\/docker-(metrics|operation-limits)/.test(request.url())) requests.push(request.url())
  })
  await page.goto('/skeleton-contract-test?editor=service-docker-unavailable')
  await expect(page.getByRole('status')).toHaveAttribute('data-tone', 'warning')
  await expect(page.getByRole('status')).toContainText('Unknown')
  await expect(page.getByRole('region', { name: 'Operation limits' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Infrastructure diagnostics' })).toHaveCount(0)
  await expect(page.locator('.root').getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeEnabled()
  expect(requests).toEqual([])
  await page.screenshot({ path: `/tmp/rebroid-docker-outage-${test.info().project.name}.png` })
})

test('runtime defaults uses the shared illustrated failure with page-level recovery', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=runtime-unavailable')
  await expect(page.getByRole('heading', { level: 1, name: 'General', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Runtime defaults unavailable' })).toBeVisible()
  await expect(page.locator('[data-slot="state-illustration"]')).toBeVisible()
  await expect(page.locator('.root').getByRole('alert')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Go to overview' })).toHaveAttribute('href', '/platform')
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled()
  await page.screenshot({ path: `/tmp/rebroid-runtime-outage-${test.info().project.name}.png` })
})

test('page failures keep illustrations, recovery, and headings readable in every theme', async ({ page }) => {
  for (const kind of ['unavailable', 'not-found', 'error']) {
    await page.goto(`/skeleton-contract-test?editor=failure-${kind}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1)
    await expect(page.locator('[data-slot="state-illustration"]')).toBeVisible()
    if (kind === 'unavailable') {
      await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled()
      await expect(page.getByRole('link', { name: 'Go to overview' })).toHaveAttribute('href', '/platform')
    }
    if (kind === 'not-found') await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const theme of ['light', 'dark', 'oled']) {
        await page.evaluate(value => {
          document.documentElement.classList.remove('light', 'dark', 'oled')
          document.documentElement.classList.add(value)
        }, theme)
        await expect(page.getByRole('heading', { level: 2 })).toBeInViewport()
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
        await page.screenshot({
          path: `/tmp/rebroid-failure-${kind}-${width}-${theme}-${test.info().project.name}.png`
        })
      }
    }
  }
})

test('overview hides unavailable cards, recovers, and retains data on subsequent failure', async ({ page }) => {
  let unavailable = true
  const failure = {
    ok: false,
    requestId: 'outage-preview',
    error: {
      code: 'upstream_unavailable',
      message: 'Could not reach the runtime service.',
      requestId: 'outage-preview'
    }
  }
  const resources = {
    containersRunning: 2,
    containersTotal: 3,
    containersStopped: 1,
    managedContainersCpuUsagePercent: 12,
    managedContainersMemoryUsageBytes: 1024,
    containerStatsCollectedAt: null,
    hostMemoryBytes: null,
    hostCpuCores: null,
    dockerRootAvailableBytes: null,
    containers: []
  }
  for (const [path, data] of [
    ['platform/operations', { failedCount: 0, pendingCount: 0, activeRunCount: 0, failed: [], pending: [], runs: [] }],
    ['platform/resources', resources],
    ['applications/recent', []]
  ] as const) {
    await page.route(`**/api/bff/${path}`, route =>
      route.fulfill({
        status: unavailable ? 503 : 200,
        json: unavailable ? failure : { ok: true, data, requestId: 'recovered-preview' }
      })
    )
  }
  await page.goto('/skeleton-contract-test?editor=overview')
  await expect(page.getByText('Operations unavailable', { exact: true })).toBeVisible()
  await expect(page.getByText('Capacity unavailable', { exact: true })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Managed container CPU', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Apps needing attention' })).toHaveCount(0)
  await expect(page.getByText(/Container stats are sampled/)).toHaveCount(0)
  await page.screenshot({ path: `/tmp/rebroid-overview-outage-${test.info().project.name}.png`, fullPage: true })
  unavailable = false
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByText('12.0%')).toBeVisible()
  await expect(page.getByText('No app failures.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled()
  unavailable = true
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByText('Operations could not be refreshed')).toBeVisible()
  await expect(page.getByText('Capacity could not be refreshed')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('12.0%')).toBeVisible()
  await expect(page.getByText('No app failures.')).toBeVisible()
  await expect(page.getByText(/Showing the last loaded snapshot/)).toBeVisible()
})

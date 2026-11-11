import { expect, test } from '@playwright/test'

const id = '76e85cb0-135b-4ca0-9782-bcb7233b4672'
const run = {
  id,
  automationId: 'workflow-1',
  automationName: 'Check inventory',
  automationTriggerId: null,
  ownerUserId: 'owner-1',
  targetApplicationId: 'preview-app',
  targetProfileName: 'default',
  targetProfileMode: 'persistent',
  trigger: 'manual',
  status: 'failed',
  startedAt: '2026-11-11T12:00:01Z',
  completedAt: '2026-11-11T12:00:03Z',
  createdAt: '2026-11-11T12:00:00Z',
  updatedAt: '2026-11-11T12:00:03Z',
  error: 'App did not become ready.',
  stepResults: []
}

test('app run history survives reload and opens summary and events beside the same device', async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile-chromium' ? 390 : 1440, height: 960 })
  const appUrl = '/skeleton-contract-test?editor=app-resource&view=workflows'
  const history = '**/api/bff/applications/preview-app/workflow-runs'
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
          streamUrl: 'ws://127.0.0.1/unused',
          events: [
            {
              id: 'event-1',
              runId: id,
              sequence: 1,
              type: 'run.failed',
              message: 'App did not become ready.',
              data: { reason: 'readiness-timeout' },
              createdAt: run.completedAt
            }
          ]
        }
      }
    })
  )

  await page.goto(appUrl)
  const device = page.getByRole('complementary', { name: 'Android device' })
  await expect(device).toBeVisible()
  await device.evaluate(element => element.setAttribute('data-workflow-test-mounted', 'true'))
  const link = page.getByRole('link', { name: 'Check inventory', exact: true })
  const search = page.getByPlaceholder('Search workflows or run IDs')
  await search.fill('inventory')
  await search.press('Enter')
  await link.click()
  await expect(page).toHaveURL(new RegExp(`[?&]run=${id}`))
  await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('App did not become ready.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open full trace' })).toHaveAttribute(
    'href',
    `/automations/workflow-1/traces?run=${id}`
  )
  await expect(device).toHaveAttribute('data-workflow-test-mounted', 'true')
  await expect(device).toBeVisible()
  await page.getByRole('button', { name: 'Run history', exact: true }).click()
  await expect(link).toBeFocused()
  await expect(search).toHaveValue('inventory')

  await link.click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Check inventory', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Events' }).click()
  const log = page.getByRole('log')
  await log.getByText('App did not become ready.', { exact: true }).click()
  await expect(log.getByText(/readiness-timeout/)).toBeVisible()
  await expect(device).toBeVisible()
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
  await page.goto(url)
  const device = page.getByRole('complementary', { name: 'Android device' })
  await expect(device).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Run history', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader').filter({ hasText: 'Workflow' })).toBeVisible()

  await page.goto(`${url}&run=${id}`)
  await expect(device).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Run details', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run history', exact: true })).toBeDisabled()
})

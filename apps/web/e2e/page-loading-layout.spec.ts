import { expect, test, type Page } from '@playwright/test'

const widths = [390, 768, 1440, 2048]
const pairs = [
  ['app', 'app-loading', 'fields'],
  ['users-list', 'users-list-loading', 'grid'],
  ['triggers', 'triggers-loading', 'grid'],
  ['ai-connection', 'ai-connection-loading&view=connection', 'fields']
] as const

const geometry = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll(nodes =>
    nodes.map(node => {
      const { x, y, width, height } = node.getBoundingClientRect()
      return { x, y, width, height }
    })
  )

for (const [ready, loading, kind] of pairs) {
  test(`${ready} loading retains the current page geometry`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`))
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(`/skeleton-contract-test?editor=${loading}`)
      const selector = kind === 'grid' ? 'thead th' : '[data-editor-field]'
      await expect(page.locator(selector).first()).toBeVisible()
      const before = await geometry(page, selector)
      await page.goto(`/skeleton-contract-test?editor=${ready}`)
      await expect(page.locator(selector).first()).toBeVisible()
      const after = await geometry(page, selector)
      expect(after.length).toBe(before.length)
      for (let index = 0; index < before.length; index++) {
        for (const axis of ['x', 'y', 'width', 'height'] as const) {
          expect(
            Math.abs(before[index][axis] - after[index][axis]),
            `${width}px ${ready} field ${index} ${axis}`
          ).toBeLessThanOrEqual(1)
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
    }
    expect(errors).toEqual([])
  })
}

test('current page loaders fit all supported widths and themes without runtime errors', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(`${page.url()}: ${error.message}`))
  const variants = [
    'app-resource-loading',
    'app-resource-loading&view=configuration',
    'app-resource-loading&view=diagnostics',
    'app-resource-loading&view=activity',
    'app-resource-loading&view=ai-agent',
    'app-resource-loading&view=clipboard',
    'app-resource-loading&view=workflows',
    'app-resource-loading&view=files',
    'app-profiles-loading',
    'workflows-loading',
    'run-history-loading',
    'overview-loading',
    'container-loading',
    'container-loading&view=logs',
    'image-loading',
    'network-loading',
    'activity-loading',
    'display-sessions-loading',
    'resources-loading',
    'user-loading',
    'group-loading',
    'groups-list-loading',
    'features-loading',
    'service-route-loading&service=docker',
    'service-route-loading&service=orchestrator'
  ]
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 })
    for (const variant of variants) {
      errors.length = 0
      await page.goto(`/skeleton-contract-test?editor=${variant}`)
      await expect(page.locator('h1').first()).toBeVisible()
      for (const theme of ['light', 'dark', 'oled']) {
        await page.evaluate(value => {
          document.documentElement.className = value
        }, theme)
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
          `${variant} ${width} ${theme}`
        ).toBeLessThanOrEqual(0)
      }
      expect(errors, variant).toEqual([])
      if (
        width === 1440 &&
        ['app-resource-loading', 'overview-loading', 'container-loading', 'resources-loading'].includes(variant)
      ) {
        await page.screenshot({ path: `/tmp/rebroid-loader-${variant}.png` })
      }
    }
  }
  expect(errors).toEqual([])
})

test('loading editor cannot receive keyboard focus', async ({ page }) => {
  await page.goto('/skeleton-contract-test?editor=app-loading')
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[inert]')))).toBe(false)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('combobox')).toHaveCount(0)
})

test('Features loader preserves its feature catalog and row geometry', async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/skeleton-contract-test?editor=features-loading')
    await expect(page.getByText('OCR perception', { exact: true })).toBeVisible()
    await expect(page.getByText(/Configuration revision/)).toHaveCount(0)
    await expect(page.getByRole('switch')).toHaveCount(0)
    await expect(page.getByText('Active', { exact: true })).not.toBeVisible()
    if (width === 1440 || width === 390) await page.screenshot({ path: `/tmp/rebroid-loader-features-${width}.png` })
    const before = await geometry(page, 'thead th, tbody tr')
    await page.goto('/skeleton-contract-test?editor=features')
    await expect(page.getByRole('switch').first()).toBeVisible()
    await expect(page.getByText(/Configuration revision/)).toHaveCount(0)
    const after = await geometry(page, 'thead th, tbody tr')
    expect(after).toHaveLength(before.length)
    for (let index = 0; index < before.length; index++) {
      for (const axis of ['x', 'y', 'width', 'height'] as const) {
        expect(
          Math.abs(before[index][axis] - after[index][axis]),
          `${width}px feature row ${index} ${axis}`
        ).toBeLessThanOrEqual(1)
      }
    }
  }
})

test('nested Services loaders show their own sections and remain inert', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const requests: string[] = []
  page.on('request', request => {
    if (request.url().includes('/api/bff/')) requests.push(request.url())
  })
  for (const service of ['docker', 'orchestrator']) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(`/skeleton-contract-test?editor=service-route-loading&service=${service}`)
      await expect(
        page.getByRole('heading', { level: 1, name: service === 'docker' ? 'Docker' : 'Orchestrator' })
      ).toBeVisible()
      await expect(page.getByRole('searchbox', { name: 'Search services' })).toHaveCount(0)
      if (service === 'docker') {
        await expect(page.getByText('Concurrent reads', { exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Save limits' })).toBeDisabled()
        await expect(page.getByRole('heading', { name: 'Infrastructure diagnostics' })).toBeVisible()
      } else {
        await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible()
      }
      for (const theme of ['light', 'dark', 'oled']) {
        await page.evaluate(value => {
          document.documentElement.className = value
        }, theme)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
      }
      if (width === 1440) await page.screenshot({ path: `/tmp/rebroid-loader-service-${service}.png` })
    }
  }
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

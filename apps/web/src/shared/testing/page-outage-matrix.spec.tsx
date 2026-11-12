import { isValidElement, Suspense, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreateAppPageEntry } from '@/features/applications/pages/create-app/page-entry'
import { AutomationTracesPageEntry } from '@/features/automations/pages/automation-traces/page-entry'
import { FirewallPageEntry } from '@/features/platform/pages/firewall/page-entry'
import PlatformFeaturesPageEntry from '@/features/platform/pages/platform-features/page-entry'
import { PlatformOverviewPageEntry } from '@/features/platform/pages/platform-overview/page-entry'
import { loadRuntimeContainersPageData } from '@/features/platform/pages/runtime-containers/page-data.server'
import { RuntimeContainersPageEntry } from '@/features/platform/pages/runtime-containers/page-entry'
import { CustomRuntimeImageBuilderPageEntry } from '@/features/platform/pages/runtime-image-builder/custom-page-entry'
import { RuntimeImageBuilderPageEntry } from '@/features/platform/pages/runtime-image-builder/page-entry'
import { CastingPageEntry } from '@/features/settings/casting/pages/casting/page-entry'
import AiProviderDetailPageEntry from '@/features/settings/orchestrator/pages/ai-provider-detail/page-entry'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { PlatformRouteUnavailable } from '@/shared/ui/page/platform-route-unavailable'

const { health, load } = vi.hoisted(() => ({
  health: vi.fn(() => Promise.resolve({ services: { orchestrator: { ok: false } } })),
  load: vi.fn()
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), unstable_rethrow: vi.fn() }))
vi.mock('@/server/auth/authorization', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/auth/authorization')>()),
  requireAdmin: vi.fn()
}))
vi.mock('@/server/orchestrator/orchestrator-page-read', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/orchestrator/orchestrator-page-read')>()),
  getOrchestratorPageHealth: health
}))
vi.mock('@/features/applications/pages/create-app/page-data.server', () => ({ getCreateAppPageData: load }))
vi.mock('@/features/automations/pages/automation-traces/page-data.server', () => ({
  loadAutomationTracesPageData: load
}))
vi.mock('@/features/platform/pages/firewall/page-data.server', () => ({
  loadFirewallPageData: load
}))
vi.mock('@/features/platform/pages/platform-features/page-data.server', () => ({ loadPlatformFeatures: load }))
vi.mock('@/features/platform/pages/runtime-containers/page-data.server', () => ({
  loadRuntimeContainersPageData: vi.fn()
}))
vi.mock('@/features/platform/pages/runtime-image-builder/page-data.server', () => ({
  loadRuntimeImageBuilderPageData: load
}))
vi.mock('@/features/platform/pages/runtime-image-builder/gapps-page-data.server', () => ({
  loadRuntimeGappsBuilderPageData: load
}))
vi.mock('@/features/settings/casting/pages/casting/page-data.server', () => ({
  loadCastingPageData: load
}))
vi.mock('@/features/settings/orchestrator/pages/ai-provider-detail/page-data.server', () => ({
  getAiProviderDetailPageData: load
}))

const resolveBoundary = async (entry: ReactNode | Promise<ReactNode>) => {
  let node: ReactNode = await entry
  for (let depth = 0; depth < 5; depth += 1) {
    if (!isValidElement<{ children?: ReactNode }>(node)) throw new Error('Expected a server page element')
    if (node.type === PlatformRouteUnavailable) return node
    if (node.type === OrchestratorPageBoundary) {
      return OrchestratorPageBoundary(node.props as unknown as Parameters<typeof OrchestratorPageBoundary>[0])
    }
    // These are server React elements, not mounted DOM nodes.
    // eslint-disable-next-line testing-library/no-node-access
    if (node.type === Suspense) node = await node.props.children
    else if (typeof node.type === 'function') {
      const component = node.type as (props: unknown) => ReactNode | Promise<ReactNode>
      node = await component(node.props)
    } else throw new Error('Page did not reach its outage boundary')
  }
  throw new Error('Page did not reach its outage boundary')
}

describe('runtime page outage matrix', () => {
  it.each([
    ['Overview', () => PlatformOverviewPageEntry()],
    ['Create app', () => CreateAppPageEntry()],
    ['Build Google Play image', () => RuntimeImageBuilderPageEntry()],
    ['Build custom image', () => CustomRuntimeImageBuilderPageEntry()],
    ['Feature management', () => PlatformFeaturesPageEntry()],
    ['Casting', () => CastingPageEntry()],
    ['AI provider', () => AiProviderDetailPageEntry({ params: Promise.resolve({ providerId: 'example' }) })],
    ['Run history', () => AutomationTracesPageEntry({ params: Promise.resolve({ id: 'example' }) })]
  ] as const)('%s renders one page failure without starting dependent loaders', async (title, entry) => {
    render(await resolveBoundary(entry()))
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeVisible()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    expect(screen.queryByRole('table')).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })

  it('keeps the firewall page refreshable during an orchestrator outage and skips dependent reads', async () => {
    const page = await resolveBoundary(FirewallPageEntry())
    render(<FeatureFlagsProvider manifest={null}>{page}</FeatureFlagsProvider>)
    expect(screen.getByRole('heading', { level: 1, name: 'Firewall' })).toBeVisible()
    expect(screen.getByText('Firewall settings unavailable')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
    expect(screen.queryByRole('table')).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })

  it('preserves a runtime inventory request reference without rendering an empty grid', async () => {
    vi.mocked(loadRuntimeContainersPageData).mockRejectedValueOnce(
      new OrchestratorRequestError('private endpoint', 503, 'inventory-ref')
    )
    render(await resolveBoundary(RuntimeContainersPageEntry({ searchParams: Promise.resolve({ page: '2' }) })))
    expect(screen.getByRole('heading', { level: 1, name: 'Containers' })).toBeVisible()
    expect(screen.getByText('Reference: inventory-ref')).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
    expect(loadRuntimeContainersPageData).toHaveBeenCalledWith({ page: '2' })
  })

  it('propagates a runtime inventory permission failure', async () => {
    const denied = new OrchestratorRequestError('denied', 403)
    vi.mocked(loadRuntimeContainersPageData).mockRejectedValueOnce(denied)
    await expect(resolveBoundary(RuntimeContainersPageEntry({}))).rejects.toBe(denied)
  })
})

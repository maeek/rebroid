import { isValidElement, Suspense, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreateAppPageEntry } from '@/features/applications/pages/create-app/page-entry'
import { AutomationTracesPageEntry } from '@/features/automations/pages/automation-traces/page-entry'
import PlatformFeaturesPageEntry from '@/features/platform/pages/platform-features/page-entry'
import { PlatformOverviewPageEntry } from '@/features/platform/pages/platform-overview/page-entry'
import { CustomRuntimeImageBuilderPageEntry } from '@/features/platform/pages/runtime-image-builder/custom-page-entry'
import { RuntimeImageBuilderPageEntry } from '@/features/platform/pages/runtime-image-builder/page-entry'
import { PlatformDisplaySessionsPageEntry } from '@/features/settings/casting/pages/platform-display-sessions/page-entry'
import AiProviderDetailPageEntry from '@/features/settings/orchestrator/pages/ai-provider-detail/page-entry'
import { SecurityNetworkPoliciesPageEntry } from '@/features/settings/orchestrator/pages/security-network-policies/page-entry'
import { OrchestratorPageBoundary } from '@/server/orchestrator/orchestrator-page-boundary'

const { health, load } = vi.hoisted(() => ({
  health: vi.fn(() => Promise.resolve({ services: { orchestrator: { ok: false } } })),
  load: vi.fn()
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), unstable_rethrow: vi.fn() }))
vi.mock('@/server/orchestrator/diagnostics/actions', () => ({ getOrchestratorHealthSummaryAction: health }))
vi.mock('@/features/applications/pages/create-app/page-data.server', () => ({ getCreateAppPageData: load }))
vi.mock('@/features/automations/pages/automation-traces/page-data.server', () => ({
  loadAutomationTracesPageData: load
}))
vi.mock('@/features/platform/pages/platform-features/page-data.server', () => ({ loadPlatformFeatures: load }))
vi.mock('@/features/platform/pages/runtime-image-builder/page-data.server', () => ({
  loadRuntimeImageBuilderPageData: load
}))
vi.mock('@/features/platform/pages/runtime-image-builder/gapps-page-data.server', () => ({
  loadRuntimeGappsBuilderPageData: load
}))
vi.mock('@/features/settings/casting/pages/platform-display-sessions/page-data.server', () => ({
  loadPlatformDisplaySessionsPageData: load
}))
vi.mock('@/features/settings/orchestrator/pages/ai-provider-detail/page-data.server', () => ({
  getAiProviderDetailPageData: load
}))
vi.mock('@/features/settings/orchestrator/pages/security-network-policies/page-data.server', () => ({
  loadSecurityNetworkPoliciesPageData: load
}))

const resolveBoundary = async (entry: ReactNode | Promise<ReactNode>) => {
  let node: ReactNode = await entry
  for (let depth = 0; depth < 5; depth += 1) {
    if (!isValidElement<{ children?: ReactNode }>(node)) throw new Error('Expected a server page element')
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
    ['Image builder', () => RuntimeImageBuilderPageEntry()],
    ['Custom image builder', () => CustomRuntimeImageBuilderPageEntry()],
    ['Features', () => PlatformFeaturesPageEntry()],
    ['Display sessions', () => PlatformDisplaySessionsPageEntry()],
    ['Network policies', () => SecurityNetworkPoliciesPageEntry()],
    ['AI provider', () => AiProviderDetailPageEntry({ params: Promise.resolve({ providerId: 'example' }) })],
    ['Workflow runs', () => AutomationTracesPageEntry({ params: Promise.resolve({ id: 'example' }) })]
  ] as const)('%s renders one page failure without starting dependent loaders', async (title, entry) => {
    render(await resolveBoundary(entry()))
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeVisible()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    expect(screen.queryByRole('table')).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })
})

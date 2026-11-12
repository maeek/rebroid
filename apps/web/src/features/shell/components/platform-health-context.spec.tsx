import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { PlatformHealthProvider } from './platform-health-context'
import { ProtectedNavigation } from './protected-navigation'
import type { OrchestratorHealth, ServiceHealth } from '@/shared/contracts/diagnostics'
import type { FeatureFlagState } from '@/shared/contracts/feature-flags'

const navigation = vi.hoisted(() => ({ pathname: '/apps', search: '' }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search)
}))
vi.mock('@/hooks/use-polling-query', () => ({ usePollingQuery: vi.fn() }))
vi.mock('@/server/orchestrator/diagnostics/actions', () => ({ getOrchestratorHealthSummaryAction: vi.fn() }))

const healthy = { ok: true, status: 'healthy', message: 'Ready' } satisfies ServiceHealth
const summary: OrchestratorHealth = {
  ok: false,
  docker: true,
  runtime: false,
  display: true,
  firewall: false,
  ocr: true,
  services: {
    orchestrator: healthy,
    docker: healthy,
    runtime: { ok: false, status: 'unhealthy', message: 'Privileged apps unavailable' },
    display: healthy,
    firewall: { ok: false, status: 'offline', message: 'Firewall could not be reached' },
    ocr: healthy
  }
}

const feature = (key: FeatureFlagState['key'], enabled: boolean): FeatureFlagState => ({
  key,
  owner: 'automations',
  description: 'Optional service',
  control: 'runtime',
  mutable: true,
  enabled,
  supported: true,
  effective: enabled,
  syncStatus: 'applied',
  disablePolicy: 'block_new',
  lifecycle: 'permanent',
  removalCondition: null,
  revision: 1,
  dependencies: [],
  conflicts: []
})

const sidebar = (optionalServicesEnabled = true) => (
  <FeatureFlagsProvider
    manifest={{
      revision: 1,
      features: [feature('feature.ocr', optionalServicesEnabled), feature('feature.firewall', optionalServicesEnabled)]
    }}
  >
    <PlatformHealthProvider polling>
      <ProtectedNavigation
        variant='sidebar'
        initialUser={{ name: 'Admin', avatarDataUrl: null, isPlatformAdmin: true }}
      />
    </PlatformHealthProvider>
  </FeatureFlagsProvider>
)

const mockPoll = (data?: OrchestratorHealth, error?: Error) =>
  vi.mocked(usePollingQuery).mockImplementation(key => ({
    data: key === 'orchestrator:health' ? data : undefined,
    error: key === 'orchestrator:health' ? error : undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn()
  }))

describe('platform health navigation', () => {
  beforeEach(() => {
    navigation.pathname = '/apps'
    navigation.search = ''
  })

  it('polls one summary and shows separate statuses on the service links', async () => {
    mockPoll()
    vi.mocked(getOrchestratorHealthSummaryAction).mockResolvedValue(summary)
    const { rerender } = render(sidebar())
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAccessibleDescription('Checking')

    expect(usePollingQuery).toHaveBeenCalledWith('orchestrator:health', expect.any(Function), {
      enabled: true,
      intervalMs: 10_000
    })
    const pollHealth = vi.mocked(usePollingQuery).mock.calls.find(([key]) => key === 'orchestrator:health')?.[1]
    await expect(pollHealth?.()).resolves.toBe(summary)
    expect(getOrchestratorHealthSummaryAction).toHaveBeenCalledOnce()

    mockPoll(summary)
    rerender(sidebar())
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAccessibleDescription('System degraded')
    expect(screen.getByRole('link', { name: 'Casting' })).toHaveAccessibleDescription('Healthy')
    expect(screen.getByRole('link', { name: 'Firewall' })).toHaveAccessibleDescription('Offline')
    expect(screen.getByRole('link', { name: 'Docker' })).toHaveAccessibleDescription('Degraded')
    expect(screen.getByRole('link', { name: 'OCR perception' })).toHaveAccessibleDescription('Healthy')
    expect(screen.getByRole('link', { name: 'Containers' })).not.toHaveAccessibleDescription()
  })

  it('shows unknown service health when the summary request fails and hides optional services that are disabled', () => {
    mockPoll(summary, new Error('Orchestrator unavailable'))
    render(sidebar(false))

    expect(screen.getByRole('link', { name: 'Services' })).toHaveAccessibleDescription('System offline')
    expect(screen.getByRole('link', { name: 'Docker' })).toHaveAccessibleDescription('Unknown')
    expect(screen.getByRole('link', { name: 'Casting' })).toHaveAccessibleDescription('Unknown')
    expect(screen.queryByRole('link', { name: 'OCR perception' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Firewall' })).toBeNull()
  })

  it('links System to its overview and keeps health visible when the section is collapsed', () => {
    navigation.pathname = '/system/resources'
    mockPoll(summary)
    render(sidebar())

    const system = screen.getByRole('link', { name: 'System' })
    const toggle = screen.getByRole('button', { name: 'Collapse System menu' })
    expect(system).toHaveAttribute('href', '/system/resources')
    expect(system).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Resource usage' })).toBeNull()
    expect(system).not.toHaveAccessibleDescription()
    fireEvent.click(toggle)
    expect(toggle).toHaveAccessibleName('Expand System menu')
    expect(system).toHaveAccessibleDescription('System degraded')
    expect(screen.queryByRole('link', { name: 'Services' })).toBeNull()

    fireEvent.click(toggle)
    expect(system).not.toHaveAccessibleDescription()
    expect(screen.getByRole('link', { name: 'Services' })).toHaveAccessibleDescription('System degraded')
  })

  it('marks OCR as current when its view is selected', () => {
    navigation.pathname = '/platform/services'
    navigation.search = 'service=ocr'
    mockPoll(summary)
    render(sidebar())

    expect(screen.getByRole('link', { name: 'OCR perception' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Services' })).not.toHaveAttribute('aria-current')
  })
})

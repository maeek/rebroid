import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { getOrchestratorHealthSummaryAction } from '@/server/orchestrator/diagnostics/actions'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { OrchestratorStatus } from './orchestrator-status'
import type { OrchestratorHealth, ServiceHealth } from '@/shared/contracts/diagnostics'
import type { FeatureFlagManifest, FeatureFlagState } from '@/shared/contracts/feature-flags'

vi.mock('@/hooks/use-polling-query', () => ({
  usePollingQuery: vi.fn()
}))
vi.mock('@/server/orchestrator/diagnostics/actions', () => ({
  getOrchestratorHealthSummaryAction: vi.fn()
}))

const healthy = { ok: true, status: 'healthy', message: 'Healthy' } satisfies ServiceHealth
const healthySummary: OrchestratorHealth = {
  ok: true,
  docker: true,
  runtime: true,
  display: true,
  firewall: true,
  ocr: true,
  services: {
    orchestrator: healthy,
    docker: healthy,
    runtime: healthy,
    display: healthy,
    firewall: healthy,
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

const status = (manifest: FeatureFlagManifest | null = null) => (
  <FeatureFlagsProvider manifest={manifest}>
    <OrchestratorStatus />
  </FeatureFlagsProvider>
)

const mockPoll = (data?: OrchestratorHealth, error?: Error) =>
  vi.mocked(usePollingQuery).mockReturnValue({
    data,
    error,
    isLoading: !data && !error,
    isValidating: false,
    mutate: vi.fn()
  })

describe('OrchestratorStatus', () => {
  it('polls the shallow diagnostics summary and shows Healthy when services are online', async () => {
    mockPoll()
    vi.mocked(getOrchestratorHealthSummaryAction).mockResolvedValue(healthySummary)

    const { rerender } = render(status())

    expect(usePollingQuery).toHaveBeenCalledWith('orchestrator:health', expect.any(Function), {
      enabled: true,
      intervalMs: 10_000
    })
    await expect(vi.mocked(usePollingQuery).mock.calls[0]?.[1]()).resolves.toBe(healthySummary)
    expect(getOrchestratorHealthSummaryAction).toHaveBeenCalledTimes(1)

    mockPoll(healthySummary)
    rerender(status())
    expect(screen.getByRole('button', { name: 'Service status: Healthy' })).toHaveTextContent('Healthy')
  })

  it('links service health rows to their service pages and editors', () => {
    mockPoll()

    render(status())
    fireEvent.click(screen.getByRole('button', { name: /checking/i }))

    expect(screen.getByRole('link', { name: /casting/i }).getAttribute('href')).toBe('/platform/casting')
    expect(screen.getByRole('link', { name: /firewall/i }).getAttribute('href')).toBe('/security/firewall')
    expect(screen.getByRole('link', { name: /ocr/i }).getAttribute('href')).toBe('/platform/services?service=ocr')
  })

  it('hides services reported disabled and shows offline services when polling fails', () => {
    const summary: OrchestratorHealth = {
      ...healthySummary,
      ok: false,
      firewall: false,
      services: {
        ...healthySummary.services,
        ocr: { ok: true, status: 'disabled', message: 'OCR is disabled.' },
        firewall: { ok: false, status: 'offline', message: 'Firewall agent could not be reached.' }
      }
    }
    mockPoll(summary)
    const { rerender } = render(status())
    fireEvent.click(screen.getByRole('button', { name: 'Service status: Degraded' }))
    expect(screen.queryByRole('link', { name: /^OCR\b/i })).toBeNull()
    expect(screen.getByRole('link', { name: /^Firewall\b/i })).toHaveTextContent('offline')

    mockPoll(summary, new Error('Orchestrator unavailable'))
    rerender(status())
    expect(screen.queryByRole('link', { name: /^OCR\b/i })).toBeNull()
    expect(screen.getByRole('link', { name: /^Firewall\b/i })).toHaveTextContent('offline')
  })

  it('uses known feature flags before health is available and during an outage', () => {
    const manifest = { revision: 1, features: [feature('feature.ocr', false), feature('feature.firewall', true)] }
    mockPoll()
    const { rerender } = render(status(manifest))
    fireEvent.click(screen.getByRole('button', { name: 'Service status: Checking' }))
    expect(screen.queryByRole('link', { name: /^OCR\b/i })).toBeNull()
    expect(screen.getByRole('link', { name: /^Firewall\b/i })).toBeInTheDocument()

    mockPoll(undefined, new Error('Orchestrator unavailable'))
    rerender(status(manifest))
    expect(screen.queryByRole('link', { name: /^OCR\b/i })).toBeNull()
    expect(screen.getByRole('link', { name: /^Firewall\b/i })).toHaveTextContent('offline')
  })
})

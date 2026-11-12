import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { ProtectedShell } from './protected-shell'

vi.mock('next/navigation', () => ({ usePathname: () => '/apps', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/hooks/use-polling-query', () => ({
  usePollingQuery: vi.fn(() => ({ isLoading: false, mutate: vi.fn() }))
}))

describe('protected shell service health', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('omits service navigation and diagnostics polling for a non-admin account', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    render(
      <TooltipProvider>
        <FeatureFlagsProvider manifest={null}>
          <ProtectedShell user={{ name: 'Test user', avatarDataUrl: null, isPlatformAdmin: false }}>
            Apps
          </ProtectedShell>
        </FeatureFlagsProvider>
      </TooltipProvider>
    )

    expect(screen.getAllByRole('button', { name: 'Notifications' })).toHaveLength(2)
    expect(screen.queryByRole('link', { name: 'Services' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.queryByRole('button', { name: 'System' })).toBeNull()
    expect(vi.mocked(usePollingQuery).mock.calls.map(([key]) => key)).not.toContain('orchestrator:health')
  })

  it('polls recent applications on mobile only while the navigation drawer is open', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    render(
      <TooltipProvider>
        <FeatureFlagsProvider manifest={null}>
          <ProtectedShell user={{ name: 'Test user', avatarDataUrl: null, isPlatformAdmin: false }}>
            Apps
          </ProtectedShell>
        </FeatureFlagsProvider>
      </TooltipProvider>
    )
    const enabledRecentReads = () =>
      vi
        .mocked(usePollingQuery)
        .mock.calls.filter(([key, , options]) => key === 'navigation:recent-apps' && options?.enabled)

    expect(enabledRecentReads()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(enabledRecentReads().length).toBeGreaterThan(0)
    vi.mocked(usePollingQuery).mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }))
    expect(enabledRecentReads()).toHaveLength(0)
  })
})

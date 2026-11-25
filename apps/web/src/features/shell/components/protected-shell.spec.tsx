import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { usePollingQuery } from '@/hooks/use-polling-query'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { ProtectedShell } from './protected-shell'

vi.mock('next/navigation', () => ({
  usePathname: () => '/devices',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() })
}))
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

    expect(screen.queryByRole('link', { name: 'Services' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(screen.queryByRole('button', { name: 'System' })).toBeNull()
    expect(vi.mocked(usePollingQuery).mock.calls.map(([key]) => key)).not.toContain('orchestrator:health')
  })

  it('starts loading recent apps before the mobile drawer opens and refreshes them on open', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const refresh = vi.fn().mockResolvedValue([])
    vi.mocked(usePollingQuery).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: true,
      replaceData: vi.fn(),
      mutate: refresh
    })
    render(
      <TooltipProvider>
        <FeatureFlagsProvider manifest={null}>
          <ProtectedShell user={{ name: 'Test user', avatarDataUrl: null, isPlatformAdmin: false }}>
            Apps
          </ProtectedShell>
        </FeatureFlagsProvider>
      </TooltipProvider>
    )

    expect(usePollingQuery).toHaveBeenLastCalledWith('navigation:recent-apps', expect.any(Function), {
      enabled: true,
      intervalMs: null
    })
    expect(refresh).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(refresh).toHaveBeenCalledOnce()
  })
})

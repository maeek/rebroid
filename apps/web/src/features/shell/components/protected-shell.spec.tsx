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
})

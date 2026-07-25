import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { PlatformServicesPage } from './services-page'
import type { FeatureFlagManifest, FeatureFlagState } from '@/shared/contracts/feature-flags'

vi.mock('next/navigation', () => ({
  usePathname: () => '/platform/services',
  useRouter: () => ({ replace: vi.fn() })
}))

const feature = (key: FeatureFlagState['key']): FeatureFlagState => ({
  key,
  owner: 'display',
  description: 'Service feature.',
  control: 'runtime',
  mutable: true,
  enabled: true,
  supported: true,
  effective: true,
  syncStatus: 'applied',
  disablePolicy: 'block_new',
  lifecycle: 'permanent',
  removalCondition: null,
  revision: 1,
  dependencies: [],
  conflicts: []
})

const manifest: FeatureFlagManifest = {
  revision: 1,
  features: [feature('feature.ocr'), feature('feature.firewall')]
}

describe('PlatformServicesPage', () => {
  it('shows Display as a service row linking to session management', () => {
    render(
      <FeatureFlagsProvider manifest={manifest}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialDisplayHealth={{
            ok: true,
            status: 'healthy',
            message: 'Display sidecar API is responding.'
          }}
        />
      </FeatureFlagsProvider>
    )

    const displayRow = screen.getByRole('row', { name: /Display service/ })
    const sessionsLink = screen.getByRole('link', { name: 'View sessions' })

    expect(displayRow).toHaveTextContent('Healthy')
    expect(displayRow).toHaveTextContent('Managed internally')
    expect(sessionsLink.getAttribute('href')).toBe('/platform/services/display-sessions')
    expect(screen.queryByRole('navigation', { name: 'Services pages' })).toBeNull()
  })
})

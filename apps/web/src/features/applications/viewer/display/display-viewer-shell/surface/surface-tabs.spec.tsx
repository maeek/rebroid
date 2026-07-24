import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { SurfaceTabs } from './surface-tabs'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'
import type { FeatureFlagManifest } from '@/shared/contracts/feature-flags'

const mainSurface: DisplayViewerSurface = {
  id: 'main',
  surfaceId: 'main',
  sessionId: 'session-1',
  kind: 'main',
  name: 'Main display',
  src: 'https://example.test/viewer',
  popoutUrl: 'https://example.test/popout',
  displaySize: { width: 1080, height: 1920 }
}

const manifest = (enabled: boolean): FeatureFlagManifest => ({
  revision: 1,
  features: [
    {
      key: 'feature.display-virtual',
      owner: 'display',
      revision: 1,
      description: 'Experimental virtual display sessions.',
      control: 'runtime',
      mutable: true,
      enabled,
      supported: true,
      effective: enabled,
      syncStatus: 'applied',
      disablePolicy: 'drain_active',
      lifecycle: 'permanent',
      removalCondition: null,
      dependencies: [],
      conflicts: []
    }
  ]
})

const renderSurfaceTabs = (enabled: boolean) =>
  render(
    <FeatureFlagsProvider manifest={manifest(enabled)}>
      <SurfaceTabs
        activeSurface={mainSurface}
        isAddingDisplay={false}
        surfaces={[mainSurface]}
        onAddDisplay={vi.fn()}
        onSelectSurface={vi.fn()}
        onScrollSurfaceIntoView={vi.fn()}
      />
    </FeatureFlagsProvider>
  )

describe('SurfaceTabs', () => {
  it('hides the surface selector when virtual displays are disabled', () => {
    const { container } = renderSurfaceTabs(false)

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: 'Main display' })).not.toBeInTheDocument()
  })

  it('shows the main display selector when virtual displays are enabled', () => {
    renderSurfaceTabs(true)

    expect(screen.getByRole('button', { name: 'Main display' })).toBeVisible()
  })
})

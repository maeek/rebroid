import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { PlatformServicesPage } from './services-page'
import { servicesPreviewHealth } from './services-preview'
import type { FeatureFlagManifest, FeatureFlagState } from '@/shared/contracts/feature-flags'

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn()
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/platform/services',
  useRouter: () => navigation
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
  it('shows one page failure instead of unknown rows and editable fallback settings on initial outage', () => {
    render(
      <FeatureFlagsProvider manifest={manifest}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={null}
        />
      </FeatureFlagsProvider>
    )
    expect(screen.getByRole('heading', { name: 'Services unavailable' })).toBeVisible()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('shows all five services with observed health and infrastructure destinations', () => {
    render(
      <FeatureFlagsProvider manifest={manifest}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={servicesPreviewHealth}
        />
      </FeatureFlagsProvider>
    )
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(6)
    expect(within(screen.getByRole('table')).getAllByRole('link', { name: 'View details' })).toHaveLength(5)
    const docker = screen.getByRole('row', { name: 'View details for Docker' })
    expect(docker).toHaveTextContent('Healthy')
    expect(within(docker).getByRole('link', { name: 'Docker' })).toHaveAttribute('href', '/runtime/docker')
    expect(screen.getByRole('row', { name: 'View details for Firewall agent' })).toHaveTextContent('Offline')
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByText('Configured')).not.toBeInTheDocument()
  })
  it('shows Display as a service row linking to Casting', () => {
    render(
      <FeatureFlagsProvider manifest={manifest}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={servicesPreviewHealth}
          containers={{ display: { id: 'display-id', name: 'rebroid-display-sidecar' } }}
        />
      </FeatureFlagsProvider>
    )

    const displayRow = screen.getByRole('row', { name: /Display service/ })
    const sessionsLink = within(displayRow).getByRole('link', { name: 'View details' })

    expect(displayRow).toHaveTextContent('Healthy')
    expect(displayRow).toHaveTextContent('Managed internally')
    expect(sessionsLink.getAttribute('href')).toBe('/platform/casting')
    const containerLink = within(displayRow).getByRole('link', { name: 'Open Docker container for Display service' })
    const logsLink = within(displayRow).getByRole('link', { name: 'View logs for Display service' })
    expect(containerLink).toHaveAttribute('href', '/runtime/containers/display-id')
    expect(logsLink).toHaveAttribute('href', '/runtime/containers/display-id?view=logs')
    expect(containerLink).not.toHaveAttribute('data-slot', 'button')
    expect(logsLink).not.toHaveAttribute('data-slot', 'button')
    expect(screen.queryByRole('navigation', { name: 'Services sections' })).toBeNull()
  })

  it('opens the service destination when its row is activated', () => {
    render(
      <FeatureFlagsProvider manifest={manifest}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={servicesPreviewHealth}
        />
      </FeatureFlagsProvider>
    )

    const ocr = screen.getByRole('row', { name: 'View details for OCR perception' })
    expect(within(ocr).getByRole('link', { name: 'OCR perception' })).toHaveAttribute('href', '/platform/ocr')
    fireEvent.click(ocr)
    expect(navigation.push).toHaveBeenCalledWith('/platform/ocr')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(navigation.replace).not.toHaveBeenCalled()
    expect(navigation.refresh).not.toHaveBeenCalled()
    const firewall = screen.getByRole('row', { name: 'View details for Firewall agent' })
    expect(within(firewall).getByRole('link', { name: 'Firewall agent' })).toHaveAttribute('href', '/security/firewall')
    fireEvent.click(firewall)
    expect(navigation.push).toHaveBeenCalledWith('/security/firewall')

    fireEvent.keyDown(screen.getByRole('row', { name: 'View details for Display service' }), { key: 'Enter' })

    expect(navigation.push).toHaveBeenCalledWith('/platform/casting')
  })

  it('hides services for disabled or unsupported features even if their health was previously available', () => {
    render(
      <FeatureFlagsProvider
        manifest={{
          revision: 1,
          features: [
            { ...feature('feature.ocr'), enabled: false },
            { ...feature('feature.firewall'), supported: false }
          ]
        }}
      >
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={servicesPreviewHealth}
        />
      </FeatureFlagsProvider>
    )
    expect(screen.getByRole('link', { name: 'Display service' })).toHaveAttribute('href', '/platform/casting')
    expect(screen.queryByRole('columnheader', { name: 'Timeout' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Settings' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('row', { name: /OCR perception|Firewall agent/ })).toBeNull()
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4)
  })

  it('uses reported disabled status when the feature manifest is unavailable', () => {
    render(
      <FeatureFlagsProvider manifest={null}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={servicesPreviewHealth}
        />
      </FeatureFlagsProvider>
    )
    expect(screen.queryByRole('row', { name: /OCR perception/ })).toBeNull()
    expect(screen.getByRole('row', { name: /Firewall agent/ })).toHaveTextContent('Offline')
  })
})

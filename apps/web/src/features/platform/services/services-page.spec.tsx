import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { saveOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { PlatformServicesPage } from './services-page'
import { servicesPreviewHealth } from './services-preview'
import type { FeatureFlagManifest, FeatureFlagState } from '@/shared/contracts/feature-flags'

vi.mock('@/shared/model/settings/use-orchestrator-ui-settings', () => ({
  saveOrchestratorUiSettings: vi.fn()
}))

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
  beforeEach(() => {
    window.history.replaceState(null, '', '/platform/services')
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
    const docker = screen.getByRole('row', { name: 'View diagnostics for Docker' })
    expect(docker).toHaveTextContent('Healthy')
    expect(within(docker).getByRole('link', { name: 'Docker' })).toHaveAttribute(
      'href',
      '/platform/services?service=docker'
    )
    expect(screen.getByRole('row', { name: 'Edit Firewall agent' })).toHaveTextContent('Offline')
    expect(screen.queryByText('Configured')).not.toBeInTheDocument()
  })
  it('shows Display as a service row linking to session management', () => {
    render(
      <FeatureFlagsProvider manifest={manifest}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={servicesPreviewHealth}
        />
      </FeatureFlagsProvider>
    )

    const displayRow = screen.getByRole('row', { name: /Display service/ })
    const sessionsLink = screen.getByRole('link', { name: 'View sessions' })

    expect(displayRow).toHaveTextContent('Healthy')
    expect(displayRow).toHaveTextContent('Managed internally')
    expect(sessionsLink.getAttribute('href')).toBe('/platform/services/display-sessions')
    const serviceNavigation = screen.getByRole('navigation', { name: 'Services sections' })
    expect(within(serviceNavigation).getByRole('link', { name: 'Features' })).toHaveAttribute(
      'href',
      '/platform/features'
    )
    expect(within(serviceNavigation).getByRole('link', { name: 'Connections' })).toHaveAttribute('aria-current', 'page')
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

    fireEvent.click(screen.getByRole('row', { name: 'Edit OCR perception' }))

    expect(screen.getByRole('dialog', { name: 'OCR perception' })).toBeInTheDocument()
    expect(window.location.search).toBe('?service=ocr')
    expect(navigation.replace).not.toHaveBeenCalled()
    expect(navigation.refresh).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(window.location.search).toBe('')
    fireEvent.keyDown(screen.getByRole('row', { name: 'View sessions for Display service' }), { key: 'Enter' })

    expect(navigation.push).toHaveBeenCalledWith('/platform/services/display-sessions')
  })

  it('keeps the filtered grid mounted while opening and closing a service editor', async () => {
    window.history.replaceState(null, '', '/platform/services?source=health#connections')
    render(
      <FeatureFlagsProvider manifest={manifest}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={servicesPreviewHealth}
        />
      </FeatureFlagsProvider>
    )
    const search = screen.getByPlaceholderText('Search services')
    fireEvent.change(search, { target: { value: 'Firewall' } })
    const row = screen.getByRole('row', { name: 'Edit Firewall agent' })
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('dialog', { name: 'Firewall agent' })).toBeInTheDocument()
    expect(window.location.search).toBe('?source=health&service=firewall')
    expect(window.location.hash).toBe('#connections')
    fireEvent.change(screen.getByLabelText('Endpoint'), { target: { value: '/tmp/another-agent.sock' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('row', { name: 'Edit Firewall agent' })).toBe(row)
    expect(search).toHaveValue('Firewall')
    expect(window.location.search).toBe('?source=health')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(navigation.replace).not.toHaveBeenCalled()
    expect(navigation.push).not.toHaveBeenCalled()
    expect(navigation.refresh).not.toHaveBeenCalled()
  })

  it('opens an enabled service deep link without navigating and stays closed after a health refresh', async () => {
    window.history.replaceState(null, '', '/platform/services?service=firewall')
    const page = (flags: FeatureFlagManifest) => (
      <FeatureFlagsProvider manifest={flags}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={servicesPreviewHealth}
          requestedServiceId='firewall'
        />
      </FeatureFlagsProvider>
    )
    const { rerender } = render(page(manifest))
    expect(screen.getByRole('dialog', { name: 'Firewall agent' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    rerender(page(structuredClone(manifest)))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(navigation.replace).not.toHaveBeenCalled()
  })

  it('keeps disabled services discoverable without opening their configuration or save actions', () => {
    render(
      <FeatureFlagsProvider manifest={{ revision: 1, features: [] }}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={servicesPreviewHealth}
          requestedServiceId='ocr'
        />
      </FeatureFlagsProvider>
    )
    expect(screen.getByRole('link', { name: 'Display service' })).toHaveAttribute(
      'href',
      '/platform/services/display-sessions'
    )
    expect(screen.queryByRole('columnheader', { name: 'Timeout' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Settings' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    const ocr = screen.getByRole('row', { name: 'Manage feature for OCR perception' })
    expect(within(ocr).getByRole('link', { name: 'Manage feature' })).toHaveAttribute(
      'href',
      '/platform/features#feature.ocr'
    )
    expect(ocr).toHaveTextContent('Disabled')
  })

  it('keeps dialog edits as drafts until Save and sends only service settings', async () => {
    const endpoint = 'http://ocr-sidecar:4300'
    const services = {
      ...defaultOrchestratorUiSettings.services,
      ocr: { ...defaultOrchestratorUiSettings.services.ocr, endpoint, timeoutMs: 20000 }
    }
    vi.mocked(saveOrchestratorUiSettings).mockResolvedValue({ ...defaultOrchestratorUiSettings, services })
    const { rerender } = render(
      <FeatureFlagsProvider manifest={manifest}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={servicesPreviewHealth}
        />
      </FeatureFlagsProvider>
    )
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'OCR perception' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Endpoint'), { target: { value: endpoint } })
    fireEvent.change(within(dialog).getByLabelText('Timeout'), { target: { value: '20000' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    rerender(
      <FeatureFlagsProvider manifest={manifest}>
        <PlatformServicesPage
          initialSettings={structuredClone(defaultOrchestratorUiSettings)}
          initialHealth={servicesPreviewHealth}
        />
      </FeatureFlagsProvider>
    )
    expect(saveOrchestratorUiSettings).not.toHaveBeenCalled()
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await waitFor(() =>
      expect(saveOrchestratorUiSettings).toHaveBeenCalledWith({
        services
      })
    )
    await waitFor(() => expect(save).toBeDisabled())
  })

  it('retains connection drafts after a failed save and unrelated server refresh', async () => {
    vi.mocked(saveOrchestratorUiSettings).mockRejectedValueOnce(new Error('offline'))
    const renderPage = (refreshSeconds: number) => (
      <FeatureFlagsProvider manifest={manifest}>
        <PlatformServicesPage
          initialSettings={{ ...defaultOrchestratorUiSettings, appListRefreshIntervalSeconds: refreshSeconds }}
          initialHealth={servicesPreviewHealth}
        />
      </FeatureFlagsProvider>
    )
    const { rerender } = render(renderPage(5))
    fireEvent.click(screen.getByRole('button', { name: 'OCR perception' }))
    fireEvent.change(await screen.findByLabelText('Endpoint'), { target: { value: 'http://ocr:4300' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
    rerender(renderPage(10))
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved connection changes')
    fireEvent.click(screen.getByRole('button', { name: 'OCR perception' }))
    expect(await screen.findByLabelText('Endpoint')).toHaveValue('http://ocr:4300')
  })

  it('discards only local service edits without resetting runtime defaults', async () => {
    render(
      <FeatureFlagsProvider manifest={manifest}>
        <PlatformServicesPage
          initialSettings={defaultOrchestratorUiSettings}
          initialHealth={servicesPreviewHealth}
        />
      </FeatureFlagsProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'OCR perception' }))
    fireEvent.change(await screen.findByLabelText('Endpoint'), { target: { value: 'http://ocr:4300' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved connection changes')
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(saveOrchestratorUiSettings).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'OCR perception' }))
    expect(await screen.findByLabelText('Endpoint')).toHaveValue('')
  })
})

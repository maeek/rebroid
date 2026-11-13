import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeatureFlagsProvider } from '@/shared/model/features/feature-flags-context'
import { defaultOrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'
import { saveOrchestratorUiSettings } from '@/shared/model/settings/use-orchestrator-ui-settings'
import { ServiceSettingsPage } from './service-settings-page'
import { servicesPreviewManifest } from './services-preview'
import type { ServiceId } from './service-definitions'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/shared/model/settings/use-orchestrator-ui-settings', () => ({
  saveOrchestratorUiSettings: vi.fn()
}))

const initialSettings = {
  ...defaultOrchestratorUiSettings.services,
  ocr: { ...defaultOrchestratorUiSettings.services.ocr, endpoint: 'http://ocr.test' }
}
const page = (serviceId: ServiceId, enabled = true, available = true) => (
  <FeatureFlagsProvider manifest={servicesPreviewManifest(enabled)}>
    <ServiceSettingsPage
      serviceId={serviceId}
      initialHealth={
        enabled
          ? { ok: true, status: 'healthy', message: 'Service is responding.' }
          : { ok: false, status: 'disabled', message: 'Service is disabled.' }
      }
      initialSettings={available ? initialSettings[serviceId] : undefined}
      container={available ? { id: `${serviceId}-id`, name: `rebroid-${serviceId}` } : undefined}
    />
  </FeatureFlagsProvider>
)

describe('Service settings detail', () => {
  it('validates, discards, and saves OCR settings on the page', async () => {
    const ocr = { ...initialSettings.ocr, language: 'de' }
    vi.mocked(saveOrchestratorUiSettings).mockResolvedValue({
      ...defaultOrchestratorUiSettings,
      services: { ...defaultOrchestratorUiSettings.services, ocr }
    })
    render(page('ocr'))

    const endpoint = screen.getByRole('textbox', { name: 'Endpoint' })
    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    fireEvent.change(endpoint, { target: { value: 'ftp://ocr.test' } })
    expect(endpoint).toHaveAttribute('aria-invalid', 'true')
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(endpoint).toHaveValue(initialSettings.ocr.endpoint)

    fireEvent.change(screen.getByRole('textbox', { name: 'Language' }), { target: { value: 'de' } })
    fireEvent.click(save)
    await waitFor(() => expect(saveOrchestratorUiSettings).toHaveBeenCalledExactlyOnceWith({ services: { ocr } }))
    await waitFor(() => expect(save).toBeDisabled())
  })

  it('validates timeout and saves only the firewall connection settings', async () => {
    const firewall = { endpoint: '/run/another-agent.sock', timeoutMs: 6000 }
    vi.mocked(saveOrchestratorUiSettings)
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce({
        ...defaultOrchestratorUiSettings,
        services: { ...initialSettings, firewall }
      })
    render(page('firewall'))
    expect(screen.getByRole('heading', { level: 1, name: 'Firewall' })).toBeVisible()
    expect(screen.queryByRole('textbox', { name: 'Language' })).toBeNull()

    const endpoint = screen.getByRole('textbox', { name: 'Endpoint' })
    const timeout = screen.getByRole('spinbutton', { name: 'Timeout' })
    const save = screen.getByRole('button', { name: 'Save' })
    fireEvent.change(endpoint, { target: { value: firewall.endpoint } })
    fireEvent.change(timeout, { target: { value: '99' } })
    expect(save).toBeDisabled()
    fireEvent.change(timeout, { target: { value: '6000' } })
    fireEvent.click(save)
    await waitFor(() => expect(save).toBeEnabled())
    expect(endpoint).toHaveValue(firewall.endpoint)
    expect(timeout).toHaveValue(6000)

    fireEvent.click(save)
    await waitFor(() => expect(save).toBeDisabled())
    expect(saveOrchestratorUiSettings).toHaveBeenNthCalledWith(2, { services: { firewall } })
    fireEvent.change(endpoint, { target: { value: 'http://firewall.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(endpoint).toHaveValue(firewall.endpoint)
  })

  it.each(['ocr', 'firewall'] as const)('retains the %s draft when the service page cannot refresh', serviceId => {
    const { rerender } = render(page(serviceId))
    expect(screen.getByRole('status')).toHaveTextContent('Healthy')
    expect(screen.queryByText('Service is responding.')).toBeNull()
    const endpoint = screen.getByRole('textbox', { name: 'Endpoint' })
    fireEvent.change(endpoint, { target: { value: 'http://draft.test' } })
    rerender(page(serviceId, true, false))
    expect(screen.getByRole('status')).toHaveTextContent('settings unavailable')
    expect(screen.queryByText('Healthy')).toBeNull()
    expect(endpoint).toBeDisabled()
    expect(endpoint).toHaveValue('http://draft.test')
    rerender(page(serviceId))
    expect(endpoint).toBeEnabled()
    expect(endpoint).toHaveValue('http://draft.test')
  })

  it.each(['ocr', 'firewall'] as const)('links to the %s container while the endpoint matches', serviceId => {
    render(page(serviceId))
    const containerName = `rebroid-${serviceId}`
    expect(screen.getByRole('link', { name: containerName })).toHaveAttribute(
      'href',
      `/runtime/containers/${serviceId}-id`
    )
    expect(screen.getByRole('link', { name: 'View logs' })).toHaveAttribute(
      'href',
      `/runtime/containers/${serviceId}-id?view=logs`
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Endpoint' }), { target: { value: 'http://draft.test' } })
    expect(screen.queryByRole('link', { name: containerName })).toBeNull()
    expect(screen.queryByRole('link', { name: 'View logs' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.getByRole('link', { name: containerName })).toBeVisible()
  })

  it.each(['ocr', 'firewall'] as const)('shows saved settings read-only when %s is disabled', serviceId => {
    render(page(serviceId, false))
    expect(screen.getByRole('textbox', { name: 'Endpoint' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Manage feature' })).toHaveAttribute(
      'href',
      `/platform/features#feature.${serviceId}`
    )
  })
})

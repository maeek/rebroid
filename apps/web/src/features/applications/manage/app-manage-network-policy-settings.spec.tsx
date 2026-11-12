import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FormLoadingBoundary } from '@/components/ui/form-loading-boundary'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { toast } from '@/hooks/use-toast'
import { getBff } from '@/lib/http/bff'
import {
  applyNetworkPolicyAction,
  updateNetworkPolicyAction
} from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import { ActionResultError, actionError, actionOk } from '@/shared/actions/action-result'
import { applicationPreview } from '@/shared/testing/application-preview'
import { AppManageNetworkPolicySettings, AppNetworkPolicySettingsLoading } from './app-manage-network-policy-settings'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/configuration/network-policy-actions', () => ({
  applyNetworkPolicyAction: vi.fn(),
  updateNetworkPolicyAction: vi.fn()
}))
vi.mock('@/lib/http/bff', () => ({ getBff: vi.fn() }))

const updateWithDestinations = (allowCidrs: string[]) => ({
  ...applicationPreview,
  network: { ...applicationPreview.network, policy: { ...applicationPreview.network.policy, allowCidrs } }
})

const renderSettings = () => {
  const onUpdated = vi.fn()
  render(
    <AppManageNetworkPolicySettings
      app={mapAndroidApplicationToAppDefinition(applicationPreview)}
      canUseInternet
      onUpdated={onUpdated}
    />
  )
  return { onUpdated }
}

const saveDestinations = (value: string) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Additional IPv4 destinations' }), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Save network access' }))
}

describe('App network policy settings', () => {
  beforeEach(() => vi.resetAllMocks())

  it('edits saved destinations directly and reports when changes take effect', async () => {
    const cidrs = ['10.0.0.0/24', '192.0.2.10/32']
    vi.mocked(updateNetworkPolicyAction).mockResolvedValue(actionOk(updateWithDestinations(cidrs)))
    const { onUpdated } = renderSettings()
    expect(screen.getByRole('button', { name: 'Save network access' })).toBeDisabled()
    expect(screen.getByText('On next start')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Additional IPv4 destinations' })).toHaveValue('10.0.0.0/24')

    saveDestinations('10.0.0.0/24\n192.0.2.10')

    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ networkPolicyAllowCidrs: cidrs }))
    )
    expect(updateNetworkPolicyAction).toHaveBeenCalledExactlyOnceWith(applicationPreview.id, {
      networkPolicyAllowCidrs: cidrs
    })
    expect(applyNetworkPolicyAction).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
  })

  it('clears the saved destinations when the list is emptied', async () => {
    vi.mocked(updateNetworkPolicyAction).mockResolvedValue(actionOk(updateWithDestinations([])))
    renderSettings()
    saveDestinations('')

    await waitFor(() =>
      expect(updateNetworkPolicyAction).toHaveBeenCalledExactlyOnceWith(applicationPreview.id, {
        networkPolicyAllowCidrs: []
      })
    )
  })

  it('shows a line error and preserves the text when a destination is invalid', () => {
    renderSettings()
    saveDestinations('10.0.0.0/24\nnot-an-ip')

    const list = screen.getByRole('textbox', { name: 'Additional IPv4 destinations' })
    expect(list).toHaveAccessibleDescription(/Line 2 has an invalid IPv4 address or range/)
    expect(list).toHaveValue('10.0.0.0/24\nnot-an-ip')
    expect(updateNetworkPolicyAction).not.toHaveBeenCalled()
  })

  it('keeps a failed draft available for correction or retry', async () => {
    vi.mocked(updateNetworkPolicyAction).mockResolvedValue(
      actionError({ message: 'Wait for the app to finish starting.', code: 'conflict' }, 'net-123')
    )
    const { onUpdated } = renderSettings()
    saveDestinations('10.0.0.0/24\n192.0.2.10')

    expect(await screen.findByRole('alert')).toHaveTextContent('Request ID net-123')
    expect(onUpdated).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Additional IPv4 destinations' })).toHaveValue('10.0.0.0/24\n192.0.2.10')
    expect(screen.getByRole('button', { name: 'Save network access' })).toBeEnabled()
  })

  it('distinguishes a saved policy from a failed live enforcement attempt', async () => {
    const cidrs = ['10.0.0.0/24', '192.0.2.10/32']
    vi.mocked(updateNetworkPolicyAction).mockResolvedValue(
      actionError({ message: 'The firewall is unavailable.', code: 'upstream_error' })
    )
    vi.mocked(getBff).mockResolvedValue(updateWithDestinations(cidrs))
    const { onUpdated } = renderSettings()
    saveDestinations('10.0.0.0/24\n192.0.2.10')

    expect(await screen.findByRole('alert')).toHaveTextContent('Settings saved. Check firewall enforcement.')
    expect(getBff).toHaveBeenCalledWith(`/api/bff/applications/${applicationPreview.id}`)
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ networkPolicyAllowCidrs: cidrs }))
    expect(toast).not.toHaveBeenCalled()
  })

  it('keeps the draft and exposes both request IDs when recovery also fails', async () => {
    vi.mocked(updateNetworkPolicyAction).mockResolvedValue(
      actionError({ message: 'The firewall is unavailable.', code: 'upstream_error' }, 'save-1')
    )
    vi.mocked(getBff).mockRejectedValue(
      new ActionResultError({
        message: 'The application is unavailable.',
        code: 'upstream_unavailable',
        requestId: 'read-2'
      })
    )
    renderSettings()
    const draft = '10.0.0.0/24\n192.0.2.10'
    saveDestinations(draft)

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('Request ID save-1')
    expect(notice).toHaveTextContent('Request ID read-2')
    expect(screen.getByRole('textbox', { name: 'Additional IPv4 destinations' })).toHaveValue(draft)
  })

  it('shows the Network settings shell without revealing an assumed outbound mode while loading', () => {
    render(
      <FormLoadingBoundary>
        <AppNetworkPolicySettingsLoading />
      </FormLoadingBoundary>
    )
    expect(screen.getByRole('heading', { name: 'Firewall enforcement' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Network access' })).toBeVisible()
    expect(screen.queryByText('Allow managed destinations and any IPv4 destinations you add.')).toBeNull()
    expect(screen.queryByText('Approved destinations only')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mapAndroidApplicationToAppDefinition } from '@/features/applications/domain/app-mapper'
import { toast } from '@/hooks/use-toast'
import {
  applyNetworkPolicyAction,
  updateNetworkPolicyAction
} from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import { actionError, actionOk } from '@/shared/actions/action-result'
import { applicationPreview } from '@/shared/testing/application-preview'
import { AppManageNetworkPolicySettings } from './app-manage-network-policy-settings'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/configuration/network-policy-actions', () => ({
  applyNetworkPolicyAction: vi.fn(),
  updateNetworkPolicyAction: vi.fn()
}))

const updated = {
  ...applicationPreview,
  network: { ...applicationPreview.network, policy: { ...applicationPreview.network.policy, enabled: false } }
}

describe('app network policy settings', () => {
  it.each(['Save policy', 'Apply now'])('disables restrictions with %s without applying twice', async label => {
    const onUpdated = vi.fn()
    vi.mocked(updateNetworkPolicyAction).mockResolvedValue(actionOk(updated))
    render(
      <AppManageNetworkPolicySettings
        app={mapAndroidApplicationToAppDefinition(applicationPreview)}
        onUpdated={onUpdated}
      />
    )
    fireEvent.click(screen.getByRole('combobox'))
    const option = await screen.findByRole('option', { name: 'Disabled' })
    fireEvent.pointerDown(option, { pointerType: 'mouse' })
    fireEvent.click(option)
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Disabled'))
    fireEvent.click(screen.getByRole('button', { name: label }))
    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ networkPolicyEnabled: false }))
    )
    expect(updateNetworkPolicyAction).toHaveBeenCalledExactlyOnceWith(applicationPreview.id, {
      networkPolicyEnabled: false,
      networkPolicyAllowCidrs: applicationPreview.network.policy.allowCidrs
    })
    expect(applyNetworkPolicyAction).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
  })

  it('shows a safe action failure and retains the draft for retry', async () => {
    vi.mocked(updateNetworkPolicyAction).mockResolvedValue(
      actionError({ message: 'Firewall enforcement is disabled.', code: 'conflict' })
    )
    const onUpdated = vi.fn()
    render(
      <AppManageNetworkPolicySettings
        app={mapAndroidApplicationToAppDefinition(applicationPreview)}
        onUpdated={onUpdated}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save policy' }))
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Firewall enforcement is disabled.',
          variant: 'danger'
        })
      )
    )
    expect(onUpdated).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save policy' })).toBeEnabled()
  })
})

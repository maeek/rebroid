import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
import {
  applyNetworkPolicyAction,
  reconcileNetworkPoliciesAction,
  updateNetworkPolicyAction
} from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getOrchestratorHealthAction } from '@/server/orchestrator/diagnostics/actions'
import { actionOk, actionError } from '@/shared/actions/action-result'
import { applicationPreview } from '@/shared/testing/application-preview'
import { FirewallSettings } from './firewall-settings'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/configuration/network-policy-actions', () => ({
  applyNetworkPolicyAction: vi.fn(),
  reconcileNetworkPoliciesAction: vi.fn(),
  updateNetworkPolicyAction: vi.fn()
}))
vi.mock('@/server/orchestrator/applications/actions/queries/listing-actions', () => ({
  listApplicationsAction: vi.fn()
}))
vi.mock('@/server/orchestrator/diagnostics/actions', () => ({ getOrchestratorHealthAction: vi.fn() }))
const health = { status: 'healthy' as const, ok: true, message: 'Policy agent is responding.' }
const applications = [applicationPreview, { ...applicationPreview, id: 'reports', name: 'Reports worker' }]
beforeEach(() => {
  vi.resetAllMocks()
})

describe('Network policies workflow', () => {
  it('exposes Reconcile all without selection and prevents repeated submission', async () => {
    let finish!: () => void
    vi.mocked(reconcileNetworkPoliciesAction).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () => resolve({ reconciled: 2 })
        })
    )
    vi.mocked(listApplicationsAction).mockResolvedValue(applications)
    vi.mocked(getOrchestratorHealthAction).mockResolvedValue({ services: { firewall: health } } as Awaited<
      ReturnType<typeof getOrchestratorHealthAction>
    >)
    render(
      <FirewallSettings
        initialHealth={health}
        initialApplications={applications}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reconcile all' }))
    expect(screen.getByRole('button', { name: 'Reconciling…' })).toBeDisabled()
    expect(reconcileNetworkPoliciesAction).toHaveBeenCalledOnce()
    await act(async () => {
      finish()
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reconcile all' })).toBeEnabled())
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
  })

  it('refreshes exactly once per request despite callback identity changes', async () => {
    vi.mocked(listApplicationsAction).mockResolvedValue(applications)
    vi.mocked(getOrchestratorHealthAction).mockResolvedValue({ services: { firewall: health } } as Awaited<
      ReturnType<typeof getOrchestratorHealthAction>
    >)
    const { rerender } = render(
      <FirewallSettings
        initialHealth={health}
        initialApplications={applications}
      />
    )
    const completed = vi.fn()
    rerender(
      <FirewallSettings
        initialHealth={health}
        initialApplications={applications}
        refreshKey={1}
        onRefreshComplete={() => {
          completed()
        }}
      />
    )
    await waitFor(() => expect(completed).toHaveBeenCalledOnce())
    rerender(
      <FirewallSettings
        initialHealth={health}
        initialApplications={applications}
        refreshKey={1}
        onRefreshComplete={() => {
          completed()
        }}
      />
    )
    expect(listApplicationsAction).toHaveBeenCalledOnce()
    expect(getOrchestratorHealthAction).toHaveBeenCalledOnce()
  })

  it('retains only failed policies for retry after a partial bulk failure', async () => {
    vi.mocked(applyNetworkPolicyAction)
      .mockResolvedValueOnce(actionOk(applicationPreview))
      .mockResolvedValueOnce(actionError({ message: 'Unavailable' }))
    render(
      <FirewallSettings
        initialHealth={health}
        initialApplications={applications}
      />
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select current page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reconcile 2 selected' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reconcile 1 selected' })).toBeEnabled())
    expect(within(screen.getByRole('row', { name: /Inventory worker/ })).getByRole('checkbox')).not.toBeChecked()
    expect(within(screen.getByRole('row', { name: /Reports worker/ })).getByRole('checkbox')).toBeChecked()
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'danger', description: '1 updated. 1 remain selected for retry.' })
    )
  })

  it('updates access with the existing payload and shows an explicit next action', async () => {
    const updated = {
      ...applicationPreview,
      network: { ...applicationPreview.network, policy: { ...applicationPreview.network.policy, enabled: false } }
    }
    vi.mocked(updateNetworkPolicyAction).mockResolvedValue(actionOk(updated))
    render(
      <FirewallSettings
        initialHealth={health}
        initialApplications={[applicationPreview]}
      />
    )
    fireEvent.click(screen.getByRole('switch', { name: 'Disable restricted network access for Inventory worker' }))
    await waitFor(() =>
      expect(
        screen.getByRole('switch', { name: 'Enable restricted network access for Inventory worker' })
      ).not.toBeChecked()
    )
    expect(updateNetworkPolicyAction).toHaveBeenCalledExactlyOnceWith(applicationPreview.id, {
      networkPolicyEnabled: false
    })
  })

  it('retains real filter controls during loading without claiming a health status', async () => {
    render(
      <FirewallSettings
        loading
        initialHealth={health}
        initialApplications={[]}
      />
    )
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByRole('combobox', { name: 'Restriction' })).toBeEnabled()
    expect(within(drawer).getByRole('combobox', { name: 'Runtime' })).toBeEnabled()
  })
})

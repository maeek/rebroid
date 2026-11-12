import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
import {
  applyNetworkPolicyAction,
  reconcileNetworkPoliciesAction
} from '@/server/orchestrator/applications/actions/configuration/network-policy-actions'
import { actionOk, actionError } from '@/shared/actions/action-result'
import { applicationPreview } from '@/shared/testing/application-preview'
import { FirewallSettings } from './firewall-settings'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/server/orchestrator/applications/actions/configuration/network-policy-actions', () => ({
  applyNetworkPolicyAction: vi.fn(),
  reconcileNetworkPoliciesAction: vi.fn()
}))
const applications = [applicationPreview, { ...applicationPreview, id: 'reports', name: 'Reports worker' }]
beforeEach(() => {
  vi.resetAllMocks()
})

describe('Network policies workflow', () => {
  it('offers Sync all rules without selection and prevents repeated submission', async () => {
    let finish!: () => void
    vi.mocked(reconcileNetworkPoliciesAction).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () => resolve({ reconciled: 2 })
        })
    )
    render(<FirewallSettings initialApplications={applications} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sync all rules' }))
    expect(screen.getByRole('button', { name: 'Syncing…' })).toBeDisabled()
    expect(reconcileNetworkPoliciesAction).toHaveBeenCalledOnce()
    await act(async () => {
      finish()
      await Promise.resolve()
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sync all rules' })).toBeEnabled())
    expect(refresh).toHaveBeenCalledOnce()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
  })

  it('renders the latest route data after a refresh', () => {
    const { rerender } = render(<FirewallSettings initialApplications={[applicationPreview]} />)
    expect(screen.queryByRole('link', { name: 'Reports worker' })).toBeNull()
    rerender(<FirewallSettings initialApplications={applications} />)
    expect(screen.getByRole('link', { name: 'Reports worker' })).toBeVisible()
  })

  it('retains only failed policies for retry after a partial bulk failure', async () => {
    vi.mocked(applyNetworkPolicyAction)
      .mockResolvedValueOnce(actionOk(applicationPreview))
      .mockResolvedValueOnce(actionError({ message: 'Unavailable' }))
    render(<FirewallSettings initialApplications={applications} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select current page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sync 2 selected' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sync 1 selected' })).toBeEnabled())
    expect(within(screen.getByRole('row', { name: /Inventory worker/ })).getByRole('checkbox')).not.toBeChecked()
    expect(within(screen.getByRole('row', { name: /Reports worker/ })).getByRole('checkbox')).toBeChecked()
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'danger', description: '1 synced. 1 remain selected for retry.' })
    )
  })

  it('keeps a failed policy selected when its new enforcement state falls outside the filter', async () => {
    const running = {
      ...applicationPreview,
      status: { ...applicationPreview.status, currentStatus: 'running' as const },
      network: { ...applicationPreview.network, policy: { ...applicationPreview.network.policy, result: null } }
    }
    const failed = {
      ...running,
      network: {
        ...running.network,
        policy: {
          ...running.network.policy,
          result: {
            status: 'error' as const,
            code: 'agent_unavailable' as const,
            message: 'Firewall unavailable',
            hint: null
          }
        }
      }
    }
    vi.mocked(applyNetworkPolicyAction).mockResolvedValue(actionOk(failed))
    render(<FirewallSettings initialApplications={[running, applications[1]]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const drawer = await screen.findByRole('dialog')
    fireEvent.click(within(drawer).getByRole('combobox', { name: 'Firewall enforcement' }))
    const unverified = await screen.findByRole('option', { name: 'Unverified' })
    fireEvent.pointerDown(unverified, { pointerType: 'mouse' })
    fireEvent.click(unverified)
    fireEvent.keyDown(drawer, { key: 'Escape' })
    await waitFor(() => expect(drawer).not.toBeVisible())
    expect(screen.queryByRole('link', { name: 'Reports worker' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select current page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sync 1 selected' }))

    expect(await screen.findByText('Needs attention')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Sync 1 selected' }))
    await waitFor(() => expect(applyNetworkPolicyAction).toHaveBeenCalledTimes(2))
    expect(applyNetworkPolicyAction).toHaveBeenLastCalledWith(running.id)
    expect(reconcileNetworkPoliciesAction).not.toHaveBeenCalled()
  })

  it('links to the network editor and separates configured access from enforcement', () => {
    render(<FirewallSettings initialApplications={[applicationPreview]} />)
    expect(screen.getByRole('link', { name: 'Inventory worker' })).toHaveAttribute(
      'href',
      '/app/preview-app?view=network'
    )
    expect(screen.getByText('Approved destinations only')).toBeVisible()
    expect(screen.getByText('On next start')).toBeVisible()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('retains real filter controls during loading', async () => {
    render(
      <FirewallSettings
        loading
        initialApplications={[]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByRole('combobox', { name: 'Outbound access' })).toBeEnabled()
    expect(within(drawer).getByRole('combobox', { name: 'Runtime' })).toBeEnabled()
  })
})

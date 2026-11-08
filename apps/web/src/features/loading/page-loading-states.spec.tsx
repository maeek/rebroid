import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreateAppPageLoading } from '@/features/applications/create/create-app-page-loading'
import { AppManagePageSkeleton, AppProfilesPageSkeleton } from '@/features/applications/detail/app-page-skeleton'
import {
  AutomationsListPageSkeleton,
  AutomationTriggersPageSkeleton
} from '@/features/automations/automations-page/automation-page-skeletons'
import { RuntimeContainerDetailPageLoading } from '@/features/platform/components/platform-page-skeletons/platform-container-detail-page-skeleton'
import {
  RuntimeImageDetailPageLoading,
  RuntimeNetworkDetailPageLoading
} from '@/features/platform/components/platform-page-skeletons/platform-resource-detail-page-skeleton'
import { InfrastructureServiceSkeleton } from '@/features/platform/services/infrastructure-service-skeleton'
import { ActivityPageSkeleton } from '@/features/settings/activity/activity-page-skeleton'
import { ProviderEditorSkeleton } from '@/features/settings/orchestrator/ai-providers/ai-provider-page-skeletons'
import { GroupsPageSkeleton, UsersPageSkeleton } from '@/features/settings/users/user-page-skeletons'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/preview',
  useSearchParams: () => new URLSearchParams()
}))
vi.mock('nextjs-toploader', () => ({ useTopLoader: () => ({ start: vi.fn(), done: vi.fn() }) }))

const renderLoading = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {node}
    </QueryClientProvider>
  )

describe('feature-owned page loading states', () => {
  it.each([
    ['workflows', AutomationsListPageSkeleton, ['Workflow', 'Steps', 'Last run']],
    ['triggers', AutomationTriggersPageSkeleton, ['Trigger', 'Target']],
    ['users', UsersPageSkeleton, ['User', 'Role', 'Status']],
    ['groups', GroupsPageSkeleton, ['Group', 'Role']],
    ['audit log', ActivityPageSkeleton, ['Event', 'Actor', 'Target', 'Outcome', 'Time']]
  ] as const)('keeps the %s grid chrome and real column labels while data is unknown', (_, Component, columns) => {
    renderLoading(<Component />)
    const table = screen.getByRole('table')
    for (const column of columns)
      expect(within(table).getByRole('columnheader', { name: new RegExp(column) })).toBeVisible()
    expect(screen.getAllByTestId('data-grid-skeleton-row')).toHaveLength(6)
    expect(within(table).queryByText(/No .*found|No .*yet/)).toBeNull()
    for (const control of within(table).queryAllByRole('checkbox'))
      expect(control).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows the current name-first identity and runtime groups during app editing', () => {
    renderLoading(<AppManagePageSkeleton />)
    expect(screen.getByText('Name', { exact: true })).toBeVisible()
    expect(screen.getByText('Runtime settings')).toBeVisible()
    expect(screen.getByText('Network access')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('uses the dedicated profile list with the persistent device pane', () => {
    renderLoading(<AppProfilesPageSkeleton />)
    expect(screen.getByRole('heading', { name: 'Profiles' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(3)
    expect(screen.queryByText('Runtime settings')).toBeNull()
    expect(screen.getByLabelText('Android device')).toBeVisible()
  })

  it.each([RuntimeContainerDetailPageLoading, RuntimeImageDetailPageLoading, RuntimeNetworkDetailPageLoading])(
    'retains resource details without pretending resources are absent',
    Component => {
      renderLoading(<Component />)
      expect(screen.getByRole('heading', { name: 'Overview' })).toBeVisible()
      expect(screen.getByRole('heading', { name: 'Raw inspect' })).toBeVisible()
      expect(screen.queryByText(/No local containers|No networks attached|Live resources/)).toBeNull()
      expect(screen.getByRole('button', { name: 'Remove' })).toBeDisabled()
    }
  )

  it('shows provider connection fields rather than the model grid for the connection view', () => {
    renderLoading(<ProviderEditorSkeleton view='connection' />)
    expect(screen.getByText('Base URL')).toBeVisible()
    expect(screen.getByText('API key')).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('button', { name: 'Check AI provider health' })).toBeDisabled()
  })

  it.each(['docker', 'orchestrator'] as const)(
    'uses the %s detail geometry without fetching runtime data',
    serviceId => {
      const fetch = vi.spyOn(globalThis, 'fetch')
      renderLoading(<InfrastructureServiceSkeleton serviceId={serviceId} />)
      expect(screen.queryByRole('alert')).toBeNull()
      expect(
        screen.getByRole('heading', { name: serviceId === 'docker' ? 'Docker' : 'Orchestrator', level: 1 })
      ).toBeVisible()
      if (serviceId === 'docker') {
        expect(screen.queryByRole('spinbutton', { name: 'Concurrent reads' })).toBeNull()
        expect(screen.getByRole('heading', { name: 'Infrastructure diagnostics' })).toBeVisible()
        expect(screen.getByRole('button', { name: 'Edit limits' })).toBeDisabled()
      } else {
        expect(screen.getByRole('heading', { name: 'Connection' })).toBeVisible()
      }
      expect(screen.queryByRole('searchbox', { name: 'Search services' })).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
      fetch.mockRestore()
    }
  )

  it('does not fetch runtime data for the inert app creation form', () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    renderLoading(<CreateAppPageLoading />)
    expect(screen.getByRole('heading', { name: 'Create app' })).toBeVisible()
    expect(screen.getByText('Display size')).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    fetch.mockRestore()
  })
})

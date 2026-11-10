import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { purgeAllAuditEventsAction } from '@/server/audit/actions'
import { ActivityEventsTable } from './activity-events-table'
import { previewActivityProps } from './activity-preview-data'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/server/audit/actions', () => ({ purgeAllAuditEventsAction: vi.fn(), saveAuditRetentionAction: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('audit log workspace', () => {
  it('shows concise rows and opens the complete immutable event with the keyboard', async () => {
    render(<ActivityEventsTable {...previewActivityProps} />)
    const row = screen.getByRole('row', { name: 'Inspect Update trigger by Alex Morgan' })
    expect(within(row).getAllByText('Alex Morgan')).toHaveLength(1)
    expect(within(row).queryByText('alex')).not.toBeInTheDocument()
    expect(within(row).queryByText('automation')).not.toBeInTheDocument()
    expect(within(row).queryByText('2026-11-08T09:17:19.369Z')).not.toBeInTheDocument()
    expect(screen.queryByText('none')).not.toBeInTheDocument()
    fireEvent.keyDown(row, { key: 'Enter' })
    const inspector = await screen.findByRole('dialog', { name: 'Update trigger' })
    expect(within(inspector).getByText('automation.trigger.update')).toBeVisible()
    expect(within(inspector).getByText('trigger-8646f9d2-2b10-4be0-a960-33792a0618fb')).toBeVisible()
    expect(within(inspector).getByText('192.0.2.10')).toBeVisible()
    expect(within(inspector).getByText('Example browser')).toBeVisible()
    expect(within(inspector).getByRole('region', { name: 'Event data JSON' })).toHaveTextContent('03:00')
    expect(within(inspector).getByRole('button', { name: 'Copy Action' })).toBeInTheDocument()
  })

  it('labels filters on their interactive inputs and supports searchable actions', async () => {
    render(<ActivityEventsTable {...previewActivityProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const filters = await screen.findByRole('dialog', { name: 'Filter activity' })
    expect(within(filters).getByRole('combobox', { name: 'Actor' })).toBeVisible()
    expect(within(filters).getByRole('combobox', { name: 'Resource type' })).toBeVisible()
    const action = within(filters).getByRole('combobox', { name: 'Action' })
    fireEvent.focus(action)
    fireEvent.change(action, { target: { value: 'trigger' } })
    expect(await screen.findByRole('option', { name: /Update trigger/ })).toBeVisible()
    expect(screen.queryByRole('option', { name: /Start application/ })).not.toBeInTheDocument()
  })

  it('keeps retention and global maintenance out of app activity', () => {
    render(
      <ActivityEventsTable
        {...previewActivityProps}
        application={{ id: 'app-reports', name: 'Reports worker' }}
      />
    )
    expect(screen.queryByText('Retention', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Configure retention' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activity actions' })).not.toBeInTheDocument()
    const exportUrl = new URL(
      screen.getByRole('link', { name: 'Export CSV' }).getAttribute('href')!,
      'https://example.test'
    )
    expect(exportUrl.searchParams.get('resourceType')).toBe('application')
    expect(exportUrl.searchParams.get('resourceId')).toBe('app-reports')
  })

  it('does not mistake the fixed app scope for a user filter in empty activity', () => {
    render(
      <ActivityEventsTable
        {...previewActivityProps}
        application={{ id: 'app-reports', name: 'Reports worker' }}
        filters={{ resourceType: 'application', resourceId: 'app-reports' }}
        result={{ ...previewActivityProps.result, events: [], total: 0 }}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent('No activity yet')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Export CSV' })).toHaveAttribute(
      'href',
      '/api/activity/export?resourceType=application&resourceId=app-reports&sort=createdAt%3Adesc'
    )
  })

  it('requires explicit purge confirmation and prevents dismissal while it is pending', async () => {
    let finish: ((value: { purged: number }) => void) | undefined
    const request = new Promise<{ purged: number }>(resolve => {
      finish = resolve
    })
    vi.mocked(purgeAllAuditEventsAction).mockReturnValue(request)
    render(<ActivityEventsTable {...previewActivityProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activity actions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Purge all logs' }))
    const confirm = await screen.findByRole('dialog', { name: 'Purge all activity logs?' })
    expect(confirm).toHaveTextContent('This includes events outside the current filters.')
    expect(purgeAllAuditEventsAction).not.toHaveBeenCalled()
    const purge = within(confirm).getByRole('button', { name: 'Purge all logs' })
    const confirmation = within(confirm).getByRole('textbox', { name: 'Confirmation text' })
    expect(purge).toBeDisabled()
    fireEvent.change(confirmation, { target: { value: 'purge' } })
    expect(purge).toBeDisabled()
    fireEvent.change(confirmation, { target: { value: 'PURGE' } })
    fireEvent.click(purge)
    expect(await within(confirm).findByRole('button', { name: 'Purging…' })).toBeDisabled()
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    fireEvent.keyDown(confirm, { key: 'Escape' })
    expect(confirm).toBeVisible()
    await act(async () => {
      finish?.({ purged: 4 })
      await request
    })
    expect(purgeAllAuditEventsAction).toHaveBeenCalledTimes(1)
  })

  it('discloses the bounded export and closes stale inspection when switching apps', async () => {
    const { rerender } = render(
      <ActivityEventsTable
        {...previewActivityProps}
        application={{ id: 'app-a', name: 'First app' }}
        result={{ ...previewActivityProps.result, total: 6000 }}
      />
    )
    expect(screen.getByRole('link', { name: 'Export first 5,000' })).toHaveAttribute(
      'title',
      'Export up to 5,000 matching events in the current sort order'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Inspect Update trigger' }))
    expect(await screen.findByRole('dialog', { name: 'Update trigger' })).toBeVisible()
    rerender(
      <ActivityEventsTable
        {...previewActivityProps}
        application={{ id: 'app-b', name: 'Second app' }}
      />
    )
    expect(screen.queryByRole('dialog', { name: 'Update trigger' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Export CSV' })).toHaveAttribute(
      'href',
      '/api/activity/export?resourceType=application&resourceId=app-b&sort=createdAt%3Adesc'
    )
  })
})

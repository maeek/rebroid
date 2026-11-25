import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlatformOperationsContent } from './platform-operations-content'
import type { PlatformOperationsSnapshot } from '@/shared/contracts/platform-operations'

const snapshot: PlatformOperationsSnapshot = {
  collectedAt: '2026-11-07T10:00:00Z',
  failedCount: 128,
  pendingCount: 42,
  activeRunCount: 17,
  workflowCatalogAvailable: true,
  activeRuns: [{ id: 'run', name: 'Inventory check', impact: 'Running', href: '/automations/inventory/traces?run=run' }]
}

describe('platform operations presentation', () => {
  it('shows the failure count and links directly to the affected app inventory', () => {
    render(<PlatformOperationsContent snapshot={snapshot} />)
    const attention = screen.getByRole('region', { name: 'Apps needing attention' })
    expect(within(attention).getByText('128')).toBeVisible()
    expect(within(attention).queryByRole('list')).toBeNull()
    expect(within(attention).getAllByRole('link')).toHaveLength(1)
    expect(screen.getByText('Snapshot taken')).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(within(attention).getByRole('link', { name: 'View affected apps' })).toHaveAttribute(
      'href',
      '/apps?status=error'
    )
    expect(screen.getByRole('link', { name: 'All apps' })).toHaveAttribute('href', '/apps')
    expect(screen.getByRole('link', { name: 'All workflows' })).toHaveAttribute('href', '/automations')
  })
  it('shows counts and filtered destinations for both active groups', () => {
    render(<PlatformOperationsContent snapshot={snapshot} />)
    const apps = within(screen.getByRole('region', { name: 'App operations' }))
    const runs = within(screen.getByRole('region', { name: 'Active workflow runs' }))
    expect(apps.getByText('42')).toBeVisible()
    expect(apps.getByRole('link', { name: 'View apps in progress' })).toHaveAttribute('href', '/apps?status=working')
    expect(apps.queryByRole('list')).toBeNull()
    expect(runs.getByText('17')).toBeVisible()
    expect(runs.getByRole('link', { name: 'View active runs' })).toHaveAttribute('href', '/automations/runs/active')
    expect(runs.getByRole('link', { name: 'Inventory check' })).toHaveAttribute(
      'href',
      '/automations/inventory/traces?run=run'
    )
  })
  it('shows compact text-only messages when there are no active operations or runs', () => {
    render(<PlatformOperationsContent snapshot={{ ...snapshot, pendingCount: 0, activeRunCount: 0, activeRuns: [] }} />)
    const apps = within(screen.getByRole('region', { name: 'App operations' }))
    const runs = within(screen.getByRole('region', { name: 'Active workflow runs' }))
    expect(apps.getByText('No app operations in progress.')).toBeVisible()
    expect(runs.getByText('No active workflow runs.')).toBeVisible()
    expect(apps.queryByAltText('')).toBeNull()
    expect(runs.queryByAltText('')).toBeNull()
  })
  it('hides unavailable catalog and run actions without showing a zero', () => {
    render(
      <PlatformOperationsContent snapshot={{ ...snapshot, activeRunCount: null, workflowCatalogAvailable: false }} />
    )
    expect(screen.queryByRole('link', { name: 'All workflows' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Active workflow runs' })).toBeNull()
    expect(screen.queryByText('No active workflow runs.')).toBeNull()
  })
  it('keeps the affected apps link at zero and omits the count when no snapshot is available', () => {
    const { rerender } = render(<PlatformOperationsContent snapshot={{ ...snapshot, failedCount: 0 }} />)
    const attention = within(screen.getByRole('region', { name: 'Apps needing attention' }))
    expect(attention.getByText('0', { exact: true })).toBeVisible()
    expect(attention.getByRole('link', { name: 'View affected apps' })).toHaveAttribute('href', '/apps?status=error')
    rerender(
      <PlatformOperationsContent
        snapshot={null}
        error
      />
    )
    expect(screen.getByText('Operations unavailable')).toBeVisible()
    expect(screen.queryByRole('region', { name: 'Apps needing attention' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'App operations' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Active workflow runs' })).toBeNull()
    expect(screen.queryByText('Snapshot taken')).toBeNull()
    expect(screen.queryByRole('link', { name: 'View affected apps' })).toBeNull()
  })
  it('retains the last snapshot with a refresh warning', () => {
    render(
      <PlatformOperationsContent
        snapshot={snapshot}
        error
        requestId='operations-request'
      />
    )
    expect(screen.getByText('Operations could not be refreshed')).toBeVisible()
    expect(screen.getByRole('link', { name: 'View affected apps' })).toBeVisible()
    expect(screen.getByText(/Showing the last loaded snapshot/)).toBeVisible()
    expect(screen.getByText('Reference: operations-request')).toBeVisible()
  })
})

import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlatformOperationsContent } from './platform-operations-content'
import type { PlatformOperationsSnapshot } from '@/shared/contracts/platform-operations'

const snapshot: PlatformOperationsSnapshot = {
  failedCount: 128,
  pendingCount: 0,
  activeRunCount: 0,
  failed: Array.from({ length: 100 }, (_, index) => ({
    id: `app-${index}`,
    name: `Worker ${index}`,
    description: 'Boot failed'
  })),
  pending: [],
  runs: []
}

describe('platform operations presentation', () => {
  it('bounds failure previews while keeping totals and resource destinations visible', () => {
    render(<PlatformOperationsContent snapshot={snapshot} />)
    const attention = screen.getByRole('region', { name: 'Apps needing attention' })
    expect(within(attention).getAllByRole('listitem')).toHaveLength(5)
    expect(within(attention).getByText('128')).toBeVisible()
    expect(within(attention).getByText('Showing 5 of 128')).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('link', { name: 'Worker 0' })).toHaveAttribute('href', '/app/app-0')
    expect(screen.getByRole('link', { name: 'All apps' })).toHaveAttribute('href', '/apps')
    expect(screen.getByRole('link', { name: 'All workflows' })).toHaveAttribute('href', '/automations')
  })
  it('shows quiet empty states and does not report a failed refresh as healthy', () => {
    const { rerender } = render(<PlatformOperationsContent snapshot={{ ...snapshot, failedCount: 0, failed: [] }} />)
    expect(screen.getByText('No app failures.')).toBeVisible()
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
    expect(screen.queryByText(/Snapshot updates/)).toBeNull()
    expect(screen.queryByText('No app failures.')).toBeNull()
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
    expect(screen.getByRole('link', { name: 'Worker 0' })).toBeVisible()
    expect(screen.getByText(/Showing the last loaded snapshot/)).toBeVisible()
    expect(screen.getByText('Reference: operations-request')).toBeVisible()
  })
})

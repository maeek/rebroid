import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SystemResourcesContent } from './system-resources-content'
import type { SystemResources } from '@/shared/contracts/system-resources'

vi.mock('./system-resource-charts', () => ({ SystemResourceCharts: () => null }))
const resources: SystemResources = {
  hostMemoryBytes: null,
  hostCpuCores: null,
  dockerRootAvailableBytes: null,
  containersTotal: 3,
  containersRunning: 1,
  containersStopped: 2,
  managedContainersCpuUsagePercent: 12.3,
  managedContainersMemoryUsageBytes: 1024,
  containerStatsCollectedAt: '2026-11-08T10:00:00Z',
  containers: []
}

describe('resource feedback', () => {
  it('keeps the last sample readable when a refresh fails', () => {
    const refresh = vi.fn()
    render(
      <SystemResourcesContent
        resources={resources}
        resourcesError
        refreshResources={refresh}
      />
    )
    expect(screen.getByText('12.3%')).toBeVisible()
    expect(screen.getByText('Showing the last available sample. Try again to update it.')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Orchestrator resources unavailable' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('shows a bounded retry state when no sample has loaded', () => {
    render(
      <SystemResourcesContent
        resourcesError
        isRefreshingResources
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Orchestrator resources unavailable')
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled()
    expect(screen.queryByText('Showing the last available sample. Try again to update it.')).toBeNull()
  })
})

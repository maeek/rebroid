import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlatformCapacityContent } from './platform-quick-glance-section'
import type { SystemResources } from '@/shared/contracts/system-resources'

const resources: SystemResources = {
  hostMemoryBytes: null,
  hostCpuCores: null,
  dockerRootAvailableBytes: null,
  containersTotal: 3,
  containersRunning: 2,
  containersStopped: 1,
  managedContainersCpuUsagePercent: 12,
  managedContainersMemoryUsageBytes: 1024,
  containerStatsCollectedAt: null,
  containers: []
}

describe('overview capacity failures', () => {
  it('replaces unavailable metrics and sampling hints with one notice', () => {
    render(<PlatformCapacityContent error='Could not reach the runtime. Reference: capacity-request' />)
    expect(screen.getByRole('status')).toHaveTextContent('Capacity unavailable')
    expect(screen.getByRole('status')).toHaveTextContent('Reference: capacity-request')
    expect(screen.queryByText('Managed container CPU')).toBeNull()
    expect(screen.queryByText('Managed container memory')).toBeNull()
    expect(screen.queryByText('Containers')).toBeNull()
    expect(screen.queryByText(/Container stats are sampled/)).toBeNull()
  })

  it('retains real values after a refresh failure and restores the ready state on recovery', () => {
    const { rerender } = render(
      <PlatformCapacityContent
        resources={resources}
        error='Service unavailable.'
      />
    )
    expect(screen.getByText('12.0%')).toBeVisible()
    expect(screen.getByText('2/3')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Showing the last collected values')
    rerender(<PlatformCapacityContent resources={resources} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('12.0%')).toBeVisible()
  })

  it('shows partial coverage and displays unavailable values when every sample is missing', () => {
    const { rerender } = render(<PlatformCapacityContent resources={{ ...resources, containerStatsSampled: 1 }} />)
    expect(screen.getByText('Sampled 1 of 2 running containers.')).toBeVisible()
    expect(screen.getByText('12.0%')).toBeVisible()

    rerender(<PlatformCapacityContent resources={{ ...resources, containerStatsSampled: 0 }} />)
    expect(screen.getByText('Sampled 0 of 2 running containers.')).toBeVisible()
    expect(screen.getAllByText('Unavailable')).toHaveLength(2)
    expect(screen.queryByText('12.0%')).toBeNull()
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SystemResourcesContent } from './system-resources-content'
import type { SystemStats } from '@/shared/contracts/system-stats'

vi.mock('./system-resource-charts', () => ({ SystemResourceCharts: () => <div>Host charts</div> }))
vi.mock('./details-table', () => ({ DetailsTable: () => <div>Host data</div> }))

describe('resource outage scope', () => {
  it('replaces all dependent sections with one page failure when nothing loaded', () => {
    render(
      <SystemResourcesContent
        systemError
        resourcesError
      />
    )
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 2, name: 'Resources unavailable' })).toBeVisible()
    expect(screen.queryByText('Host data')).toBeNull()
    expect(screen.queryByText('Host charts')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Managed containers' })).toBeNull()
  })

  it('keeps independent host data available during an orchestrator outage', () => {
    render(
      <SystemResourcesContent
        systemUtilization={{} as SystemStats}
        resourcesError
      />
    )
    expect(screen.getByText('Host data')).toBeVisible()
    expect(screen.getByText('Host charts')).toBeVisible()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByText('Orchestrator resources unavailable')).toBeVisible()
  })
})

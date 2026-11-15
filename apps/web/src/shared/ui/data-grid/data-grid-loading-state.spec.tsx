import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataGrid } from './data-grid'

describe('DataGrid loading state', () => {
  it('renders loading rows beneath the real column headers', () => {
    render(
      <DataGrid
        columns={[
          { id: 'name', header: 'Name', meta: { skeleton: { kind: 'stacked' } } },
          { id: 'status', header: 'Status', meta: { skeleton: { kind: 'badge' } } }
        ]}
        data={[]}
        totalItems={0}
        pageIndex={0}
        pageSize={20}
        getRowId={() => ''}
        loading={{ rowCount: 3 }}
      />
    )

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeVisible()
    expect(screen.getAllByTestId('data-grid-skeleton-row')).toHaveLength(3)
  })

  it('renders embedded grids and passes the placeholder row index to feature-owned cell renderers', () => {
    render(
      <DataGrid
        columns={[
          {
            id: 'name',
            header: 'Name',
            meta: { skeleton: { kind: 'custom', render: index => <span>Known row {index + 1}</span> } }
          }
        ]}
        data={[]}
        totalItems={0}
        pageIndex={0}
        pageSize={20}
        getRowId={() => ''}
        loading={{ rowCount: 2, selectable: false, rowMenu: false }}
      />
    )
    expect(screen.getAllByTestId('data-grid-skeleton-row')).toHaveLength(2)
    expect(screen.getByText('Known row 1')).toBeVisible()
    expect(screen.getByText('Known row 2')).toBeVisible()
  })
})

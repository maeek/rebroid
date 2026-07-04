import { describe, expect, it } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { DataGridSkeleton } from './data-grid-skeleton'

describe('DataGridSkeleton', () => {
  it('renders data-grid chrome with selectable rows and row menu by default', () => {
    render(
      <DataGridSkeleton
        rows={3}
        minWidth='40rem'
        columns={[
          { width: '12rem', headerWidth: 'w-20', kind: 'stacked' },
          { width: '8rem', headerWidth: 'w-12', kind: 'badge' },
          { width: '10rem', headerWidth: 'w-16', kind: 'action' }
        ]}
      />
    )

    expect(screen.getByTestId('data-grid-skeleton-shell')).toBeTruthy()
    expect(screen.getAllByTestId('data-grid-skeleton-row')).toHaveLength(3)
  })

  it('can render embedded grids without selection or row menus', () => {
    render(
      <DataGridSkeleton
        rows={2}
        selectable={false}
        rowMenu={false}
        columns={[{ width: '12rem', headerWidth: 'w-20' }]}
      />
    )

    expect(screen.getAllByTestId('data-grid-skeleton-row')).toHaveLength(2)
  })
})

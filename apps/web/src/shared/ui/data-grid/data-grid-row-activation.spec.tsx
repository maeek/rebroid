import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/button'
import { DataGrid } from './data-grid'
import type { ColumnDef } from '@tanstack/react-table'

type TestRow = {
  id: string
  name: string
}

const rows: TestRow[] = [{ id: 'alpha', name: 'Alpha' }]

const columns: ColumnDef<TestRow>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span>{row.original.name}</span>
  },
  {
    id: 'actions',
    header: '',
    cell: () => <Button type='button'>Nested action</Button>
  }
]

describe('DataGrid row activation', () => {
  it('activates rows with pointer, Enter, and Space', () => {
    const onActivate = vi.fn()
    render(
      <DataGrid
        columns={columns}
        data={rows}
        totalItems={1}
        pageIndex={0}
        pageSize={20}
        getRowId={row => row.id}
        rowActivation={{
          getLabel: row => `Open ${row.name}`,
          onActivate
        }}
      />
    )

    const row = screen.getByRole('row', { name: 'Open Alpha' })
    expect(row).toHaveAttribute('tabindex', '0')

    fireEvent.click(screen.getByText('Alpha'))
    fireEvent.keyDown(row, { key: 'Enter' })
    fireEvent.keyDown(row, { key: ' ' })

    expect(onActivate).toHaveBeenCalledTimes(3)
    expect(onActivate).toHaveBeenLastCalledWith(rows[0])
  })

  it('does not activate the row from nested controls', () => {
    const onActivate = vi.fn()
    render(
      <DataGrid
        columns={columns}
        data={rows}
        totalItems={1}
        pageIndex={0}
        pageSize={20}
        getRowId={row => row.id}
        rowActivation={{
          getLabel: row => `Open ${row.name}`,
          onActivate
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Nested action' }))

    expect(onActivate).not.toHaveBeenCalled()
  })
})

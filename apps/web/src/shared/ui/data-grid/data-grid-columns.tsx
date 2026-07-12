import { type MouseEvent, type RefObject } from 'react'
import { IconDotsVertical } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { DataGridSelectionState } from './data-grid'
import type { ColumnDef } from '@tanstack/react-table'

export const openContextMenuFromButton = (event: MouseEvent<HTMLButtonElement>) => {
  event.preventDefault()
  event.stopPropagation()
  event.currentTarget.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY
    })
  )
}

export const selectionColumn = <TData,>({
  selection,
  getRowId,
  lastSelectedIndexRef
}: {
  selection: DataGridSelectionState
  getRowId: (row: TData) => string
  lastSelectedIndexRef: RefObject<number | null>
}): ColumnDef<TData> => ({
  id: '__select',
  enableHiding: false,
  enableSorting: false,
  size: 48,
  minSize: 48,
  maxSize: 48,
  enableResizing: false,
  header: ({ table }) => {
    const rows = table.getRowModel().rows
    const allSelected = rows.length > 0 && rows.every(row => selection.selectedIds.has(getRowId(row.original)))
    return (
      <div className='flex min-h-5 items-center justify-center'>
        <Checkbox
          checked={allSelected}
          aria-label='Select current page'
          onCheckedChange={checked => {
            const next = new Set(selection.selectedIds)
            for (const row of rows) {
              const id = getRowId(row.original)
              if (checked === true) next.add(id)
              else next.delete(id)
            }
            selection.onSelectedIdsChange(next)
          }}
        />
      </div>
    )
  },
  cell: ({ row, table }) => {
    const id = getRowId(row.original)
    return (
      <div className='flex min-h-10 items-center justify-center'>
        <Checkbox
          checked={selection.selectedIds.has(id)}
          aria-label='Select row'
          onClick={event => {
            const next = new Set(selection.selectedIds)
            if (event.shiftKey && lastSelectedIndexRef.current !== null) {
              const rows = table.getRowModel().rows
              const start = Math.min(lastSelectedIndexRef.current, row.index)
              const end = Math.max(lastSelectedIndexRef.current, row.index)
              for (const rangeRow of rows.slice(start, end + 1)) {
                next.add(getRowId(rangeRow.original))
              }
            } else if (next.has(id)) {
              next.delete(id)
            } else {
              next.add(id)
            }
            lastSelectedIndexRef.current = row.index
            selection.onSelectedIdsChange(next)
          }}
          onCheckedChange={() => undefined}
        />
      </div>
    )
  }
})

export const loadingSelectionColumn = <TData,>(): ColumnDef<TData> => ({
  id: '__select',
  enableHiding: false,
  enableSorting: false,
  size: 48,
  minSize: 48,
  maxSize: 48,
  enableResizing: false,
  header: () => null,
  cell: () => null
})

export const spacerColumn = <TData,>(): ColumnDef<TData> => ({
  id: '__spacer',
  enableHiding: false,
  enableSorting: false,
  size: 0,
  minSize: 0,
  maxSize: 10000,
  enableResizing: false,
  header: () => null,
  cell: () => null
})

export const rowMenuColumn = <TData,>(): ColumnDef<TData> => ({
  id: '__row_menu',
  enableHiding: false,
  enableSorting: false,
  size: 48,
  minSize: 48,
  maxSize: 48,
  enableResizing: false,
  header: () => <span className='sr-only'>Row actions</span>,
  cell: () => (
    <div className='flex min-h-10 items-center justify-end'>
      <Button
        type='button'
        variant='ghost'
        size='icon-md'
        className='size-8'
        aria-label='Open row actions'
        onClick={openContextMenuFromButton}
      >
        <IconDotsVertical className='size-4' />
      </Button>
    </div>
  )
})

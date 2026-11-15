import { type MouseEvent, type ReactNode, type RefObject } from 'react'
import { IconDotsVertical } from '@tabler/icons-react'
import { Checkbox } from '@/components/ui/checkbox'
import { RowActions, RowActionButton } from '@/components/ui/row-actions'
import type { DataGridSelectionState } from './data-grid'
import type { CellContext, ColumnDef, Row } from '@tanstack/react-table'

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
    const ids = table
      .getRowModel()
      .rows.map(row => getRowId(row.original))
      .filter(id => selection.canSelectId?.(id) !== false)
    const allSelected = ids.length > 0 && ids.every(id => selection.selectedIds.has(id))
    return (
      <div className='flex min-h-5 items-center justify-center'>
        <Checkbox
          className='relative touch:after:absolute touch:after:-inset-3.5'
          checked={allSelected}
          disabled={selection.disabled || ids.length === 0}
          aria-label='Select current page'
          onCheckedChange={checked => {
            if (selection.disabled) return
            const next = new Set(selection.selectedIds)
            for (const id of ids) {
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
    if (selection.canSelectId?.(id) === false) return null
    return (
      <div className='flex min-h-10 items-center justify-center'>
        <Checkbox
          className='relative touch:after:absolute touch:after:-inset-3.5'
          checked={selection.selectedIds.has(id)}
          disabled={selection.disabled}
          aria-label='Select row'
          onClick={event => {
            if (selection.disabled) return
            const next = new Set(selection.selectedIds)
            if (event.shiftKey && lastSelectedIndexRef.current !== null) {
              const rows = table.getRowModel().rows
              const start = Math.min(lastSelectedIndexRef.current, row.index)
              const end = Math.max(lastSelectedIndexRef.current, row.index)
              for (const rangeRow of rows.slice(start, end + 1)) {
                const rangeId = getRowId(rangeRow.original)
                if (selection.canSelectId?.(rangeId) !== false) next.add(rangeId)
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

const RowMenuCell = <TData,>({ row, column }: CellContext<TData, unknown>) => {
  const quickAction = column.columnDef.meta?.rowQuickAction
  const contextual = Boolean(quickAction)
  return (
    <div className='flex min-h-10 items-center justify-end'>
      <RowActions visible={!contextual}>
        {contextual ? (
          <span
            data-slot='data-grid-quick-action'
            className='touch-control inline-flex size-8 shrink-0'
          >
            {quickAction?.(row)}
          </span>
        ) : null}
        <RowActionButton
          label='Open row actions'
          onClick={openContextMenuFromButton}
        >
          <IconDotsVertical className='size-4' />
        </RowActionButton>
      </RowActions>
    </div>
  )
}

export const rowMenuColumn = <TData,>(quickAction?: (row: Row<TData>) => ReactNode): ColumnDef<TData> => ({
  id: '__row_menu',
  enableHiding: false,
  enableSorting: false,
  size: quickAction ? 108 : 48,
  minSize: quickAction ? 108 : 48,
  maxSize: quickAction ? 108 : 48,
  enableResizing: false,
  header: () => <span className='sr-only'>Row actions</span>,
  meta: { rowQuickAction: quickAction },
  cell: RowMenuCell
})

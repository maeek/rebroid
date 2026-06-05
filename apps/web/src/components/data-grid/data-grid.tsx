'use client'

import { type ReactNode } from 'react'
import {
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowData,
  type SortingState,
  type VisibilityState
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { DataGridColumnVisibilityMenu } from './data-grid-column-visibility'
import { DataGridTable } from './data-grid-table'
import { useDataGridTable } from './use-data-grid-table'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string
  }
}

export type DataGridSelectionState = {
  selectedIds: Set<string>
  onSelectedIdsChange: (selectedIds: Set<string>) => void
}

export type DataGridProps<TData> = {
  columns: ColumnDef<TData>[]
  data: TData[]
  totalItems: number
  pageIndex: number
  pageSize: number
  getRowId: (row: TData) => string
  onPageIndexChange?: (pageIndex: number) => void
  onPageSizeChange?: (pageSize: number) => void
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  selection?: DataGridSelectionState
  emptyState?: ReactNode
  minWidth?: string
  rowContextMenu?: (row: Row<TData>) => ReactNode
  className?: string
}

export function DataGrid<TData>({
  columns,
  data,
  totalItems,
  pageIndex,
  pageSize,
  getRowId,
  sorting = [],
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
  selection,
  emptyState,
  minWidth,
  rowContextMenu,
  className
}: DataGridProps<TData>) {
  const {
    getColumnPixelWidth,
    lastVisibleColumnId,
    renderedTableWidth,
    selectRowForContextMenu,
    showColumnVisibilityControl,
    table,
    tableContainerRef
  } = useDataGridTable({
    data,
    columns,
    totalItems,
    pageIndex,
    pageSize,
    getRowId,
    sorting,
    onSortingChange,
    columnVisibility,
    onColumnVisibilityChange,
    selection,
    rowContextMenu
  })
  const columnVisibilityMenu = showColumnVisibilityControl ? <DataGridColumnVisibilityMenu table={table} /> : null

  return (
    <div className={cn('grid gap-3', className)}>
      <div
        ref={tableContainerRef}
        className='overflow-x-auto overflow-y-hidden rounded-xl border border-border/70 bg-background/25'
        style={{ minWidth: 0 }}
      >
        <div style={{ minWidth }}>
          <DataGridTable
            table={table}
            renderedTableWidth={renderedTableWidth}
            minWidth={minWidth}
            getColumnPixelWidth={getColumnPixelWidth}
            lastVisibleColumnId={lastVisibleColumnId}
            columnVisibilityMenu={columnVisibilityMenu}
            selection={selection}
            getRowId={getRowId}
            emptyState={emptyState}
            rowContextMenu={rowContextMenu}
            onContextMenuRow={selectRowForContextMenu}
          />
        </div>
      </div>
    </div>
  )
}

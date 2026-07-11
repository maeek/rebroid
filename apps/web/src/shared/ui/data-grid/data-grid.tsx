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
    skeleton?: DataGridCellSkeleton
  }
}

export type DataGridCellSkeleton =
  | { kind: 'text'; width?: string }
  | {
      kind: 'stacked'
      gap?: string
      primaryHeight?: string
      primaryWidth?: string
      secondaryHeight?: string
      secondaryWidth?: string
    }
  | { kind: 'badge'; width?: string }
  | { kind: 'custom'; render: () => ReactNode }

export type DataGridLoadingState = {
  rowCount?: number
  rowMenu?: boolean
  selectable?: boolean
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
  loading?: boolean | DataGridLoadingState
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
  className,
  loading = false
}: DataGridProps<TData>) {
  const loadingState = loading === true ? {} : loading || undefined
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
    rowContextMenu,
    loadingState
  })
  const columnVisibilityMenu =
    showColumnVisibilityControl && !loading ? <DataGridColumnVisibilityMenu table={table} /> : null

  return (
    <div
      aria-busy={Boolean(loading)}
      className={cn('grid min-w-0 gap-3', className)}
    >
      <DataGridTable
        table={table}
        tableContainerRef={tableContainerRef}
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
        loading={loadingState}
      />
    </div>
  )
}

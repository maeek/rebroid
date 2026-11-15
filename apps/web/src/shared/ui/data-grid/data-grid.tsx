'use client'

import { useContext, type ReactNode } from 'react'
import {
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowData,
  type SortingState,
  type VisibilityState
} from '@tanstack/react-table'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { DataGridColumnVisibilityMenu } from './data-grid-column-visibility'
import { DataGridTable } from './data-grid-table'
import { DataGridColumnToolbarContext } from './data-grid-toolbar-context'
import { useDataGridTable } from './use-data-grid-table'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string
    cellContentClassName?: string
    /** A title opts the grid into a settings layout at narrow content widths. */
    compactSlot?: 'title' | 'control' | 'details' | 'sort' | 'status'
    showCompactLabel?: boolean
    skeleton?: DataGridCellSkeleton
    rowQuickAction?: (row: Row<TData>) => ReactNode
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
  | { kind: 'custom'; render: (rowIndex: number) => ReactNode }

export type DataGridLoadingState = {
  rowCount?: number
  rowMenu?: boolean
  selectable?: boolean
}

export type DataGridSelectionState = {
  disabled?: boolean
  canSelectId?: (rowId: string) => boolean
  selectedIds: Set<string>
  onSelectedIdsChange: (selectedIds: Set<string>) => void
}

export type DataGridRowActivation<TData> = {
  getLabel: (row: TData) => string
  onActivate: (row: TData) => void
}

export type DataGridProps<TData> = {
  columns: ColumnDef<TData>[]
  data: TData[]
  totalItems: number
  pageIndex: number
  pageSize: number
  getRowId: (row: TData) => string
  /** Group rows by label. Supplied rows also determine the groups and placeholder counts during loading. */
  getRowGroupLabel?: (row: TData) => string
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
  rowQuickAction?: (row: Row<TData>) => ReactNode
  rowActivation?: DataGridRowActivation<TData>
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
  getRowGroupLabel,
  sorting = [],
  onSortingChange,
  columnVisibility,
  onColumnVisibilityChange,
  selection,
  emptyState,
  minWidth,
  rowContextMenu,
  rowQuickAction,
  rowActivation,
  className,
  loading = false
}: DataGridProps<TData>) {
  'use no memo'

  const columnToolbarTarget = useContext(DataGridColumnToolbarContext)
  const columnsInToolbar = columnToolbarTarget !== undefined
  const loadingState = loading === true ? {} : loading || undefined
  const {
    getColumnPixelWidth,
    scrollStart,
    scrollEnd,
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
    rowQuickAction,
    loadingState
  })
  const columnVisibilityMenu =
    showColumnVisibilityControl && (!loading || columnsInToolbar) ? (
      <DataGridColumnVisibilityMenu
        table={table}
        disabled={Boolean(loading)}
      />
    ) : null

  return (
    <div
      aria-busy={Boolean(loading)}
      className={cn('grid min-w-0 gap-3', className)}
    >
      {columnToolbarTarget && columnVisibilityMenu ? createPortal(columnVisibilityMenu, columnToolbarTarget) : null}
      <DataGridTable
        table={table}
        tableContainerRef={tableContainerRef}
        scrollStart={scrollStart}
        scrollEnd={scrollEnd}
        renderedTableWidth={renderedTableWidth}
        minWidth={minWidth}
        getColumnPixelWidth={getColumnPixelWidth}
        lastVisibleColumnId={lastVisibleColumnId}
        columnVisibilityMenu={columnsInToolbar ? null : columnVisibilityMenu}
        selection={selection}
        getRowId={getRowId}
        getRowGroupLabel={getRowGroupLabel}
        emptyState={emptyState}
        rowContextMenu={rowContextMenu}
        rowActivation={rowActivation}
        onContextMenuRow={selectRowForContextMenu}
        loading={loadingState}
      />
    </div>
  )
}

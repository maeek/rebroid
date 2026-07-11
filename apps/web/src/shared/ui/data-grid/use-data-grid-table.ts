import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  functionalUpdate,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type OnChangeFn,
  type Row,
  type SortingState,
  type VisibilityState
} from '@tanstack/react-table'
import { loadingSelectionColumn, rowMenuColumn, selectionColumn, spacerColumn } from './data-grid-columns'
import type { DataGridLoadingState, DataGridSelectionState } from './data-grid'

type UseDataGridTableInput<TData> = {
  columns: ColumnDef<TData>[]
  data: TData[]
  totalItems: number
  pageIndex: number
  pageSize: number
  getRowId: (row: TData) => string
  sorting: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>
  selection?: DataGridSelectionState
  rowContextMenu?: (row: Row<TData>) => ReactNode
  loadingState?: DataGridLoadingState
}

export const useDataGridTable = <TData>({
  columns,
  data,
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
}: UseDataGridTableInput<TData>) => {
  const lastSelectedIndexRef = useRef<number | null>(null)
  const tableContainerRef = useRef<HTMLDivElement | null>(null)
  const [internalSorting, setInternalSorting] = useState<SortingState>(sorting)
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>(columnVisibility ?? {})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [containerWidth, setContainerWidth] = useState(0)
  const resolvedSorting = onSortingChange ? sorting : internalSorting
  const resolvedColumnVisibility = onColumnVisibilityChange ? (columnVisibility ?? {}) : internalColumnVisibility
  const resolvedColumns = useMemo(
    () => [
      ...(selection || loadingState?.selectable
        ? [
            selection
              ? selectionColumn({
                  selection,
                  getRowId,
                  lastSelectedIndexRef
                })
              : loadingSelectionColumn<TData>()
          ]
        : []),
      ...columns,
      spacerColumn<TData>(),
      ...(rowContextMenu || loadingState?.rowMenu ? [rowMenuColumn<TData>()] : [])
    ],
    [columns, getRowId, loadingState?.rowMenu, loadingState?.selectable, rowContextMenu, selection]
  )

  useEffect(() => {
    const node = tableContainerRef.current
    if (!node) return

    const updateContainerWidth = () => setContainerWidth(node.clientWidth)
    updateContainerWidth()

    if (typeof ResizeObserver === 'undefined') return

    const resizeObserver = new ResizeObserver(updateContainerWidth)
    resizeObserver.observe(node)
    return () => resizeObserver.disconnect()
  }, [])

  const handleSortingChange: OnChangeFn<SortingState> = updater => {
    if (onSortingChange) onSortingChange(updater)
    else setInternalSorting(updater)
  }
  const handleColumnVisibilityChange: OnChangeFn<VisibilityState> = updater => {
    if (onColumnVisibilityChange) onColumnVisibilityChange(updater)
    else setInternalColumnVisibility(current => functionalUpdate(updater, current))
  }

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: resolvedColumns,
    defaultColumn: {
      minSize: 72,
      size: 160,
      maxSize: 720
    },
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: Boolean(onSortingChange),
    enableSortingRemoval: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    pageCount: Math.max(Math.ceil(totalItems / pageSize), 1),
    state: {
      pagination: { pageIndex, pageSize },
      sorting: resolvedSorting,
      columnVisibility: resolvedColumnVisibility,
      columnSizing
    },
    onSortingChange: handleSortingChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onColumnSizingChange: setColumnSizing
  })

  const visibleColumns = table.getVisibleLeafColumns()
  const fixedTableWidth = visibleColumns
    .filter(column => column.id !== '__spacer')
    .reduce((total, column) => total + column.getSize(), 0)
  const spacerWidth = Math.max(containerWidth - fixedTableWidth, 0)
  const renderedTableWidth = fixedTableWidth + spacerWidth
  const getColumnPixelWidth = (column: (typeof visibleColumns)[number]) =>
    column.id === '__spacer' ? spacerWidth : column.getSize()
  const lastVisibleColumnId = visibleColumns[visibleColumns.length - 1]?.id
  const showColumnVisibilityControl =
    columns.length > 1 && table.getAllLeafColumns().some(column => column.getCanHide())

  const selectRowForContextMenu = (row: Row<TData>) => {
    if (!selection) return

    const rowId = getRowId(row.original)
    if (selection.selectedIds.has(rowId)) return

    lastSelectedIndexRef.current = row.index
    selection.onSelectedIdsChange(new Set([rowId]))
  }

  return {
    getColumnPixelWidth,
    lastVisibleColumnId,
    renderedTableWidth,
    selectRowForContextMenu,
    showColumnVisibilityControl,
    table,
    tableContainerRef
  }
}

'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { IconChevronDown, IconChevronUp, IconColumns3, IconDotsVertical, IconSearch } from '@tabler/icons-react'
import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type OnChangeFn,
  type Row,
  type RowData,
  type SortingState,
  type VisibilityState
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { openContextMenuFromButton, rowMenuColumn, selectionColumn, spacerColumn } from './data-grid-columns'

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
  mobileCard?: (row: Row<TData>) => ReactNode
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
  minWidth: _minWidth,
  mobileCard,
  rowContextMenu,
  className
}: DataGridProps<TData>) {
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
      ...(selection
        ? [
            selectionColumn({
              selection,
              getRowId,
              lastSelectedIndexRef
            })
          ]
        : []),
      ...columns,
      spacerColumn<TData>(),
      ...(rowContextMenu ? [rowMenuColumn<TData>()] : [])
    ],
    [columns, getRowId, rowContextMenu, selection]
  )
  useEffect(() => {
    const node = tableContainerRef.current
    if (!node) return

    const updateContainerWidth = () => setContainerWidth(node.clientWidth)
    updateContainerWidth()

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
  const rows = table.getRowModel().rows
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

  const columnVisibilityMenu = showColumnVisibilityControl ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type='button'
          variant='secondary'
          size='icon'
          className='size-8'
          aria-label='Toggle columns'
        >
          <IconColumns3 className='size-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {table
          .getAllLeafColumns()
          .filter(column => column.getCanHide())
          .map(column => (
            <DropdownMenuItem
              key={column.id}
              onSelect={event => {
                event.preventDefault()
                column.toggleVisibility(!column.getIsVisible())
              }}
            >
              <Checkbox
                checked={column.getIsVisible()}
                className='mr-2'
                onClick={event => event.stopPropagation()}
                onCheckedChange={checked => column.toggleVisibility(checked === true)}
              />
              {column.columnDef.meta?.label ?? column.id}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null
  const selectRowForContextMenu = (row: Row<TData>) => {
    if (!selection) return

    const rowId = getRowId(row.original)
    if (selection.selectedIds.has(rowId)) return

    lastSelectedIndexRef.current = row.index
    selection.onSelectedIdsChange(new Set([rowId]))
  }

  const tableMarkup = (
    <Table
      className='table-fixed'
      style={{
        width: renderedTableWidth,
        minWidth: renderedTableWidth
      }}
    >
      <TableHeader className='bg-background/45'>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow
            key={headerGroup.id}
            className='hover:bg-transparent'
          >
            {headerGroup.headers.map(header => {
              const canSort = header.column.getCanSort()
              const canResize = header.column.getCanResize()
              const isSelectColumn = header.column.id === '__select'
              const isSpacerColumn = header.column.id === '__spacer'
              const isRowMenuColumn = header.column.id === '__row_menu'
              const hasColumnVisibilityMenu = header.column.id === lastVisibleColumnId && Boolean(columnVisibilityMenu)
              const widthPx = getColumnPixelWidth(header.column)
              const sortDirection = header.column.getIsSorted()
              return (
                <TableHead
                  key={header.id}
                  className={cn(
                    'relative overflow-hidden py-3',
                    isSelectColumn || isSpacerColumn ? 'px-0' : isRowMenuColumn ? 'px-2' : 'px-4'
                  )}
                  style={{
                    width: widthPx,
                    maxWidth: widthPx
                  }}
                >
                  <div
                    className={cn(
                      'min-w-0',
                      isSelectColumn && 'flex w-12 justify-center',
                      canResize && 'pr-2',
                      hasColumnVisibilityMenu && 'pr-10'
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type='button'
                        className='flex w-full min-w-0 items-center gap-1 text-left hover:text-foreground'
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className='min-w-0 truncate'>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {sortDirection === 'asc' ? <IconChevronUp className='size-3 shrink-0' /> : null}
                        {sortDirection === 'desc' ? <IconChevronDown className='size-3 shrink-0' /> : null}
                      </button>
                    ) : (
                      <div className='min-w-0 truncate'>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    )}
                  </div>
                  {canResize ? (
                    <button
                      type='button'
                      aria-label={`Resize ${header.column.columnDef.meta?.label ?? header.column.id} column`}
                      className={cn(
                        'absolute right-0 top-0 h-full w-3 cursor-col-resize touch-none select-none',
                        'after:absolute after:right-1 after:top-1/2 after:h-5 after:w-px after:-translate-y-1/2 after:bg-border',
                        'hover:after:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
                        header.column.getIsResizing() && 'after:bg-primary'
                      )}
                      onDoubleClick={() => header.column.resetSize()}
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                    />
                  ) : null}
                  {hasColumnVisibilityMenu ? (
                    <div className='absolute right-2 top-1/2 z-10 -translate-y-1/2'>{columnVisibilityMenu}</div>
                  ) : null}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={table.getVisibleLeafColumns().length}
              className='px-4 py-10'
            >
              {emptyState ?? (
                <div className='mx-auto flex max-w-md flex-col items-center text-center'>
                  <div className='mb-3 rounded-full border border-border/70 bg-card/60 p-3'>
                    <IconSearch className='size-6 text-secondary-foreground' />
                  </div>
                  <div className='font-medium'>No rows found</div>
                </div>
              )}
            </TableCell>
          </TableRow>
        ) : (
          rows.map(row => {
            const rowContent = (
              <TableRow
                key={row.id}
                data-state={selection?.selectedIds.has(getRowId(row.original)) ? 'selected' : undefined}
                onContextMenu={() => selectRowForContextMenu(row)}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      'overflow-hidden py-4 align-top',
                      cell.column.id === '__select' || cell.column.id === '__spacer'
                        ? 'px-0'
                        : cell.column.id === '__row_menu'
                          ? 'px-2 text-center'
                          : 'px-4'
                    )}
                    style={{
                      width: getColumnPixelWidth(cell.column),
                      maxWidth: getColumnPixelWidth(cell.column)
                    }}
                  >
                    <div
                      className={cn(
                        'min-w-0 overflow-hidden',
                        cell.column.id === '__select' && 'flex w-12 justify-center overflow-visible',
                        cell.column.id === '__row_menu' && 'flex justify-end overflow-visible'
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            )

            return rowContextMenu ? (
              <ContextMenu key={row.id}>
                <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
                <ContextMenuContent>{rowContextMenu(row)}</ContextMenuContent>
              </ContextMenu>
            ) : (
              rowContent
            )
          })
        )}
      </TableBody>
    </Table>
  )

  const renderMobileCard = (row: Row<TData>) => {
    const card = mobileCard?.(row)
    if (!card) return null

    return rowContextMenu ? (
      <ContextMenu key={row.id}>
        <ContextMenuTrigger asChild>
          <div
            className='relative'
            onContextMenu={() => selectRowForContextMenu(row)}
          >
            {card}
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='absolute right-2 top-2 size-8'
              aria-label='Open row actions'
              onClick={event => {
                selectRowForContextMenu(row)
                openContextMenuFromButton(event)
              }}
            >
              <IconDotsVertical className='size-4' />
            </Button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>{rowContextMenu(row)}</ContextMenuContent>
      </ContextMenu>
    ) : (
      card
    )
  }

  return (
    <div className={cn('grid gap-3', className)}>
      {mobileCard ? (
        <div className='grid gap-3 lg:hidden'>
          {rows.length === 0 ? emptyState : rows.map(row => renderMobileCard(row))}
        </div>
      ) : null}
      <div
        ref={tableContainerRef}
        className={cn(
          'overflow-hidden rounded-xl border border-border/70 bg-background/25',
          mobileCard && 'hidden lg:block'
        )}
      >
        {tableMarkup}
      </div>
    </div>
  )
}

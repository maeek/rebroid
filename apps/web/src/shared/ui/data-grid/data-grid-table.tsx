import type { ReactNode } from 'react'
import { IconChevronDown, IconChevronUp, IconSearch } from '@tabler/icons-react'
import { flexRender, type Row, type Table as ReactTable } from '@tanstack/react-table'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { DataGridSelectionState } from './data-grid'

type DataGridTableProps<TData> = {
  table: ReactTable<TData>
  renderedTableWidth: number
  minWidth?: string
  getColumnPixelWidth: (column: ReturnType<ReactTable<TData>['getVisibleLeafColumns']>[number]) => number
  lastVisibleColumnId?: string
  columnVisibilityMenu: ReactNode
  selection?: DataGridSelectionState
  getRowId: (row: TData) => string
  emptyState?: ReactNode
  rowContextMenu?: (row: Row<TData>) => ReactNode
  onContextMenuRow: (row: Row<TData>) => void
}

export const DataGridTable = <TData,>({
  table,
  renderedTableWidth,
  minWidth,
  getColumnPixelWidth,
  lastVisibleColumnId,
  columnVisibilityMenu,
  selection,
  getRowId,
  emptyState,
  rowContextMenu,
  onContextMenuRow
}: DataGridTableProps<TData>) => {
  const rows = table.getRowModel().rows

  return (
    <Table
      className='table-fixed'
      style={{
        width: renderedTableWidth,
        minWidth: minWidth ?? renderedTableWidth
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
                      isSelectColumn && 'flex w-12 items-center justify-center',
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
                onContextMenu={() => onContextMenuRow(row)}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      'overflow-hidden py-3 align-middle',
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
                        cell.column.id === '__select' &&
                          'flex min-h-10 w-12 items-center justify-center overflow-visible',
                        cell.column.id === '__row_menu' && 'flex min-h-10 items-center justify-end overflow-visible'
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
}

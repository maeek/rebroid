import type { ReactNode, RefObject } from 'react'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { flexRender, type Row, type Table as ReactTable } from '@tanstack/react-table'
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { DataGridEmptyState } from './data-grid-empty-state'
import type {
  DataGridCellSkeleton,
  DataGridLoadingState,
  DataGridRowActivation,
  DataGridSelectionState
} from './data-grid'

type DataGridTableProps<TData> = {
  table: ReactTable<TData>
  tableContainerRef: RefObject<HTMLDivElement | null>
  renderedTableWidth: number
  minWidth?: string
  getColumnPixelWidth: (column: ReturnType<ReactTable<TData>['getVisibleLeafColumns']>[number]) => number
  lastVisibleColumnId?: string
  columnVisibilityMenu: ReactNode
  selection?: DataGridSelectionState
  getRowId: (row: TData) => string
  emptyState?: ReactNode
  rowContextMenu?: (row: Row<TData>) => ReactNode
  rowActivation?: DataGridRowActivation<TData>
  onContextMenuRow: (row: Row<TData>) => void
  loading?: DataGridLoadingState
}

const interactiveRowTargetSelector = [
  'a',
  'button',
  'input',
  'label',
  'select',
  'textarea',
  'summary',
  '[contenteditable="true"]',
  '[data-row-activation-ignore]',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="switch"]'
].join(',')

const isNestedInteractiveTarget = (target: EventTarget | null, row: HTMLTableRowElement) => {
  if (!(target instanceof Element) || target === row) return false
  const interactiveTarget = target.closest(interactiveRowTargetSelector)
  return interactiveTarget !== null && interactiveTarget !== row
}

const renderLoadingCell = (skeleton: DataGridCellSkeleton | undefined, rowIndex: number) => {
  if (skeleton?.kind === 'custom') return skeleton.render(rowIndex)
  if (skeleton?.kind === 'stacked') {
    return (
      <div className={cn('grid min-w-0', skeleton.gap ?? 'gap-1')}>
        <Skeleton className={cn(skeleton.primaryHeight ?? 'h-5', 'max-w-full', skeleton.primaryWidth ?? 'w-[78%]')} />
        <Skeleton
          className={cn(
            skeleton.secondaryHeight ?? 'h-4',
            'max-w-full opacity-70',
            skeleton.secondaryWidth ?? 'w-[42%]'
          )}
        />
      </div>
    )
  }
  if (skeleton?.kind === 'badge') {
    return <Skeleton className={cn('h-5 max-w-full rounded-full', skeleton.width ?? 'w-16')} />
  }
  return <Skeleton className={cn('h-4 max-w-full', skeleton?.width ?? 'w-[70%]')} />
}

export const DataGridTable = <TData,>({
  table,
  tableContainerRef,
  renderedTableWidth,
  minWidth,
  getColumnPixelWidth,
  lastVisibleColumnId,
  columnVisibilityMenu,
  selection,
  getRowId,
  emptyState,
  rowContextMenu,
  rowActivation,
  onContextMenuRow,
  loading
}: DataGridTableProps<TData>) => {
  const rows = table.getRowModel().rows
  const isEmpty = !loading && rows.length === 0

  return (
    <>
      <Table
        className='table-fixed'
        containerClassName={cn('overflow-x-auto overflow-y-hidden', !isEmpty && 'border-b border-surface-border/40')}
        containerRef={tableContainerRef}
        style={{
          width: renderedTableWidth,
          minWidth: minWidth ?? '100%'
        }}
      >
        <TableHeader className='bg-surface-editor [clip-path:inset(0_round_var(--shape-control))] [&_tr]:border-b-0'>
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
                const hasColumnVisibilityMenu =
                  header.column.id === lastVisibleColumnId && Boolean(columnVisibilityMenu)
                const widthPx = getColumnPixelWidth(header.column)
                const sortDirection = header.column.getIsSorted()
                let ariaSort: 'ascending' | 'descending' | 'none' | undefined
                if (canSort) ariaSort = 'none'
                if (sortDirection === 'asc') ariaSort = 'ascending'
                if (sortDirection === 'desc') ariaSort = 'descending'
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'relative overflow-hidden py-2 text-xs font-medium',
                      isSelectColumn || isSpacerColumn ? 'px-0' : isRowMenuColumn ? 'px-2' : 'px-4'
                    )}
                    aria-sort={ariaSort}
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
                          className='flex w-full min-w-0 items-center gap-1 rounded-control text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
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
                          'after:absolute after:right-1 after:top-1/2 after:h-5 after:w-px after:-translate-y-1/2 after:bg-transparent',
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
          {loading
            ? Array.from({ length: loading.rowCount ?? 6 }).map((_, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  aria-hidden='true'
                  data-testid='data-grid-skeleton-row'
                >
                  {table.getVisibleLeafColumns().map(column => {
                    const widthPx = getColumnPixelWidth(column)
                    const isSelectColumn = column.id === '__select'
                    const isSpacerColumn = column.id === '__spacer'
                    const isRowMenuColumn = column.id === '__row_menu'
                    return (
                      <TableCell
                        key={column.id}
                        className={cn(
                          'overflow-hidden py-2 align-middle',
                          isSelectColumn || isSpacerColumn ? 'px-0' : isRowMenuColumn ? 'px-2 text-center' : 'px-4'
                        )}
                        style={{ width: widthPx, maxWidth: widthPx }}
                      >
                        <div
                          className={cn(
                            'min-w-0 overflow-hidden',
                            isSelectColumn && 'flex min-h-10 w-12 items-center justify-center overflow-visible',
                            isRowMenuColumn && 'flex min-h-10 items-center justify-end overflow-visible'
                          )}
                        >
                          {isSpacerColumn ? null : isSelectColumn ? (
                            <Skeleton className='size-4 rounded-control' />
                          ) : isRowMenuColumn ? (
                            <Skeleton className='size-8 rounded-control' />
                          ) : (
                            renderLoadingCell(column.columnDef.meta?.skeleton, rowIndex)
                          )}
                        </div>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            : rows.map(row => {
                const rowContent = (
                  <TableRow
                    key={row.id}
                    aria-label={rowActivation?.getLabel(row.original)}
                    className={cn(
                      'transition-none hover:bg-surface-band/50',
                      '[clip-path:inset(0_round_var(--shape-control))]',
                      'data-[state=selected]:bg-primary/8',
                      'data-[state=selected]:hover:bg-primary/12 dark:data-[state=selected]:bg-primary/10',
                      'oled:data-[state=selected]:bg-primary/12 oled:data-[state=selected]:hover:bg-primary/16',
                      rowActivation &&
                        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
                    )}
                    data-state={selection?.selectedIds.has(getRowId(row.original)) ? 'selected' : undefined}
                    tabIndex={rowActivation ? 0 : undefined}
                    onClick={event => {
                      if (!rowActivation || isNestedInteractiveTarget(event.target, event.currentTarget)) return
                      rowActivation.onActivate(row.original)
                    }}
                    onContextMenu={() => onContextMenuRow(row)}
                    onKeyDown={event => {
                      if (!rowActivation || event.target !== event.currentTarget) return
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      rowActivation.onActivate(row.original)
                    }}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'overflow-hidden py-2 align-middle',
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
              })}
        </TableBody>
      </Table>
      {isEmpty ? <div className='border-b border-surface-border/40'>{emptyState ?? <DataGridEmptyState />}</div> : null}
    </>
  )
}

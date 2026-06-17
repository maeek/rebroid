import { Skeleton } from '@/components/ui/skeleton'
import type { ListColumn } from '@/shared/ui/skeletons/list-skeleton-types'

export type DataGridSkeletonProps = {
  columns: ListColumn[]
  minWidth?: string
  rows?: number
  selectable?: boolean
  rowMenu?: boolean
}

const renderCell = (column: ListColumn, index: number) => {
  if (column.kind === 'stacked') {
    return (
      <div
        key={index}
        className='grid min-w-0 overflow-hidden gap-2'
      >
        <Skeleton className='h-4 w-[78%] max-w-full' />
        <Skeleton className='h-3 w-[42%] max-w-full opacity-70' />
      </div>
    )
  }

  if (column.kind === 'badge') {
    return (
      <div
        key={index}
        className='flex min-w-0 items-center gap-2 overflow-hidden'
      >
        <Skeleton className='h-5 w-16 max-w-full rounded-full' />
      </div>
    )
  }

  if (column.kind === 'actions' || column.kind === 'action') {
    return (
      <div
        key={index}
        className='flex min-h-10 min-w-0 items-center justify-end gap-2 overflow-hidden'
      >
        <Skeleton className='h-9 w-20 max-w-full' />
      </div>
    )
  }

  return (
    <div
      key={index}
      className='min-w-0 overflow-hidden'
    >
      <Skeleton className={`h-4 max-w-full ${column.cellWidth ?? 'w-[70%]'}`} />
    </div>
  )
}

export const DataGridSkeleton = ({
  columns,
  minWidth = '64rem',
  rows = 6,
  selectable = true,
  rowMenu = true
}: DataGridSkeletonProps) => {
  const templateColumns = [
    ...(selectable ? ['3rem'] : []),
    ...columns.map(column => column.width ?? 'minmax(8rem,1fr)'),
    ...(rowMenu ? ['3rem'] : [])
  ].join(' ')

  return (
    <div
      className='grid gap-3'
      data-testid='data-grid-skeleton'
    >
      <div
        className='overflow-x-auto overflow-y-hidden rounded-xl border border-border/70 bg-surface-band/35'
        style={{ minWidth: 0 }}
      >
        <div
          className='w-max min-w-full'
          style={{ minWidth }}
        >
          <div
            className='grid items-center gap-3 bg-surface-band/55 px-4 py-3'
            style={{ gridTemplateColumns: templateColumns }}
          >
            {selectable ? (
              <div className='flex w-12 justify-center'>
                <Skeleton className='size-4 rounded-sm' />
              </div>
            ) : null}
            {columns.map((column, index) => (
              <div
                key={index}
                className={
                  column.kind === 'actions' || column.kind === 'action'
                    ? 'flex min-w-0 justify-end overflow-hidden'
                    : 'min-w-0 overflow-hidden'
                }
              >
                <Skeleton className={`h-3 max-w-full ${column.headerWidth}`} />
              </div>
            ))}
            {rowMenu ? (
              <div className='flex justify-end'>
                <Skeleton className='size-8 rounded-md' />
              </div>
            ) : null}
          </div>

          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className='grid min-h-16 items-center gap-3 border-t border-border/70 px-4 py-3'
              style={{ gridTemplateColumns: templateColumns }}
            >
              {selectable ? (
                <div className='flex w-12 justify-center'>
                  <Skeleton className='size-4 rounded-sm' />
                </div>
              ) : null}
              {columns.map(renderCell)}
              {rowMenu ? (
                <div className='flex min-h-10 items-center justify-end'>
                  <Skeleton className='size-9 rounded-md' />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

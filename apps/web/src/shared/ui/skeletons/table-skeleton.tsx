import { Skeleton } from '@/components/ui/skeleton'
import type { ListColumn } from './list-skeleton-types'

export const TableSkeleton = ({
  columns,
  minWidth = '64rem',
  rows = 6
}: {
  columns: ListColumn[]
  minWidth?: string
  rows?: number
}) => (
  <div className='overflow-hidden rounded-lg bg-background/20'>
    <div className='overflow-x-auto'>
      <div
        className='min-w-full'
        style={{ minWidth }}
      >
        <div
          className='grid items-center gap-3 bg-background/30 px-4 py-3'
          style={{ gridTemplateColumns: columns.map(column => column.width ?? 'minmax(8rem,1fr)').join(' ') }}
        >
          {columns.map((column, index) => (
            <div
              key={index}
              className={column.kind === 'actions' || column.kind === 'action' ? 'flex justify-end' : ''}
            >
              <Skeleton className={`h-3 ${column.headerWidth}`} />
            </div>
          ))}
        </div>

        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className='grid items-start gap-3 px-4 py-3'
            style={{ gridTemplateColumns: columns.map(column => column.width ?? 'minmax(8rem,1fr)').join(' ') }}
          >
            {columns.map((column, columnIndex) => {
              if (column.kind === 'stacked') {
                return (
                  <div
                    key={columnIndex}
                    className='flex min-w-0 flex-col gap-2'
                  >
                    <Skeleton className='h-4 w-[78%]' />
                    <Skeleton className='h-3 w-[42%] opacity-70' />
                  </div>
                )
              }

              if (column.kind === 'badge') {
                return (
                  <div
                    key={columnIndex}
                    className='flex items-center gap-2'
                  >
                    <Skeleton className='h-5 w-16 rounded-full' />
                  </div>
                )
              }

              if (column.kind === 'actions' || column.kind === 'action') {
                return (
                  <div
                    key={columnIndex}
                    className='flex justify-end gap-2'
                  >
                    <Skeleton className='h-9 w-9' />
                    <Skeleton className='h-9 w-20' />
                  </div>
                )
              }

              return (
                <div key={columnIndex}>
                  <Skeleton className={`h-4 ${column.cellWidth ?? 'w-[70%]'}`} />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  </div>
)

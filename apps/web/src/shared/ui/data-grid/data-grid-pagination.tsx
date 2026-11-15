'use client'

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

const defaultPageSizeOptions = [10, 20, 50, 100]

export function DataGridPagination({
  pageIndex,
  pageSize,
  pageSizeOptions = defaultPageSizeOptions,
  totalItems,
  itemLabels = { singular: 'result', plural: 'results' },
  onPageIndexChange,
  onPageSizeChange,
  loading = false
}: {
  pageIndex: number
  pageSize: number
  pageSizeOptions?: number[]
  totalItems: number
  itemLabels?: { singular: string; plural: string }
  onPageIndexChange: (pageIndex: number) => void
  /** Apply the size and return to the first page in the same update. */
  onPageSizeChange: (pageSize: number) => void
  loading?: boolean
}) {
  if (!loading && totalItems === 0) return null

  const pageCount = Math.max(Math.ceil(totalItems / pageSize), 1)
  const showNavigation = loading || pageCount > 1
  const showPageSize = loading || pageSizeOptions.some(size => size < totalItems)
  const firstItem = pageIndex * pageSize + 1
  const lastItem = Math.min((pageIndex + 1) * pageSize, totalItems)
  const summary =
    pageCount === 1
      ? `${totalItems} ${totalItems === 1 ? itemLabels.singular : itemLabels.plural}`
      : `${firstItem}–${lastItem} of ${totalItems}`

  return (
    <div
      aria-busy={loading || undefined}
      className='flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 py-1 text-xs tabular-nums text-foreground-muted sm:px-4'
    >
      <div className='flex min-h-8 items-center'>{loading ? <Skeleton className='h-5 w-16' /> : summary}</div>
      <div className='ml-auto flex min-h-9 items-center gap-1 empty:hidden sm:gap-3'>
        {showPageSize ? (
          <div className='flex items-center gap-2'>
            <span className='hidden sm:inline'>Rows per page</span>
            <Select
              disabled={loading}
              value={String(pageSize)}
              onValueChange={value => onPageSizeChange(Number(value))}
            >
              <SelectTrigger
                size='sm'
                aria-label='Rows per page'
                className='w-16 gap-1 px-2 sm:w-20 sm:px-3'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map(option => (
                  <SelectItem
                    key={option}
                    value={String(option)}
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {showNavigation ? (
          <div className='flex items-center sm:gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='icon-md'
              aria-label='Previous page'
              disabled={loading || pageIndex <= 0}
              onClick={() => onPageIndexChange(Math.max(pageIndex - 1, 0))}
            >
              <IconChevronLeft className='size-4' />
            </Button>
            <span className='sr-only sm:not-sr-only sm:flex sm:min-w-20 sm:justify-center'>
              {loading ? <Skeleton className='h-5 w-14' /> : `Page ${pageIndex + 1} of ${pageCount}`}
            </span>
            <Button
              type='button'
              variant='ghost'
              size='icon-md'
              aria-label='Next page'
              disabled={loading || pageIndex >= pageCount - 1}
              onClick={() => onPageIndexChange(Math.min(pageIndex + 1, pageCount - 1))}
            >
              <IconChevronRight className='size-4' />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

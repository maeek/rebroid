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
  onPageIndexChange,
  onPageSizeChange,
  loading = false
}: {
  pageIndex: number
  pageSize: number
  pageSizeOptions?: number[]
  totalItems: number
  onPageIndexChange: (pageIndex: number) => void
  /** Apply the size and return to the first page in the same update. */
  onPageSizeChange: (pageSize: number) => void
  loading?: boolean
}) {
  const pageCount = Math.max(Math.ceil(totalItems / pageSize), 1)
  const firstItem = totalItems === 0 ? 0 : pageIndex * pageSize + 1
  const lastItem = Math.min((pageIndex + 1) * pageSize, totalItems)

  return (
    <div
      aria-busy={loading || undefined}
      className='flex flex-wrap items-center justify-between gap-3 px-4 py-1 text-xs text-foreground-muted'
    >
      <div className='flex min-h-5 min-w-20 items-center'>
        {loading ? <Skeleton className='h-5 w-20' /> : `${firstItem}-${lastItem} of ${totalItems}`}
      </div>
      <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2'>
        <div className='flex items-center gap-2'>
          <span>Rows per page</span>
          <Select
            disabled={loading}
            value={String(pageSize)}
            onValueChange={value => onPageSizeChange(Number(value))}
          >
            <SelectTrigger
              size='sm'
              aria-label='Rows per page'
              className='w-20'
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
        <div className='flex items-center gap-2'>
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
          <span className='flex min-h-5 min-w-20 items-center justify-center text-center'>
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
      </div>
    </div>
  )
}

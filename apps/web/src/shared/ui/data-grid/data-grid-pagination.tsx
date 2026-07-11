'use client'

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const defaultPageSizeOptions = [10, 20, 50, 100]

export function DataGridPagination({
  pageIndex,
  pageSize,
  pageSizeOptions = defaultPageSizeOptions,
  totalItems,
  onPageIndexChange,
  onPageSizeChange
}: {
  pageIndex: number
  pageSize: number
  pageSizeOptions?: number[]
  totalItems: number
  onPageIndexChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
}) {
  const pageCount = Math.max(Math.ceil(totalItems / pageSize), 1)
  const firstItem = totalItems === 0 ? 0 : pageIndex * pageSize + 1
  const lastItem = Math.min((pageIndex + 1) * pageSize, totalItems)

  return (
    <div className='flex flex-wrap items-center justify-between gap-3 text-sm text-foreground-muted'>
      <div>
        {firstItem}-{lastItem} of {totalItems}
      </div>
      <div className='flex items-center gap-3'>
        <div className='flex items-center gap-2'>
          <span>Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={value => {
              onPageSizeChange(Number(value))
              onPageIndexChange(0)
            }}
          >
            <SelectTrigger
              size='sm'
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
            variant='secondary'
            size='icon-md'
            disabled={pageIndex <= 0}
            onClick={() => onPageIndexChange(Math.max(pageIndex - 1, 0))}
          >
            <IconChevronLeft className='size-4' />
          </Button>
          <span className='min-w-20 text-center'>
            {pageIndex + 1} / {pageCount}
          </span>
          <Button
            type='button'
            variant='secondary'
            size='icon-md'
            disabled={pageIndex >= pageCount - 1}
            onClick={() => onPageIndexChange(Math.min(pageIndex + 1, pageCount - 1))}
          >
            <IconChevronRight className='size-4' />
          </Button>
        </div>
      </div>
    </div>
  )
}

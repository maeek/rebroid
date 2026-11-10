'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SearchField } from '@/shared/ui/search-field'

export type DataGridToolbarProps = {
  search: string
  searchPlaceholder: string
  onSearchChange: (value: string) => void
  onSearchSubmit: (value: string) => void
  filterControl?: ReactNode
  searchActions?: ReactNode
  selectedCount?: number
  actions?: ReactNode
  disabled?: boolean
  layout?: 'spread' | 'compact'
}

export function DataGridToolbar({
  search,
  searchPlaceholder,
  onSearchChange,
  onSearchSubmit,
  filterControl,
  searchActions,
  selectedCount = 0,
  actions,
  disabled = false,
  layout = 'spread'
}: DataGridToolbarProps) {
  return (
    <div
      aria-busy={disabled || undefined}
      className={cn('flex flex-wrap items-end gap-x-4 gap-y-2', layout === 'spread' && 'justify-between')}
    >
      <fieldset
        className='contents'
        disabled={disabled}
      >
        <div className={cn('flex min-w-0 items-center gap-2', layout === 'spread' ? 'flex-1 basis-72' : 'w-full')}>
          <SearchField
            value={search}
            placeholder={searchPlaceholder}
            className={cn('min-w-0 max-w-lg flex-1', layout === 'compact' && 'sm:w-96 sm:flex-initial')}
            disabled={disabled}
            onValueChange={onSearchChange}
            onSearch={onSearchSubmit}
          />
          {filterControl}
          {searchActions}
        </div>
        <div className='flex max-w-full shrink-0 flex-wrap items-center gap-2 empty:hidden sm:justify-end sm:gap-3'>
          {selectedCount > 0 ? <span className='text-sm text-foreground-muted'>{selectedCount} selected</span> : null}
          {actions}
        </div>
      </fieldset>
    </div>
  )
}

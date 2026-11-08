'use client'

import { type ReactNode } from 'react'
import { SearchField } from '@/shared/ui/search-field'

export type DataGridToolbarProps = {
  search: string
  searchPlaceholder: string
  onSearchChange: (value: string) => void
  onSearchSubmit: (value: string) => void
  filterControl?: ReactNode
  selectedCount?: number
  actions?: ReactNode
  disabled?: boolean
}

export function DataGridToolbar({
  search,
  searchPlaceholder,
  onSearchChange,
  onSearchSubmit,
  filterControl,
  selectedCount = 0,
  actions,
  disabled = false
}: DataGridToolbarProps) {
  return (
    <div
      aria-busy={disabled || undefined}
      className='flex flex-wrap items-end justify-between gap-x-4 gap-y-2'
    >
      <fieldset
        className='contents'
        disabled={disabled}
      >
        <div className='flex min-w-0 flex-1 basis-72 items-center gap-2'>
          <SearchField
            value={search}
            placeholder={searchPlaceholder}
            className='min-w-0 max-w-lg flex-1'
            disabled={disabled}
            onValueChange={onSearchChange}
            onSearch={onSearchSubmit}
          />
          {filterControl}
        </div>
        <div className='flex max-w-full shrink-0 flex-wrap items-center justify-end gap-3 empty:hidden'>
          {selectedCount > 0 ? <span className='text-sm text-foreground-muted'>{selectedCount} selected</span> : null}
          {actions}
        </div>
      </fieldset>
    </div>
  )
}

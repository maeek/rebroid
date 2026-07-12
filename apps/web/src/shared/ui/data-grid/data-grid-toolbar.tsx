'use client'

import { type ReactNode } from 'react'
import { IconFilter } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { SearchField } from '@/shared/ui/search-field'

export type DataGridToolbarProps = {
  search: string
  searchPlaceholder: string
  onSearchChange: (value: string) => void
  onSearchSubmit: (value: string) => void
  onFiltersOpen?: () => void
  activeFilterCount?: number
  selectedCount?: number
  actions?: ReactNode
  disabled?: boolean
}

export function DataGridToolbar({
  search,
  searchPlaceholder,
  onSearchChange,
  onSearchSubmit,
  onFiltersOpen,
  activeFilterCount = 0,
  selectedCount = 0,
  actions,
  disabled = false
}: DataGridToolbarProps) {
  const filterButtonLabel = activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'

  return (
    <div
      aria-busy={disabled || undefined}
      className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'
    >
      <fieldset
        className='contents'
        disabled={disabled}
      >
        <div className='flex w-full flex-wrap items-end gap-2 lg:min-w-0 lg:flex-1'>
          <SearchField
            value={search}
            placeholder={searchPlaceholder}
            className='max-w-md'
            disabled={disabled}
            onValueChange={onSearchChange}
            onSearch={onSearchSubmit}
          />
          {onFiltersOpen ? (
            <Button
              type='button'
              variant='secondary'
              onClick={onFiltersOpen}
            >
              <IconFilter className='size-4' />
              {filterButtonLabel}
            </Button>
          ) : null}
        </div>
        <div className='flex min-h-9 shrink-0 flex-wrap items-center justify-end gap-3'>
          {selectedCount > 0 ? <span className='text-sm text-foreground-muted'>{selectedCount} selected</span> : null}
          {actions}
        </div>
      </fieldset>
    </div>
  )
}
